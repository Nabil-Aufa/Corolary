import { ethers } from 'ethers';
import { sql } from '../db/client.js';
import { submitter, ETH_CHAIN_KEY } from '../chain/providers.js';
import { loadAbi } from '../chain/abi.js';
import { requireContracts } from '../config.js';
import { stageLogger } from '../logger.js';
import { claimNextNonce, reconcileNonce } from './nonce.js';
import { classifySubmitError } from './errors.js';
import { proofBuilder } from '../prover/client.js';
import { splitToSingles, type BatchBundleJson, type SingleBundleJson } from '../prover/bundle.js';
import { nextRetryDelayMs } from '../prover/run.js';
import { persistReceipt } from './persist.js';

const log = stageLogger('submitter');

/**
 * Ambang peringatan ukuran batch, dalam byte `encodedTx` gabungan.
 *
 * 1,4x rekor produksi saat ini (282.208 byte) dan hanya ~40% dari anggaran yang
 * setara sepertiga batas gas blok CC3. Ini alarm, bukan penegakan.
 */
const BATCH_BYTE_WARN = 400_000;

const MAX_ATTEMPTS = 8;

let factRegistry: ethers.Contract | null = null;

export async function initSubmitter(): Promise<void> {
  const { factRegistry: address } = requireContracts();
  factRegistry = new ethers.Contract(address, loadAbi('FactRegistry'), submitter);
  const nonce = await reconcileNonce();
  const reclaimed = await reclaimOrphanedBatches();
  const requeued = await requeueOrphanedEvents();
  log.info(
    { submitter: submitter.address, nonce, factRegistry: address, reclaimed, requeued },
    'submitter siap',
  );
}

/**
 * Batch yang ditinggalkan dalam status `submitting`.
 *
 * `submitOnce` hanya memilih batch berstatus `ready`, jadi batch yang prosesnya
 * mati setelah ditandai `submitting` tidak akan pernah disentuh lagi — proof-nya
 * sudah dibayar dan hilang begitu saja. Terukur: satu batch tersangkut sejak
 * pukul 05:19 dan baru ketahuan empat jam kemudian, karena tidak ada gejala
 * apa pun selain antrean yang tidak pernah habis.
 *
 * Aman dikirim ulang: kalau transaksinya ternyata SUDAH masuk chain,
 * `_markProcessed` menolaknya dengan `QueryAlreadyProcessed`, yang
 * diklasifikasikan sebagai `skip` — bukan kegagalan.
 */
async function reclaimOrphanedBatches(): Promise<number> {
  const rows = await sql`
    UPDATE proof_batches
    SET status = 'ready', updated_at = now()
    WHERE status = 'submitting'
    RETURNING batch_id
  `;
  if (rows.count > 0) {
    log.warn({ batches: rows.count }, 'batch yatim dikembalikan ke antrean');
  }
  return rows.count;
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
      ORDER BY priority DESC, created_at ASC
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
  // Ukuran encodedTx-lah yang menentukan gas, BUKAN jumlah transaksi.
  //
  // Diregresi atas 476 batch produksi: `gas ≈ 47,4 × byte + 658.615` (R² 0,833).
  // Batas gas blok CC3 = 75.000.000, dan batch termahal yang pernah terjadi cuma
  // 12,77 juta (17%) pada 268.704 byte — jadi MAX_BATCH_SIZE = 10 sudah menjadi
  // pengaman yang memadai dan anggaran byte tidak ditegakkan (docs/open-issues.md T2).
  //
  // Yang TIDAK boleh terjadi adalah batas itu ditembus tanpa ada yang tahu. Ambang
  // di bawah ini 1,4x rekor saat ini dan masih jauh di bawah bahaya; ia ada supaya
  // kita diberi tahu SEBELUM rusak, bukan sesudah.
  const totalBytes = payload.encodedTransactions.reduce((n, t) => n + (t.length - 2) / 2, 0);
  if (totalBytes > BATCH_BYTE_WARN) {
    log.warn(
      { batchId, totalBytes, txCount: payload.heights.length, perkiraanGas: Math.round(47.4 * totalBytes + 658_615) },
      'batch jauh lebih besar dari apa pun yang pernah terukur — tinjau T2 sebelum menaikkan MAX_BATCH_SIZE',
    );
  }

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
    // JANGAN sekadar `releaseNonce`. Melepas nonce mengandaikan transaksinya
    // tidak pernah tersiar — dan pada RPC yang berkedip, andaian itu salah:
    // transaksi SUDAH masuk blok sementara RPC membalas error yang tidak bisa
    // diurai ("could not coalesce error"). Nonce yang dilepas lalu dipakai
    // ulang menghasilkan "nonce has already been used", berulang tanpa henti —
    // terukur 90 kali dalam setengah jam.
    //
    // Rekonsiliasi membaca kebenaran dari CHAIN, jadi ia menyembuhkan dua arah
    // sekaligus: lubang nonce (klaim yang tidak pernah tersiar) maupun nonce
    // yang telanjur terpakai.
    await reconcileNonce();
    const verdict = classifySubmitError(err, true);
    log.warn({ batchId, verdict: verdict.verdict, reason: verdict.reason }, 'submit batch gagal');

    // Proof kedaluwarsa TIDAK boleh dikirim ulang — isinya tidak akan pernah
    // cocok lagi. Batch dibubarkan dan anggotanya dikembalikan ke tahap
    // proving, supaya prover membeli proof BARU dan menyusun batch baru.
    // Biaya proof-nya memang terbayar dua kali; tidak ada jalan lain.
    if (verdict.verdict === 'staleProof') {
      await sql.begin(async (t) => {
        await t`
          UPDATE proof_batches
          SET status = 'stale', last_error = ${verdict.reason}, updated_at = now()
          WHERE batch_id = ${batchId}
        `;
        await t`
          UPDATE observed_events
          SET status = 'proving', batch_id = NULL, last_error = ${verdict.reason},
              attempts = attempts + 1, run_after = NULL
          WHERE batch_id = ${batchId} AND status = 'submitting'
        `;
      });
      log.warn({ batchId, reason: verdict.reason }, 'proof kedaluwarsa, dijadwalkan proving ulang');
      return;
    }

    // Sudah tercatat on-chain — bisa terjadi pada batch yatim yang transaksinya
    // ternyata berhasil. Bukan kegagalan; jangan diulang selamanya.
    if (verdict.verdict === 'skip') {
      await sql.begin(async (t) => {
        await t`
          UPDATE proof_batches SET status = 'done', last_error = ${verdict.reason},
                 updated_at = now()
          WHERE batch_id = ${batchId}
        `;
        await t`
          UPDATE observed_events SET status = 'recorded', last_error = ${verdict.reason}
          WHERE batch_id = ${batchId} AND status = 'submitting'
        `;
      });
      log.info({ batchId, reason: verdict.reason }, 'batch sudah tercatat sebelumnya');
      return;
    }

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
 * Event yang menggantung di belakang batch yang sudah tidak aktif.
 *
 * `reclaimOrphanedBatches` menyelamatkan BATCH-nya, tapi event bisa yatim
 * dengan cara lain: batch-nya ditandai `stale` atau `failed` sementara
 * event-nya tertinggal berstatus `submitting`. Tidak ada satu pun loop yang
 * memilih event dalam keadaan itu — mereka berhenti selamanya, dan satu-satunya
 * gejalanya adalah antrean yang tidak pernah benar-benar habis.
 *
 * Terukur 2026-08-25: 57 event tertinggal begini setelah pemulihan proof
 * kedaluwarsa. Dikembalikan ke `proving` supaya proof baru dibeli.
 */
async function requeueOrphanedEvents(): Promise<number> {
  const rows = await sql`
    UPDATE observed_events oe
    SET status = 'proving', batch_id = NULL, run_after = NULL,
        last_error = 'dipulihkan: batch induk tidak aktif lagi'
    WHERE oe.status = 'submitting'
      AND NOT EXISTS (
        SELECT 1 FROM proof_batches pb
        WHERE pb.batch_id = oe.batch_id AND pb.status IN ('ready', 'submitting')
      )
    RETURNING 1
  `;
  if (rows.count > 0) {
    log.warn({ events: rows.count }, 'event yatim dikembalikan ke antrean proving');
  }
  return rows.count;
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
    // JANGAN sekadar `releaseNonce`. Melepas nonce mengandaikan transaksinya
    // tidak pernah tersiar — dan pada RPC yang berkedip, andaian itu salah:
    // transaksi SUDAH masuk blok sementara RPC membalas error yang tidak bisa
    // diurai ("could not coalesce error"). Nonce yang dilepas lalu dipakai
    // ulang menghasilkan "nonce has already been used", berulang tanpa henti —
    // terukur 90 kali dalam setengah jam.
    //
    // Rekonsiliasi membaca kebenaran dari CHAIN, jadi ia menyembuhkan dua arah
    // sekaligus: lubang nonce (klaim yang tidak pernah tersiar) maupun nonce
    // yang telanjur terpakai.
    await reconcileNonce();
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
    // panggilan tunggal, dan proof yang kedaluwarsa pasti tidak. Keduanya
    // sembuh dengan cara yang sama: beli proof baru sekali, lalu coba lagi.
    if (
      (verdict.verdict === 'retryable' || verdict.verdict === 'staleProof') &&
      !isRetryWithFreshProof
    ) {
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
