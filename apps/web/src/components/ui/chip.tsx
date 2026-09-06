import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Potongan metadata pendek: "Block 25.919.955", "tx index 128", "log 361".
 *
 * BUKAN `Badge`. Badge huruf kapital semua dan menyandang status — kind,
 * "PROVEN" — sementara ini menyandang nilai, dan memaksa "Block 25.919.955"
 * jadi kapital membuatnya berteriak sekeras label yang memang seharusnya.
 * Angkanya memakai `.num` supaya digit sejajar antar chip yang bertumpuk.
 */
export function Chip({
  className,
  bordered = true,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  /**
   * Garis tepi dimatikan ketika chip berdiri SENDIRIAN di barisnya sendiri —
   * judul kelompok di tabel Raw. Di sana tidak ada chip tetangga yang perlu
   * dipisahkan, jadi garisnya cuma menambah satu bentuk untuk dipindai mata
   * di baris yang seharusnya tenang.
   */
  bordered?: boolean;
}) {
  return (
    <span
      className={cn(
        'num inline-flex items-center rounded-[var(--radius-sm)] bg-bg px-2 py-0.5 text-micro text-ink-700',
        bordered && 'border border-border',
        className,
      )}
      {...props}
    />
  );
}
