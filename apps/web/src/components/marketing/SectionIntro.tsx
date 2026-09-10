import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';

interface SectionIntroProps {
  /** Label mikro-uppercase di kolom kiri. Dua sampai tiga kata. */
  label: string;
  /** Pernyataan besar di kolom kanan. Satu kalimat, maksimal dua. */
  children: ReactNode;
  /** Panel gelap memakai tinta yang berbeda dari halaman terang. */
  onPanel?: boolean;
  className?: string;
}

/**
 * Pola label-kiri / pernyataan-kanan.
 *
 * Kolom kanan sengaja berhenti di 5 dari 12 kolom, menyisakan sekitar
 * seperlima lebar layar kosong di kanan. Itu keputusan, bukan sisa: pernyataan
 * yang melebar penuh terbaca sebagai paragraf, dan paragraf tidak menahan
 * pandangan. Ukuran yang lebih besar pada ukuran garis yang lebih pendek
 * adalah seluruh mekanismenya.
 */
export function SectionIntro({ label, children, onPanel = false, className }: SectionIntroProps) {
  return (
    <div className={cn('grid gap-6 md:grid-cols-12 md:gap-8', className)}>
      <Reveal className="md:col-span-3" distance={16}>
        <p
          className={cn(
            'text-micro font-medium uppercase tracking-[0.12em]',
            onPanel ? 'text-panel-ink-500' : 'text-ink-500',
          )}
        >
          {label}
        </p>
      </Reveal>
      <Reveal className="md:col-span-8 lg:col-span-7" delay={0.08}>
        <p
          className={cn(
            'font-display text-mkt-statement font-medium',
            onPanel ? 'text-panel-ink-900' : 'text-ink-900',
          )}
        >
          {children}
        </p>
      </Reveal>
    </div>
  );
}
