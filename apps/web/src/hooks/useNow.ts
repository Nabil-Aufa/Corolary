'use client';

import { useSyncExternalStore } from 'react';

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
 */
let current = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

const TICK_MS = 15_000;

function tick(): void {
  current = Math.floor(Date.now() / 1000);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    tick();
    timer = window.setInterval(tick, TICK_MS);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

/** `0` di server dan sebelum langganan pertama — pemanggil harus menanganinya. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 0,
  );
}
