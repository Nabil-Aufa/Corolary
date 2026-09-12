import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HTTP_BODY_LIMIT,
  httpBodyBytesFor,
  hexBytes,
  maxHttpCallDataBytes,
  needsWebSocket,
} from './transport.js';

test('hexBytes membaca ukuran byte dari string heks', () => {
  assert.equal(hexBytes('0x'), 0);
  assert.equal(hexBytes('0xff'), 1);
  assert.equal(hexBytes('0x' + '00'.repeat(4864)), 4864);
});

test('perkiraan body TIDAK PERNAH lebih kecil daripada body sebenarnya', () => {
  // Ini invarian yang menentukan. Perkiraan yang terlalu optimistis berarti
  // transaksi dikirim lewat HTTP lalu mati 413 — kegagalan yang modul ini ada
  // untuk mencegahnya. Jadi bandingkan dengan body JSON-RPC yang sungguhan.
  for (const callDataBytes of [0, 100, 4864, 233_316, 491_232]) {
    const rawTxHex = '0x' + '00'.repeat(callDataBytes + 160);
    const actual = Buffer.byteLength(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 999_999,
        method: 'eth_sendRawTransaction',
        params: [rawTxHex],
      }),
    );
    assert.ok(
      httpBodyBytesFor(callDataBytes) >= actual,
      `perkiraan ${httpBodyBytesFor(callDataBytes)} < sebenarnya ${actual} pada ${callDataBytes} byte`,
    );
  }
});

test('ukuran nyata yang terukur tetap lewat HTTP', () => {
  // Median receipt mainnet di jendela kegagalan, dan yang TERBESAR dari 70
  // sampel (transaksi 1.141 log). Keduanya harus lewat jalur biasa — kalau
  // tidak, perbaikan ini memindahkan lalu lintas normal ke WebSocket.
  assert.equal(needsWebSocket(2_773), false);
  assert.equal(needsWebSocket(233_316), false);
});

test('batas HTTP-nya tepat di satu byte', () => {
  const max = maxHttpCallDataBytes();
  assert.equal(needsWebSocket(max), false);
  assert.equal(needsWebSocket(max + 1), true);
  // Dan pada ukuran maksimum itu, body-nya memang masih di bawah plafon.
  assert.ok(httpBodyBytesFor(max) < HTTP_BODY_LIMIT);
});

test('heks yang menggandakan ukuran ikut diperhitungkan', () => {
  // Plafon body 1 MiB, tapi karena body-nya heks, plafon pada TRANSAKSI-nya
  // kira-kira setengah. Kalau penggandaan ini pernah hilang dari rumusnya,
  // batasnya akan terbaca dua kali lebih longgar daripada kenyataan.
  assert.ok(maxHttpCallDataBytes() < HTTP_BODY_LIMIT / 2);
  assert.ok(maxHttpCallDataBytes() > HTTP_BODY_LIMIT / 3);
});
