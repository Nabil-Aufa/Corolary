'use client';

import type Lenis from 'lenis';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CorolaryLogo } from '@/components/brand/CorolaryLogo';
import {
  claimBootGate,
  hasBooted,
  markBooted,
  readBootProgress,
  resolveBootGate,
  subscribeBootProgress,
} from '@/lib/boot';
import { onLenis } from '@/lib/lenis-store';

/**
 * Lama menggambar garis logo, dari goresan pertama sampai terakhir.
 *
 * Ini pembukaan, bukan pengukuran: ia selalu selesai, dan panjangnya dipilih
 * supaya goresannya benar-benar terlihat berjalan. Dibagi ke tiga ruas menurut
 * panjang aslinya, bukan rata tiga.
 */
const DRAW_MS = 1400;

/**
 * Pengisian mulai sedikit sebelum goresan terakhir menutup, supaya dua fase
 * itu tidak terbaca sebagai dua babak terpisah.
 *
 * Cuma SEDIKIT. Ruas terakhir adalah palangnya, dan pada kecepatan pena yang
 * tetap ia cuma 11% dari panjang seluruh logo (terukur: 426,8 dari total 3887,1).
 * Handoff yang lebih awal berarti tinta sudah naik sementara palangnya belum
 * digambar sama sekali, dan logo yang terisi sebelum selesai digambar
 * membatalkan seluruh gagasan satu garisnya.
 */
const DRAW_HANDOFF = 0.96;
/** Sama dengan transisi `height` pada `.boot-fill` di globals.css. */
const FILL_MS = 560;
/** Jeda kecil supaya logo sempat terbaca utuh sebelum layarnya pergi. */
const HOLD_MS = 140;
/** Sama dengan transisi `transform` pada `.boot-screen` di globals.css. */
const EXIT_MS = 620;

/**
 * Batas atas mutlak, per pemakai.
 *
 * Landing menunggu hero WebGL, yang benar-benar bisa lama di mesin lambat.
 * App tidak menunggu apa pun seberat itu, jadi batasnya jauh lebih pendek:
 * di sana batas yang longgar bukan jaring pengaman, ia cuma lama.
 *
 * Bukan jalur normal di keduanya. Kalau ia menyala, ada gerbang yang diklaim
 * tapi tidak pernah diselesaikan.
 */
const DEFAULT_MAX_MS = 8000;

interface BootScreenProps {
  /** Batas menunggu sebelum layar dilepas paksa. */
  maxMs?: number;
}

type Phase = 'draw' | 'fill' | 'exit' | 'done';

/**
 * Layar boot landing.
 *
 * Logo Corolary digambar sebagai garis lebih dulu, lalu terisi warna dari bawah
 * mengikuti progres kesiapan yang SUNGGUHAN — `lib/boot.ts` menghitung
 * gerbang yang didaftarkan bagian-bagian halaman, bukan sebuah timer. Yang
 * ditunggu di landing ini ada dua dan keduanya nyata:
 *
 * - `fonts`  — Geist display dipakai pada ukuran 300px di footer dan di hero;
 *              tanpa menunggunya, huruf pertama yang terlihat adalah fallback
 *              sistem yang lalu melompat lebarnya.
 * - `hero`   — frame WebGL pertama benar-benar tergambar (HeroScroll), atau
 *              hero memutuskan turun ke mode `css`/`static`. Ini bagian
 *              termahal halaman: chunk OGL, tekstur koin, dan dua tekstur teks.
 *
 * Dua hal yang membuat komponen ini benar alih-alih sekadar jalan:
 *
 * 1. **Ia dirender di server juga.** Overlay yang baru muncul setelah hydrate
 *    justru memamerkan persis apa yang seharusnya ia tutupi: halaman setengah
 *    jadi berkedip lebih dulu, baru ditutup. Karena itu render pertamanya sudah
 *    dalam keadaan menutup, dan `noscript` di globals.css menyingkirkannya
 *    untuk klien tanpa JavaScript, yang tidak akan pernah bisa melepasnya.
 *
 * 2. **Scroll dikunci lewat Lenis dan pencegahan event, BUKAN `overflow:
 *    hidden`.** Hero memasang ScrollTrigger yang di-pin pada saat overlay masih
 *    terpasang; mengubah tinggi dokumen di bawahnya berarti ia mengukur halaman
 *    yang salah lalu butuh refresh setelah overlay pergi. Mencegah event tidak
 *    menyentuh layout sama sekali.
 */
export function BootScreen({ maxMs = DEFAULT_MAX_MS }: BootScreenProps) {
  // Inisialisasi malas, bukan efek: pada navigasi klien komponen ini dipasang
  // di klien, jadi penanda modulnya sudah bisa dibaca sebelum render pertama
  // dan tidak ada satu frame pun overlay yang berkedip. Saat render server
  // `window` tidak ada dan penandanya selalu palsu, jadi markup server dan
  // klien tetap sama.
  const [phase, setPhase] = useState<Phase>(() =>
    typeof window !== 'undefined' && hasBooted() ? 'done' : 'draw',
  );
  const phaseAt = useRef<Phase>('draw');
  const outline = useRef<SVGSVGElement>(null);
  const [progress, setProgress] = useState(0);

  // Sengaja dibaca sekali saat mount, bukan lewat listener: durasi fase ikut
  // menentukan timer yang sudah berjalan, dan mengubahnya di tengah hanya
  // akan membuat layar ini berperilaku berbeda tergantung kapan seseorang
  // mengubah preferensinya.
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const draw = reduced ? 0 : Math.round(DRAW_MS * DRAW_HANDOFF);
  const settle = reduced ? 0 : FILL_MS + HOLD_MS;
  const exit = reduced ? 0 : EXIT_MS;

  // Gerbang font. Diklaim di sini karena layar inilah yang menunggunya; hero
  // mengklaim gerbangnya sendiri di HeroScroll.
  useEffect(() => {
    const release = claimBootGate('fonts');
    void document.fonts.ready.then(() => resolveBootGate('fonts'));
    return release;
  }, []);

  useEffect(() => {
    return subscribeBootProgress(() => {
      const { claimed, resolved } = readBootProgress();
      // Nol gerbang bukan "semuanya siap", itu "belum ada yang mendaftar".
      setProgress(claimed === 0 ? 0 : resolved / claimed);
    });
  }, []);

  useEffect(() => {
    phaseAt.current = phase;
  }, [phase]);

  /**
   * Membagi DRAW_MS ke tiap path MENURUT PANJANG ASLINYA, supaya penanya
   * bergerak dengan kecepatan yang sama sepanjang logo. `pathLength="1"` di
   * markup hanya menyeragamkan satuan dash; ia justru yang membuat pembagian
   * rata tiga terlihat salah, karena palang pendek dan cincin luar lalu
   * dapat jatah waktu yang sama.
   */
  useEffect(() => {
    const svg = outline.current;
    if (svg === null) return;

    const paths = [...svg.querySelectorAll('path')];
    const lengths = paths.map((path) => path.getTotalLength());
    const total = lengths.reduce((sum, n) => sum + n, 0);

    if (!Number.isFinite(total) || total <= 0) {
      svg.classList.add('-static');
      return;
    }

    let before = 0;
    paths.forEach((path, i) => {
      const length = lengths[i] ?? 0;
      const start = before / total;
      const end = (before + length) / total;

      // Dipakai mode pena tunggal: di mana ruas ini berada pada timeline 0..1.
      path.style.setProperty('--boot-seg-end', `${end}`);
      path.style.setProperty('--boot-seg-span', `${end - start}`);

      // Dipakai mode cadangan tiga animasi.
      path.style.setProperty('--boot-seg-duration', `${(length / total) * DRAW_MS}ms`);
      path.style.setProperty('--boot-seg-delay', `${start * DRAW_MS}ms`);

      before += length;
    });

    svg.style.setProperty('--boot-draw-duration', `${DRAW_MS}ms`);

    // `@property` dan `CSS.registerProperty` dikirim bersamaan di setiap mesin
    // yang punya keduanya, jadi yang kedua adalah penanda yang sah untuk yang
    // pertama — dan yang pertama tidak punya cara dideteksi lewat `@supports`.
    if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
      svg.classList.add('-pen');
    }

    svg.classList.add('-drawing');
  }, []);

  useEffect(() => {
    const toFill = window.setTimeout(() => setPhase('fill'), draw);
    const cap = window.setTimeout(() => {
      // Fase dibaca dari ref, BUKAN dari `phase` yang tertangkap closure ini.
      // Timernya dipasang sekali saat mount dan tidak ikut dibatalkan saat
      // layar keluar lewat jalur normal — memasukkan `phase` ke dependensi
      // justru akan MENGULANG hitungan 8 detik tiap kali fasenya berubah,
      // yang berarti batasnya tidak pernah benar-benar mengukur apa pun.
      // Tanpa penjaga ini ia tetap menyala setelah layar selesai dan
      // mengembalikan overlay yang sudah pergi ke layar.
      if (phaseAt.current === 'exit' || phaseAt.current === 'done') return;
      // Kalau baris ini muncul, ada gerbang yang diklaim tapi tidak pernah
      // diselesaikan, dan layar boot menutupi halaman yang sebenarnya siap.
      const { claimed, resolved } = readBootProgress();
      console.warn(`[boot] batas ${maxMs}ms tercapai, ${resolved}/${claimed} gerbang selesai`);
      setPhase('exit');
    }, maxMs);
    return () => {
      window.clearTimeout(toFill);
      window.clearTimeout(cap);
    };
  }, [draw, maxMs]);

  useEffect(() => {
    if (phase !== 'fill' || progress < 1) return;
    const id = window.setTimeout(() => setPhase('exit'), settle);
    return () => window.clearTimeout(id);
  }, [phase, progress, settle]);

  useEffect(() => {
    if (phase !== 'exit') return;
    const id = window.setTimeout(() => {
      markBooted();
      setPhase('done');
    }, exit);
    return () => window.clearTimeout(id);
  }, [phase, exit]);

  // Kunci scroll selama layar masih ada, termasuk selama fade keluar: halaman
  // yang sudah bergerak di belakang overlay yang belum hilang terbaca seperti
  // kesalahan render.
  useEffect(() => {
    if (phase === 'done') return;

    const block = (event: Event) => event.preventDefault();
    window.addEventListener('wheel', block, { passive: false });
    window.addEventListener('touchmove', block, { passive: false });

    // Lenis tidak dipasang sama sekali untuk klien reduced-motion, dan ia bisa
    // mendaftar SETELAH layar ini mount. Karena itu lewat langganan, bukan
    // `getLenis()` sekali.
    let current: Lenis | null = null;
    const unsubscribe = onLenis((lenis) => {
      current = lenis;
      lenis?.stop();
    });

    return () => {
      window.removeEventListener('wheel', block);
      window.removeEventListener('touchmove', block);
      unsubscribe();
      current?.start();
    };
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      className="boot-screen"
      data-phase={phase}
      style={{ '--boot-fill': `${phase === 'draw' ? 0 : Math.round(progress * 100)}%` } as CSSProperties}
      role="status"
      aria-live="polite"
    >
      <div className="boot-logo">
        {/* Salinan garis. `pathLength` menormalkan ketiga path ke panjang 1,
            jadi satu `stroke-dashoffset` menggambar semuanya dalam tempo yang
            sama meski panjang aslinya berbeda jauh. */}
        <CorolaryLogo
          ref={outline}
          className="boot-logo-outline"
          fill="none"
          pathProps={{ pathLength: 1, vectorEffect: 'non-scaling-stroke' }}
        />

        {/* Salinan berisi, dipotong dari bawah. Pemotongnya `overflow: hidden`
            pada div biasa, bukan mask SVG: `height` dalam persen dianimasikan
            di mana saja, sementara geometri SVG sebagai properti CSS masih
            bergantung versi browser. */}
        <div className="boot-fill">
          <CorolaryLogo className="boot-logo-solid" />
        </div>
      </div>

      <span className="sr-only">Preparing Corolary</span>

      {/* Tanpa JavaScript tidak ada yang pernah melepas overlay ini, dan
          halaman yang seharusnya tetap terbaca jadi tertutup permanen. */}
      <noscript>
        <style>{'.boot-screen{display:none}'}</style>
      </noscript>
    </div>
  );
}
