import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAD, scaledToActual, wadToUsd, wadToUsdPrice, usdOf, toUsd } from './money.js';

/**
 * Aritmetika uang. Kegagalan di lapis ini tidak pernah melempar — ia menghasilkan
 * angka yang terlihat wajar dan salah, lalu ditampilkan di UI sebagai fakta.
 * Contoh yang sudah pernah terjadi di proyek ini: timestamp 1,8e9 terbaca pada
 * feed berdesimal 8 sebagai "$18" — masuk akal, dan karena itu tidak terlihat
 * seperti kesalahan.
 */

// Harga Chainlink USD selalu 8 desimal.
const USD8 = 8;

test('wadToUsd menyisakan sen, tidak membulatkan ke dolar', () => {
  assert.equal(wadToUsd(0n), '0.00');
  assert.equal(wadToUsd(WAD), '1.00');
  assert.equal(wadToUsd(WAD / 100n), '0.01');
  assert.equal(wadToUsd((WAD * 123456n) / 100n), '1234.56');
});

test('sen di bawah satu tetap ditampilkan dua digit', () => {
  // "0.5" bukan setengah dolar dalam pembacaan manusia mana pun — ia terbaca
  // sebagai 50 sen oleh sebagian orang dan 5 sen oleh sebagian lain.
  assert.equal(wadToUsd(WAD / 20n), '0.05');
  assert.equal(wadToUsd((WAD * 3n) / 2n), '1.50');
});

test('wadToUsd tidak kehilangan presisi di atas 2^53', () => {
  // Satu whale Aave sudah cukup melewati Number.MAX_SAFE_INTEGER. Lewat float,
  // angka ini akan berubah diam-diam di digit terakhir.
  const wad = 98_765_432_109_876_543_210n * WAD;
  assert.equal(wadToUsd(wad), '98765432109876543210.00');
});

test('nilai negatif tidak menghasilkan string cacat', () => {
  // Tidak seharusnya terjadi — jumlah token uint256 — tapi versi sebelumnya
  // menghasilkan "-1.-50" alih-alih "-1.50", yaitu string yang lolos ke UI
  // tanpa satu pun error.
  assert.equal(wadToUsd(-WAD), '-1.00');
  assert.equal(wadToUsd((-WAD * 3n) / 2n), '-1.50');
});

test('scaledToActual: indeks 0 berarti nol, bukan pembagian nol', () => {
  // Reserve yang belum pernah dipakai punya indeks 0. Tanpa penjaga ini,
  // `/market/summary` melempar untuk pasar yang baru di-deploy.
  assert.equal(scaledToActual(1_000n, 0n), 0n);
  assert.equal(scaledToActual(1_000n, WAD), 1_000n);
  // Bunga berjalan: indeks 1,5 berarti utang tercatat 1.000 kini bernilai 1.500.
  assert.equal(scaledToActual(1_000n, (WAD * 3n) / 2n), 1_500n);
});

test('usdOf memakai desimal token, bukan desimal seragam', () => {
  // 1.000 USDC (6 desimal) pada $1,00 = $1.000. Memakai 18 desimal di sini
  // menghasilkan $0,000000000001 — angka yang terbaca sebagai "debu", bukan
  // sebagai bug.
  const usdc = { answer: String(1_0000_0000n), priceDecimals: USD8 };
  assert.equal(usdOf(1_000_000_000n, 6, usdc), 1_000n * WAD);

  // 2 WETH (18 desimal) pada $2.511,24.
  const weth = { answer: String(2_511_24000000n), priceDecimals: USD8 };
  assert.equal(usdOf(2n * WAD, 18, weth), 5_022_48n * WAD / 100n);
});

test('usdOf tanpa harga terbukti = 0n, bukan tebakan', () => {
  assert.equal(usdOf(10n ** 18n, 18, undefined), 0n);
  assert.equal(usdOf(10n ** 18n, 18, { answer: null, priceDecimals: USD8 }), 0n);
  assert.equal(usdOf(10n ** 18n, 18, { answer: '100000000', priceDecimals: null }), 0n);
});

test('toUsd mengembalikan null saat harga belum terbukti — BUKAN "0.00"', () => {
  // Keduanya terlihat mirip di UI dan artinya berlawanan: `null` berarti
  // "belum ada harga terbukti untuk aset ini", "0.00" berarti "aset ini
  // bernilai nol dolar".
  assert.equal(toUsd('1000000', 6, null, USD8), null);
  assert.equal(toUsd('1000000', 6, '100000000', null), null);
  assert.equal(toUsd('1000000', null, '100000000', USD8), null);
  assert.equal(toUsd('0', 6, '100000000', USD8), '0.00');
});

test('toUsd atas jumlah uint256 sungguhan', () => {
  // 1.000 tUSDC = $999,94 pada harga USDC mainnet yang benar-benar dibuktikan
  // (docs/open-issues.md §585). Harga stablecoin TIDAK persis $1, dan
  // membulatkannya ke $1 adalah cara paling halus mengarang angka.
  assert.equal(toUsd('1000000000', 6, '99994000', USD8), '999.94');
});

test('toUsd tidak melempar pada masukan cacat', () => {
  // Kolom `amount` NUMERIC(78,0) tidak pernah cacat, tapi jalur ini juga
  // melayani harga dari kontrak. Melempar di sini menjatuhkan seluruh
  // /v1/facts karena satu baris.
  assert.equal(toUsd('bukan angka', 6, '100000000', USD8), null);
  assert.equal(toUsd('1000000', -1, '100000000', USD8), null);
});

test('harga stablecoin butuh lebih dari dua desimal', () => {
  // USDC mainnet yang benar-benar dibuktikan pada ronde 1152: $0,99994916.
  // Dua desimal memotongnya jadi "0.99", yang tak terbedakan dari $0,99 —
  // selisih 1% pada aset yang seluruh gunanya adalah menempel di $1.
  const usdc = (99_994_916n * WAD) / 10n ** 8n;
  assert.equal(wadToUsd(usdc), '0.99');
  assert.equal(wadToUsdPrice(usdc), '0.999949');
});

test('harga aset mahal tetap terbaca wajar', () => {
  const weth = (2_469_25000000n * WAD) / 10n ** 8n;
  assert.equal(wadToUsdPrice(weth), '2469.250000');
});

test('wadToUsdPrice: nol, satu, dan nilai negatif', () => {
  assert.equal(wadToUsdPrice(0n), '0.000000');
  assert.equal(wadToUsdPrice(WAD), '1.000000');
  assert.equal(wadToUsdPrice(-WAD), '-1.000000');
});

test('wadToUsdPrice tidak kehilangan presisi di atas 2^53', () => {
  assert.equal(wadToUsdPrice(98_765_432_109_876_543_210n * WAD), '98765432109876543210.000000');
});
