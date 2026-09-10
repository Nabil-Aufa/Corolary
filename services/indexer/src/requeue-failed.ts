import { sql, closeDb } from './db/client.js';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Mengembalikan event yang gagal permanen ke antrean proving.
 *
 *   pnpm --filter @corolary/indexer requeue-failed                 # dry-run
 *   pnpm --filter @corolary/indexer requeue-failed -- --match 413  # dry-run tersaring
 *   pnpm --filter @corolary/indexer requeue-failed -- --match 413 --apply
 *
 * `status = 'failed'` berarti event menyerah setelah delapan percobaan. Untuk
 * sebab yang SUDAH diperbaiki, itu bukan vonis akhir — melainkan fakta mainnet
 * nyata yang hilang dari registry sampai ada yang mengembalikannya.
 *
 * Ditulis setelah 568 event ditemukan gagal dengan satu sebab tunggal, HTTP 413
 * dari gateway RPC (2026-09-06, jendela 6,5 jam). Sebabnya sudah ditutup —
 * klasifikasi 413 sekarang memecah batch alih-alih mengulanginya — tapi ke-568
 * fakta itu tetap tidak ada di registry sampai di-requeue.
 *
 * ## Kenapa `proving`, bukan `submitting`
 *
 * Event ini gagal di tahap submit, jadi batch-nya sudah punya proof. Tapi
 * continuity proof menganggur berhenti cocok dengan checkpoint Creditcoin yang
 * terus maju — proof berumur hari sudah pasti kedaluwarsa. Mengembalikan ke
 * `submitting` berarti revert langsung; `proving` membuat prover membeli proof
 * baru dan menyusun batch baru.
 *
 * ## Kenapa aman dijalankan
 *
 * Kalau ada di antaranya yang ternyata SUDAH tercatat, kontrak menolak lewat
 * `queryId` dan klasifikasi memvonisnya `skip` — bukan kegagalan, dan bukan
 * duplikat. Tidak ada jalan bagi skrip ini menghasilkan fakta ganda.
 *
 * ## Biaya
 *
 * Blok yang sudah berumur >24 jam masuk tarif lazy, `3,13×10⁻⁴` CTC per
 * transaksi — sekitar 12x tarif eager. Untuk 568 event itu 0,178 CTC. Biaya
 * dilaporkan sebelum apa pun diubah, karena requeue besar pada rentang yang
 * sangat lama bisa jadi mahal dan keputusannya bukan milik skrip ini.
 */

interface Group {
  reason: string;
  n: number;
  oldest: number;
  newest: number;
}

/** Tarif proof untuk transaksi di luar jendela 24 jam (docs Attestcoin, gas-costs). */
const LAZY_PROOF_CTC = 3.13e-4;

function parseArgs(argv: string[]): { match: string | null; apply: boolean } {
  let match: string | null = null;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') apply = true;
    if (argv[i] === '--match') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) throw new Error('--match butuh nilai, mis. --match 413');
      match = v;
      i++;
    }
  }
  return { match, apply };
}

async function groups(match: string | null): Promise<Group[]> {
  const rows = await sql<{ reason: string; n: string; oldest: string; newest: string }[]>`
    SELECT left(coalesce(last_error, '(tanpa pesan)'), 120) AS reason,
           count(*)::text AS n,
           min(observed_at)::text AS oldest,
           max(observed_at)::text AS newest
    FROM observed_events
    WHERE chain_key = ${config.ETHEREUM_CHAIN_KEY}
      AND status = 'failed'
      ${match ? sql`AND last_error ILIKE ${'%' + match + '%'}` : sql``}
    GROUP BY 1
    ORDER BY count(*) DESC
  `;
  return rows.map((r) => ({
    reason: r.reason,
    n: Number(r.n),
    oldest: Number(r.oldest),
    newest: Number(r.newest),
  }));
}

async function main(): Promise<void> {
  const { match, apply } = parseArgs(process.argv.slice(2));

  const before = await groups(match);
  const total = before.reduce((n, g) => n + g.n, 0);

  if (total === 0) {
    logger.info({ match }, 'tidak ada event gagal yang cocok — tidak ada yang dikerjakan');
    return;
  }

  const iso = (t: number) => new Date(t * 1000).toISOString().replace('.000Z', 'Z');
  for (const g of before) {
    logger.info(
      { jumlah: g.n, blokTertua: iso(g.oldest), blokTermuda: iso(g.newest), sebab: g.reason },
      'kelompok kegagalan',
    );
  }
  logger.info(
    { total, perkiraanBiayaCtc: (total * LAZY_PROOF_CTC).toFixed(4), match: match ?? '(semua)' },
    'ringkasan',
  );

  if (!apply) {
    logger.warn(
      'DRY-RUN — tidak ada yang diubah. Tambahkan --apply untuk benar-benar mengembalikan ke antrean.',
    );
    return;
  }

  // `attempts = 0` disengaja: penghitung lama sudah mencapai batas, dan tanpa
  // meresetnya event akan langsung divonis gagal lagi pada percobaan pertama.
  // `batch_id = NULL` melepasnya dari batch lama yang proof-nya kedaluwarsa.
  const updated = await sql<{ count: string }[]>`
    WITH moved AS (
      UPDATE observed_events
      SET status = 'proving', batch_id = NULL, attempts = 0,
          last_error = NULL, run_after = NULL
      WHERE chain_key = ${config.ETHEREUM_CHAIN_KEY}
        AND status = 'failed'
        ${match ? sql`AND last_error ILIKE ${'%' + match + '%'}` : sql``}
      RETURNING 1
    )
    SELECT count(*)::text AS count FROM moved
  `;
  const n = Number(updated[0]?.count ?? 0);

  const after = await groups(match);
  const sisa = after.reduce((acc, g) => acc + g.n, 0);

  logger.info({ dikembalikan: n, sisaGagal: sisa }, 'requeue selesai');
  if (sisa > 0) {
    logger.warn(
      { sisa },
      'masih ada yang berstatus failed dan cocok filter — periksa apakah ada yang gagal lagi selagi skrip berjalan',
    );
  }
}

main()
  .catch((err) => {
    logger.error({ err: String(err) }, 'requeue gagal');
    process.exitCode = 1;
  })
  .finally(closeDb);
