import { ethers } from 'ethers';
import { config } from '../config.js';
import { getLogsWithFailover, withFailover } from './failover.js';

// Backend memakai ethers v6 (frontend memakai viem/wagmi). Disengaja: SDK
// Attestcoin memaksa ethers. Keduanya tidak pernah bertemu di satu file.
/**
 * Ukuran batch JSON-RPC dikunci PER PROVIDER, bukan sekali untuk semua.
 *
 * ethers v6 diam-diam menggabungkan permintaan yang berjalan bersamaan menjadi
 * SATU JSON-RPC batch. Begitu getBlock dijalankan paralel, ethers mengirim batch
 * berisi 12 permintaan dan drpc free plan menolak SELURUH batch dengan HTTP 500:
 * "Batch of more than 3 requests are not allowed on free plan". Yang gagal bukan
 * satu permintaan, melainkan semuanya sekaligus — dan pesannya muncul sebagai
 * error server, bukan rate limit, sehingga mudah salah didiagnosis.
 *
 * mevblocker menerima batch 12 (diuji 2026-09-08, 12 respons semuanya ok), jadi
 * yang utama tidak perlu ikut menanggung batas drpc. 10 dipilih, bukan 12, agar
 * angka yang dipakai berada di bawah yang terbukti — bukan tepat di atasnya.
 *
 * Paralelismenya sendiri dipertahankan di kedua sisi: itu yang memangkas satu
 * chunk Aave dari 39,6 detik ke 4,17 detik.
 */
const PRIMARY_BATCH_MAX = 10;
const FALLBACK_BATCH_MAX = 3;

export const ethereum = new ethers.JsonRpcProvider(config.ETHEREUM_RPC_URL, 1, {
  staticNetwork: true,
  batchMaxCount: PRIMARY_BATCH_MAX,
});

/**
 * RPC Ethereum cadangan. `null` kalau tidak dikonfigurasi.
 *
 * Kemampuannya TIDAK setara dengan yang utama — lihat `failover.ts`. drpc free
 * melayani semua metode kecuali `eth_getLogs` rentang > ~50 blok, dan batas
 * batch-nya 3. Ia tetap cadangan TERBAIK yang tersedia tanpa API key: Alchemy
 * free lebih sempit lagi (10 blok).
 */
export const ethereumFallback: ethers.JsonRpcProvider | null =
  config.ETHEREUM_RPC_URL_FALLBACK
    ? new ethers.JsonRpcProvider(config.ETHEREUM_RPC_URL_FALLBACK, 1, {
        staticNetwork: true,
        batchMaxCount: FALLBACK_BATCH_MAX,
      })
    : null;

/** `getLogs` dengan failover + pemecahan rentang untuk cadangan yang terbatas. */
export function ethGetLogs(filter: ethers.Filter): Promise<ethers.Log[]> {
  return getLogsWithFailover(ethereum, ethereumFallback, filter);
}

/**
 * Kepala rantai yang sudah FINAL, dengan rute yang sadar kemampuan.
 *
 * mevblocker — RPC utama — hanya melayani tag `latest` dan nomor blok. `safe`,
 * `finalized`, dan `pending` dijawab halaman Cloudflare `error code: 1015`,
 * yaitu HTML, bukan JSON; ethers menerjemahkannya jadi 504 Gateway Timeout.
 * Gejalanya jauh lebih buruk daripada kedengarannya: `getBlock('finalized')`
 * adalah panggilan PERTAMA di tiap iterasi watcher, jadi kegagalannya membatalkan
 * iterasi sebelum satu baris log watcher pun ditulis. Terukur 2026-09-08 —
 * cursor keempat protokol tidak bergerak sedetik pun sementara submitter dan
 * jalur harga bekerja normal, dan `stage: "watcher"` sama sekali absen dari log.
 *
 * Karena itu tag ini dirutekan ke CADANGAN lebih dulu. Ini bukan failover —
 * failover bereaksi setelah gagal, sedangkan di sini kita sudah TAHU siapa yang
 * sanggup. Membiarkannya jatuh lewat failover berarti membayar satu 504 (dan
 * satu peringatan DEGRADASI palsu) setiap iterasi, selamanya.
 *
 * Tanpa cadangan, kita tetap mencoba yang utama: gagal dengan sebab yang jelas
 * lebih baik daripada diam-diam memakai `latest` — blok yang belum final bisa
 * ter-reorg, dan fakta yang dibuktikan di atasnya tidak bisa ditarik kembali.
 */
export async function ethFinalizedBlock(): Promise<ethers.Block | null> {
  if (ethereumFallback) {
    try {
      return await ethereumFallback.getBlock('finalized');
    } catch (err) {
      // Cadangan pun bisa jatuh; baru di sinilah yang utama patut dicoba.
      return withFailover('getBlockFinalized', ethereum, null, (p) =>
        p.getBlock('finalized'),
      );
    }
  }
  return ethereum.getBlock('finalized');
}

/** `getBlock`/`getTransactionReceipt`/`eth_call` — cadangan melayani penuh. */
export function ethCall<T>(
  label: string,
  fn: (p: ethers.JsonRpcProvider) => Promise<T>,
): Promise<T> {
  return withFailover(label, ethereum, ethereumFallback, fn);
}

export const creditcoin = new ethers.JsonRpcProvider(
  config.CREDITCOIN_RPC_URL,
  config.CREDITCOIN_CHAIN_ID,
  { staticNetwork: true },
);

export const submitter = new ethers.Wallet(config.SUBMITTER_PRIVATE_KEY, creditcoin);

export const ETH_CHAIN_KEY = config.ETHEREUM_CHAIN_KEY;
