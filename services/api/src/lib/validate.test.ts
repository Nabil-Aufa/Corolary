import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddress, parseHash32, parseLimit, encodeCursor, decodeCursor } from './validate.js';
import { ApiFailure } from './envelope.js';

/**
 * Batas masukan API. Semua yang dikirim frontend lewat sini, dan kegagalan di
 * lapis ini punya bentuk yang sama: permintaannya SUKSES, jawabannya kosong.
 * Tidak ada exception yang bisa dilacak — cuma pengguna yang melihat "tidak ada
 * riwayat" untuk dompet yang sebenarnya punya ratusan fakta.
 */

function failsWith(code: string, fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ApiFailure, `dilempar ${String(e)}, bukan ApiFailure`);
    assert.equal(e.code, code);
    return;
  }
  assert.fail('seharusnya melempar');
}

test('alamat lowercase dinormalkan ke checksum', () => {
  // Jebakan senyap: DB menyimpan alamat checksum-case. Meneruskan lowercase
  // apa adanya membuat setiap query tidak menemukan apa pun TANPA error —
  // 200 OK dengan daftar kosong, yang terbaca sebagai "dompet ini tidak punya
  // riwayat" alih-alih sebagai bug.
  assert.equal(
    parseAddress('0x94963b928498be7f06637c3d57ea1e74d7f73423'),
    '0x94963B928498bE7f06637C3D57ea1E74D7f73423',
  );
});

test('alamat yang sudah checksum tidak berubah', () => {
  const a = '0x94963B928498bE7f06637C3D57ea1E74D7f73423';
  assert.equal(parseAddress(a), a);
});

test('alamat cacat ditolak sebagai INVALID_ADDRESS, bukan INVALID_PARAM', () => {
  // Kode terpisah karena UI menanganinya berbeda: sorot kolom input.
  failsWith('INVALID_ADDRESS', () => parseAddress('0x123'));
  failsWith('INVALID_ADDRESS', () => parseAddress(undefined));
  failsWith('INVALID_ADDRESS', () => parseAddress('bukan alamat'));
  failsWith('INVALID_ADDRESS', () => parseAddress('0x' + 'z'.repeat(40)));
});

test('hash 32 byte di-lowercase-kan; panjang salah ditolak', () => {
  const h = '0x' + 'AB'.repeat(32);
  assert.equal(parseHash32(h, 'txHash'), h.toLowerCase());
  failsWith('INVALID_PARAM', () => parseHash32('0xabc', 'txHash'));
  failsWith('INVALID_PARAM', () => parseHash32(undefined, 'txHash'));
  // 31 byte: cukup mirip untuk lolos pemeriksaan yang ceroboh.
  failsWith('INVALID_PARAM', () => parseHash32('0x' + 'ab'.repeat(31), 'txHash'));
});

test('limit di atas maksimum DITOLAK, bukan dipangkas diam-diam', () => {
  // Memangkas diam-diam membuat klien mengira ia menerima 1000 item padahal 100,
  // lalu berhenti paginasi karena mengira sudah habis.
  assert.equal(parseLimit(undefined), 20);
  assert.equal(parseLimit('100'), 100);
  failsWith('INVALID_PARAM', () => parseLimit('101'));
  failsWith('INVALID_PARAM', () => parseLimit('0'));
  failsWith('INVALID_PARAM', () => parseLimit('-5'));
  failsWith('INVALID_PARAM', () => parseLimit('1.5'));
  failsWith('INVALID_PARAM', () => parseLimit('abc'));
});

test('cursor bolak-balik utuh', () => {
  const c = { blockHeight: 25_829_643, txIndex: 85, logIndex: 4 };
  assert.deepEqual(decodeCursor(encodeCursor(c)), c);
});

test('cursor tanpa nilai berarti halaman pertama, bukan error', () => {
  assert.equal(decodeCursor(undefined), null);
  assert.equal(decodeCursor(''), null);
});

test('cursor karangan atau terpotong ditolak, bukan diam-diam jadi halaman 1', () => {
  // Diperlakukan sebagai halaman pertama, paginasi berputar selamanya.
  failsWith('INVALID_PARAM', () => decodeCursor('bukan-base64!!'));
  failsWith('INVALID_PARAM', () => decodeCursor(Buffer.from('{"a":1}').toString('base64url')));
  failsWith('INVALID_PARAM', () =>
    decodeCursor(Buffer.from(JSON.stringify({ blockHeight: 1.5, txIndex: 0, logIndex: 0 })).toString('base64url')),
  );
});
