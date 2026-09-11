'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Seberapa cepat kursor menyusul penunjuk asli. 1 = menempel persis (dan
 * karena itu tidak ada gunanya menggambar kursor sendiri); di bawah ~0,1 ia
 * tertinggal cukup jauh sehingga terasa seperti lag, bukan seperti bobot.
 */
const FOLLOW = 0.19;

const DOT = 12;
const RING = 44;

/** Elemen yang membuat kursor membesar. Diperiksa lewat `closest`, jadi ikon
 *  di DALAM tombol tetap menghitung tombolnya sebagai target. */
const HOVER_TARGETS = 'a, button, [role="button"], summary, input, select, textarea';

const FINE = '(pointer: fine)';
const REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * Kursor kustom hanya masuk akal bila ada penunjuk halus DAN orangnya tidak
 * meminta gerakan dikurangi.
 *
 * Dibaca lewat `useSyncExternalStore`, bukan lewat `useState` + `useEffect`.
 * Dua alasannya terpisah: memanggil `setState` langsung di badan efek memicu
 * render berantai (dan ditolak lint), dan yang lebih penting — kedua media
 * query ini bisa BERUBAH di tengah sesi. Seseorang yang menyalakan "reduce
 * motion" di panel sistem, atau mencabut mouse dari tablet, langsung
 * mendapatkan kursor aslinya kembali tanpa memuat ulang halaman.
 */
function subscribePointer(onChange: () => void): () => void {
  const fine = window.matchMedia(FINE);
  const reduced = window.matchMedia(REDUCED);
  fine.addEventListener('change', onChange);
  reduced.addEventListener('change', onChange);
  return () => {
    fine.removeEventListener('change', onChange);
    reduced.removeEventListener('change', onChange);
  };
}

function readPointer(): boolean {
  return window.matchMedia(FINE).matches && !window.matchMedia(REDUCED).matches;
}

/** Di server tidak ada penunjuk apa pun, jadi kursor kustom tidak pernah ikut
 *  ter-render di HTML awal — dan tidak ada mismatch hidrasi untuk ditambal. */
function readPointerOnServer(): boolean {
  return false;
}

/**
 * Kursor kustom yang menyusul penunjuk dengan inersia.
 *
 * Ini elemen paling khas dari bahasa visual yang ditiru, dan ia punya tiga
 * jebakan yang membuat implementasi naif terasa rusak:
 *
 * ── 1. Jangan pernah dipasang di perangkat sentuh ──
 * Tidak ada penunjuk untuk diikuti, jadi yang tersisa cuma titik yang diam di
 * pojok kiri atas selamanya. `pointer: fine` adalah gerbangnya, bukan lebar
 * layar — tablet dengan stylus punya penunjuk halus meski layarnya sempit.
 *
 * ── 2. Kursor asli TIDAK boleh disembunyikan sebelum penggantinya hidup ──
 * `cursor: none` dipasang dari efek, bukan dari CSS statis. Kalau JS gagal
 * atau komponen ini belum ter-hydrate, menyembunyikan kursor asli lebih dulu
 * meninggalkan halaman yang benar-benar tidak punya penunjuk apa pun.
 *
 * ── 3. TIDAK ADA state React yang berubah saat penunjuk bergerak ──
 * `pointermove` menyala puluhan kali per detik. Menyimpan koordinat — atau
 * bahkan sekadar bendera "sedang di atas tombol" — di `useState` berarti
 * sebanyak itu pula render React, dan pada halaman setinggi ini hasilnya
 * terlihat sebagai patah-patah justru saat digulir. Semua posisi dan ukuran
 * ditulis langsung ke `style` dari dalam loop rAF.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const enabled = useSyncExternalStore(subscribePointer, readPointer, readPointerOnServer);

  useEffect(() => {
    if (!enabled) return;

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const drawn = { ...target };
    let hovering = false;
    let visible = false;
    let frame = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      visible = true;
      const el = e.target;
      hovering = el instanceof Element && el.closest(HOVER_TARGETS) !== null;
    };

    // Keluar dari window: sembunyikan, jangan biarkan menggantung di tepi.
    const onLeave = () => {
      visible = false;
    };

    const tick = () => {
      drawn.x += (target.x - drawn.x) * FOLLOW;
      drawn.y += (target.y - drawn.y) * FOLLOW;

      const node = dot.current;
      const inner = ring.current;
      if (node !== null && inner !== null) {
        node.style.transform = `translate3d(${drawn.x}px, ${drawn.y}px, 0) translate(-50%, -50%)`;
        node.style.opacity = visible ? '1' : '0';
        const size = hovering ? RING : DOT;
        inner.style.width = `${size}px`;
        inner.style.height = `${size}px`;
        inner.style.opacity = hovering ? '0.18' : '1';
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    // Kursor asli baru disembunyikan setelah penggantinya benar-benar hidup.
    const root = document.documentElement;
    root.style.cursor = 'none';

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      root.style.cursor = '';
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={dot}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] opacity-0 transition-opacity duration-200"
    >
      <div
        ref={ring}
        className="rounded-full bg-ink-900 transition-[width,height,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: DOT, height: DOT }}
      />
    </div>
  );
}
