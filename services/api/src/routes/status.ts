import { Hono } from 'hono';
import { sql } from '../lib/db.js';
import { ok } from '../lib/envelope.js';
import { config, VERSION, STARTED_AT } from '../config.js';
import { creditcoin, chainInfoProvider } from '../lib/chain.js';
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
  };
  return ok(c, data);
});
