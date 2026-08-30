import { migrate } from './db/migrate.js';
import { closeDb } from './db/client.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { PROTOCOLS } from './watcher/protocols.js';
import { watchOnce } from './watcher/watch.js';
import { waitOnce } from './attestation/waiter.js';
import { proveOnce } from './prover/run.js';
import { runEagerProveJobs } from './jobs/eagerProve.js';
import { runBackfillJobs } from './jobs/backfill.js';
import { initSubmitter, submitOnce } from './submitter/submit.js';
import { initPrices, refreshPricesOnce, priceFreshness } from './prices/run.js';
import {
  oldestUnprovenAgeSeconds,
  queueSizes,
  WARN_AGE_SECONDS,
  CRITICAL_AGE_SECONDS,
} from './metrics.js';

/**
 * Satu proses, empat loop.
 *
 * Antreannya adalah tabel Postgres, bukan Redis/Kafka. Di skala ini satu proses
 * meniadakan koordinasi lintas-proses, dan yang lebih penting: submitter jadi
 * satu-satunya penulis dari kunci submitter, sehingga manajemen nonce tidak
 * butuh lock terdistribusi.
 */
const WATCH_INTERVAL_MS = 15_000;
const WAIT_INTERVAL_MS = 15_000; // ~1 blok Creditcoin
const PROVE_INTERVAL_MS = 5_000;
const BACKFILL_INTERVAL_MS = 20_000;
const SUBMIT_INTERVAL_MS = 5_000;
const METRICS_INTERVAL_MS = 60_000;
// Harga tidak butuh putaran cepat: ambang penyegarannya satu jam, dan tiap
// putaran hanya satu eth_call per feed untuk memastikan.
const PRICE_INTERVAL_MS = 120_000;

let stopping = false;

/**
 * Batas waktu satu iterasi loop.
 *
 * Ada karena `loop` menjadwalkan tick berikutnya SETELAH `await fn()` selesai —
 * jadi satu iterasi yang tidak pernah selesai menghentikan loop itu selamanya,
 * tanpa satu pun error, tanpa gejala apa pun selain pekerjaan yang berhenti
 * diam-diam. Terjadi 2026-08-26: loop harga berhenti sepenuhnya sementara
 * watcher dan submitter terus berjalan; tidak ada `recordPrice` selama 1 jam 40
 * menit padahal ronde Chainlink baru sudah tersedia, dan 50 transaksi terakhir
 * submitter semuanya `recordFactBatch`.
 *
 * Yang bisa menggantung tanpa batas: `tx.wait()` pada transaksi yang tidak
 * pernah tertambang. Proof Builder punya timeout 60 detik dan `getLogs` punya
 * timeout HTTP, jadi keduanya bukan penyebabnya.
 *
 * 10 menit jauh di atas iterasi terlama yang wajar (chunk Aave ~40 detik,
 * pengiriman batch beberapa detik), jadi ia tidak akan memotong pekerjaan yang
 * sehat.
 */
const ITERATION_TIMEOUT_MS = 600_000;

/**
 * Loop yang tidak pernah menjalankan dua iterasi bersamaan — dan tidak pernah
 * berhenti diam-diam.
 *
 * setInterval akan menumpuk iterasi kalau satu putaran lebih lambat dari
 * intervalnya; pada watcher itu berarti beberapa eth_getLogs berjalan bersamaan
 * dan memicu rate limit yang justru memperlambatnya lagi.
 *
 * Iterasi yang melewati `ITERATION_TIMEOUT_MS` dijadwalkan ulang, dan itu
 * disengaja meski berarti iterasi lama mungkin masih berjalan: loop yang
 * tumpang tindih sesekali bisa dipulihkan, loop yang mati permanen tidak.
 * Pengaman terhadap tumpang tindih ada di lapis bawah — `claimNextNonce` dan
 * `FOR UPDATE SKIP LOCKED` — bukan di sini.
 */
function loop(name: string, intervalMs: number, fn: () => Promise<void>): void {
  const tick = async (): Promise<void> => {
    if (stopping) return;
    const startedAt = Date.now();
    try {
      let timer: NodeJS.Timeout | undefined;
      const guard = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`iterasi melewati ${ITERATION_TIMEOUT_MS} ms`)),
          ITERATION_TIMEOUT_MS,
        );
      });
      try {
        await Promise.race([fn(), guard]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= ITERATION_TIMEOUT_MS) {
        logger.error(
          { loop: name, durationMs },
          'iterasi loop MENGGANTUNG dan dilewati — loop dijadwalkan ulang. ' +
            'Iterasi lama mungkin masih berjalan; periksa penyebabnya',
        );
      } else {
        logger.error({ loop: name, err: String(err), durationMs }, 'iterasi loop gagal');
      }
    }
    if (!stopping) setTimeout(() => void tick(), intervalMs);
  };
  void tick();
}

async function main(): Promise<void> {
  await migrate();

  logger.info(
    {
      chainKey: config.ETHEREUM_CHAIN_KEY,
      protocols: PROTOCOLS.map((p) => p.name),
      creditcoinChainId: config.CREDITCOIN_CHAIN_ID,
    },
    'indexer start',
  );

  // Watcher dijalankan berurutan antar protokol, bukan Promise.all: batas
  // praktisnya satu eth_getLogs in-flight per protokol, dan menembakkan
  // keempatnya sekaligus adalah cara tercepat kena rate limit.
  loop('watcher', WATCH_INTERVAL_MS, async () => {
    for (const cfg of PROTOCOLS) {
      await watchOnce(cfg);
    }
  });

  loop('attestation-waiter', WAIT_INTERVAL_MS, waitOnce);
  loop('prover', PROVE_INTERVAL_MS, proveOnce);

  // Permintaan eksplisit dari POST /v1/prove. Tanpa loop ini endpoint itu
  // menerima job yang tidak pernah dikerjakan siapa pun — fitur yang tampak
  // hidup padahal tidak, yang persis dilarang aturan nol-mock.
  loop('prove-jobs', PROVE_INTERVAL_MS, runEagerProveJobs);

  // Permintaan dari POST /v1/backfill. Intervalnya panjang dan pekerjanya
  // serial: satu backfill makan menit, bukan detik, dan berbagi RPC Ethereum
  // dengan watcher di atas. Menyalakannya secepat prove-jobs hanya menambah
  // polling ke Postgres untuk pekerjaan yang tidak bisa dimulai.
  loop('backfill-jobs', BACKFILL_INTERVAL_MS, runBackfillJobs);

  // Submitter hanya menyala kalau alamat kontraknya sudah ada. Sebelum deploy,
  // tiga tahap di atas tetap bekerja dan menumpuk antrean yang siap dikirim.
  let submitterReady = false;
  try {
    await initSubmitter();
    loop('submitter', SUBMIT_INTERVAL_MS, submitOnce);
    submitterReady = true;
  } catch (err) {
    logger.error(
      { err: String(err) },
      'submitter tidak aktif — pipeline berhenti di status submitting',
    );
  }

  // TRY TERPISAH, dan itu inti perbaikannya.
  //
  // Sebelumnya `initPrices()` berbagi satu `try` dengan `initSubmitter()`,
  // sementara `loop('submitter')` sudah dinyalakan di baris sebelumnya. Satu
  // kegagalan RPC di dalam `initPrices` karena itu melompati penjadwalan
  // `loop('prices')` SELAMANYA — tanpa mematikan apa pun yang lain. Fakta terus
  // mengalir, watcher tetap di head, setiap dashboard hijau, dan satu-satunya
  // gejalanya adalah harga yang tidak pernah diperbarui sampai pasar membeku.
  // Terukur 2026-08-30: 91,8 jam tanpa satu pun `recordPrice`.
  //
  // Sekarang `initPrices()` tidak menyentuh jaringan sama sekali — verifikasi
  // feed pindah ke dalam loop — sehingga satu-satunya hal yang bisa
  // menggagalkannya adalah alamat kontrak yang belum dikonfigurasi. Dan kalau
  // itu terjadi, ia `error`, bukan `warn`: harga yang mati membekukan seluruh
  // lapis pasar, tempat `capitalSavedUsd` hidup.
  //
  // Tetap digantung pada `submitterReady`: jalur harga mengklaim nonce dari
  // baris `submitter_state` yang sama, dan baris itu dibuat `reconcileNonce()`
  // di dalam `initSubmitter`.
  if (submitterReady) {
    try {
      initPrices();
      loop('prices', PRICE_INTERVAL_MS, refreshPricesOnce);
    } catch (err) {
      logger.error(
        { err: String(err) },
        'jalur harga TIDAK menyala — pasar akan membeku begitu harga terakhir basi',
      );
    }
  }

  loop('metrics', METRICS_INTERVAL_MS, async () => {
    const age = await oldestUnprovenAgeSeconds();
    const queue = await queueSizes();

    // Umur harga ikut di baris yang SAMA dengan antrean fakta, dan itu
    // disengaja. Kegagalan jalur harga tidak menghentikan apa pun yang lain,
    // jadi ia hanya bisa terlihat kalau ia menumpang pada baris yang memang
    // sudah dibaca orang. `null` kalau jalur harga tidak menyala sama sekali —
    // yang justru keadaan paling berbahaya, bukan yang paling tenang.
    let priceAgeSeconds: number | null = null;
    if (submitterReady) {
      try {
        const feeds = await priceFreshness();
        const ages = feeds.map((f) => f.ageSeconds).filter((a): a is number => a !== null);
        priceAgeSeconds = ages.length === feeds.length ? Math.max(...ages) : null;
      } catch {
        priceAgeSeconds = null;
      }
    }

    const payload = { oldestUnprovenAgeSeconds: age, queue, priceAgeSeconds };
    if (age >= CRITICAL_AGE_SECONDS) {
      logger.error(payload, 'event tertua mendekati batas 24 jam eager-proving');
    } else if (age >= WARN_AGE_SECONDS) {
      logger.warn(payload, 'backlog proving menua');
    } else {
      logger.info(payload, 'status antrean');
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutdown');
    stopping = true;
    void closeDb().finally(() => process.exit(0));
  });
}

main().catch((err) => {
  logger.error({ err: String(err) }, 'indexer gagal start');
  process.exitCode = 1;
});
