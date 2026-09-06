'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useCopy } from '@/hooks/useCopy';
import { cn } from '@/lib/utils';

/**
 * Pill = tombol `secondary` dengan sudut penuh.
 *
 * Gayanya datang dari `buttonVariants`, bukan dari kelas yang ditulis ulang di
 * sini, supaya ia tidak bisa menyimpang dari tombol "Prove a transaction" di
 * /proofs tanpa ada yang menyadarinya. Tiga bentuk karena tiga perilaku yang
 * berbeda secara semantik — tautan internal, tautan keluar, dan aksi — dan
 * membungkus ketiganya jadi satu <button> akan merusak middle-click dan
 * "buka di tab baru" pada dua di antaranya.
 */
const PILL = 'gap-1.5 [&_svg]:shrink-0';

/**
 * `brand` dipakai untuk pill yang membawa pembaca lebih jauh ke dalam produk,
 * bukan keluar darinya. Warnanya sama dengan tombol Connect — biru yang tidak
 * ikut berubah antar tema — dan varian itu sudah memaksa ikonnya jadi putih.
 */
type PillVariant = 'secondary' | 'brand';

function pillClass(variant: PillVariant, className?: string): string {
  return cn(buttonVariants({ variant, size: 'sm', shape: 'pill' }), PILL, className);
}

interface PillContentProps {
  icon: ReactNode;
  children: ReactNode;
  variant?: PillVariant;
  className?: string;
}

export function PillLink({
  href,
  icon,
  children,
  variant = 'secondary',
  className,
}: PillContentProps & { href: Route }) {
  return (
    <Link href={href} className={pillClass(variant, className)}>
      {icon}
      {children}
    </Link>
  );
}

export function PillExternalLink({
  href,
  icon,
  children,
  variant = 'secondary',
  className,
}: PillContentProps & { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={pillClass(variant, className)}>
      {icon}
      {children}
    </a>
  );
}

/**
 * Pill yang menyalin nilainya sendiri.
 *
 * Labelnya menampilkan bentuk pendek, yang tersalin selalu nilai PENUH — alamat
 * terpotong yang tertempel di tempat lain tidak berguna, dan kegagalannya baru
 * ketahuan setelah seseorang mem-paste-nya.
 */
export function PillCopy({
  value,
  label,
  children,
  variant = 'secondary',
  className,
}: {
  value: string;
  /** Dibacakan pembaca layar, mis. "Copy subject address". */
  label: string;
  children: ReactNode;
  variant?: PillVariant;
  className?: string;
}) {
  const { copied, copy } = useCopy();

  return (
    <button
      type="button"
      onClick={() => copy(value)}
      aria-label={label}
      className={pillClass(variant, className)}
    >
      {copied ? (
        <Check size={14} strokeWidth={2} className="text-verified" />
      ) : (
        <Copy size={14} strokeWidth={1.5} className="text-ink-400" />
      )}
      {children}
    </button>
  );
}
