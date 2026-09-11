'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';

import { registerLenis } from '@/lib/lenis-store';

/** Berapa layar yang dilompati PageUp/PageDown. Sedikit kurang dari satu layar
 *  supaya selalu ada baris yang tumpang tindih sebagai jangkar baca. */
const PAGE_FRACTION = 0.9;

/**
 * Scroll berinersia untuk landing saja.
 *
 * Ini yang membuat "panel curtain" terasa seperti benda fisik alih-alih dua
 * div yang kebetulan bertumpuk. Tapi ia MENGAMBIL ALIH scroll dari browser,
 * dan itu punya dua korban yang tidak terlihat saat menguji dengan mouse.
 *
 * ── Korban 1: pengguna reduced-motion ──
 * Inersia adalah tepat jenis gerakan yang mereka matikan. Lenis tidak dipasang
 * sama sekali, bukan sekadar dipercepat.
 *
 * ── Korban 2: keyboard ──
 * Lenis memelihara posisi scroll versinya sendiri dan menuliskannya tiap frame.
 * Scroll native yang dipicu keyboard — Home, End, PageUp/Down, spasi, panah —
 * karena itu langsung ditimpa kembali pada frame berikutnya, dan gejalanya
 * adalah tombol yang benar-benar tidak melakukan apa-apa. Halaman ini tingginya
 * tujuh layar; tanpa keyboard, seseorang yang tidak memakai mouse tidak bisa
 * membaca sebagian besar isinya.
 *
 * Jadi tombol-tombol itu dijalankan lewat Lenis sendiri, bukan dibiarkan ke
 * browser. `preventDefault` wajib — kalau tidak, browser tetap menggulir dan
 * kita dapat dua gerakan yang berebut.
 *
 * Dan `focusin`: menekan Tab ke elemen di bawah lipatan membuat browser
 * menggulirnya ke tampilan lewat jalur native yang sama, jadi ia ikut ditimpa.
 * Fokus yang berpindah ke sesuatu yang tak terlihat adalah cara tercepat
 * membuat navigasi keyboard tersesat, jadi Lenis diminta menyusul ke sana.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    const lenis = new Lenis({
      // Nilainya dipilih untuk mendekati rasa situs referensi: cukup panjang
      // untuk terasa berbobot, cukup pendek untuk tidak terasa lepas kendali.
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      autoRaf: false,
    });

    // rAF dikendalikan sendiri, bukan `autoRaf`: loop bawaan tetap hidup
    // setelah komponen dilepas di App Router, jadi scroll di halaman APP
    // ikut ter-hijack setelah navigasi klien dari landing.
    //
    // Loop itu sekarang tinggal di `lenis-store`, bersama instancenya, supaya
    // bagian lain yang perlu menggerakkan Lenis sendiri (ScrollTrigger) bisa
    // MENGAMBIL ALIH loop ini alih-alih menambah loop kedua di sebelahnya.
    const unregister = registerLenis(lenis);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      // Di dalam input, tombol yang sama berarti "pindah kursor", bukan
      // "gulir halaman". Merebutnya membuat kolom alamat di CTA penutup
      // tidak bisa diedit dengan keyboard.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      ) {
        return;
      }

      const viewport = window.innerHeight;
      const page = viewport * PAGE_FRACTION;
      let to: number | null = null;

      switch (event.key) {
        case 'Home':
          to = 0;
          break;
        case 'End':
          to = document.documentElement.scrollHeight;
          break;
        case 'PageDown':
          to = lenis.targetScroll + page;
          break;
        case 'PageUp':
          to = lenis.targetScroll - page;
          break;
        case ' ':
          to = lenis.targetScroll + (event.shiftKey ? -page : page);
          break;
        case 'ArrowDown':
          to = lenis.targetScroll + 80;
          break;
        case 'ArrowUp':
          to = lenis.targetScroll - 80;
          break;
        default:
          return;
      }

      event.preventDefault();
      lenis.scrollTo(to);
    };

    const onFocusIn = (event: FocusEvent) => {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;
      const rect = el.getBoundingClientRect();
      const offscreen = rect.top < 0 || rect.bottom > window.innerHeight;
      // `offset` memberi ruang di atas supaya elemen tidak mendarat persis di
      // bawah header sticky, yang membuatnya tampak tidak ter-scroll.
      if (offscreen) lenis.scrollTo(el, { offset: -96 });
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      unregister();
      lenis.destroy();
    };
  }, []);

  return null;
}
