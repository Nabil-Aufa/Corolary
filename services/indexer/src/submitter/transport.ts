import { ethers } from 'ethers';
import { creditcoinWsUrl } from '../chain/providers.js';
import { loadAbi } from '../chain/abi.js';
import { config, requireContracts } from '../config.js';
import { stageLogger } from '../logger.js';

const log = stageLogger('submitter');

// Aritmetika ukurannya tinggal di `body-size.ts`, yang sengaja tanpa impor
// supaya bisa diuji tanpa `.env`. Diekspor ulang di sini agar pemanggil tetap
// melihat satu modul transport.
export {
  HTTP_BODY_LIMIT,
  hexBytes,
  httpBodyBytesFor,
  maxHttpCallDataBytes,
  needsWebSocket,
} from './body-size.js';

/**
 * Menjalankan satu pengiriman lewat WebSocket, lalu menutup soketnya.
 *
 * `fn` HARUS mencakup `tx.wait()`, bukan hanya pengirimannya. Soketnya ditutup
 * begitu `fn` selesai, dan resi transaksi datang lewat provider yang sama —
 * menunggu di luar cakupan ini berarti menunggu pada provider yang sudah mati,
 * yang muncul sebagai `could not coalesce error` dan diklasifikasikan
 * `retryable`, sehingga transaksi yang SUDAH terkirim dikirim ulang. Terukur
 * di produksi 2026-09-12.
 *
 * Dibuat sesaat dan dibuang, bukan provider kedua yang hidup terus. Fakta
 * sebesar ini langka — 26 sepanjang umur proyek — dan soket yang menetap
 * membawa pekerjaan yang tidak sepadan: menyambung ulang, keepalive, dan satu
 * jalur lagi yang bisa mati diam-diam seperti loop harga dulu.
 *
 * Kalau WS gagal, error-nya dilempar apa adanya supaya pemanggil
 * mengklasifikasikannya seperti kegagalan kirim lainnya. Itu membuat kasus
 * terburuknya sama dengan perilaku hari ini, bukan lebih buruk.
 */
export async function withWebSocketRegistry<T>(
  fn: (registry: ethers.Contract) => Promise<T>,
): Promise<T> {
  const url = creditcoinWsUrl();
  const provider = new ethers.WebSocketProvider(url, config.CREDITCOIN_CHAIN_ID, {
    staticNetwork: true,
  });
  try {
    const wallet = new ethers.Wallet(config.SUBMITTER_PRIVATE_KEY, provider);
    const { factRegistry } = requireContracts();
    log.info({ url }, 'mengirim lewat WebSocket: payload melampaui batas body HTTP');
    return await fn(new ethers.Contract(factRegistry, loadAbi('FactRegistry'), wallet));
  } finally {
    // `destroy` menutup soketnya. Tanpa ini proses menahan handle yang hidup
    // dan mati-nya proses jadi menggantung.
    await provider.destroy();
  }
}
