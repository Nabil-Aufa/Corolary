/**
 * Satu putaran jalur harga lalu keluar. Dipakai untuk verifikasi manual dan
 * untuk mengisi harga pertama kali tanpa menjalankan seluruh indexer.
 *
 * JANGAN jalankan bersamaan dengan indexer: keduanya mengklaim nonce dari
 * kunci submitter yang sama.
 */
import { reconcileNonce } from '../submitter/nonce.js';
import { closeDb } from '../db/client.js';
import { logger } from '../logger.js';
import { initPrices, refreshPricesOnce } from './run.js';

await reconcileNonce();
await initPrices();
await refreshPricesOnce();
logger.info('putaran harga selesai');
await closeDb();
