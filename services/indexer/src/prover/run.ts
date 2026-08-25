import { sql } from '../db/client.js';
import { ETH_CHAIN_KEY } from '../chain/providers.js';
import { stageLogger } from '../logger.js';
import { proofBuilder } from './client.js';
import { buildBatches, batchIdOf, type ProvableTx } from './batching.js';
import { buildBatchBundle } from './bundle.js';

const log = stageLogger('prover');

/** Transaksi kandidat yang ditarik per putaran (10 batch penuh). */
const CANDIDATE_LIMIT = 100;

interface TxRow {
  block_height: string;
  tx_index: number;
  tx_hash: string;
  observed_at: string;
  is_backfill: boolean;
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
           bool_or(backfill) AS is_backfill
    FROM observed_events
    WHERE chain_key = ${ETH_CHAIN_KEY}
      AND status = 'proving'
      AND (run_after IS NULL OR run_after <= now())
    GROUP BY block_height, tx_index
    ORDER BY bool_or(backfill) ASC, min(observed_at) ASC
    LIMIT ${CANDIDATE_LIMIT}
  `;

  return rows.map((r) => ({
    txHash: r.tx_hash,
    blockHeight: Number(r.block_height),
    txIndex: r.tx_index,
    observedAt: Number(r.observed_at),
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
      await deferBatch(batch, `prover error: ${String(err)}`);
      log.warn({ batchId, err: String(err) }, 'panggilan prover gagal, dijadwalkan ulang');
      continue;
    }

    if (!result.success || !result.data) {
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
