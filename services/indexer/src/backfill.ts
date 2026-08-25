/**
 * CLI backfill.
 *
 *   pnpm --filter @corolary/indexer backfill --subject 0x… [--months 6] \
 *        [--protocol aave-v3,spark] [--priority 10] [--dry-run]
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

/**
 * Kumpulkan SEMUA kemunculan sebuah flag, bukan yang pertama saja.
 *
 * `--protocol a --protocol b` sebelumnya diam-diam membuang `b`: `indexOf`
 * berhenti di kecocokan pertama. Tidak ada error, tidak ada peringatan — cuma
 * pemindaian yang lebih sempit dari yang diminta, dan hasil "nol log" yang
 * terbaca seperti temuan padahal separuh protokolnya tidak pernah disentuh.
 */
function args(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] !== `--${name}`) continue;
    const v = process.argv[i + 1];
    if (v !== undefined && !v.startsWith('--')) out.push(v);
  }
  return out;
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

// Terima dua bentuk sekaligus: `--protocol a,b` dan `--protocol a --protocol b`.
const protocolList = args('protocol').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);

const priorityRaw = arg('priority');
const priority = priorityRaw === null ? 0 : Number(priorityRaw);
if (!Number.isFinite(priority) || priority < 0) {
  logger.error({ priorityRaw }, '--priority harus angka >= 0');
  process.exit(1);
}

await backfillSubject({
  subject,
  months,
  untilMonths,
  protocols: protocolList.length === 0 ? null : protocolList,
  dryRun: process.argv.includes('--dry-run'),
  priority,
})
  .catch((err) => {
    logger.error({ err: String(err) }, 'backfill gagal');
    process.exitCode = 1;
  })
  .finally(closeDb);
