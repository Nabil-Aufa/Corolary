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
   */
  tone?: 'dark' | 'page';
  /** Sudut membulat di atas — panel "menutupi" bagian sebelumnya. */
  roundTop?: boolean;
}

/**
 * Panel curtain: bagian yang MENUTUPI bagian sebelumnya alih-alih mengalir di
 * bawahnya.
 *
 * Efeknya datang dari tiga hal sekaligus, dan menghilangkan salah satunya
 * membuat dua sisanya terlihat seperti kesalahan:
 *
 * 1. Sudut membulat besar (80px) hanya di sisi yang "menutupi".
 * 2. Latar yang kontras dengan apa pun yang ada di atasnya.
 * 3. `relative z-10` — tanpa ini panel berada di aliran normal dan tidak ada
 *    yang tertutupi; sudut membulatnya lalu terbaca sebagai kartu raksasa.
 *
 * Sudutnya menyusut di layar sempit: 80px pada lebar 390px memakan seperlima
 * layar dan memotong baris pertama teks.
 */
export function Panel({ children, className, tone = 'dark', roundTop = true }: PanelProps) {
  return (
    <section
      // Dibaca oleh navbar lewat IntersectionObserver untuk membalik warnanya
      // sendiri. Navbar TIDAK bisa menyimpulkan ini dari posisi scroll: tinggi
      // tiap panel bergantung pada data yang baru datang setelah render.
      data-tone={tone}
      className={cn(
        'relative z-10',
        tone === 'dark' ? 'bg-panel text-panel-ink-700' : 'bg-bg text-ink-700',
        roundTop && 'rounded-t-[clamp(28px,7vw,80px)]',
        className,
      )}
    >
      {children}
    </section>
  );
}
