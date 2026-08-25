import { Hono } from 'hono';
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
      fact_id: string | null; symbol: string | null;
    }[]
  >`
    SELECT p.*, a.symbol FROM prices p
    LEFT JOIN assets a ON a.address = p.asset
    ORDER BY a.symbol NULLS LAST
  `;

  const now = Math.floor(Date.now() / 1000);
  const data: PriceEntry[] = rows.map((r) => ({
    asset: r.asset as Address,
    assetSymbol: r.symbol ?? '',
    pair: `${r.symbol ?? '?'}/USD`,
    aggregator: r.aggregator as Address,
    answer: r.answer,
    decimals: r.decimals,
    roundId: r.round_id,
    sourceBlock: Number(r.source_block),
    factId: (r.fact_id ?? '0x') as Hex,
    updatedAt: Number(r.updated_at),
    // Melewati maxPriceAge (24 jam) membuat pasar membeku untuk operasi yang
    // menambah risiko. Diekspos supaya UI bisa memperingatkan sebelum itu.
    ageSeconds: Math.max(0, now - Number(r.updated_at)),
  }));

  return ok(c, data, { total: data.length });
});
