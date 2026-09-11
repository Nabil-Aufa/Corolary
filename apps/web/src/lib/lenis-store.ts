import type Lenis from 'lenis';

/**
 * Satu-satunya pemegang instance Lenis halaman.
 *
 * `SmoothScroll` membuat instancenya di dalam `useEffect`, jadi dulu ia tidak
 * bisa dijangkau siapa pun. Bagian mana pun yang ingin ikut menumpang scroll
 * yang sama — ScrollTrigger, misalnya — hanya punya dua pilihan: membuat Lenis
 * kedua, atau meminta yang sudah ada. Yang pertama berarti dua objek menulis
 * `scrollTop` yang sama tiap frame dan halaman bergetar. Modul ini menyediakan
 * yang kedua.
 *
 * ── Kenapa RAF-nya ikut tinggal di sini ──
 * Lenis hanya bergerak saat `raf()` dipanggil, dan ia harus dipanggil TEPAT
 * sekali per frame. Kalau pemiliknya (SmoothScroll) menjalankan loop sendiri
 * lalu GSAP menambahkan `gsap.ticker.add(t => lenis.raf(t * 1000))`, Lenis maju
 * dua kali per frame: durasi easing terpotong separuh dan momentumnya terasa
 * lepas kendali — tanpa satu pun error. Jadi kepemilikan RAF adalah keputusan
 * yang harus diambil di satu tempat, dan `claimRaf()` adalah cara memindahkan
 * kepemilikan itu, bukan menambah loop kedua.
 */

type Listener = (lenis: Lenis | null) => void;

let instance: Lenis | null = null;
let frame = 0;
let claimed = false;

const listeners = new Set<Listener>();

function startInternalRaf(): void {
  if (frame || claimed || !instance) return;
  frame = requestAnimationFrame(function raf(time: number) {
    instance?.raf(time);
    frame = requestAnimationFrame(raf);
  });
}

function stopInternalRaf(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

/** Dipanggil oleh pemilik instance. Mengembalikan fungsi pelepas. */
export function registerLenis(lenis: Lenis): () => void {
  instance = lenis;
  startInternalRaf();
  for (const fn of listeners) fn(lenis);

  return () => {
    if (instance !== lenis) return;
    stopInternalRaf();
    instance = null;
    for (const fn of listeners) fn(null);
  };
}

export function getLenis(): Lenis | null {
  return instance;
}

/**
 * Berlangganan instance. Callback dipanggil SEGERA dengan nilai saat ini —
 * termasuk `null`.
 *
 * Pemanggilan segera itu wajib dan mudah dilewatkan: urutan mount tidak
 * dijamin. Kalau `SmoothScroll` sudah terpasang lebih dulu, konsumen yang hanya
 * menunggu notifikasi berikutnya akan menunggu selamanya, karena notifikasi itu
 * sudah lewat.
 */
export function onLenis(fn: Listener): () => void {
  listeners.add(fn);
  fn(instance);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Mengambil alih pemanggilan `raf()` dari modul ini.
 *
 * Pemanggil WAJIB memanggil fungsi pelepas yang dikembalikan saat selesai;
 * sampai saat itu, Lenis tidak digerakkan oleh siapa pun kecuali pemanggil,
 * dan lupa melepasnya berarti scroll membeku total setelah navigasi klien.
 */
export function claimRaf(): () => void {
  claimed = true;
  stopInternalRaf();

  return () => {
    claimed = false;
    startInternalRaf();
  };
}
