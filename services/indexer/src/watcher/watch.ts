import { ethers } from 'ethers';
import type { TransactionSql } from 'postgres';
import { sql } from '../db/client.js';
import { ETH_CHAIN_KEY, ethGetLogs, ethCall } from '../chain/providers.js';
import { stageLogger } from '../logger.js';
import type { ProtocolWatchConfig } from './protocols.js';

const log = stageLogger('watcher');

/**
 * Watcher hanya memindai sampai tag `finalized`, bukan `latest`.
 *
 * Reorg dangkal dihindari secara DESAIN, bukan ditangani setelah terjadi: blok
 * yang belum finalized tidak pernah masuk observed_events, jadi tidak ada fakta
 * yang perlu ditarik kembali — dan menarik kembali fakta memang mustahil, karena
 * FactRegistry menyimpannya permanen.
 *
 * Ongkosnya: watcher tertinggal head ~12-19 menit (2 epoch). Itu ~1,3% dari
 * anggaran 24 jam eager-proving, jadi murah.
 */
const FINALIZED = 'finalized';

/** Batas bawah saat cursor belum ada: mulai dari masa lalu dekat, bukan genesis. */
const LIVE_START_LOOKBACK_BLOCKS = 300;

interface CursorRow {
  last_scanned_block: string;
}

/** Rentang efektif per protokol, dikecilkan saat RPC menolak/timeout. */
const effectiveChunk = new Map<string, number>();

function chunkFor(cfg: ProtocolWatchConfig): number {
  return effectiveChunk.get(cfg.name) ?? cfg.chunkSize;
}

/**
 * Provider menolak rentang lebar dengan pesan yang berbeda-beda dan tanpa kode
 * error yang stabil, jadi klasifikasinya terpaksa lewat teks. Salah menebak di
 * sini hanya membuat chunk mengecil tanpa perlu — aman ke arah itu.
 */
function isRangeComplaint(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('block range') ||
    msg.includes('more than 10000 results') ||
    msg.includes('query returned more than') ||
    msg.includes('response size') ||
    msg.includes('too large')
  );
}

async function readCursor(protocol: string): Promise<number | null> {
  const rows = await sql<CursorRow[]>`
    SELECT last_scanned_block FROM source_cursors
    WHERE chain_key = ${ETH_CHAIN_KEY} AND protocol = ${protocol}
  `;
  const row = rows[0];
  return row ? Number(row.last_scanned_block) : null;
}


/**
 * Satu-satunya jalur yang menulis ke `observed_events`.
 *
 * Watcher live dan backfill memakai fungsi yang sama persis — hanya bendera
 * `backfill` yang berbeda. Dua jalur insert terpisah akan menyimpang diam-diam
 * (bentuk `raw_log`, kolom yang diisi, aturan konflik), dan yang menyimpang
 * selalu jalur yang lebih jarang dipakai.
 */
export async function insertLogs(
  tx: TransactionSql<{ bigint: bigint }>,
  protocolAddress: string,
  logs: ethers.Log[],
  timestamps: Map<number, number>,
  backfill: boolean,
  priority = 0,
): Promise<number> {
  let inserted = 0;
  for (const l of logs) {
    const observedAt = timestamps.get(l.blockNumber);
    if (observedAt === undefined) continue; // blok hilang dari RPC; dipungut putaran berikutnya
    const rows = await tx`
      INSERT INTO observed_events ${tx({
        chain_key: ETH_CHAIN_KEY,
        block_height: l.blockNumber,
        tx_hash: l.transactionHash,
        tx_index: l.transactionIndex,
        log_index: l.index,
        topic0: l.topics[0] ?? '',
        protocol: protocolAddress,
        // JANGAN JSON.stringify di sini: postgres.js sudah menserialisasi
        // objek untuk kolom jsonb. Men-stringify lebih dulu menyimpannya
        // sebagai STRING JSON, bukan objek — jsonb_typeof mengembalikan
        // 'string' dan setiap operator -> mengembalikan NULL tanpa error.
        raw_log: sql.json({
          address: l.address,
          topics: l.topics,
          data: l.data,
          blockNumber: l.blockNumber,
          transactionHash: l.transactionHash,
          transactionIndex: l.transactionIndex,
          logIndex: l.index,
        }),
        status: 'pending',
        attempts: 0,
        backfill,
        priority,
        observed_at: observedAt,
      })}
      ON CONFLICT (chain_key, block_height, tx_index, log_index) DO NOTHING
      RETURNING 1 AS ok
    `;
    if (rows.length > 0) inserted++;
  }
  return inserted;
}

/**
 * Satu putaran pemindaian untuk satu protokol.
 *
 * Insert log dan pemajuan cursor terjadi dalam SATU transaksi Postgres. Kalau
 * proses mati di tengah, restart memindai ulang rentang yang sama — aman karena
 * observed_events_unique_log membuat insert kedua no-op. Tanpa transaksi ini,
 * cursor bisa maju sementara log belum masuk, dan event itu hilang selamanya.
 */
export async function watchOnce(cfg: ProtocolWatchConfig): Promise<void> {
  const head = await ethCall('getBlock', (p) => p.getBlock(FINALIZED));
  if (!head) return; // RPC belum siap; coba lagi di iterasi berikutnya

  const stored = await readCursor(cfg.address);
  const fromBlock =
    stored !== null ? stored + 1 : Math.max(0, head.number - LIVE_START_LOOKBACK_BLOCKS);

  if (fromBlock > head.number) return; // sudah mengejar finalized

  const size = chunkFor(cfg);
  const toBlock = Math.min(fromBlock + size - 1, head.number);

  let logs: ethers.Log[];
  const startedAt = Date.now();
  try {
    logs = await ethGetLogs({
      address: cfg.address,
      topics: [cfg.topics],
      fromBlock,
      toBlock,
    });
  } catch (err) {
    if (isRangeComplaint(err) && size > 1) {
      const shrunk = Math.max(1, Math.floor(size / 2));
      effectiveChunk.set(cfg.name, shrunk);
      log.warn(
        { protocol: cfg.name, from: size, to: shrunk, err: String(err) },
        'RPC menolak rentang, chunk dikecilkan',
      );
      return; // putaran berikutnya mencoba lagi dengan chunk lebih kecil
    }
    throw err;
  }

  // Timestamp diambil per blok unik, bukan per log: satu blok bisa memuat
  // puluhan log dan getBlock adalah panggilan RPC penuh.
  const timestamps = await blockTimestamps(new Set(logs.map((l) => l.blockNumber)));

  await sql.begin(async (tx) => {
    await insertLogs(tx, cfg.address, logs, timestamps, false);

    await tx`
      INSERT INTO source_cursors ${tx({
        chain_key: ETH_CHAIN_KEY,
        protocol: cfg.address,
        last_scanned_block: toBlock,
      })}
      ON CONFLICT (chain_key, protocol)
      DO UPDATE SET last_scanned_block = ${toBlock}, updated_at = now()
    `;
  });

  log.info(
    {
      protocol: cfg.name,
      fromBlock,
      toBlock,
      chunk: size,
      logs: logs.length,
      lagBlocks: head.number - toBlock,
      durationMs: Date.now() - startedAt,
    },
    'rentang dipindai',
  );
}

/**
 * Panggilan getBlock dibatasi paralel, bukan berurutan.
 *
 * Terukur: satu chunk Aave 500 blok berisi 321 log yang tersebar di ~300 blok
 * unik. Berurutan, itu 300 round-trip dan memakan 39,6 detik untuk satu chunk —
 * sementara Compound yang cuma punya 1 log selesai dalam 0,5 detik. Beban
 * sebenarnya ada di jumlah blok unik, bukan lebar rentangnya.
 *
 * Paralelismenya dibatasi: menembakkan 300 permintaan sekaligus adalah cara
 * tercepat kena rate limit, yang justru membuatnya lebih lambat lagi.
 */
const TIMESTAMP_CONCURRENCY = 12;

export async function blockTimestamps(heights: Set<number>): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const queue = [...heights];

  const workers = Array.from(
    { length: Math.min(TIMESTAMP_CONCURRENCY, queue.length) },
    async () => {
      for (;;) {
        const h = queue.pop();
        if (h === undefined) return;
        const block = await ethCall('getBlock', (p) => p.getBlock(h));
        if (block) out.set(h, block.timestamp);
      }
    },
  );

  await Promise.all(workers);
  return out;
}
