import { ethers } from 'ethers';
import { creditcoin } from './chain/providers.js';
import { loadAbi } from './chain/abi.js';
import { requireContracts } from './config.js';
import { persistReceipt } from './submitter/persist.js';
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
    for (const l of logs) {
      if (seen.has(l.transactionHash)) continue;
      seen.add(l.transactionHash);
      const receipt = await creditcoin.getTransactionReceipt(l.transactionHash);
      if (!receipt) continue;
      facts += await persistReceipt(receipt, null);
    }
    if (logs.length > 0) {
      logger.info({ from: start, to: end, tx: seen.size, facts }, 'blok dipindai');
    }
  }

  logger.info({ creditcoinTx: seen.size, facts }, 'mirror selesai dibangun');
}

main()
  .catch((err) => {
    logger.error({ err: String(err) }, 'pembangunan mirror gagal');
    process.exitCode = 1;
  })
  .finally(closeDb);
