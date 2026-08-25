import { migrate } from './db/migrate.js';
import { closeDb } from './db/client.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { PROTOCOLS } from './watcher/protocols.js';
import { watchOnce } from './watcher/watch.js';
import { waitOnce } from './attestation/waiter.js';
import { proveOnce } from './prover/run.js';
import { runEagerProveJobs } from './jobs/eagerProve.js';
import { initSubmitter, submitOnce } from './submitter/submit.js';
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
const SUBMIT_INTERVAL_MS = 5_000;
const METRICS_INTERVAL_MS = 60_000;

let stopping = false;

/**
 * Loop yang tidak pernah menjalankan dua iterasi bersamaan.
 *
 * setInterval akan menumpuk iterasi kalau satu putaran lebih lambat dari
 * intervalnya — pada watcher itu berarti beberapa eth_getLogs berjalan
 * bersamaan dan memicu rate limit yang justru memperlambatnya lagi.
 */
function loop(name: string, intervalMs: number, fn: () => Promise<void>): void {
  const tick = async (): Promise<void> => {
    if (stopping) return;
    try {
      await fn();
    } catch (err) {
      logger.error({ loop: name, err: String(err) }, 'iterasi loop gagal');
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

  // Submitter hanya menyala kalau alamat kontraknya sudah ada. Sebelum deploy,
  // tiga tahap di atas tetap bekerja dan menumpuk antrean yang siap dikirim.
  try {
    await initSubmitter();
    loop('submitter', SUBMIT_INTERVAL_MS, submitOnce);
  } catch (err) {
    logger.warn(
      { err: String(err) },
      'submitter tidak aktif — pipeline berhenti di status submitting',
    );
  }

  loop('metrics', METRICS_INTERVAL_MS, async () => {
    const age = await oldestUnprovenAgeSeconds();
    const queue = await queueSizes();
    const payload = { oldestUnprovenAgeSeconds: age, queue };
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
