'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Waktu sekarang dalam detik, sebagai sumber eksternal — bukan `Date.now()` di
 * badan render dan bukan `setState` di dalam efek.
 *
 * Keduanya ditolak lint di proyek ini, dan keduanya memang keliru untuk kasus
 * ini. Membaca `Date.now()` saat render membuat komponen tidak murni, dan
 * nilainya membeku sampai ada sesuatu yang kebetulan me-render ulang: hitung
 * mundur yang tidak turun terbaca seperti tombol yang macet.
 * `useSyncExternalStore` memang dirancang untuk sumber yang berubah di luar
 * React — pola yang sama sudah dipakai `useIsMounted`.
 *
 * Satu interval untuk SELURUH aplikasi, berapa pun komponen yang memakainya,
 * dan mati sendiri begitu pemakai terakhir lepas.
 *
 * Kerapatan tick adalah milik PEMANGGIL, karena hanya pemanggil yang tahu satuan
 * terkecil yang benar-benar ditampilkannya. Tick 15 detik di bawah label yang
 * mencetak detik menghasilkan persis gejala yang hendak dihindari komentar di
 * atas: angka yang melompat 15 detik lalu membeku, tak terbedakan dari hitung
 * mundur yang berhenti. Store-nya berdetak pada interval TERCEPAT yang sedang
 * diminta, jadi satu komponen berdetik tidak memaksa seluruh aplikasi ikut
 * ter-render tiap detik setelah komponen itu tertutup.
 */
let current = 0;
let timer: number | null = null;
let period = 0;

/** Nilai adalah interval yang diminta tiap pelanggan, bukan sekadar keanggotaan. */
const listeners = new Map<() => void, number>();

const DEFAULT_TICK_MS = 15_000;

function tick(): void {
  current = Math.floor(Date.now() / 1000);
  for (const listener of listeners.keys()) listener();
}

function reschedule(): void {
  const next = listeners.size === 0 ? 0 : Math.min(...listeners.values());
  if (next === period) return;

  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  period = next;
  if (next > 0) timer = window.setInterval(tick, next);
}

function subscribe(listener: () => void, intervalMs: number): () => void {
  // Dibaca sekali di sini supaya pelanggan pertama tidak menunggu satu periode
  // penuh sebelum melihat angka yang benar.
  if (listeners.size === 0) tick();
  listeners.set(listener, intervalMs);
  reschedule();

  return () => {
    listeners.delete(listener);
    reschedule();
  };
}

/**
 * `0` di server dan sebelum langganan pertama — pemanggil harus menanganinya.
 *
 * `intervalMs` adalah kerapatan tick yang dibutuhkan tampilan pemanggil:
 * 1.000 untuk label yang mencetak detik, default 15.000 untuk yang mencetak
 * menit ke atas.
 */
export function useNow(intervalMs: number = DEFAULT_TICK_MS): number {
  return useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(listener, intervalMs), [intervalMs]),
    () => current,
    () => 0,
  );
}
