import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySubmitError } from './errors.js';

/**
 * Klasifikasi error submit menentukan apakah sebuah event dicoba lagi, dilewati,
 * atau dikubur permanen. Tiap kasus di bawah pernah SALAH diklasifikasi di
 * produksi, dan tiap kesalahan itu senyap: antrean tetap jalan, log tetap hijau,
 * dan yang hilang cuma fakta yang seharusnya tercatat.
 */

/** Bentuk error ethers v6 pada CALL_EXCEPTION. */
function ethersError(o: Record<string, unknown>) {
  return { code: 'CALL_EXCEPTION', ...o };
}

test('Error(string) berisi pesan continuity -> staleProof, bukan fatal', () => {
  // Proof yang menganggur berhenti cocok dengan checkpoint. Ia harus DIBELI
  // ULANG, bukan dikirim ulang dan bukan dikubur. 21 batch pernah ditandai
  // gagal permanen karena `Error` dianggap "custom error tak dikenal".
  const v = classifySubmitError(
    ethersError({
      revert: { name: 'Error', args: ['Continuity proof does not match attestation or checkpoint'] },
    }),
    true,
  );
  assert.equal(v.verdict, 'staleProof');
});

test('Error(string) lain -> retryable, dan pesannya IKUT terbawa', () => {
  const v = classifySubmitError(
    ethersError({ revert: { name: 'Error', args: ['some transient thing'] } }),
    false,
  );
  assert.equal(v.verdict, 'retryable');
  assert.equal(v.reason, 'some transient thing');
});

test('QueryAlreadyProcessed -> skip walau ethers TIDAK bisa menamainya', () => {
  // Selector nyata, diukur 2026-08-25. ethers melaporkannya sebagai
  // "unknown custom error" karena revert-nya datang lewat jalur tanpa konteks
  // kontrak; 49 event dikubur permanen karena itu. Nama harus diresolusi dari
  // ABI sendiri, bukan diandalkan dari ethers.
  const v = classifySubmitError(ethersError({ data: '0x62e48a65' + '00'.repeat(32) }), false);
  assert.equal(v.verdict, 'skip');
  assert.equal(v.revertName, 'QueryAlreadyProcessed');
});

test('nama dari ethers dipakai kalau ada', () => {
  const v = classifySubmitError(ethersError({ revert: { name: 'SourceTransactionReverted' } }), false);
  assert.equal(v.verdict, 'skip');
});

test('selector betul-betul asing -> retryable DAN selectornya dicatat', () => {
  // Bukan fatal: sebabnya belum diketahui, dan mengubur event membuang
  // satu-satunya bukti yang tersisa untuk melacaknya.
  const v = classifySubmitError(ethersError({ data: '0xdeadbeef' + '00'.repeat(32) }), false);
  assert.equal(v.verdict, 'retryable');
  assert.equal(v.selector, '0xdeadbeef');
  assert.match(v.reason, /0xdeadbeef/);
});

test('ProofVerificationFailed: batch dipecah, transaksi tunggal tidak', () => {
  // Memecah sesuatu yang sudah tunggal itu mustahil; yang tersisa adalah
  // membeli proof baru.
  const batch = classifySubmitError(ethersError({ revert: { name: 'ProofVerificationFailed' } }), true);
  assert.equal(batch.verdict, 'splitBatch');
  const single = classifySubmitError(ethersError({ revert: { name: 'ProofVerificationFailed' } }), false);
  assert.equal(single.verdict, 'retryable');
});

test('saldo habis -> fatal, karena retry tidak akan pernah menyembuhkannya', () => {
  const v = classifySubmitError({ shortMessage: 'insufficient funds for intrinsic transaction cost' }, false);
  assert.equal(v.verdict, 'fatal');
});

test('nonce dan gangguan jaringan -> retryable', () => {
  assert.equal(classifySubmitError({ shortMessage: 'nonce too low' }, false).verdict, 'retryable');
  assert.equal(classifySubmitError({ shortMessage: 'nonce has already been used' }, false).verdict, 'retryable');
  assert.equal(classifySubmitError({ message: 'ETIMEDOUT' }, false).verdict, 'retryable');
});

test('revert tanpa nama pada BATCH -> dipecah', () => {
  const v = classifySubmitError({ shortMessage: 'execution reverted' }, true);
  assert.equal(v.verdict, 'splitBatch');
});

test('error kosong tidak melempar', () => {
  assert.equal(classifySubmitError(undefined, false).verdict, 'retryable');
  assert.equal(classifySubmitError(null, true).verdict, 'retryable');
});
