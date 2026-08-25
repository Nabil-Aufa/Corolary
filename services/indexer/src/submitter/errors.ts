/**
 * Klasifikasi error submit.
 *
 * Pemisahnya bukan "seberapa parah", tapi "apakah mengulang bisa mengubah
 * hasilnya":
 *   retryable    -> kegagalan sementara di infrastruktur
 *   skip         -> hasil sudah pasti dan BENAR (tx sumber revert, duplikat)
 *   fatal        -> butuh manusia (dompet kosong, bug, alamat salah)
 *   splitBatch   -> batch gagal utuh, coba anggotanya satu per satu
 *   staleProof   -> proof-nya kedaluwarsa; harus dibeli ULANG, bukan dikirim ulang
 *
 * `skip` bukan kegagalan. Ia berarti sistem menolak sesuatu yang memang
 * seharusnya ditolak, dan mencampurnya dengan `fatal` membuat dashboard tidak
 * bisa membedakan "semua normal" dari "butuh perhatian sekarang".
 */
export type SubmitVerdict = 'retryable' | 'skip' | 'fatal' | 'splitBatch' | 'staleProof';

export interface Classified {
  verdict: SubmitVerdict;
  reason: string;
  /** Nama custom error Solidity, kalau berhasil didecode. */
  revertName?: string;
}

/** Custom error yang berarti fakta sudah tercatat / memang tidak layak dicatat. */
const SKIP_ERRORS = new Set([
  'QueryAlreadyProcessed',
  'SourceTransactionReverted',
  'UnsupportedTransactionType',
  'InvalidSubject',
]);

/** Custom error yang menandakan proof atau susunan batch bermasalah. */
const SPLIT_ERRORS = new Set([
  'ProofVerificationFailed',
  'BatchTooLarge',
  'BatchBlockRangeExceeded',
  'BatchLengthMismatch',
  'BatchEmpty',
]);

const FATAL_ERRORS = new Set(['ChainKeyNotAllowed', 'TxIndexOutOfRange']);

interface EthersLikeError {
  revert?: { name?: string; args?: unknown[] } | null;
  shortMessage?: string;
  message?: string;
  code?: string;
}

/**
 * Revert string yang berarti proof-nya KEDALUWARSA, bukan salah.
 *
 * Precompile menganggarkan continuity proof pada checkpoint tertentu. Checkpoint
 * Creditcoin terus maju, jadi proof yang menganggur cukup lama berhenti cocok —
 * meski isinya tidak pernah salah dan sudah dibayar.
 *
 * Ini menyanggah asumsi di docs/indexer.md §14 bahwa proof yang sudah dibayar
 * "selamat dari restart". Ia selamat dari restart yang CEPAT. Terukur: 21 batch
 * yang menganggur ~45 menit sementara submitter mati semuanya revert dengan
 * pesan ini.
 */
const STALE_PROOF_MESSAGES = [
  'continuity proof does not match',
  'checkpoint',
];

export function classifySubmitError(err: unknown, isBatch: boolean): Classified {
  const e = (err ?? {}) as EthersLikeError;
  const revertName = e.revert?.name;
  const text = (e.shortMessage ?? e.message ?? String(err)).toLowerCase();

  // `Error(string)` adalah revert BERPESAN standar Solidity, bukan custom error
  // tak dikenal. Namanya selalu 'Error'; yang membawa informasi adalah args[0].
  // Memperlakukannya sebagai "tak dikenal -> fatal" membuang satu-satunya
  // petunjuk yang ada, dan menandai batch gagal permanen tanpa sebab tercatat.
  if (revertName === 'Error') {
    const reason = String(e.revert?.args?.[0] ?? '').trim();
    const lower = reason.toLowerCase();
    if (STALE_PROOF_MESSAGES.some((m) => lower.includes(m))) {
      return { verdict: 'staleProof', reason: reason || 'continuity proof kedaluwarsa', revertName };
    }
    // Revert berpesan lain: sementara sampai terbukti sebaliknya, dan PESANNYA
    // ikut dibawa supaya tidak hilang seperti sebelumnya.
    return { verdict: 'retryable', reason: reason || 'revert tanpa pesan', revertName };
  }

  if (revertName) {
    if (SKIP_ERRORS.has(revertName)) {
      return { verdict: 'skip', reason: revertName, revertName };
    }
    if (FATAL_ERRORS.has(revertName)) {
      return { verdict: 'fatal', reason: revertName, revertName };
    }
    if (SPLIT_ERRORS.has(revertName)) {
      return {
        // Batch dipecah; kalau ini SUDAH transaksi tunggal, memecahnya lagi
        // tidak mungkin, jadi proof-nya yang harus dibeli ulang.
        verdict: isBatch ? 'splitBatch' : 'retryable',
        reason: revertName,
        revertName,
      };
    }
    return { verdict: 'fatal', reason: `custom error tak dikenal: ${revertName}`, revertName };
  }

  // Dompet kosong tidak akan pernah membaik dengan sendirinya. Retry hanya
  // membakar antrean dan menyembunyikan penyebab sebenarnya.
  if (text.includes('insufficient funds')) {
    return { verdict: 'fatal', reason: 'saldo CTC submitter habis — perlu top-up manual' };
  }
  if (text.includes('nonce too low') || text.includes('already known')) {
    return { verdict: 'retryable', reason: 'nonce perlu direkonsiliasi' };
  }
  if (text.includes('replacement transaction underpriced') || text.includes('underpriced')) {
    return { verdict: 'retryable', reason: 'gas price terlalu rendah' };
  }
  if (
    text.includes('timeout') ||
    text.includes('econnreset') ||
    text.includes('etimedout') ||
    text.includes('network') ||
    text.includes('server error') ||
    text.includes('429')
  ) {
    return { verdict: 'retryable', reason: 'gangguan jaringan/RPC' };
  }

  // Revert tanpa nama yang bisa didecode, pada batch, paling mungkin berasal
  // dari satu anggota yang buruk. Memecahnya mengubah satu kegagalan gelap
  // menjadi beberapa kegagalan yang bisa dijelaskan satu per satu.
  if (isBatch && (text.includes('revert') || text.includes('call_exception'))) {
    return { verdict: 'splitBatch', reason: 'revert batch tanpa nama, dipecah' };
  }

  return { verdict: 'retryable', reason: e.shortMessage ?? String(err) };
}
