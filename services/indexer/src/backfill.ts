/**
 * CLI backfill.
 *
 *   pnpm --filter @corolary/indexer backfill --subject 0x… [--months 6] \
 *        [--protocol aave-v3,spark] [--dry-run]
 *
 * JANGAN jalankan bersamaan dengan indexer: keduanya memakai RPC Ethereum yang
 * sama, dan burst backfill bisa membuat provider membatasi watcher live.
 */
import { closeDb } from './db/client.js';
import { logger } from './logger.js';
import { backfillSubject } from './backfill/run.js';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

const subject = arg('subject');
if (!subject) {
  logger.error(
    'wajib --subject 0x… (backfill di-scope per dompet; lihat docs/indexer.md §13.2b)',
  );
  process.exit(1);
}

const monthsRaw = arg('months');
const months = monthsRaw === null ? 6 : Number(monthsRaw);
if (!Number.isFinite(months) || months <= 0) {
  logger.error({ monthsRaw }, '--months harus angka positif');
  process.exit(1);
}

const untilRaw = arg('until-months');
const untilMonths = untilRaw === null ? 0 : Number(untilRaw);
if (!Number.isFinite(untilMonths) || untilMonths < 0) {
  logger.error({ untilRaw }, '--until-months harus angka >= 0');
  process.exit(1);
}

const protocolRaw = arg('protocol');

await backfillSubject({
  subject,
  months,
  untilMonths,
  protocols: protocolRaw === null ? null : protocolRaw.split(',').map((s) => s.trim()),
  dryRun: process.argv.includes('--dry-run'),
})
  .catch((err) => {
    logger.error({ err: String(err) }, 'backfill gagal');
    process.exitCode = 1;
  })
  .finally(closeDb);
