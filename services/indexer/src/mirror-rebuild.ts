import { ethers } from 'ethers';
import { creditcoin } from './chain/providers.js';
import { loadAbi } from './chain/abi.js';
import { requireContracts } from './config.js';
import { persistReceipt, refreshScores } from './submitter/persist.js';
import { migrate } from './db/migrate.js';
import { closeDb } from './db/client.js';
import { logger } from './logger.js';

/**
 * Membangun ulang mirror Postgres dari log FactRegistry di Creditcoin.
 *
 * Mirror bukan sumber kebenaran — chain-lah sumbernya — jadi harus selalu bisa
 * dibangun ulang. Dipakai setelah kehilangan database, setelah menambah kolom,
 * dan untuk memungut fakta yang tercatat sebelum mirror ada.
 *
 * Aman dijalankan berulang: setiap insert memakai ON CONFLICT DO NOTHING.
 */
const CHUNK = 2000;

/**
 * Berapa receipt Creditcoin diproses bersamaan.
 *
 * Berurutan, ini alat pemulihan yang tidak berfungsi: terukur di produksi
 * 2026-09-01, ~300 fakta dalam 25 menit, proyeksi 8–29 jam untuk riwayat penuh.
 * Node Creditcoin melayani JSON-RPC batch sampai 100 (diukur langsung), jadi
 * batasnya bukan provider melainkan kesopanan — dan tulisan Postgres-nya juga
 * harus muat di pool koneksi.
 *
 * Catatan: `batchMaxCount: 3` yang dipasang di provider ETHEREUM tidak berlaku
 * di sini. Angka itu batas drpc free plan, bukan batas Creditcoin.
 */
const RECEIPT_CONCURRENCY = 8;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (;;) {
        const item = queue.pop();
        if (item === undefined) return;
        await fn(item);
      }
    }),
  );
}

async function main(): Promise<void> {
  await migrate();
  const { factRegistry } = requireContracts();
  const iface = new ethers.Interface(loadAbi('FactRegistry') as ethers.InterfaceAbi);
  const topic = iface.getEvent('FactRecorded')?.topicHash;
  if (!topic) throw new Error('FactRecorded tidak ada di ABI FactRegistry');

  const head = await creditcoin.getBlockNumber();
  const from = Number(process.env.MIRROR_FROM_BLOCK ?? Math.max(0, head - 50_000));

  logger.info({ factRegistry, from, head }, 'membangun ulang mirror');

  const seen = new Set<string>();
  // Skor ditunda ke akhir, bukan disegarkan per receipt. Subjek yang sama
  // muncul di puluhan receipt, dan tiap perhitungan ulang adalah empat
  // panggilan RPC yang hasilnya langsung ditimpa perhitungan berikutnya.
  const subjects = new Set<string>();
  const startedAt = Date.now();
  let facts = 0;

  for (let start = from; start <= head; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, head);
    const logs = await creditcoin.getLogs({
      address: factRegistry,
      topics: [topic],
      fromBlock: start,
      toBlock: end,
    });
    // Satu transaksi Creditcoin memuat banyak FactRecorded (satu batch), dan
    // persistReceipt bekerja per-receipt — jadi dedup dulu, bukan per log.
    const hashes = logs.map((l) => l.transactionHash).filter((h) => !seen.has(h) && seen.add(h));

    await mapLimit(hashes, RECEIPT_CONCURRENCY, async (hash) => {
      const receipt = await creditcoin.getTransactionReceipt(hash);
      if (!receipt) return;
      facts += await persistReceipt(receipt, null, { collectSubjects: subjects });
    });

    if (logs.length > 0) {
      logger.info({ from: start, to: end, tx: seen.size, facts, subjects: subjects.size }, 'blok dipindai');
    }
  }

  // Sekali per subjek, terhadap keadaan chain SEKARANG — yang memang satu-satunya
  // keadaan yang bisa dijawab `scoreOf`. Menyegarkannya per receipt lama justru
  // menulis skor hari ini ke score_history dengan stempel blok masa lalu.
  logger.info({ subjects: subjects.size }, 'menghitung ulang skor');
  await refreshScores([...subjects], head);

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  logger.info(
    { creditcoinTx: seen.size, facts, subjects: subjects.size, seconds },
    'mirror selesai dibangun',
  );
}

main()
  .catch((err) => {
    logger.error({ err: String(err) }, 'pembangunan mirror gagal');
    process.exitCode = 1;
  })
  .finally(closeDb);
