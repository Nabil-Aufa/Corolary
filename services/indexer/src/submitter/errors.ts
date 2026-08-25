import { ethers } from 'ethers';
import { loadAbi } from '../chain/abi.js';

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
  /** Selector 4-byte mentah, diisi justru ketika namanya TIDAK bisa didecode. */
  selector?: string;
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
  /** Payload revert mentah. ethers mengisinya walau namanya tak dikenal. */
  data?: unknown;
  info?: { error?: { data?: unknown } };
}

/**
 * Selector 4-byte dari revert yang TIDAK bisa dinamai.
 *
 * ethers membuang payload-nya dari pesan begitu selector tidak ada di ABI, dan
 * yang tersisa cuma "execution reverted (unknown custom error)" — kalimat yang
 * sama untuk sebab yang berbeda-beda. 49 event ditandai gagal permanen dengan
 * teks itu dan tidak ada satu pun petunjuk untuk melacaknya.
 *
 * Selector-nya sendiri selalu ada di `data`; ia cuma tidak pernah dibaca. Empat
 * byte ini yang membedakan "kontrak kita menolak" dari "precompile menolak" —
 * dan error precompile memang tidak akan pernah ada di ABI kita.
 */
function revertSelector(e: EthersLikeError): string | undefined {
  const raw = e.data ?? e.info?.error?.data;
  if (typeof raw !== 'string' || !raw.startsWith('0x') || raw.length < 10) return undefined;
  return raw.slice(0, 10);
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

/**
 * Selector -> nama, dibangun sendiri dari ABI FactRegistry.
 *
 * ethers TIDAK selalu menamai custom error walau error itu ada di ABI: kalau
 * revert-nya muncul lewat jalur yang tidak membawa konteks kontrak (estimateGas,
 * misalnya), yang sampai cuma `data` mentah dan pesan generik. Terukur:
 * `QueryAlreadyProcessed` — ada di ABI, ada di SKIP_ERRORS — tetap dilaporkan
 * sebagai "unknown custom error", sehingga 49 event yang seharusnya DILEWATI
 * (fakta memang sudah tercatat, kontrak menolak duplikat dengan benar) justru
 * ditandai gagal permanen.
 *
 * Mencocokkan selector sendiri membuat klasifikasi tidak lagi bergantung pada
 * jalur mana error itu kebetulan lewat.
 */
const errorNameBySelector: Map<string, string> = (() => {
  const map = new Map<string, string>();
  const iface = new ethers.Interface(loadAbi('FactRegistry'));
  iface.forEachError((frag) => map.set(frag.selector, frag.name));
  return map;
})();

export function classifySubmitError(err: unknown, isBatch: boolean): Classified {
  const e = (err ?? {}) as EthersLikeError;
  const selectorRaw = revertSelector(e);
  const revertName =
    e.revert?.name ?? (selectorRaw ? errorNameBySelector.get(selectorRaw) : undefined);
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

  // Revert yang tidak bisa dinamai TAPI selectornya terbaca. Bukan fatal:
  // sebabnya belum diketahui, dan menandainya permanen membuang buktinya.
  if (selectorRaw) {
    return {
      verdict: 'retryable',
      reason: `revert tak dikenal, selector ${selectorRaw}`,
      selector: selectorRaw,
    };
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
