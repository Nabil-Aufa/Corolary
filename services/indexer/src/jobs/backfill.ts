import { sql } from '../db/client.js';
import { stageLogger } from '../logger.js';
import { backfillSubject } from '../backfill/run.js';

const log = stageLogger('backfill');

/**
 * Menjalankan permintaan backfill dari `POST /v1/backfill`.
 *
 * Jalur kodenya sama persis dengan CLI — `backfillSubject`, tanpa cabang. Yang
 * berbeda cuma pemicunya. Backfill punya banyak perilaku halus (rentang
 * adaptif, pemecahan rentang, pencatatan cakupan, laporan biaya); menyalinnya
 * ke jalur kedua berarti dua tempat yang harus sama-sama benar soal semua itu.
 */

/**
 * Prioritas antrean untuk backfill yang dipicu pengguna.
 *
 * Ada seseorang yang menekan tombol dan menunggu layar. Antrean latar penuh
 * butuh ~110 menit untuk habis (migrasi 0009); tanpa didahulukan, tombol itu
 * secara efektif tidak berfungsi.
 */
const USER_PRIORITY = 10;

/**
 * Satu backfill pada satu waktu, se-proses.
 *
 * Bukan kehati-hatian berlebihan. Backfill berbagi RPC Ethereum dengan watcher
 * live, dan burst-nya sudah pernah membuat drpc membalas 403 untuk SEMUA
 * permintaan rentang lebar selama beberapa menit — artinya backfill yang rakus
 * bisa menjatuhkan pipeline produksi. Dua backfill sekaligus menggandakan
 * risiko itu untuk nol keuntungan: keduanya melambat, bukan selesai lebih cepat.
 *
 * Ini juga satu-satunya rem BIAYA yang sebenarnya. Rate limit per-IP di API
 * membatasi seberapa cepat job MASUK; yang membatasi seberapa cepat CTC KELUAR
 * adalah baris ini.
 */
let running = false;

interface JobRow {
  id: string;
  payload: { subject: string; months: number };
  attempts: number;
}

const MAX_ATTEMPTS = 3;

export async function runBackfillJobs(): Promise<void> {
  if (running) return;

  const rows = await sql<JobRow[]>`
    UPDATE jobs SET status = 'running', updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE kind = 'backfill' AND status = 'pending'
        AND (run_after IS NULL OR run_after <= now())
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id, payload, attempts
  `;
  const job = rows[0];
  if (!job) return;

  running = true;
  const startedAt = Date.now();
  try {
    const result = await backfillSubject({
      subject: job.payload.subject,
      months: job.payload.months,
      untilMonths: 0,
      protocols: null,
      dryRun: false,
      priority: USER_PRIORITY,
    });

    // `partial`, bukan `complete`. Rentang yang menyerah berarti riwayatnya
    // berlubang, dan lubang itu tidak punya gejala apa pun di UI: skornya tetap
    // sah, cuma lebih rendah dari seharusnya. Satu-satunya cara pengguna bisa
    // tahu adalah kalau status ini jujur.
    const status = result.failedRanges > 0 ? 'partial' : 'complete';
    await sql`
      UPDATE jobs
      SET status = ${status},
          payload = payload || ${sql.json({
            failedRanges: result.failedRanges,
            logsFound: result.logsFound,
            fromBlock: result.fromBlock,
            toBlock: result.toBlock,
          })}::jsonb,
          last_error = ${
            result.failedRanges > 0 ? `${result.failedRanges} rentang tidak terbaca` : null
          },
          updated_at = now()
      WHERE id = ${job.id}
    `;
    log.info(
      { jobId: job.id, subject: job.payload.subject, status, durationMs: Date.now() - startedAt },
      'job backfill selesai',
    );
  } catch (err) {
    await requeue(job, String(err));
  } finally {
    running = false;
  }
}

async function requeue(job: JobRow, reason: string): Promise<void> {
  const attempts = job.attempts + 1;
  // Backoff jauh lebih panjang daripada job proving. Kegagalan di sini hampir
  // selalu berarti provider RPC sedang membatasi kita, dan mencoba lagi
  // beberapa detik kemudian adalah cara memperpanjang pembatasan itu.
  await sql`
    UPDATE jobs
    SET status = ${attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'},
        attempts = ${attempts}, last_error = ${reason},
        run_after = now() + make_interval(secs => ${60 * 2 ** attempts}),
        updated_at = now()
    WHERE id = ${job.id}
  `;
  log.warn({ jobId: job.id, attempts, reason }, 'job backfill dijadwalkan ulang');
}
