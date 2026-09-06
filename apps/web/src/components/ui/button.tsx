'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Ditulis tangan, bukan `shadcn add`. CLI-nya menulis palet tokennya sendiri ke
// globals.css dan akan bersaing dengan tokens.css — dua sumber warna di satu
// proyek adalah cara paling cepat kehilangan konsistensi "verified vs accent".
const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
  {
    variants: {
      /**
       * Radius, dipisah dari `variant` supaya pill mewarisi SELURUH penampilan
       * tombol biasa — border, permukaan, hover — dan hanya berbeda sudutnya.
       *
       * Kalau pill jadi komponen tersendiri dengan gayanya sendiri, ia akan
       * menyimpang diam-diam begitu warna tombol berubah; ini yang membuat
       * pill di hero /proofs/[factId] dan tombol "Prove a transaction" di
       * /proofs tidak bisa berbeda tanpa seseorang menyadarinya.
       */
      shape: {
        base: 'rounded-[var(--radius-base)]',
        pill: 'rounded-full',
      },
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover',
        // Satu penampilan untuk kedua tema — lihat --color-brand di tokens.css.
        brand: 'bg-brand text-white hover:bg-brand-hover [&_svg]:text-white',
        secondary: 'border border-border bg-surface text-ink-700 hover:border-border-strong hover:text-ink-900',
        ghost: 'text-ink-500 hover:bg-accent-soft hover:text-accent',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-small',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-6 text-body',
        icon: 'h-10 w-10',
        // Sepadan tinggi dengan `sm`, jadi tombol ikon dan tombol berteks bisa
        // berdiri berdampingan di baris tabel yang sama tanpa saling menggeser.
        iconSm: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', shape: 'base' },
  },
);

/**
 * Kelas tombol tanpa elemen <button>-nya.
 *
 * Dibutuhkan karena sebagian "tombol" di produk ini sebenarnya tautan —
 * Etherscan dan Blockscout membuka tab baru, "See their score" navigasi
 * internal. Membungkus <a> di dalam <button> merusak semantik dan
 * middle-click; ini membuat keduanya berbagi satu sumber gaya.
 */
export const buttonVariants = button;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export function Button({ className, variant, size, shape, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size, shape }), className)} {...props} />;
}
