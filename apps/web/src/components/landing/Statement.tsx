import type { ReactNode } from 'react';
import { Reveal } from '@/components/marketing/Reveal';
import { cn } from '@/lib/utils';

/**
 * Blok pernyataan: label kecil di kolom kiri, satu paragraf besar di kanan.
 *
 * Pola ini muncul dua kali di halaman, dan keduanya memakai komponen yang sama
 * supaya jarak label-ke-teksnya tidak bisa menyimpang. Yang menahan seluruh
 * efeknya adalah SELISIH ukuran: label 16px di sebelah teks 26px membuat teks
 * itu terbaca sebagai kutipan, bukan sebagai paragraf biasa. Menaikkan label
 * ke ukuran body menghapus seluruh hierarki dalam satu langkah.
 *
 * Kolom kirinya sengaja dibiarkan kosong di bawah label. Ruang kosong itu yang
 * memberi paragraf tepi kiri yang tegas untuk disandari.
 */
export function Statement({
  label,
  children,
  tone = 'page',
  className,
}: {
  label: string;
  children: ReactNode;
  tone?: 'page' | 'panel';
  className?: string;
}) {
  const dark = tone === 'panel';

  return (
    <div className={cn('mkt-container', className)}>
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-12">
        <Reveal className="md:col-span-3" distance={16}>
          <h2
            className={cn(
              'text-small font-medium uppercase tracking-[0.08em]',
              dark ? 'text-panel-ink-500' : 'text-ink-500',
            )}
          >
            {label}
          </h2>
        </Reveal>

        <Reveal className="md:col-span-9" delay={0.06} distance={24}>
          <p
            className={cn(
              'max-w-[44ch] text-mkt-statement',
              dark ? 'text-panel-ink-900' : 'text-ink-900',
            )}
          >
            {children}
          </p>
        </Reveal>
      </div>
    </div>
  );
}
