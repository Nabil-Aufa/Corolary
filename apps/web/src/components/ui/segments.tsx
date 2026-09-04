'use client';

import { cn } from '@/lib/utils';

/**
 * Pilihan berdampingan, yang aktif ditandai KOTAK, bukan warna.
 *
 * Digeneralisasi dari `ThemeSegments` supaya kedua pemakaian memakai penanda
 * aktif yang sama. Warna tidak dipakai untuk menandai keadaan terpilih karena
 * palet ini sudah memberi arti pada warna — teal berarti terbukti, amber
 * berarti belum selesai — dan menambah "biru berarti terpilih" mengikis itu.
 */
export function Segments<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex items-center gap-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-[var(--radius-sm)] border px-3 py-1.5 text-small font-medium transition-colors',
              active
                ? 'border-border-strong bg-bg text-ink-900'
                : 'border-transparent text-ink-400 hover:text-ink-700',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
