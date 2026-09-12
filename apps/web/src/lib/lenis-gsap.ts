import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';

import { claimRaf, onLenis } from './lenis-store';

/**
 * Menyambungkan Lenis ke ScrollTrigger.
 *
 * Dua hal harus benar sekaligus, dan keduanya gagal tanpa error.
 *
 * ── 1. ScrollTrigger harus diberi tahu kapan posisi berubah ──
 * Lenis menggulir dengan menulis `scrollTop` di dalam rAF-nya sendiri dan tidak
 * memancarkan event `scroll` seperti scroll native. ScrollTrigger yang menunggu
 * event itu karena itu diam saja: trigger terpasang, timeline terbentuk, dan
 * tidak ada yang bergerak. `lenis.on('scroll', ScrollTrigger.update)` adalah
 * satu-satunya kabelnya.
 *
 * ── 2. Keduanya harus berada di RAF YANG SAMA ──
 * Kalau Lenis maju di loop sendiri dan ScrollTrigger dibaca di loop GSAP,
 * ScrollTrigger selalu membaca posisi frame SEBELUMNYA. Satu frame tidak
 * terdengar banyak, tapi pada scrub itu persis selisih yang terbaca sebagai
 * "animasinya menyusul scroll", bukan "animasinya mengikuti scroll". Karena itu
 * RAF-nya diambil alih dari store lewat `claimRaf()` dan Lenis digerakkan dari
 * ticker GSAP — bukan dijalankan berdampingan.
 *
 * `lagSmoothing(0)`: bawaan GSAP adalah membuang selisih waktu besar dan
 * berpura-pura frame-nya normal. Itu benar untuk animasi berbasis waktu dan
 * salah untuk animasi berbasis posisi scroll — setelah satu jeda (tab kembali
 * aktif, GC), scroll sudah pindah jauh sementara ticker menganggap tidak ada
 * waktu yang lewat, dan animasinya melompat untuk mengejar.
 *
 * `scrollerProxy` tidak dipakai: Lenis di sini menggulir `window` sungguhan,
 * jadi pembaca posisi bawaan ScrollTrigger sudah menunjuk sumber yang benar.
 * Proxy hanya perlu kalau scrollernya elemen dengan transform.
 */

let refs = 0;
let teardown: (() => void) | null = null;
let lastTickFrame = -1;

/**
 * Frame `gsap.ticker` saat Lenis terakhir maju.
 *
 * Dipakai HUD hero (`?debug=1`) untuk MEMBUKTIKAN urutan tick, bukan
 * mengasumsikannya: kalau angka ini tidak sama dengan `gsap.ticker.frame` di
 * dalam callback lain, callback itu sedang membaca posisi frame sebelumnya.
 */
export function lenisTickFrame(): number {
  return lastTickFrame;
}

function bind(lenis: Lenis): () => void {
  const releaseRaf = claimRaf();

  const update = () => ScrollTrigger.update();
  lenis.on('scroll', update);

  // Ticker GSAP memberi waktu dalam detik; Lenis menunggu milidetik.
  const tick = (time: number) => {
    lenis.raf(time * 1000);
    lastTickFrame = gsap.ticker.frame;
  };
  // Argumen ketiga = prioritaskan. Menyambungkan Lenis ke ScrollTrigger saja
  // belum cukup untuk callback ticker LAIN yang membaca posisi scroll di frame
  // yang sama — hero menggambar seluruh scene-nya dari sana. Tanpa prioritas,
  // urutannya ditentukan oleh komponen mana yang mount lebih dulu, dan satu
  // remount membaliknya jadi tertinggal satu frame: tepi frame hero terlihat
  // bergetar, dan tidak ada error yang menjelaskan kenapa.
  gsap.ticker.add(tick, false, true);
  gsap.ticker.lagSmoothing(0);

  return () => {
    lenis.off('scroll', update);
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33); // kembali ke bawaan GSAP
    lastTickFrame = -1;
    releaseRaf();
  };
}

/**
 * Menyalakan jembatan selama masih ada pemakai.
 *
 * Refcount-nya bukan kemewahan: Fast Refresh melepas lalu memasang ulang
 * komponen, dan dua section yang sama-sama memakai ScrollTrigger akan
 * tumpang-tindih sesaat. Tanpa hitungan ini, yang kedua mount akan memasang
 * ticker kedua, dan yang pertama unmount akan mencabut jembatan yang masih
 * dipakai yang lain.
 */
export function connectLenisToScrollTrigger(): () => void {
  refs += 1;

  if (refs === 1) {
    gsap.registerPlugin(ScrollTrigger);
    // Instance-nya mungkin belum ada (urutan mount tidak dijamin) dan mungkin
    // tidak akan pernah ada — `SmoothScroll` tidak memasang Lenis sama sekali
    // untuk pengguna reduced-motion. `onLenis` menangani keduanya: ia memanggil
    // balik segera dengan nilai sekarang, lalu lagi setiap kali berubah.
    let unbind: (() => void) | null = null;
    const stop = onLenis((lenis) => {
      unbind?.();
      unbind = lenis ? bind(lenis) : null;
    });

    teardown = () => {
      stop();
      unbind?.();
      unbind = null;
    };
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    refs -= 1;
    if (refs === 0) {
      teardown?.();
      teardown = null;
    }
  };
}
