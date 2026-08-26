import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// SATU .env untuk seluruh repo (lihat header .env.example).
loadEnv({ path: resolve(import.meta.dirname, '../../../.env') });

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'harus alamat EVM');

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(8080),
  ETHEREUM_CHAIN_KEY: z.coerce.number().int().positive(),
  CREDITCOIN_RPC_URL: z.url(),
  CREDITCOIN_CHAIN_ID: z.coerce.number().int().positive(),
  FACT_REGISTRY_ADDRESS: address,
  CREDIT_GRAPH_ADDRESS: address,
  PRICE_REGISTRY_ADDRESS: address,
  EFFICIENCY_MARKET_ADDRESS: address,
});

/**
 * Platform hosting (Railway, Fly, Render) menyuntikkan port lewat `PORT` dan
 * mengarahkan traffic ke sana — bukan lewat nama variabel kita sendiri.
 *
 * `PORT` menang atas `API_PORT` kalau keduanya ada, dan urutan itu disengaja:
 * kalau kita mendengarkan port lain daripada yang dipetakan platform, service-nya
 * naik dengan sehat, log-nya bersih, health check-nya gagal, dan satu-satunya
 * gejala adalah domain yang tidak pernah menjawab. Tidak ada error di mana pun
 * untuk dilacak.
 */
const parsed = schema.safeParse({
  ...process.env,
  API_PORT: process.env.PORT ?? process.env.API_PORT,
});
if (!parsed.success) {
  throw new Error(
    'Konfigurasi .env tidak valid:\n' +
      parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
  );
}

export const config = parsed.data;
export const VERSION = '0.1.0';
export const STARTED_AT = Date.now();
