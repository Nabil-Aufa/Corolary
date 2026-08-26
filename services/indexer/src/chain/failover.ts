import type { ethers } from 'ethers';
import { stageLogger } from '../logger.js';

const log = stageLogger('rpc');

/**
 * Failover RPC Ethereum — SADAR KEMAMPUAN, bukan `FallbackProvider` buta.
 *
 * `ethers.FallbackProvider` mengasumsikan para provider setara. Di sini mereka
 * tidak setara sama sekali, dan itu terukur (2026-08-26, rentang 2.000 blok
 * pada kontrak Aave V3):
 *
 *   drpc        2.602 log dalam 0,9 detik
 *   Alchemy     DITOLAK — "Under the Free tier plan, you can make eth_getLogs
 *               requests with up to a 10 block range"
 *   publicnode  DITOLAK — archive butuh token
 *   ankr        DITOLAK — butuh autentikasi
 *   1rpc        DITOLAK — dibatasi 50 blok
 *   llamarpc    tidak menjawab JSON sama sekali
 *
 * Jadi tidak ada provider gratis kedua yang bisa menggantikan drpc untuk
 * `eth_getLogs` rentang lebar. Yang BISA dilakukan Alchemy adalah semua metode
 * lain (`eth_getBlockByNumber`, `eth_getTransactionReceipt`, `eth_call`) plus
 * `eth_getLogs` dalam potongan <= 10 blok.
 *
 * Konsekuensinya failover di sini menyelamatkan sebagian, bukan semuanya — dan
 * itu dinyatakan terbuka daripada disembunyikan di balik provider yang
 * berpura-pura setara. Kabar baiknya: pemadaman RPC Ethereum hanya menghentikan
 * PENEMUAN event baru. Tahap attestation, prover, dan submitter memakai
 * Creditcoin dan Proof Builder, jadi antrean yang sudah ada tetap mengalir.
 */

/**
 * Batas rentang `eth_getLogs` provider cadangan, dalam blok.
 *
 * 10 adalah angka Alchemy free tier, diambil dari pesan errornya sendiri yang
 * bahkan menyebutkan rentang yang seharusnya dipakai. Inklusif: `from..to`
 * sepanjang 11 blok sudah ditolak.
 */
export const FALLBACK_MAX_LOG_RANGE = 10;

/**
 * Batas jumlah sub-permintaan saat memecah untuk provider cadangan.
 *
 * Tanpa batas ini, satu chunk Compound 2.000 blok menjadi 200 permintaan
 * beruntun ke provider yang justru sedang kita andalkan karena yang utama
 * bermasalah — cara tercepat membuat cadangan ikut kena rate limit. Di atas
 * batas ini kita MENOLAK dengan sebab yang jelas, bukan mencoba dan gagal
 * setengah jalan.
 */
export const FALLBACK_MAX_SPLITS = 50;

/** Memecah [from,to] inklusif jadi potongan selebar `max` blok. */
export function splitRange(from: number, to: number, max: number): [number, number][] {
  if (to < from) return [];
  const out: [number, number][] = [];
  for (let start = from; start <= to; start += max) {
    out.push([start, Math.min(start + max - 1, to)]);
  }
  return out;
}

export interface FailoverDeps {
  /** Nama untuk log. */
  label: string;
  primary: <T>(p: ethers.JsonRpcProvider) => Promise<T>;
}

let degradedSince: number | null = null;

/** Dipanggil setiap kali cadangan menyelamatkan sebuah permintaan. */
function noteDegraded(label: string, err: unknown): void {
  const first = degradedSince === null;
  if (first) degradedSince = Date.now();
  // Peringatan pertama LEBIH keras daripada yang berikutnya: kalau tiap
  // permintaan berteriak sama kencangnya, tidak ada yang terbaca.
  const fields = {
    method: label,
    err: String(err).slice(0, 160),
    degradedSejakMenit: Math.round((Date.now() - (degradedSince ?? Date.now())) / 60_000),
  };
  if (first) {
    log.error(fields, 'RPC utama gagal — beralih ke cadangan. Pipeline berjalan DEGRADASI');
  } else {
    log.warn(fields, 'masih memakai RPC cadangan');
  }
}

function noteRecovered(): void {
  if (degradedSince === null) return;
  log.info(
    { degradedSelamaMenit: Math.round((Date.now() - degradedSince) / 60_000) },
    'RPC utama pulih',
  );
  degradedSince = null;
}

/**
 * Jalankan `fn` di provider utama; kalau gagal, ulangi di cadangan.
 *
 * Untuk metode yang cadangannya sanggup melayani sepenuhnya — blok, receipt,
 * `eth_call`. `eth_getLogs` TIDAK lewat sini; lihat `getLogsWithFailover`.
 */
export async function withFailover<T>(
  label: string,
  primary: ethers.JsonRpcProvider,
  fallback: ethers.JsonRpcProvider | null,
  fn: (p: ethers.JsonRpcProvider) => Promise<T>,
): Promise<T> {
  try {
    const out = await fn(primary);
    noteRecovered();
    return out;
  } catch (err) {
    if (!fallback) throw err;
    noteDegraded(label, err);
    return await fn(fallback);
  }
}

/**
 * `eth_getLogs` dengan failover yang memecah rentang untuk provider cadangan.
 *
 * Sengaja TIDAK mengembalikan array kosong ketika cadangan tidak sanggup.
 * Provider yang menjawab kosong tanpa error adalah mode kegagalan yang sudah
 * pernah menipu proyek ini (llamarpc menjawab `result: []` untuk rentang berisi
 * 711 log Aave), dan menirunya di sini akan membuat watcher menyimpulkan
 * protokolnya sepi lalu memajukan cursor melewati event yang tidak pernah
 * terbaca — kehilangan permanen tanpa satu pun gejala.
 */
export async function getLogsWithFailover(
  primary: ethers.JsonRpcProvider,
  fallback: ethers.JsonRpcProvider | null,
  filter: ethers.Filter,
): Promise<ethers.Log[]> {
  try {
    const out = await primary.getLogs(filter);
    noteRecovered();
    return out;
  } catch (err) {
    if (!fallback) throw err;

    const from = Number(filter.fromBlock);
    const to = Number(filter.toBlock);
    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      // Label blok seperti 'finalized' tidak bisa dipecah; teruskan apa adanya.
      noteDegraded('getLogs', err);
      return await fallback.getLogs(filter);
    }

    const parts = splitRange(from, to, FALLBACK_MAX_LOG_RANGE);
    if (parts.length > FALLBACK_MAX_SPLITS) {
      throw new Error(
        `RPC utama gagal (${String(err).slice(0, 100)}) dan cadangan tidak sanggup: ` +
          `rentang ${from}..${to} butuh ${parts.length} permintaan pada batas ` +
          `${FALLBACK_MAX_LOG_RANGE} blok, di atas ambang ${FALLBACK_MAX_SPLITS}. ` +
          'Kecilkan chunkSize protokol atau pakai RPC cadangan yang sanggup rentang lebar.',
      );
    }

    noteDegraded('getLogs', err);
    const out: ethers.Log[] = [];
    for (const [f, t] of parts) {
      out.push(...(await fallback.getLogs({ ...filter, fromBlock: f, toBlock: t })));
    }
    return out;
  }
}

/** Hanya untuk tes: kembalikan state degradasi ke awal. */
export function _resetDegradedState(): void {
  degradedSince = null;
}
