'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Ditulis tangan, bukan `shadcn add`. CLI-nya menulis palet tokennya sendiri ke
// globals.css dan akan bersaing dengan tokens.css — dua sumber warna di satu
// proyek adalah cara paling cepat kehilangan konsistensi "verified vs accent".
const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-base)] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
  {
    variants: {
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
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
