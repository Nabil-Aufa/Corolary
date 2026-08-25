import postgres from 'postgres';
import { config } from '../config.js';

export const sql = postgres(config.DATABASE_URL, {
  max: 10,
  // uint256 tidak muat di Number. NUMERIC dikembalikan sebagai string supaya
  // tidak ada titik di sistem ini yang diam-diam membulatkan jumlah pinjaman.
  types: {
    bigint: postgres.BigInt,
  },
  onnotice: () => {},
});

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
