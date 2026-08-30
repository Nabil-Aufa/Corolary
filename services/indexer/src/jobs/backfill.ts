import { sql } from '../db/client.js';
import { stageLogger } from '../logger.js';
import { backfillSubject } from '../backfill/run.js';
import { oldestUnprovenAgeSeconds, CRITICAL_AGE_SECONDS } from '../metrics.js';

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

/**
 * Rem di depan: pipeline yang sudah tertekan tidak boleh dibebani backfill
 * baru. Ketiganya dicek TANPA panggilan RPC tambahan — hanya baca Postgres —
 * supaya pemeriksaan ini sendiri tidak ikut menambah beban ke provider yang
 * sedang bermasalah.
 */

/**
 * Watcher berputar tiap 15 detik (`WATCH_INTERVAL_MS` di `main.ts`) dan
 * menulis `source_cursors.updated_at` di akhir setiap tick yang berhasil.
 * 300 detik (5 menit) = 20x lipat interval itu — jauh lebih longgar daripada
 * satu tick yang sekadar lambat (mis. chunk Aave besar dengan ratusan blok
 * unik yang masing-masing butuh `getBlock` untuk timestamp), tapi cukup ketat
 * untuk menangkap watcher yang benar-benar tersendat atau berhenti. Dipilih
 * dari `updated_at`, bukan dari selisih terhadap tinggi blok Ethereum
 * terkini, persis supaya pemeriksaan ini tidak perlu panggilan RPC sendiri.
 */
const WATCHER_STALE_SECONDS = 300;

/**
 * 90 menit, dan angkanya diturunkan dari anggaran yang BENAR-BENAR berlaku.
 *
 * Bukan 24 jam. `maxPriceAge` GLOBAL di PriceRegistry yang hidup terbaca
 * 10.800 detik (3 jam) pada pembacaan langsung 2026-08-30; yang 100.800 detik
 * adalah override per-aset `maxPriceAgeOf`, dan ia hanya dipasang untuk USDC —
 * satu-satunya feed dengan heartbeat 24 jam. WETH dan WBTC (heartbeat 1 jam)
 * memakai anggaran 3 jam. Ambang 24 jam karena itu tidak akan pernah menyala
 * sebelum pasar sudah lama membeku: ia delapan kali lebih longgar daripada
 * anggaran aset yang paling ketat.
 *
 * 90 menit = separuh anggaran 3 jam. Cukup longgar untuk feed cepat yang
 * kebetulan diam sesaat, cukup ketat untuk menahan backfill SEBELUM harga
 * benar-benar ditolak kontrak.
 *
 * PENTING: `prices` di sini adalah MIRROR Postgres, bukan state on-chain.
 * Ia cukup sebagai sinyal "jalur harga sedang tersendat" untuk menunda
 * backfill — TAPI tidak boleh dibaca sebagai verifikasi kesehatan pasar.
 * Verifikasi sungguhan wajib lewat `cast call tryToUsd1e18` terhadap kontrak,
 * bukan lewat tabel ini: mirror bisa terlihat sehat sementara registry kosong.
 */
const PRICE_STALE_SECONDS = 90 * 60;

/** Berapa lama job yang ditunda diam sebelum dicek ulang. */
const POSTPONE_MINUTES = 5;

/**
 * Rate-limit log.warn kesehatan. Loop ini berputar tiap 20 detik
 * (`BACKFILL_INTERVAL_MS`); tanpa rate-limit, satu kondisi tertekan yang
 * berlangsung berjam-jam akan menghasilkan ratusan baris warn yang identik.
 * Sekali per jendela penundaan sudah cukup untuk operator tahu apa yang
 * terjadi tanpa menenggelamkan log lain.
 */
const HEALTH_WARN_INTERVAL_MS = POSTPONE_MINUTES * 60_000;
let lastHealthWarnAt = 0;

interface HealthCheck {
  ok: boolean;
  reason: string | null;
}

/**
 * a. Watcher tertinggal — cursor mana pun basi lebih dari `WATCHER_STALE_SECONDS`.
 * b. Backlog proving sudah menua — melewati `CRITICAL_AGE_SECONDS` (metrics.ts).
 * c. Harga mendekati basi — mirror `prices` menunjukkan feed mana pun sudah
 *    melewati `PRICE_STALE_SECONDS` sejak update on-chain terakhirnya.
 *
 * Tabel kosong (belum ada cursor / belum ada harga) TIDAK dianggap tertekan —
 * itu kondisi bootstrap, bukan kondisi macet.
 */
async function checkHealth(): Promise<HealthCheck> {
  const [cursorRows, unprovenAge, priceRows] = await Promise.all([
    sql<{ stalest_seconds: number | null }[]>`
      SELECT EXTRACT(EPOCH FROM (now() - min(updated_at)))::float8 AS stalest_seconds
      FROM source_cursors
    `,
    oldestUnprovenAgeSeconds(),
    sql<{ oldest_seconds: number | null }[]>`
      SELECT max(EXTRACT(EPOCH FROM now())::bigint - updated_at) AS oldest_seconds
      FROM prices
    `,
  ]);

  const cursorStaleSeconds = cursorRows[0]?.stalest_seconds ?? null;
  if (cursorStaleSeconds !== null && cursorStaleSeconds > WATCHER_STALE_SECONDS) {
    return {
      ok: false,
      reason: `watcher tertinggal — cursor paling basi ${Math.round(cursorStaleSeconds)}s (ambang ${WATCHER_STALE_SECONDS}s)`,
    };
  }

  if (unprovenAge > CRITICAL_AGE_SECONDS) {
    return {
      ok: false,
      reason: `backlog proving sudah menua — ${unprovenAge}s (ambang kritis ${CRITICAL_AGE_SECONDS}s)`,
    };
  }

  const priceOldestSeconds = priceRows[0]?.oldest_seconds ?? null;
  if (priceOldestSeconds !== null && priceOldestSeconds > PRICE_STALE_SECONDS) {
    return {
      ok: false,
      reason: `harga mendekati basi — feed paling tua ${Math.round(priceOldestSeconds)}s sejak update on-chain (ambang ${PRICE_STALE_SECONDS}s)`,
    };
  }

  return { ok: true, reason: null };
}

/**
 * Menunda SATU job pending tanpa mengklaimnya — tidak menaikkan `attempts`,
 * tidak mengubah `status`. `run_after` didorong maju supaya SELECT klaim di
 * `runBackfillJobs` tidak memilihnya lagi sampai jendela penundaan lewat.
 */
async function postponeNextJob(reason: string): Promise<void> {
  const rows = await sql<{ id: string }[]>`
    UPDATE jobs SET run_after = now() + make_interval(mins => ${POSTPONE_MINUTES}), updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE kind = 'backfill' AND status = 'pending'
        AND (run_after IS NULL OR run_after <= now())
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;
  if (rows.length === 0) return; // tidak ada job yang menunggu — tidak ada yang perlu ditunda

  const now = Date.now();
  if (now - lastHealthWarnAt > HEALTH_WARN_INTERVAL_MS) {
    lastHealthWarnAt = now;
    log.warn({ jobId: rows[0]?.id, reason, postponeMinutes: POSTPONE_MINUTES }, 'backfill ditunda — pipeline sedang tertekan');
  }
}

export async function runBackfillJobs(): Promise<void> {
  if (running) return;

  const health = await checkHealth();
  if (!health.ok) {
    await postponeNextJob(health.reason ?? 'alasan tidak diketahui');
    return;
  }

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
