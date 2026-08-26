import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// SATU .env untuk seluruh repo (lihat header .env.example). Indexer berjalan dari
// services/indexer, jadi file-nya dua tingkat di atas.
loadEnv({ path: resolve(import.meta.dirname, '../../../.env') });

const hex32 = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'harus private key hex 32 byte berawalan 0x');

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'harus alamat EVM');

const schema = z.object({
  ETHEREUM_RPC_URL: z.url(),
  /**
   * RPC Ethereum cadangan. Opsional, tapi tanpanya tidak ada failover sama
   * sekali — variabel ini sempat ada di `.env` selama berminggu-minggu TANPA
   * dibaca kode mana pun, memberi rasa aman yang palsu.
   */
  ETHEREUM_RPC_URL_FALLBACK: z.url().or(z.literal('')).optional(),
  ETHEREUM_CHAIN_KEY: z.coerce.number().int().positive(),
  CREDITCOIN_RPC_URL: z.url(),
  CREDITCOIN_CHAIN_ID: z.coerce.number().int().positive(),
  PROOF_BUILDER_URL: z.url(),
  SUBMITTER_PRIVATE_KEY: hex32,
  // Kosong sampai `pnpm contracts:deploy:testnet` jalan. Watcher dan prover
  // tetap bisa bekerja tanpa ini; hanya submitter yang butuh, dan ia memanggil
  // requireContracts() saat start supaya kegagalannya jelas dan di satu tempat.
  FACT_REGISTRY_ADDRESS: address.or(z.literal('')).optional(),
  PRICE_REGISTRY_ADDRESS: address.or(z.literal('')).optional(),
  DATABASE_URL: z.string().min(1),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Konfigurasi .env tidak valid:\n${issues}`);
}

export const config = parsed.data;

// chainKey 1 = Sepolia. Memakainya berarti fakta berasal dari token karangan,
// yang melanggar aturan nol-mock — dan itu kegagalan produk, bukan kegagalan
// teknis, sehingga tidak boleh cuma jadi peringatan.
if (config.ETHEREUM_CHAIN_KEY === 1) {
  throw new Error(
    'ETHEREUM_CHAIN_KEY=1 adalah Sepolia. Produk akhir wajib chainKey 3 (Ethereum mainnet).',
  );
}

export interface DeployedContracts {
  factRegistry: string;
  priceRegistry: string;
}

/**
 * Dipanggil submitter saat start. Sengaja melempar alih-alih mengembalikan
 * undefined: submitter yang berjalan tanpa alamat kontrak akan gagal di tiap
 * transaksi dan membanjiri antrean `failed` dengan error yang menyesatkan.
 */
export function requireContracts(): DeployedContracts {
  const { FACT_REGISTRY_ADDRESS, PRICE_REGISTRY_ADDRESS } = config;
  const missing: string[] = [];
  if (!FACT_REGISTRY_ADDRESS) missing.push('FACT_REGISTRY_ADDRESS');
  if (!PRICE_REGISTRY_ADDRESS) missing.push('PRICE_REGISTRY_ADDRESS');
  if (missing.length > 0) {
    throw new Error(
      `${missing.join(', ')} belum diisi di .env — deploy kontraknya dulu ` +
        '(`pnpm contracts:deploy:testnet`), lalu salin alamatnya ke .env.',
    );
  }
  return {
    factRegistry: FACT_REGISTRY_ADDRESS as string,
    priceRegistry: PRICE_REGISTRY_ADDRESS as string,
  };
}
