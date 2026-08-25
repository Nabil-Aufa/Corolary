import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBatches, batchIdOf, MAX_BATCH_SIZE, MAX_BLOCK_SPAN, type ProvableTx } from './batching.js';

function tx(blockHeight: number, observedAt = blockHeight, priority = 0): ProvableTx {
  return { txHash: `0x${blockHeight.toString(16).padStart(64, '0')}`, blockHeight, txIndex: 0, observedAt, priority };
}

/**
 * Kedua batas di sini DITEGAKKAN KONTRAK. Melanggarnya tidak ketahuan di sisi
 * indexer — batch-nya lolos, proof-nya dibeli dan dibayar, lalu revert on-chain.
 * Biayanya sudah keluar sebelum kesalahannya terlihat.
 */

test('span TEPAT 1000 blok dipecah — kontrak menolak `span >= 1000`', () => {
  // Off-by-one yang sempat tertulis di docs/indexer.md §10.4 sebagai `span > 1000`.
  const batches = buildBatches([tx(1_000_000), tx(1_001_000)]);
  assert.equal(batches.length, 2, 'span 1000 harus dipecah, bukan diloloskan');
});

test('span 999 blok tetap satu batch', () => {
  const batches = buildBatches([tx(1_000_000), tx(1_000_999)]);
  assert.equal(batches.length, 1);
  assert.equal(MAX_BLOCK_SPAN, 999);
});

test('tidak ada batch yang melebihi MAX_BATCH_SIZE', () => {
  const txs = Array.from({ length: 25 }, (_, i) => tx(1_000_000 + i));
  const batches = buildBatches(txs);
  for (const b of batches) assert.ok(b.length <= MAX_BATCH_SIZE, `batch berisi ${b.length}`);
  assert.equal(batches.reduce((n, b) => n + b.length, 0), 25, 'tidak boleh ada tx yang hilang');
});

test('setiap batch memenuhi KEDUA batas sekaligus', () => {
  // Campuran rapat dan renggang: yang rapat menabrak batas jumlah, yang renggang
  // menabrak batas span. Keduanya harus ditegakkan bersamaan, bukan bergantian.
  const txs = [
    ...Array.from({ length: 15 }, (_, i) => tx(2_000_000 + i)),
    ...Array.from({ length: 5 }, (_, i) => tx(2_000_000 + i * 900)),
  ];
  for (const b of buildBatches(txs)) {
    const h = b.map((t) => t.blockHeight);
    assert.ok(b.length <= MAX_BATCH_SIZE);
    assert.ok(Math.max(...h) - Math.min(...h) <= MAX_BLOCK_SPAN);
  }
});

test('diurutkan dari yang TERTUA — proof < 24 jam ~12x lebih murah', () => {
  // FIFO insersi tidak menjamin ini setelah backlog, dan event yang mendekati
  // batas 24 jam harus selalu didahulukan di atas yang baru masuk.
  const batches = buildBatches([tx(500, 3_000), tx(400, 1_000), tx(450, 2_000)]);
  assert.equal(batches[0]?.[0]?.observedAt, 1_000);
});

test('input kosong menghasilkan nol batch, bukan satu batch kosong', () => {
  assert.deepEqual(buildBatches([]), []);
});

test('batchIdOf memakai tinggi min dan maks yang sebenarnya', () => {
  assert.equal(batchIdOf([tx(200), tx(100), tx(150)], 7), 'batch-100-200-7');
});

test('buildBatches tidak mengubah array masukan', () => {
  const txs = [tx(300, 3), tx(100, 1), tx(200, 2)];
  const before = txs.map((t) => t.blockHeight);
  buildBatches(txs);
  assert.deepEqual(txs.map((t) => t.blockHeight), before);
});
