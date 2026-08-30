import { Hono } from 'hono';
import { sql } from '../lib/db.js';
import { ok } from '../lib/envelope.js';
import { config, VERSION, STARTED_AT } from '../config.js';
import { creditcoin, chainInfoProvider, priceRegistry } from '../lib/chain.js';
import { protocolName } from '../lib/protocols.js';
import type { Address, ChainStatus, HealthStatus, IndexerStatus } from '@corolary/shared';

export const status = new Hono();

status.get('/health', async (c) => {
  // "degraded", bukan 503: API tetap melayani data yang sudah ada di mirror
  // meski Postgres sedang bermasalah untuk penulisan. Frontend butuh tahu
  // bedanya "mati" dan "data mungkin basi".
  let dbOk = true;
  try {
    await sql`SELECT 1`;
  } catch {
    dbOk = false;
  }

  const data: HealthStatus = {
    status: dbOk ? 'ok' : 'degraded',
    version: VERSION,
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
    timestamp: Math.floor(Date.now() / 1000),
  };
  return ok(c, data);
});

/**
 * Precompile mengembalikan nama chain sebagai byte terenkode hex
 * ("0x457468657265756d"), bukan string siap tampil. Meneruskannya apa adanya
 * membuat UI menampilkan hex sebagai nama jaringan.
 */
function decodeChainName(raw: string): string {
  if (!raw.startsWith('0x')) return raw;
  const text = Buffer.from(raw.slice(2), 'hex').toString('utf8').replace(/\0+$/, '');
  return /^[\x20-\x7e]+$/.test(text) ? text : raw;
}

status.get('/chains', async (c) => {
  const chains = await chainInfoProvider.getSupportedChains();

  const data: ChainStatus[] = [];
  for (const ch of chains) {
    const key = Number(ch.chainKey);
    const latestAttested = await chainInfoProvider.getLatestAttestedHeightAndHash(key);
    const height = latestAttested.exists ? latestAttested.height : 0;
    const genesis = await chainInfoProvider.getAttestationGenesisHeight(key);

    // `latestHeight` hanya diketahui untuk chain yang benar-benar kita pantau;
    // untuk chain lain, tinggi ter-attest adalah satu-satunya angka yang jujur.
    const isSource = key === config.ETHEREUM_CHAIN_KEY;
    const latest = isSource ? await latestEthereumBlock() : height;

    data.push({
      chainKey: key,
      chainId: ch.chainId,
      name: decodeChainName(ch.chainName),
      encoding: ch.chainEncoding,
      isSourceForFacts: isSource,
      latestHeight: latest,
      attestedHeight: height,
      checkpointHeight: height,
      lagBlocks: Math.max(0, latest - height),
      lagSeconds: Math.max(0, latest - height) * 12,
      genesisHeight: genesis,
    });
  }
  return ok(c, data, { total: data.length });
});

async function latestEthereumBlock(): Promise<number> {
  const rows = await sql<{ b: string | null }[]>`
    SELECT max(last_scanned_block) AS b FROM source_cursors WHERE chain_key = ${config.ETHEREUM_CHAIN_KEY}
  `;
  return Number(rows[0]?.b ?? 0);
}

status.get('/indexer/status', async (c) => {
  const cursors = await sql<
    { protocol: string; last_scanned_block: string; updated_at: Date }[]
  >`
    SELECT protocol, last_scanned_block, updated_at FROM source_cursors
    WHERE chain_key = ${config.ETHEREUM_CHAIN_KEY} ORDER BY protocol
  `;

  const queueRows = await sql<{ status: string; n: string }[]>`
    SELECT status, count(*) AS n FROM observed_events
    WHERE chain_key = ${config.ETHEREUM_CHAIN_KEY} GROUP BY status
  `;
  const q = Object.fromEntries(queueRows.map((r) => [r.status, Number(r.n)]));

  const dayAgo = Math.floor(Date.now() / 1000) - 86_400;
  const recent = await sql<{ status: string; n: string }[]>`
    SELECT status, count(*) AS n FROM observed_events
    WHERE chain_key = ${config.ETHEREUM_CHAIN_KEY}
      AND status IN ('recorded','skipped') AND observed_at >= ${dayAgo}
    GROUP BY status
  `;
  const r24 = Object.fromEntries(recent.map((x) => [x.status, Number(x.n)]));

  // Metrik operasional paling penting di seluruh sistem: melewati 86400 detik
  // berarti biaya proof melonjak ~12x. Event backfill dikecualikan — umurnya
  // memang selalu di atas ambang by design, dan memasukkannya membuat alert
  // menyala terus sehingga berhenti dibaca.
  const oldest = await sql<{ oldest: string | null }[]>`
    SELECT min(observed_at) AS oldest FROM observed_events
    WHERE chain_key = ${config.ETHEREUM_CHAIN_KEY} AND backfill = false
      AND status NOT IN ('recorded','skipped','failed')
  `;
  const oldestAt = oldest[0]?.oldest;

  const attestedInfo = await chainInfoProvider.getLatestAttestedHeightAndHash(
    config.ETHEREUM_CHAIN_KEY,
  );
  const attested = attestedInfo.exists ? attestedInfo.height : 0;

  const latest = await latestEthereumBlock();

  const totals = await sql<{ total_facts: string; distinct_subjects: string }[]>`
    SELECT count(*)::text AS total_facts, count(DISTINCT subject)::text AS distinct_subjects
    FROM facts
  `;
  const totalFacts = Number(totals[0]?.total_facts ?? 0);
  const distinctSubjects = Number(totals[0]?.distinct_subjects ?? 0);

  const onChainPriceAgeSeconds = await maxOnChainPriceAgeSeconds();

  const data: IndexerStatus = {
    chainKey: config.ETHEREUM_CHAIN_KEY,
    latestEthereumBlock: latest,
    attestedHeight: attested,
    lagBlocks: Math.max(0, latest - attested),
    cursors: cursors.map((cur) => ({
      protocol: cur.protocol as Address,
      protocolName: protocolName(cur.protocol),
      lastScannedBlock: Number(cur.last_scanned_block),
      updatedAt: Math.floor(new Date(cur.updated_at).getTime() / 1000),
    })),
    queue: {
      pending: q['pending'] ?? 0,
      awaitingAttestation: q['awaiting_attestation'] ?? 0,
      proving: q['proving'] ?? 0,
      submitting: q['submitting'] ?? 0,
      recorded24h: r24['recorded'] ?? 0,
      failed: q['failed'] ?? 0,
      skipped24h: r24['skipped'] ?? 0,
    },
    oldestUnprovenAgeSeconds: oldestAt
      ? Math.max(0, Math.floor(Date.now() / 1000) - Number(oldestAt))
      : 0,
    totalFacts,
    distinctSubjects,
    onChainPriceAgeSeconds,
  };
  return ok(c, data);
});

/**
 * Aset kanonik yang dipantau harga-nya, dan alamatnya di Ethereum mainnet —
 * sama seperti yang dipetakan `PriceRegistry.setPriceAlias` untuk token
 * testnet (tUSDC/tWETH memakai harga mainnet WETH/USDC yang benar-benar
 * dibuktikan; lihat CLAUDE.md).
 */
const CANONICAL_PRICE_ASSETS = [
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
] as const;

/**
 * Umur harga terbesar di antara aset kanonik, dibaca LANGSUNG dari
 * `PriceRegistry` on-chain — bukan dari mirror Postgres `prices`.
 *
 * Kenapa ini penting ada sejarahnya: `/v1/market/reserves` pernah menampilkan
 * `priceUsd` yang sehat dari tabel `prices` padahal registry on-chain masih
 * `roundId 0` dan setiap operasi pasar akan revert — mirror-nya jujur tentang
 * apa yang PERNAH ditulis loop harga, bukan tentang apa yang benar-benar ada
 * di kontrak sekarang. Angka ini adalah pengecekan silang yang tidak bisa
 * dibohongi oleh mirror yang basi.
 *
 * `roundId == 0` berarti registry BENAR-BENAR kosong untuk aset itu (belum
 * pernah ditulis sama sekali) — dikecualikan dari perhitungan umur, bukan
 * dihitung sebagai umur tak-terhingga.
 *
 * Kegagalan RPC per-aset tidak menjatuhkan seluruh endpoint: dikembalikan
 * `null` dan dicatat, karena field ini tambahan diagnostik, bukan jalur kritis
 * `/v1/indexer/status`.
 */
async function maxOnChainPriceAgeSeconds(): Promise<number | null> {
  let maxAge: number | null = null;
  const now = Math.floor(Date.now() / 1000);

  for (const asset of CANONICAL_PRICE_ASSETS) {
    try {
      const p = (await priceRegistry.getFunction('priceDataOf')(asset)) as {
        roundId: bigint;
        updatedAt: bigint;
      };
      if (p.roundId === 0n) continue; // registry kosong untuk aset ini
      const age = Math.max(0, now - Number(p.updatedAt));
      if (maxAge === null || age > maxAge) maxAge = age;
    } catch (err) {
      console.error(`priceDataOf(${asset}) gagal, dilewati:`, err);
    }
  }

  return maxAge;
}
