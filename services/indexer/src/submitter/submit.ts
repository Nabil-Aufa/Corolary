import { ethers } from 'ethers';
import { sql } from '../db/client.js';
import { submitter, ETH_CHAIN_KEY } from '../chain/providers.js';
import { loadAbi } from '../chain/abi.js';
import { requireContracts } from '../config.js';
import { stageLogger } from '../logger.js';
import { claimNextNonce, releaseNonce, reconcileNonce } from './nonce.js';
import { classifySubmitError } from './errors.js';
import { proofBuilder } from '../prover/client.js';
import { splitToSingles, type BatchBundleJson, type SingleBundleJson } from '../prover/bundle.js';
import { nextRetryDelayMs } from '../prover/run.js';
import { persistReceipt } from './persist.js';

const log = stageLogger('submitter');

const MAX_ATTEMPTS = 8;

let factRegistry: ethers.Contract | null = null;

export async function initSubmitter(): Promise<void> {
  const { factRegistry: address } = requireContracts();
  factRegistry = new ethers.Contract(address, loadAbi('FactRegistry'), submitter);
  const nonce = await reconcileNonce();
  log.info({ submitter: submitter.address, nonce, factRegistry: address }, 'submitter siap');
}

function registry(): ethers.Contract {
  if (!factRegistry) throw new Error('initSubmitter() belum dipanggil');
  return factRegistry;
}

interface BatchRow {
  batch_id: string;
  payload: BatchBundleJson;
  attempts: number;
}

export async function submitOnce(): Promise<void> {
  const rows = await sql<BatchRow[]>`
    UPDATE proof_batches
    SET status = 'submitting', updated_at = now()
    WHERE batch_id = (
      SELECT batch_id FROM proof_batches
      WHERE status = 'ready' AND (run_after IS NULL OR run_after <= now())
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING batch_id, payload, attempts
  `;

  const row = rows[0];
  if (!row) return;

  await submitBatch(row);
}

async function submitBatch(row: BatchRow): Promise<void> {
  const { batch_id: batchId, payload } = row;
  const startedAt = Date.now();
  const nonce = await claimNextNonce();

  try {
    const tx = await registry().getFunction('recordFactBatch')(
      {
        chainKey: payload.chainKey,
        heights: payload.heights,
        merkleProofs: payload.merkleProofs,
        sharedContinuityProof: payload.sharedContinuityProof,
      },
      payload.encodedTransactions,
      payload.observedAts,
      { nonce },
    );

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`recordFactBatch revert on-chain: ${tx.hash}`);
    }

    await sql.begin(async (t) => {
      await t`
        UPDATE proof_batches
        SET status = 'done', tx_hash = ${tx.hash}, updated_at = now()
        WHERE batch_id = ${batchId}
      `;
      await t`
        UPDATE observed_events
        SET status = 'recorded', last_error = NULL
        WHERE batch_id = ${batchId} AND status = 'submitting'
      `;
    });

    // Mirror dibangun SETELAH status ditandai, dan kegagalannya tidak boleh
    // membatalkan pencatatan: faktanya sudah permanen di chain. Mirror yang
    // tertinggal bisa dibangun ulang dari chain; status yang salah tidak.
    try {
      const facts = await persistReceipt(receipt, batchId);
      log.info({ batchId, facts }, 'fakta disalin ke mirror');
    } catch (err) {
      log.error({ batchId, err: String(err) }, 'gagal menyalin fakta ke mirror');
    }

    log.info(
      {
        batchId,
        txHash: tx.hash,
        batchSize: payload.heights.length,
        gasUsed: receipt.gasUsed?.toString(),
        durationMs: Date.now() - startedAt,
      },
      'batch tercatat',
    );
  } catch (err) {
    await releaseNonce(nonce);
    const verdict = classifySubmitError(err, true);
    log.warn({ batchId, verdict: verdict.verdict, reason: verdict.reason }, 'submit batch gagal');

    if (verdict.verdict === 'splitBatch') {
      await sql`
        UPDATE proof_batches
        SET status = 'split', last_error = ${verdict.reason}, updated_at = now()
        WHERE batch_id = ${batchId}
      `;
      await submitSingles(batchId, payload);
      return;
    }

    if (verdict.verdict === 'fatal' || row.attempts + 1 >= MAX_ATTEMPTS) {
      await sql`
        UPDATE proof_batches
        SET status = 'failed', attempts = attempts + 1,
            last_error = ${verdict.reason}, updated_at = now()
        WHERE batch_id = ${batchId}
      `;
      await sql`
        UPDATE observed_events
        SET status = 'failed', last_error = ${verdict.reason}
        WHERE batch_id = ${batchId} AND status = 'submitting'
      `;
      return;
    }

    // Retryable: kembalikan ke antrean dengan backoff. Nonce sudah dilepas,
    // jadi percobaan berikutnya tidak meninggalkan lubang di urutan nonce.
    await sql`
      UPDATE proof_batches
      SET status = 'ready', attempts = attempts + 1, last_error = ${verdict.reason},
          run_after = now() + make_interval(secs => ${nextRetryDelayMs(row.attempts) / 1000}),
          updated_at = now()
      WHERE batch_id = ${batchId}
    `;
  }
}

/**
 * Fallback per-transaksi.
 *
 * Precompile mengembalikan satu bool untuk seluruh batch, jadi satu proof buruk
 * atau satu transaksi sumber yang revert menjatuhkan sembilan yang sehat.
 * Tanpa jalur ini, satu transaksi Aave yang gagal akan memblokir sembilan
 * transaksi valid secara permanen.
 */
async function submitSingles(batchId: string, payload: BatchBundleJson): Promise<void> {
  for (const single of splitToSingles(payload)) {
    await submitSingle(batchId, single, false);
  }
}

async function submitSingle(
  batchId: string,
  bundle: SingleBundleJson,
  isRetryWithFreshProof: boolean,
): Promise<void> {
  const nonce = await claimNextNonce();
  try {
    const tx = await registry().getFunction('recordFact')(
      {
        chainKey: bundle.chainKey,
        blockHeight: bundle.blockHeight,
        merkleRoot: bundle.merkleRoot,
        siblings: bundle.siblings,
        lowerEndpointDigest: bundle.lowerEndpointDigest,
        continuityRoots: bundle.continuityRoots,
      },
      bundle.encodedTransaction,
      bundle.observedAt,
      { nonce },
    );

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`recordFact revert on-chain: ${tx.hash}`);
    }

    await markTx(bundle, 'recorded', null);
    try {
      await persistReceipt(receipt, batchId);
    } catch (err) {
      log.error({ sourceTx: bundle.txHash, err: String(err) }, 'gagal menyalin fakta ke mirror');
    }
    log.info({ batchId, txHash: tx.hash, sourceTx: bundle.txHash }, 'fakta tercatat (tunggal)');
  } catch (err) {
    await releaseNonce(nonce);
    const verdict = classifySubmitError(err, false);

    if (verdict.verdict === 'skip') {
      await markTx(bundle, 'skipped', verdict.reason);
      log.info(
        { batchId, sourceTx: bundle.txHash, reason: verdict.reason },
        'transaksi dilewati (bukan error)',
      );
      return;
    }

    // Proof yang dipakai ulang dari batch mungkin memang tidak sah untuk
    // panggilan tunggal. Beli proof tunggal sekali, lalu coba lagi.
    if (verdict.verdict === 'retryable' && !isRetryWithFreshProof) {
      const fresh = await freshSingleBundle(bundle);
      if (fresh) {
        await submitSingle(batchId, fresh, true);
        return;
      }
    }

    if (verdict.verdict === 'fatal' || isRetryWithFreshProof) {
      await markTx(bundle, 'failed', verdict.reason);
      log.error({ batchId, sourceTx: bundle.txHash, reason: verdict.reason }, 'transaksi gagal');
      return;
    }

    await markTx(bundle, 'proving', verdict.reason);
  }
}

/** Membeli proof tunggal baru untuk satu transaksi. */
async function freshSingleBundle(bundle: SingleBundleJson): Promise<SingleBundleJson | null> {
  try {
    const result = await proofBuilder.getProof(bundle.txHash);
    if (!result.success || !result.data) return null;
    const d = result.data;
    return {
      chainKey: bundle.chainKey,
      blockHeight: d.headerNumber,
      merkleRoot: d.merkleProof.root,
      siblings: d.merkleProof.siblings.map((s) => ({ hash: s.hash, isLeft: s.isLeft })),
      lowerEndpointDigest: d.continuityProof.lowerEndpointDigest,
      continuityRoots: d.continuityProof.roots,
      encodedTransaction: d.txBytes,
      observedAt: bundle.observedAt,
      txHash: bundle.txHash,
    };
  } catch (err) {
    log.warn({ sourceTx: bundle.txHash, err: String(err) }, 'gagal membeli proof tunggal');
    return null;
  }
}

async function markTx(
  bundle: SingleBundleJson,
  status: 'recorded' | 'skipped' | 'failed' | 'proving',
  reason: string | null,
): Promise<void> {
  await sql`
    UPDATE observed_events
    SET status = ${status}, last_error = ${reason}
    WHERE chain_key = ${ETH_CHAIN_KEY}
      AND block_height = ${bundle.blockHeight}
      AND tx_index = (
        SELECT tx_index FROM observed_events
        WHERE chain_key = ${ETH_CHAIN_KEY} AND tx_hash = ${bundle.txHash}
        LIMIT 1
      )
      AND status = 'submitting'
  `;
}
