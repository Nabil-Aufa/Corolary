import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Satu sel tabel yang membawa nama kolomnya sendiri di bawah `md`.
 *
 * Semua tabel di app ini menyembunyikan headernya di ponsel (`hidden md:grid`)
 * lalu menumpuk barisnya. Tanpa label yang ikut turun, baris di ponsel jadi
 * deret angka tanpa nama — dan itu lebih buruk daripada tabel yang menggulir ke
 * samping, karena angkanya tetap terlihat sah.
 *
 * Dipakai bersama oleh `market/` dan `proofs/` supaya keempat tabel menumpuk
 * dengan cara yang sama. Empat salinan kecil dari pola ini akan menyimpang
 * begitu salah satunya disentuh.
 */
export function StackedCell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className="flex items-baseline justify-between gap-4 md:block md:text-right">
      <span className="text-micro uppercase tracking-wide text-ink-400 md:hidden">{label}</span>
      <span className={cn('num text-small', className)}>{children}</span>
    </span>
  );
}
