import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  children: ReactNode;
  className?: string;
  /**
   * `dark` menutupi halaman terang; `page` menutupi balik panel gelap dengan
   * warna halaman. Bergantian di antara keduanya adalah seluruh mekanisme
   * curtain — satu panel gelap yang tidak pernah ditutup balik hanya terbaca
   * sebagai "situsnya berubah gelap di tengah".
   *
   * `light` adalah permukaan putih (`--color-surface`), bukan warna halaman.
   * Ia hanya terbaca sebagai curtain kalau yang di atasnya GELAP: selisih
   * putih dengan warna halaman terlalu tipis untuk membaca sudut membulatnya.
   */
  tone?: 'dark' | 'page' | 'light';
  /** Sudut membulat di atas — panel "menutupi" bagian sebelumnya. */
  roundTop?: boolean;
}

/**
 * Panel curtain: bagian yang MENUTUPI bagian sebelumnya alih-alih mengalir di
 * bawahnya.
 *
 * Efeknya datang dari empat hal sekaligus, dan menghilangkan salah satunya
 * membuat sisanya terlihat seperti kesalahan:
 *
 * 1. Sudut membulat besar (80px) hanya di sisi yang "menutupi".
 * 2. Latar yang kontras dengan apa pun yang ada di atasnya.
 * 3. `relative z-10` — tanpa ini panel berada di aliran normal dan tidak ada
 *    yang tertutupi; sudut membulatnya lalu terbaca sebagai kartu raksasa.
 * 4. Sebuah `::before` setinggi radiusnya yang duduk TEPAT DI ATAS panel,
 *    berlatar sama dan bersudut membulat sama.
 *
 * Yang keempat dulu tidak ada, dan ketiadaannya tersembunyi selama panel yang
 * menutupi selalu lebih gelap daripada halaman. Tanpa tumpang tindih, sudut
 * membulat cuma memotong ke warna HALAMAN, bukan ke bagian di atasnya — dan
 * warna halaman kebetulan sama dengan bagian terang di atas panel gelap, jadi
 * sudutnya tetap terbaca. Begitu arahnya dibalik (panel TERANG menutupi yang
 * gelap), sudut itu memotong terang ke terang dan yang tersisa cuma garis
 * lurus: peralihan gelap ke terang kehilangan bentuknya sama sekali,
 * sementara terang ke gelap tetap benar. Itu sebabnya cacatnya hanya muncul
 * di satu arah.
 *
 * `::before`, BUKAN margin atas negatif. Margin negatif menghasilkan piksel
 * yang sama persis, tapi ia MENELAN 80px dari jarak bawah bagian di atasnya,
 * dan jarak-jarak itu sudah disetel satu per satu.
 *
 * Tumpang tindih itu TIDAK bisa ditiadakan: lengkungannya hanya terlihat
 * kalau ada warna bagian sebelumnya di balik sudutnya. Memberi panel margin
 * atas positif sebesar radiusnya sempat dicoba dan hasilnya justru kosong —
 * `::before` lalu duduk di ruang margin yang berwarna halaman, bukan di atas
 * bagian sebelumnya, jadi sudutnya kembali memotong terang ke terang.
 *
 * Jadi 80px itu memang harus dimakan, dan yang mengembalikannya adalah
 * `padding-bottom` sebesar radius pada panel yang DITUTUPI. Setiap panel
 * memakainya, karena tiap panel di halaman ini ditutupi oleh yang berikutnya;
 * pada panel terakhir ia cuma menambah ruang yang tidak terlihat karena
 * bagian di bawahnya sewarna.
 *
 * Sudut membulatnya pindah SELURUHNYA ke `::before` — panel sendiri bersudut
 * siku. Kalau keduanya membulat, tepi bawah `::before` bertemu tepi atas
 * panel yang sama-sama melengkung dan sambungannya menyisakan dua takik.
 *
 * Sudutnya menyusut di layar sempit: 80px pada lebar 390px memakan seperlima
 * layar dan memotong baris pertama teks.
 */
export function Panel({ children, className, tone = 'dark', roundTop = true }: PanelProps) {
  return (
    <section
      // Penanda nada bagian ini untuk siapa pun yang perlu tahu apakah ia gelap.
      // Saat ini tidak ada yang membacanya: navbar landing tidak lagi membalik
      // warna, ia bersembunyi saat digulir ke bawah (MarketingHeader.tsx).
      data-tone={tone}
      className={cn(
        // Mengembalikan 80px yang dimakan oleh panel BERIKUTNYA saat ia
        // menumpuk bagian bawah panel ini.
        'relative z-10 pb-[clamp(28px,7vw,80px)]',
        tone === 'dark' && 'bg-panel text-panel-ink-700',
        tone === 'page' && 'bg-bg text-ink-700',
        tone === 'light' && 'bg-surface text-ink-700',
        roundTop &&
          'before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-[clamp(28px,7vw,80px)] before:rounded-t-[clamp(28px,7vw,80px)] before:bg-inherit',
        className,
      )}
    >
      {children}
    </section>
  );
}
