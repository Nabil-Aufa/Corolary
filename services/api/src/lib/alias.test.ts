import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { resolveAliasPrices, createAliasCache, type AliasDeps, type PricedAsset } from './alias.js';

/**
 * Alias harga adalah satu-satunya alasan token pasar testnet punya nilai USD
 * sama sekali. Setiap kegagalan di sini berbentuk sama: `null` yang terbaca
 * sebagai "harga belum ada" padahal `tryToUsd1e18` on-chain menjawab benar.
 */

const TUSDC = ethers.getAddress('0x1111111111111111111111111111111111111111');
const USDC = ethers.getAddress('0x2222222222222222222222222222222222222222');
const WETH = ethers.getAddress('0x3333333333333333333333333333333333333333');

function asset(over: Partial<PricedAsset> = {}): PricedAsset {
  return { decimals: 6, answer: null, priceDecimals: null, sourceTxHash: null, ...over };
}

function deps(over: Partial<AliasDeps> = {}): AliasDeps {
  return {
    aliasOf: async () => ethers.ZeroAddress,
    priceOf: async () => null,
    ...over,
  };
}

const USDC_PRICE = { answer: '99994000', priceDecimals: 8, sourceTxHash: '0xabc' };

test('token beralias meminjam harga aset kanonik', () => {
  const meta = new Map([[TUSDC.toLowerCase(), asset()]]);
  return resolveAliasPrices(
    meta,
    deps({ aliasOf: async () => USDC, priceOf: async () => USDC_PRICE }),
    createAliasCache(),
  ).then(() => {
    const m = meta.get(TUSDC.toLowerCase());
    assert.equal(m?.answer, '99994000');
    assert.equal(m?.priceDecimals, 8);
    assert.equal(m?.sourceTxHash, '0xabc');
  });
});

test('HANYA harga yang dipinjam — desimal tetap milik tokennya sendiri', async () => {
  // Jebakan paling mahal di file ini. tUSDC berdesimal 6; kalau desimal ikut
  // dipinjam dari aset kanonik berdesimal 18, setiap saldo meleset 10^12 kali
  // dan tidak ada satu pun gejala di UI — angkanya tetap terformat rapi.
  const meta = new Map([[TUSDC.toLowerCase(), asset({ decimals: 6 })]]);
  await resolveAliasPrices(
    meta,
    deps({
      aliasOf: async () => WETH,
      priceOf: async () => ({ answer: '251124000000', priceDecimals: 8, sourceTxHash: null }),
    }),
    createAliasCache(),
  );
  assert.equal(meta.get(TUSDC.toLowerCase())?.decimals, 6);
});

test('aset yang SUDAH punya harga sendiri tidak pernah ditimpa', async () => {
  // Menimpanya berarti harga pinjaman mengalahkan harga asli — terbalik dari
  // maksud alias, dan hasilnya harga yang tidak sesuai asetnya.
  const meta = new Map([[USDC.toLowerCase(), asset({ answer: '100000000', priceDecimals: 8 })]]);
  let aliasCalls = 0;
  await resolveAliasPrices(
    meta,
    deps({
      aliasOf: async () => {
        aliasCalls++;
        return WETH;
      },
      priceOf: async () => ({ answer: '251124000000', priceDecimals: 8, sourceTxHash: null }),
    }),
    createAliasCache(),
  );
  assert.equal(meta.get(USDC.toLowerCase())?.answer, '100000000');
  assert.equal(aliasCalls, 0, 'tidak boleh ada eth_call untuk aset yang sudah berharga');
});

test('ZeroAddress berarti tidak ada alias, bukan alamat nol', async () => {
  const meta = new Map([[TUSDC.toLowerCase(), asset()]]);
  await resolveAliasPrices(
    meta,
    deps({ priceOf: async () => USDC_PRICE }),
    createAliasCache(),
  );
  assert.equal(meta.get(TUSDC.toLowerCase())?.answer, null);
});

test('aliasOf yang melempar tidak menjatuhkan permintaan pasar', async () => {
  // Kontrak lama tanpa `priceAliasOf`, atau RPC yang sedang gagal. Keduanya
  // berarti "tidak ada alias yang diketahui" — bukan alasan seluruh
  // /v1/market/positions balas 500.
  const meta = new Map([[TUSDC.toLowerCase(), asset()]]);
  await resolveAliasPrices(
    meta,
    deps({ aliasOf: async () => { throw new Error('unknown selector'); } }),
    createAliasCache(),
  );
  assert.equal(meta.get(TUSDC.toLowerCase())?.answer, null);
});

test('alias ada tapi harganya belum terbukti -> tetap null', async () => {
  // Alias menunjuk USDC, tapi loop harga belum pernah mencatat ronde untuknya.
  // Meminjam "sesuatu" di sini akan mengarang angka.
  const meta = new Map([[TUSDC.toLowerCase(), asset()]]);
  await resolveAliasPrices(
    meta,
    deps({ aliasOf: async () => USDC, priceOf: async () => null }),
    createAliasCache(),
  );
  assert.equal(meta.get(TUSDC.toLowerCase())?.answer, null);
});

test('hasil NEGATIF ikut di-cache — satu eth_call per token, bukan per permintaan', async () => {
  // Mayoritas aset memang tidak punya alias. Tanpa entri negatif, tiap
  // permintaan pasar mengulang satu eth_call per aset untuk jawaban yang sudah
  // diketahui — dan jumlahnya tumbuh seiring daftar reserve.
  const cache = createAliasCache();
  let calls = 0;
  const d = deps({
    aliasOf: async () => {
      calls++;
      return ethers.ZeroAddress;
    },
  });
  for (let i = 0; i < 3; i++) {
    await resolveAliasPrices(new Map([[TUSDC.toLowerCase(), asset()]]), d, cache);
  }
  assert.equal(calls, 1);
});

test('alias positif juga di-cache lintas permintaan', async () => {
  const cache = createAliasCache();
  let calls = 0;
  const d = deps({
    aliasOf: async () => {
      calls++;
      return USDC;
    },
    priceOf: async () => USDC_PRICE,
  });
  for (let i = 0; i < 3; i++) {
    const meta = new Map([[TUSDC.toLowerCase(), asset()]]);
    await resolveAliasPrices(meta, d, cache);
    assert.equal(meta.get(TUSDC.toLowerCase())?.answer, '99994000');
  }
  assert.equal(calls, 1);
  // Harga TIDAK ikut di-cache: alias itu permanen, harganya berubah tiap ronde.
});

test('beberapa aset diproses independen dalam satu permintaan', async () => {
  const meta = new Map<string, PricedAsset>([
    [TUSDC.toLowerCase(), asset({ decimals: 6 })],
    [WETH.toLowerCase(), asset({ decimals: 18, answer: '251124000000', priceDecimals: 8 })],
  ]);
  await resolveAliasPrices(
    meta,
    deps({ aliasOf: async () => USDC, priceOf: async () => USDC_PRICE }),
    createAliasCache(),
  );
  assert.equal(meta.get(TUSDC.toLowerCase())?.answer, '99994000');
  assert.equal(meta.get(WETH.toLowerCase())?.answer, '251124000000');
});
