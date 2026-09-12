import { ethers } from 'ethers';
import { creditcoinWsUrl } from '../chain/providers.js';
import { loadAbi } from '../chain/abi.js';
import { config, requireContracts } from '../config.js';
import { stageLogger } from '../logger.js';

const log = stageLogger('submitter');

/**
 * Plafon body HTTP di RPC CC3 publik: 1 MiB, PERSIS.
 *
 * Diukur 2026-09-12 dengan pencarian biner memakai `eth_call` berpayload
 * (baca-saja, tanpa menyentuh state), disertai kontrol body kecil yang lolos
 * supaya 413-nya bermakna: body 1.048.575 byte dijawab 200, body 1.048.577
 * dijawab 413 dengan halaman error nginx. Jadi ini `client_max_body_size 1m`,
 * default nginx — konfigurasi server, bukan batas protokol.
 *
 * Kompresi TIDAK tersedia sebagai jalan keluar: body ber-`Content-Encoding:
 * gzip` dijawab 400 galat parse bahkan pada ukuran kecil (kontrol polos lolos
 * di ukuran yang sama), jadi node tidak membongkar gzip.
 */
export const HTTP_BODY_LIMIT = 1_048_576;

/**
 * Selubung JSON-RPC di sekitar heks transaksi, dibulatkan ke atas.
 *
 * `{"jsonrpc":"2.0","id":N,"method":"eth_sendRawTransaction","params":["0x…"]}`
 * berukuran ~100 byte; 256 dipakai supaya perkiraan ini TIDAK pernah lebih
 * kecil daripada kenyataan. Perkiraan yang terlalu optimistis di sini berarti
 * transaksi dikirim lewat HTTP lalu mati 413 — persis kegagalan yang sedang
 * diperbaiki.
 */
const JSONRPC_ENVELOPE = 256;

/** Selubung transaksi bertanda tangan di luar calldata: nonce, gas, tujuan, v/r/s. */
const TX_ENVELOPE = 160;

/**
 * Ambang keamanan. Penggabungan batch ethers bisa menaruh permintaan lain di
 * body yang sama (lihat `CREDITCOIN_BATCH_MAX` di providers.ts), jadi batas
 * yang dipakai sengaja lebih rendah daripada batas sebenarnya.
 */
const HEADROOM = 64 * 1024;

/** Ukuran body HTTP yang akan dihasilkan oleh calldata sebesar ini. */
export function httpBodyBytesFor(callDataBytes: number): number {
  // Heks: dua karakter per byte. Inilah yang membuat plafon 1 MiB terasa
  // sebagai plafon ~510 KB pada transaksinya.
  return JSONRPC_ENVELOPE + 2 * (callDataBytes + TX_ENVELOPE);
}

/** Calldata terbesar yang masih aman lewat HTTP. */
export function maxHttpCallDataBytes(): number {
  return Math.floor((HTTP_BODY_LIMIT - HEADROOM - JSONRPC_ENVELOPE) / 2) - TX_ENVELOPE;
}

/**
 * Apakah calldata sebesar ini harus lewat WebSocket alih-alih HTTP.
 *
 * Dipakai SEBELUM mengirim, bukan sebagai penanganan error. Menunggu 413 lebih
 * mahal daripada mengukur: proof-nya sudah dibayar, nonce sudah diklaim, dan
 * 413 pada transaksi tunggal diklasifikasikan `fatal` — jadi satu event mati
 * permanen padahal jalur lain tersedia.
 */
export function needsWebSocket(callDataBytes: number): boolean {
  return httpBodyBytesFor(callDataBytes) > HTTP_BODY_LIMIT - HEADROOM;
}

/** Ukuran byte dari sebuah string heks `0x…`. */
export function hexBytes(hex: string): number {
  return Math.max(0, hex.length / 2 - 1);
}

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
