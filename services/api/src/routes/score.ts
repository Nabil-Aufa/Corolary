import { Hono } from 'hono';
import { sql } from '../lib/db.js';
import { ok } from '../lib/envelope.js';
import { parseAddress, parseLimit } from '../lib/validate.js';
import { toComponents, type StoredComponent } from '../lib/mappers.js';
import { creditGraph, creditcoin } from '../lib/chain.js';
import { FactKind } from '@corolary/shared';
import type { Address, CreditScore, Hex, ScoreComponentKey, ScoreHistoryPoint, Tier } from '@corolary/shared';

export const score = new Hono();

/**
 * Bukti pendukung per komponen: fakta jenis mana yang menggerakkan angka itu.
 * `historyDuration` sengaja kosong — ia turunan dari waktu, bukan dari sekumpulan
 * fakta tertentu, dan mengarang daftar bukti untuknya akan menyesatkan.
 */
const EVIDENCE_KINDS: Record<ScoreComponentKey, number[]> = {
  repaymentVolume: [FactKind.LoanRepaid],
  repaymentCount: [FactKind.LoanRepaid],
  historyDuration: [],
  liquidationPenalty: [FactKind.Liquidated],
  protocolDiversity: [FactKind.LoanOriginated, FactKind.LoanRepaid],
  activeStanding: [FactKind.LoanRepaid, FactKind.CollateralSupplied],
};

interface ScoreRow {
  subject: string;
  score: number;
  tier: number;
  ratio_bps: number;
  components: StoredComponent[];
  fact_count: number;
  first_fact_at: string | null;
  last_fact_at: string | null;
  computed_at: string;
  onchain_block: string;
}

score.get('/score/:address', async (c) => {
  const subject = parseAddress(c.req.param('address'));

  const rows = await sql<ScoreRow[]>`SELECT * FROM scores WHERE subject = ${subject}`;
  const row = rows[0];

  // Alamat tanpa riwayat BUKAN 404. Setiap alamat mulai dari nol, bukan dari
  // ketiadaan — dan frontend tidak perlu menulis dua jalur render (docs/api.md §6).
  if (!row) {
    const empty: CreditScore = {
      subject: subject as Address,
      score: 0,
      tier: 0,
      collateralRatioBps: Number(await creditGraph.getFunction('collateralRatioBpsOf')(subject)),
      components: [],
      factCount: 0,
      firstFactAt: null,
      lastFactAt: null,
      computedAt: Math.floor(Date.now() / 1000),
      onChainBlock: await creditcoin.getBlockNumber(),
    };
    return ok(c, empty);
  }

  const evidence = new Map<ScoreComponentKey, { count: number; ids: Hex[] }>();
  for (const [key, kinds] of Object.entries(EVIDENCE_KINDS) as [ScoreComponentKey, number[]][]) {
    if (kinds.length === 0) {
      evidence.set(key, { count: 0, ids: [] });
      continue;
    }
    const idRows = await sql<{ fact_id: string }[]>`
      SELECT fact_id FROM facts
      WHERE subject = ${subject} AND kind = ANY(${kinds})
      ORDER BY block_height DESC LIMIT 10
    `;
    const countRows = await sql<{ n: string }[]>`
      SELECT count(*) AS n FROM facts WHERE subject = ${subject} AND kind = ANY(${kinds})
    `;
    evidence.set(key, {
      count: Number(countRows[0]?.n ?? 0),
      ids: idRows.map((r) => r.fact_id as Hex),
    });
  }

  const data: CreditScore = {
    subject: row.subject as Address,
    score: row.score,
    tier: row.tier as Tier,
    collateralRatioBps: row.ratio_bps,
    components: toComponents(row.components, evidence),
    factCount: row.fact_count,
    firstFactAt: row.first_fact_at === null ? null : Number(row.first_fact_at),
    lastFactAt: row.last_fact_at === null ? null : Number(row.last_fact_at),
    computedAt: Number(row.computed_at),
    onChainBlock: Number(row.onchain_block),
  };
  return ok(c, data);
});

score.get('/score/:address/history', async (c) => {
  const subject = parseAddress(c.req.param('address'));
  const limit = parseLimit(c.req.query()['limit'], 50, 200);

  // `docs/api.md` §7 menjanjikan titik data menaik, dan `limit` titik
  // TERBARU — bukan tertua. Dua tuntutan itu tidak bisa dipenuhi satu
  // `ORDER BY at_block ASC LIMIT n` biasa: itu akan mengembalikan `limit`
  // titik TERTUA, diam-diam mengubah arti endpointnya (grafik tren akan
  // berhenti di masa lalu, bukan menunjukkan kondisi terkini). Jadi ambil
  // `limit` titik terbaru dulu (subquery DESC), baru urutkan hasilnya menaik
  // di luar.
  const rows = await sql<
    { subject: string; score: number; tier: number; at_block: string; at_time: string }[]
  >`
    SELECT * FROM (
      SELECT subject, score, tier, at_block, at_time FROM score_history
      WHERE subject = ${subject}
      ORDER BY at_block DESC LIMIT ${limit}
    ) latest
    ORDER BY at_block ASC
  `;

  const data: ScoreHistoryPoint[] = rows.map((r) => ({
    subject: r.subject as Address,
    score: r.score,
    tier: r.tier as Tier,
    atBlock: Number(r.at_block),
    atTime: Number(r.at_time),
  }));

  return ok(c, data, { total: data.length });
});
