/**
 * Daftar hal yang benar-benar harus selesai sebelum halaman boleh terlihat.
 *
 * Loading screen di proyek ini tidak boleh jadi timer berkostum. Aturan yang
 * sama dengan `check:no-mocks`: kontrol yang kelihatan mengukur sesuatu tapi
 * sebenarnya cuma menghitung mundur adalah mock, hanya saja mock-nya berupa
 * progres alih-alih angka. Jadi progresnya dihitung dari gerbang NYATA yang
 * didaftarkan bagian-bagian halaman itu sendiri.
 *
 * Dua sifat yang mudah dilewatkan dan keduanya wajib:
 *
 * 1. **Gerbang DIKLAIM lebih dulu, baru diselesaikan.** Kalau layar hanya
 *    menunggu `resolve` tanpa tahu berapa yang akan datang, ia tidak punya
 *    penyebut: nol gerbang terselesaikan dari nol gerbang terbaca "100% siap"
 *    pada frame pertama, dan layarnya berkedip lewat sebelum apa pun dimuat.
 *
 * 2. **`subscribe` memanggil balik SEGERA.** Urutan mount tidak dijamin, dan di
 *    React efek ANAK berjalan sebelum efek induk — hero mengklaim gerbangnya
 *    sebelum overlay di layout sempat berlangganan. Konsumen yang cuma menunggu
 *    notifikasi berikutnya akan melewatkan yang sudah lewat. Pola yang sama
 *    dengan `onLenis` di `lenis-store.ts`, dan alasannya sama.
 */

/** `false` = sudah diklaim, belum selesai. */
const gates = new Map<string, boolean>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

/**
 * Mendaftarkan satu hal yang ditunggu. Fungsi pelepas yang dikembalikan
 * MENGHAPUS gerbang, bukan menyelesaikannya: bagian yang dilepas sebelum siap
 * tidak pernah akan siap, dan membiarkannya tergantung berarti layar menunggu
 * sesuatu yang sudah tidak ada di halaman.
 */
export function claimBootGate(name: string): () => void {
  if (!gates.has(name)) {
    gates.set(name, false);
    notify();
  }
  return () => {
    if (gates.delete(name)) notify();
  };
}

/** Diam saja bila gerbangnya tidak pernah diklaim atau sudah selesai. */
export function resolveBootGate(name: string): void {
  if (gates.get(name) === false) {
    gates.set(name, true);
    notify();
  }
}

export interface BootProgress {
  claimed: number;
  resolved: number;
}

export function readBootProgress(): BootProgress {
  let resolved = 0;
  for (const done of gates.values()) if (done) resolved += 1;
  return { claimed: gates.size, resolved };
}

export function subscribeBootProgress(fn: () => void): () => void {
  listeners.add(fn);
  fn();
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Sudah pernah boot di pemuatan halaman INI.
 *
 * Landing dan app punya layout masing-masing, jadi berpindah di antara
 * keduanya melepas satu `BootScreen` dan memasang yang lain. Tanpa penanda ini
 * layar boot muncul lagi setiap kali seseorang menekan tautan dari landing ke
 * /score — padahal tidak ada apa pun yang sedang disiapkan, halamannya sudah
 * berjalan sejak tadi.
 *
 * Sengaja state modul, bukan `sessionStorage`: yang ditandai adalah satu
 * pemuatan halaman, dan reload memang HARUS memunculkannya lagi karena reload
 * menyiapkan segalanya dari nol. Hanya disentuh dari efek, jadi proses server
 * yang berumur panjang tidak pernah menuliskannya.
 */
let booted = false;

export function hasBooted(): boolean {
  return booted;
}

export function markBooted(): void {
  booted = true;
}
