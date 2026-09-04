import { Hono } from 'hono';
import { priceRegistry } from '../lib/chain.js';
import { sql } from '../lib/db.js';
import { ok } from '../lib/envelope.js';
import type { Address, Hex, PriceEntry } from '@corolary/shared';

export const prices = new Hono();

/**
 * Harga di sini SELALU berasal dari event `AnswerUpdated` Chainlink yang
 * dibuktikan lewat Attestcoin dan tersimpan di PriceRegistry. Tidak ada
 * pembacaan feed langsung: harga yang tidak bisa ditelusuri ke sebuah proof
 * akan merusak klaim produk ini tanpa terlihat di UI.
 */
prices.get('/prices', async (c) => {
  const rows = await sql<
    {
      asset: string; aggregator: string; answer: string; decimals: number;
      round_id: string; updated_at: string; source_block: string;
      source_tx_hash: string; pair: string | null; symbol: string | null;
    }[]
  >`
    SELECT p.*, a.symbol FROM prices p
    LEFT JOIN assets a ON a.address = p.asset
    ORDER BY a.symbol NULLS LAST
  `;

  // Anggaran kesegaran dibaca dari KONTRAK, bukan dari konstanta di sini.
  // `maxPriceAgeOf` mengembalikan 0 untuk aset tanpa override, artinya "pakai
  // yang global" — bukan "tidak ada anggaran". Menyalin angkanya ke sisi API
  // adalah cara paling langsung untuk membuat UI menampilkan ambang yang tidak
  // pernah berlaku; chain yang berhak menjawab.
  const globalMax = Number((await priceRegistry.getFunction('maxPriceAge')()) as bigint);
  const overrides = await Promise.all(
    rows.map((r) => priceRegistry.getFunction('maxPriceAgeOf')(r.asset) as Promise<bigint>),
  );

  const now = Math.floor(Date.now() / 1000);
  const data: PriceEntry[] = rows.map((r, i) => ({
    asset: r.asset as Address,
    assetSymbol: r.symbol ?? '',
    // Label feed datang dari kolomnya sendiri, bukan disusun dari simbol aset:
    // WBTC dihargai feed BTC/USD, dan "WBTC/USD" adalah feed lain yang tidak
    // pernah kita baca.
    pair: r.pair ?? '',
    aggregator: r.aggregator as Address,
    answer: r.answer,
    decimals: r.decimals,
    roundId: r.round_id,
    sourceBlock: Number(r.source_block),
    sourceTxHash: r.source_tx_hash as Hex,
    updatedAt: Number(r.updated_at),
    // Melewati anggaran di bawah membuat `tryToUsd1e18` menjawab `false` dan
    // pasar membeku untuk operasi yang menambah risiko — tanpa satu pun error.
    // Keduanya diekspos supaya UI bisa memperingatkan SEBELUM itu terjadi.
    ageSeconds: Math.max(0, now - Number(r.updated_at)),
    maxAgeSeconds: Number(overrides[i] ?? 0n) || globalMax,
  }));

  return ok(c, data, { total: data.length });
});
