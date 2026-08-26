import { sql } from '../db/client.js';
import { ETH_CHAIN_KEY, ethCall } from '../chain/providers.js';
import { PROTOCOLS } from '../watcher/protocols.js';
import { stageLogger } from '../logger.js';

const log = stageLogger('prover');

/**
 * Menjalankan permintaan proving eksplisit dari `POST /v1/prove`.
 *
 * Tugasnya hanya MEMASUKKAN transaksi itu ke pipeline yang sudah ada, bukan
 * membuat jalur kedua: ia menulis baris `observed_events` seperti watcher, lalu
 * tahap attestation/prover/submitter memperlakukannya sama persis. Jalur proving
 * kedua berarti dua tempat yang harus sama-sama benar soal dedup dan biaya.
 */
const WATCHED = new Map(
  PROTOCOLS.map((p) => [p.address.toLowerCase(), new Set(p.topics.map((t) => t.toLowerCase()))]),
);

interface JobRow {
  id: string;
  payload: { txHash: string; chainKey: number };
  attempts: number;
}

export async function runEagerProveJobs(): Promise<void> {
  const rows = await sql<JobRow[]>`
    UPDATE jobs SET status = 'proving', updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE kind = 'eager_prove' AND status = 'pending'
        AND (run_after IS NULL OR run_after <= now())
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id, payload, attempts
  `;
  const job = rows[0];
  if (!job) return;

  const { txHash } = job.payload;

  try {
    const receipt = await ethCall('getTransactionReceipt', (p) => p.getTransactionReceipt(txHash));
    if (!receipt) {
      await finish(job.id, 'failed', `transaksi ${txHash} tidak ditemukan di Ethereum`);
      return;
    }
    if (receipt.status !== 1) {
      // Sesuai Gerbang 2 di kontrak: transaksi sumber yang revert tidak boleh
      // menghasilkan fakta. Ditolak di sini supaya biaya proof tidak terbuang.
      await finish(job.id, 'skipped', 'transaksi sumber revert di Ethereum');
      return;
    }

    const block = await ethCall('getBlock', (p) => p.getBlock(receipt.blockNumber));
    if (!block) {
      await requeue(job, 'blok belum tersedia di RPC');
      return;
    }

    let inserted = 0;
    for (const l of receipt.logs) {
      const topics = WATCHED.get(l.address.toLowerCase());
      if (!topics) continue;
      const topic0 = l.topics[0]?.toLowerCase();
      if (!topic0 || !topics.has(topic0)) continue;

      const res = await sql`
        INSERT INTO observed_events ${sql({
          chain_key: ETH_CHAIN_KEY,
          block_height: l.blockNumber,
          tx_hash: l.transactionHash,
          tx_index: l.transactionIndex,
          log_index: l.index,
          topic0,
          protocol: l.address,
          raw_log: sql.json({
            address: l.address, topics: l.topics, data: l.data,
            blockNumber: l.blockNumber, transactionHash: l.transactionHash,
            transactionIndex: l.transactionIndex, logIndex: l.index,
          }),
          status: 'pending',
          attempts: 0,
          observed_at: block.timestamp,
        })}
        ON CONFLICT (chain_key, block_height, tx_index, log_index) DO NOTHING
      `;
      inserted += res.count;
    }

    if (inserted === 0) {
      // Nol baris baru berarti tidak ada log yang relevan, ATAU transaksinya
      // sudah dipungut watcher. Keduanya sukses, bukan kegagalan.
      await finish(job.id, 'skipped', 'tidak ada log baru dari protokol terdaftar');
      log.info({ jobId: job.id, txHash }, 'job proving: tidak ada yang perlu ditambahkan');
      return;
    }

    await finish(job.id, 'submitting', null);
    log.info({ jobId: job.id, txHash, events: inserted }, 'job proving masuk pipeline');
  } catch (err) {
    await requeue(job, String(err));
  }
}

async function finish(id: string, status: string, error: string | null): Promise<void> {
  await sql`
    UPDATE jobs SET status = ${status}, last_error = ${error}, updated_at = now()
    WHERE id = ${id}
  `;
}

const MAX_ATTEMPTS = 5;

async function requeue(job: JobRow, reason: string): Promise<void> {
  const attempts = job.attempts + 1;
  await sql`
    UPDATE jobs
    SET status = ${attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'},
        attempts = ${attempts}, last_error = ${reason},
        run_after = now() + make_interval(secs => ${Math.min(300, 2 ** attempts)}),
        updated_at = now()
    WHERE id = ${job.id}
  `;
  log.warn({ jobId: job.id, attempts, reason }, 'job proving dijadwalkan ulang');
}
