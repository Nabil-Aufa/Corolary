import { market, priceRegistry } from './chain.js';

/**
 * Kesegaran harga MENURUT KONTRAK, dibaca per aset dari `PriceRegistry`.
 *
 * Ada karena `priceUsd` di respons datang dari mirror Postgres, dan mirror itu
 * tetap memperlihatkan angka yang sehat lama setelah kontrak berhenti
 * menerimanya — persis mode kegagalan yang terjadi saat cutover PriceRegistry:
 * UI normal, pasar beku. Satu-satunya jawaban jujur soal beku/tidak datang dari
 * chain, dan lewat gerbang yang PERSIS sama dengan yang ditegakkan pasar.
 *
 * Dipakai bersama oleh `/v1/market/reserves` dan `/v1/indexer/status`. Itu
 * disengaja: dua definisi "segar" yang bisa menyimpang adalah cara membuat
 * dashboard hijau sementara pasar beku, yaitu bug yang justru mau dicegah di
 * sini.
 */
export interface PriceFreshness {
  fresh: boolean;
  updatedAt: number | null;
  ageSeconds: number | null;
  maxAgeSeconds: number;
}

export async function priceFreshnessOf(asset: string): Promise<PriceFreshness> {
  // Desimal dibaca dari registry, BUKAN dari tabel `assets`. `tryToUsd1e18`
  // memakai `assetDecimals[asset]` miliknya sendiri, jadi memasok desimal dari
  // sumber lain berarti menguji gerbang dengan angka yang bukan angka gerbang
  // itu. Aset yang belum terdaftar menjawab 0 di sini dan `fresh: false` di
  // bawah — dan itu memang jawaban yang benar: pasar akan revert untuknya.
  const decimals = (await priceRegistry.getFunction('assetDecimals')(asset)) as bigint;

  const [data, maxAge, age, usd] = await Promise.all([
    priceRegistry.getFunction('priceDataOf')(asset) as Promise<{
      roundId: bigint;
      updatedAt: bigint;
    }>,
    priceRegistry.getFunction('maxAgeFor')(asset) as Promise<bigint>,
    priceRegistry.getFunction('priceAgeSeconds')(asset) as Promise<bigint>,
    // Gerbang yang sama dengan `_usdOrRevert`. Jumlahnya satu unit penuh, bukan
    // 1 wei: `tryToUsd1e18` menjawab `false` untuk amount != 0 pada aset yang
    // desimalnya belum terdaftar, dan itu memang bagian dari gerbangnya.
    priceRegistry.getFunction('tryToUsd1e18')(asset, 10n ** decimals) as Promise<
      [bigint, boolean]
    >,
  ]);

  const hasPrice = data.roundId !== 0n;
  return {
    fresh: usd[1],
    updatedAt: hasPrice ? Number(data.updatedAt) : null,
    ageSeconds: hasPrice ? Number(age) : null,
    maxAgeSeconds: Number(maxAge),
  };
}

/** Kesegaran untuk SETIAP reserve yang benar-benar terdaftar di pasar. */
export async function reservePriceFreshness(): Promise<
  { asset: string; freshness: PriceFreshness }[]
> {
  const count = Number(await market.getFunction('reserveCount')());
  const assets: string[] = [];
  for (let i = 0; i < count; i++) {
    assets.push((await market.getFunction('reserveList')(i)) as string);
  }
  return Promise.all(
    assets.map(async (asset) => ({ asset, freshness: await priceFreshnessOf(asset) })),
  );
}
