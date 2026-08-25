/**
 * Pembentukan batch proof.
 *
 * Dua batas datang dari precompile, dan keduanya DITEGAKKAN OLEH KONTRAK kita
 * di AttestcoinReader._verifyBatch:
 *
 *   n > MAX_BATCH_SIZE              -> revert BatchTooLarge
 *   span >= MAX_BATCH_BLOCK_RANGE   -> revert BatchBlockRangeExceeded
 *
 * Perhatikan `>=` pada span: rentang tepat 1000 blok DITOLAK, jadi span maksimum
 * yang aman adalah 999. docs/indexer.md §10.4 menulis `span > 1000` dan itu
 * off-by-one — batch dengan span tepat 1000 akan lolos pemeriksaan dokumen lalu
 * revert on-chain setelah proof-nya dibayar.
 */
export const MAX_BATCH_SIZE = 10;
export const MAX_BLOCK_SPAN = 999;

export interface ProvableTx {
  txHash: string;
  blockHeight: number;
  txIndex: number;
  observedAt: number;
}

/**
 * Greedy, diurutkan dari yang TERTUA (observed_at ASC).
 *
 * Urutan ini bukan preferensi gaya: proof < 24 jam ~12x lebih murah, jadi event
 * yang mendekati batas itu harus selalu didahulukan di atas event yang baru
 * masuk. FIFO insersi tidak menjamin itu setelah backlog.
 */
export function buildBatches(txs: ProvableTx[]): ProvableTx[][] {
  const sorted = [...txs].sort((a, b) =>
    a.observedAt !== b.observedAt ? a.observedAt - b.observedAt : a.blockHeight - b.blockHeight,
  );

  const batches: ProvableTx[][] = [];
  let current: ProvableTx[] = [];
  let min = 0;
  let max = 0;

  for (const tx of sorted) {
    if (current.length === 0) {
      current = [tx];
      min = tx.blockHeight;
      max = tx.blockHeight;
      continue;
    }

    const nextMin = Math.min(min, tx.blockHeight);
    const nextMax = Math.max(max, tx.blockHeight);

    if (current.length < MAX_BATCH_SIZE && nextMax - nextMin <= MAX_BLOCK_SPAN) {
      current.push(tx);
      min = nextMin;
      max = nextMax;
    } else {
      batches.push(current);
      current = [tx];
      min = tx.blockHeight;
      max = tx.blockHeight;
    }
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

/** `batch-{minHeight}-{maxHeight}-{seq}` (docs/indexer.md §5.2). */
export function batchIdOf(batch: ProvableTx[], seq: number): string {
  const heights = batch.map((t) => t.blockHeight);
  return `batch-${Math.min(...heights)}-${Math.max(...heights)}-${seq}`;
}
