import { sql } from '../db/client.js';
import { ETH_CHAIN_KEY } from '../chain/providers.js';
import { stageLogger } from '../logger.js';
import { proofBuilder } from './client.js';
import { buildBatches, batchIdOf, type ProvableTx } from './batching.js';
import { buildBatchBundle, singleAsBatchBundle, type BatchBundleJson } from './bundle.js';

const log = stageLogger('prover');

/** Transaksi kandidat yang ditarik per putaran (10 batch penuh). */
const CANDIDATE_LIMIT = 100;

interface TxRow {
  block_height: string;
  tx_index: number;
  tx_hash: string;
  observed_at: string;
  is_backfill: boolean;
  priority: number;
}

/**
 * Satuan kerja prover adalah TRANSAKSI, bukan log.
 *
 * recordFact memanen seluruh log yang relevan dari satu receipt sekali jalan,
 * dan _markProcessed mengunci per (chainKey, blockHeight, txIndex). Jadi satu
 * transaksi hanya boleh dikirim SEKALI seumur hidup — mengirim per log akan
 * membuat log kedua dari transaksi yang sama revert dengan QueryAlreadyProcessed
 * setelah proof-nya dibayar.
 */
async function claimCandidates(): Promise<ProvableTx[]> {
  // Event BACKFILL diurutkan paling belakang, bukan paling depan.
  //
  // Urutan `observed_at ASC` sendirian benar selama hanya ada lalu lintas live:
  // yang tertua paling dekat ke tebing 24 jam, jadi ia harus didahulukan.
  // Begitu backfill masuk, aturan yang sama berbalik jadi merusak — event
  // backfill berumur BULANAN, jadi ia selalu menyalip, dan antrean backfill
  // yang panjang akan mendorong event segar melewati 24 jam. Ongkosnya nyata:
  // yang segar naik 12x lipat, sementara yang backfill sudah kena tarif itu
  // dan tidak rugi apa pun kalau menunggu.
  //
  // `bool_or` karena pengelompokannya per transaksi: satu transaksi yang punya
  // log backfill dan log live diperlakukan sebagai live.
  const rows = await sql<TxRow[]>`
    SELECT block_height, tx_index, min(tx_hash) AS tx_hash, min(observed_at) AS observed_at,
           bool_or(backfill) AS is_backfill, max(priority) AS priority
    FROM observed_events
    WHERE chain_key = ${ETH_CHAIN_KEY}
      AND status = 'proving'
      AND (run_after IS NULL OR run_after <= now())
    GROUP BY block_height, tx_index
    ORDER BY max(priority) DESC, bool_or(backfill) ASC, min(observed_at) ASC
    LIMIT ${CANDIDATE_LIMIT}
  `;

  return rows.map((r) => ({
    txHash: r.tx_hash,
    blockHeight: Number(r.block_height),
    txIndex: r.tx_index,
    observedAt: Number(r.observed_at),
    priority: Number(r.priority ?? 0),
  }));
}

export async function proveOnce(): Promise<void> {
  const candidates = await claimCandidates();
  if (candidates.length === 0) return;

  const batches = buildBatches(candidates);

  for (const [seq, batch] of batches.entries()) {
    const batchId = batchIdOf(batch, seq);
    const startedAt = Date.now();

    let result;
    try {
      result = await proofBuilder.getBatchProof(batch.map((t) => t.txHash));
    } catch (err) {
      if (await fallbackToSingles(batch, `prover error: ${String(err)}`)) continue;
      await deferBatch(batch, `prover error: ${String(err)}`);
      log.warn({ batchId, err: String(err) }, 'panggilan prover gagal, dijadwalkan ulang');
      continue;
    }

    if (!result.success || !result.data) {
      // Endpoint batch menolak sebagian rentang blok lama dengan HTTP 500 dalam
      // ~300 ms, sementara endpoint TUNGGAL melayani transaksi yang sama dengan
      // sukses. Tanpa jalur mundur ini, tahap proving memvonis gagal permanen
      // sesuatu yang sebenarnya bisa dibuktikan — dan itu menghukum backfill
      // secara khusus, karena backfill seluruhnya blok lama.
      if (await fallbackToSingles(batch, result.error ?? 'batch ditolak')) continue;
      await deferBatch(batch, `prover menolak: ${result.error ?? 'tanpa alasan'}`);
      log.warn({ batchId, error: result.error }, 'prover mengembalikan success=false');
      continue;
    }

    let payload;
    try {
      payload = buildBatchBundle(ETH_CHAIN_KEY, batch, result.data);
    } catch (err) {
      // Ketidakcocokan bentuk respons adalah bug/kontrak API berubah, bukan
      // gangguan sementara. Retry tidak akan memperbaikinya.
      await failBatch(batch, `pemetaan bundle gagal: ${String(err)}`);
      log.error({ batchId, err: String(err) }, 'respons prover tidak bisa dipetakan');
      continue;
    }

    const heights = payload.heights;
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO proof_batches ${tx({
          batch_id: batchId,
          chain_key: ETH_CHAIN_KEY,
          min_height: Math.min(...heights),
          max_height: Math.max(...heights),
          tx_count: heights.length,
          // Batch mewarisi prioritas TERTINGGI anggotanya. Tanpa ini prioritas
          // hilang begitu event masuk batch, dan submitter kembali FIFO.
          priority: Math.max(...batch.map((t) => t.priority)),
          payload: sql.json(payload as unknown as Parameters<typeof sql.json>[0]),
          status: 'ready',
        })}
        ON CONFLICT (batch_id) DO NOTHING
      `;

      for (const member of batch) {
        await tx`
          UPDATE observed_events
          SET status = 'submitting', batch_id = ${batchId}, run_after = NULL, last_error = NULL
          WHERE chain_key = ${ETH_CHAIN_KEY}
            AND block_height = ${member.blockHeight}
            AND tx_index = ${member.txIndex}
            AND status = 'proving'
        `;
      }
    });

    const oldest = Math.min(...batch.map((t) => t.observedAt));
    log.info(
      {
        batchId,
        batchSize: batch.length,
        blockSpan: Math.max(...heights) - Math.min(...heights),
        ageSeconds: Math.floor(Date.now() / 1000) - oldest,
        durationMs: Date.now() - startedAt,
      },
      'proof batch didapat',
    );
  }
}


/**
 * Jalur mundur tahap PROVING: beli proof satu per satu.
 *
 * Padanan `splitToSingles` di submitter, yang selama ini tidak punya pasangan di
 * sisi prover — sehingga satu penolakan endpoint batch menjatuhkan seluruh
 * anggotanya secara permanen.
 *
 * Lebih mahal: setiap transaksi membayar continuity proof-nya sendiri alih-alih
 * berbagi satu. Itu sebabnya ini jalur MUNDUR, bukan jalur utama.
 *
 * @returns true kalau seluruh anggota berhasil ditangani di sini
 */
async function fallbackToSingles(batch: ProvableTx[], reason: string): Promise<boolean> {
  if (batch.length === 1) return false; // sudah tunggal; tidak ada yang bisa dipecah

  let stored = 0;
  for (const [i, member] of batch.entries()) {
    let single;
    try {
      single = await proofBuilder.getProof(member.txHash);
    } catch {
      continue;
    }
    if (!single.success || !single.data) continue;

    const payload: BatchBundleJson = singleAsBatchBundle(ETH_CHAIN_KEY, member, single.data);
    const singleId = `single-${member.blockHeight}-${member.txIndex}-${i}`;

    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO proof_batches ${tx({
          batch_id: singleId,
          chain_key: ETH_CHAIN_KEY,
          min_height: member.blockHeight,
          max_height: member.blockHeight,
          tx_count: 1,
          priority: member.priority,
          payload: sql.json(payload as unknown as Parameters<typeof sql.json>[0]),
          status: 'ready',
        })}
        ON CONFLICT (batch_id) DO NOTHING
      `;
      await tx`
        UPDATE observed_events
        SET status = 'submitting', batch_id = ${singleId}, run_after = NULL, last_error = NULL
        WHERE chain_key = ${ETH_CHAIN_KEY}
          AND block_height = ${member.blockHeight}
          AND tx_index = ${member.txIndex}
          AND status = 'proving'
      `;
    });
    stored++;
  }

  if (stored > 0) {
    log.warn(
      { batchSize: batch.length, stored, reason },
      'endpoint batch menolak; proof dibeli satu per satu',
    );
  }
  // Sebagian berhasil sudah cukup untuk melanjutkan: sisanya tetap berstatus
  // proving dan dipungut putaran berikutnya.
  return stored > 0;
}

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 8;

/** Full jitter, dijadwalkan di DB supaya selamat dari restart proses. */
export function nextRetryDelayMs(attempts: number): number {
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
  // check-no-mocks: allow jitter retry — mengacak JADWAL, bukan angka yang ditampilkan
  return Math.round(exp * (0.5 + Math.random() * 0.5));
}

async function deferBatch(batch: ProvableTx[], reason: string): Promise<void> {
  for (const m of batch) {
    await sql`
      UPDATE observed_events
      SET attempts = attempts + 1,
          last_error = ${reason},
          status = CASE WHEN attempts + 1 >= ${MAX_ATTEMPTS} THEN 'failed' ELSE status END,
          run_after = now() + make_interval(secs => ${nextRetryDelayMs(1) / 1000})
      WHERE chain_key = ${ETH_CHAIN_KEY}
        AND block_height = ${m.blockHeight}
        AND tx_index = ${m.txIndex}
        AND status = 'proving'
    `;
  }
}

async function failBatch(batch: ProvableTx[], reason: string): Promise<void> {
  for (const m of batch) {
    await sql`
      UPDATE observed_events
      SET status = 'failed', last_error = ${reason}
      WHERE chain_key = ${ETH_CHAIN_KEY}
        AND block_height = ${m.blockHeight}
        AND tx_index = ${m.txIndex}
        AND status = 'proving'
    `;
  }
}
