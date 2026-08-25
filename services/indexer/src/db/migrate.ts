import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sql, closeDb } from './client.js';
import { logger } from '../logger.js';

const DIR = resolve(import.meta.dirname, 'migrations');

/**
 * Migrasi berbasis file, dijalankan berurutan dan dicatat di tabel
 * `schema_migrations`. Sengaja tanpa tool eksternal: skemanya kecil dan
 * DDL-nya sudah dikunci di docs/indexer.md §14.
 */
export async function migrate(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name),
  );

  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const ddl = await readFile(resolve(DIR, file), 'utf8');
    // Satu transaksi per file: migrasi yang gagal di tengah tidak boleh
    // meninggalkan skema separuh jadi.
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`INSERT INTO schema_migrations ${tx({ name: file })}`;
    });
    logger.info({ migration: file }, 'migrasi diterapkan');
  }
}

// Dijalankan langsung lewat `pnpm --filter @corolary/indexer migrate`.
if (import.meta.filename === process.argv[1]) {
  migrate()
    .then(() => logger.info('migrasi selesai'))
    .catch((err) => {
      logger.error({ err }, 'migrasi gagal');
      process.exitCode = 1;
    })
    .finally(closeDb);
}
