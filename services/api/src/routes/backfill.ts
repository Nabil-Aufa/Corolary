import { Hono } from 'hono';
import { sql } from '../lib/db.js';
import { ok, notFound, invalidParam } from '../lib/envelope.js';
import { parseAddress, parseMonths } from '../lib/validate.js';
import { rateLimit } from '../lib/ratelimit.js';
import type { Address, BackfillJob, BackfillJobAccepted, BackfillJobStatus } from '@corolary/shared';

export const backfill = new Hono();

/**
 * Kedalaman default dan maksimum, dalam bulan.
 *
 * 6 bulan bukan angka bulat yang dipilih karena enak dibaca. `historyDuration`
 * memakai half-saturation `saturating(days, 365, 200)`: 365 hari memberi 100
 * dari 200 poin, 730 hari memberi 133. Menggandakan jendela dari 6 ke 12 bulan
 * hanya menambah ~34 poin, sementara biayanya naik sebanding jumlah transaksi
 * yang ditemukan. Tuas skor yang sebenarnya ada di cakupan protokol
 * (`protocolDiversity`, linear, 25 poin per protokol) — dan itu sudah selalu
 * keempat-empatnya di sini.
 *
 * Batas 24 bulan ada supaya satu permintaan tidak bisa memesan pemindaian
 * berjam-jam. Dompet aktif sudah pernah menghasilkan 1.277 transaksi dari 10%
 * pertama rentang 24 bulan, memproyeksikan ~23 jam pengiriman CC3.
 */
const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 24;

/**
 * Toleransi kesegaran cakupan, dalam blok Ethereum (~1 hari pada 12 detik).
 *
 * Backfill yang selesai kemarin punya `to_block` beberapa ribu blok di belakang
 * head hari ini. Menuntut `to_block >= head` membuat dedupe TIDAK PERNAH cocok,
 * dan tiap permintaan memindai ulang riwayat yang sudah dibayar penuh.
 *
 * Celah itu aman ditutup karena bukan tugas backfill: watcher live memindai maju
 * terus-menerus dan cursornya ada di head. Backfill hanya menambahkan riwayat
 * yang LEBIH TUA dari jangkauan watcher. Kalau watcher mati, gejalanya muncul di
 * `/v1/status` sebagai cursor yang tertinggal — bukan urusan endpoint ini untuk
 * menurunkannya lagi.
 */
const COVERAGE_SLACK_BLOCKS = 7_200;

/** ~12 detik per blok Ethereum. */
const BLOCKS_PER_MONTH = Math.round((30.44 * 24 * 3600) / 12);

/**
 * Memicu pemindaian riwayat mainnet untuk satu dompet.
 *
 * API tidak memindai apa pun sendiri; ia menitipkan job dan indexer yang
 * mengerjakannya (`services/indexer/src/jobs/backfill.ts`). Alasannya sama
 * dengan POST /v1/prove: submitter harus tetap satu-satunya penulis dari kunci
 * submitter, dan backfill berbagi RPC Ethereum dengan watcher live.
 *
 * Rate limitnya jauh lebih ketat daripada endpoint lain karena tiap panggilan
 * yang lolos dedupe berujung pada CTC yang benar-benar keluar — setiap
 * transaksi yang ditemukan dibuktikan pada tarif lazy 3,13x10^-4 CTC.
 */
backfill.post('/backfill', rateLimit({ perMinute: 3, burst: 2 }), async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    invalidParam('body harus JSON');
  }

  const parsed = body as { address?: string; months?: unknown };
  const subject = parseAddress(parsed.address);

  const months = parseMonths(parsed.months, DEFAULT_MONTHS, MAX_MONTHS);

  // Job yang MASIH berjalan didahulukan di atas cek cakupan: cakupannya belum
  // tercatat justru karena job-nya belum selesai, jadi bertanya ke
  // `backfill_runs` lebih dulu akan menjadwalkan pemindaian kedua di atas
  // pemindaian yang sedang berlangsung.
  const active = await sql<{ id: string; status: string; months: number; created_at: Date }[]>`
    SELECT id, status, (payload->>'months')::int AS months, created_at FROM jobs
    WHERE kind = 'backfill' AND status IN ('pending', 'running')
      AND payload->>'subject' = ${subject}
    ORDER BY created_at DESC LIMIT 1
  `;
  const inFlight = active[0];
  if (inFlight) {
    // Job yang belum mulai dan lebih DANGKAL dari yang diminta diperdalam di
    // tempat. Alternatifnya cuma dua dan keduanya buruk: menolak permintaan
    // (pengguna kehilangan kedalaman yang ia minta) atau membuat job kedua (dua
    // pemindaian paralel untuk dompet yang sama, di RPC yang sama).
    let effective = inFlight.months;
    if (inFlight.status === 'pending' && months > inFlight.months) {
      const bumped = await sql<{ id: string }[]>`
        UPDATE jobs SET payload = payload || ${sql.json({ months })}::jsonb, updated_at = now()
        WHERE id = ${inFlight.id} AND status = 'pending'
        RETURNING id
      `;
      if (bumped.length > 0) effective = months;
    }

    // `effective`, bukan `months`. Melaporkan kedalaman yang DIMINTA untuk job
    // yang mengerjakan kedalaman LAIN adalah bentuk paling langsung dari
    // kekeliruan yang sudah berulang di proyek ini: menyamakan jendela
    // pemindaian dengan riwayat yang benar-benar ada.
    return ok(
      c,
      accepted(inFlight.id, inFlight.status, subject, effective, inFlight.created_at),
      undefined,
      202,
    );
  }

  if (await isCovered(subject, months)) {
    // Dedupe terhadap KENYATAAN, bukan terhadap antrean. Backfill lewat CLI
    // tidak pernah menulis baris `jobs` — dompet demo salah satunya — jadi
    // dedupe yang hanya melihat `jobs` akan memindai ulang riwayat yang sudah
    // utuh, membakar RPC dan waktu untuk nol fakta baru.
    const settled: BackfillJobAccepted = {
      jobId: null,
      status: 'covered',
      subject: subject as Address,
      months,
      createdAt: Math.floor(Date.now() / 1000),
    };
    return ok(c, settled, undefined, 202);
  }

  const inserted = await sql<{ id: string; created_at: Date }[]>`
    INSERT INTO jobs ${sql({
      kind: 'backfill',
      payload: sql.json({ subject, months }),
      status: 'pending',
    })}
    RETURNING id, created_at
  `;
  const row = inserted[0];
  if (!row) invalidParam('gagal menitipkan job');

  return ok(c, accepted(row.id, 'pending', subject, months, row.created_at), undefined, 202);
});

backfill.get('/backfill/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) invalidParam('jobId harus UUID');

  const rows = await sql<
    {
      id: string;
      status: string;
      payload: { subject: string; months: number; failedRanges?: number; logsFound?: number };
      attempts: number;
      last_error: string | null;
      created_at: Date;
      updated_at: Date;
    }[]
  >`SELECT id, status, payload, attempts, last_error, created_at, updated_at
    FROM jobs WHERE id = ${jobId} AND kind = 'backfill'`;
  const row = rows[0];
  if (!row) notFound(`job backfill ${jobId}`);

  const data: BackfillJob = {
    jobId: row.id,
    status: row.status as BackfillJobStatus,
    subject: row.payload.subject as Address,
    months: row.payload.months,
    attempts: row.attempts,
    lastError: row.last_error,
    failedRanges: row.payload.failedRanges ?? null,
    logsFound: row.payload.logsFound ?? null,
    createdAt: Math.floor(new Date(row.created_at).getTime() / 1000),
    updatedAt: Math.floor(new Date(row.updated_at).getTime() / 1000),
  };
  return ok(c, data);
});

function accepted(
  jobId: string,
  status: string,
  subject: string,
  months: number,
  createdAt: Date,
): BackfillJobAccepted {
  return {
    jobId,
    status: status as BackfillJobStatus,
    subject: subject as Address,
    months,
    createdAt: Math.floor(new Date(createdAt).getTime() / 1000),
  };
}

/**
 * Apakah riwayat sedalam ini sudah pernah dipindai untuk SETIAP protokol?
 *
 * Menuntut "setiap", bukan "ada", dan itu intinya. `firstFactAt` adalah minimum
 * LINTAS protokol, jadi cakupan yang tidak seragam menghasilkan kesimpulan yang
 * salah tentang dompetnya: dompet demo pernah dipindai 24 bulan di Aave tapi
 * hanya 9 bulan di Morpho, dan "riwayatnya mentok 8 bulan" ternyata pernyataan
 * tentang jendela pemindaian, bukan tentang dompetnya. Dua transaksi Morpho dari
 * 2025-09-23 menggeser skornya 797 -> 813.
 *
 * Daftar protokolnya dibaca dari `source_cursors` — apa yang watcher BENAR-BENAR
 * awasi — bukan dari konstanta di sisi API. Protokol kelima yang ditambahkan
 * besok otomatis membuat semua cakupan lama tidak lengkap, yang memang benar.
 *
 * Baris dengan `complete = false` tidak dihitung: rentang yang menyerah berarti
 * riwayatnya berlubang, dan lubang itu tidak punya gejala selain skor yang lebih
 * rendah dari seharusnya.
 *
 * Kedalamannya diukur dari LEBAR baris itu sendiri (`to_block - from_block`),
 * bukan dari ambang `head - months` yang dihitung di sini. Versi pertama
 * memakai ambang, dan ambang itu diturunkan dari cursor watcher — yang selalu
 * tertinggal beberapa ribu blok di belakang head yang dipakai backfill. Terukur
 * 2026-08-26: `from_block` 25.617.433 lawan ambang 25.615.294, meleset 2.139
 * blok, persis sebesar ketertinggalan cursor. Cakupan yang baru saja ditulis
 * dijawab "belum tercakup", dan setiap permintaan berikutnya akan memindai ulang
 * riwayat yang sudah lengkap. Lebar baris tidak punya masalah itu: ia tidak
 * bergantung pada apa pun yang bergerak.
 */
async function isCovered(subject: string, months: number): Promise<boolean> {
  const rows = await sql<{ missing: string }[]>`
    SELECT w.protocol AS missing
    FROM source_cursors w
    WHERE NOT EXISTS (
      SELECT 1 FROM backfill_runs r
      WHERE r.subject = ${subject}
        AND r.protocol = w.protocol
        AND r.complete
        AND r.to_block - r.from_block >= ${months * BLOCKS_PER_MONTH}::bigint
        AND r.to_block >= w.last_scanned_block - ${COVERAGE_SLACK_BLOCKS}::bigint
    )
  `;

  // Nol protokol terawasi berarti watcher belum pernah jalan. Itu BUKAN
  // "semuanya sudah tercakup" — query di atas akan mengembalikan nol baris dan
  // terbaca seperti cakupan penuh. Ditolak eksplisit supaya permintaan tetap
  // masuk antrean alih-alih dijawab `covered` secara keliru.
  const watched = await sql<{ n: string }[]>`SELECT COUNT(*)::text AS n FROM source_cursors`;
  if (Number(watched[0]?.n ?? 0) === 0) return false;

  return rows.length === 0;
}
