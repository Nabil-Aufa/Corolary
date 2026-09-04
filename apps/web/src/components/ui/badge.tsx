import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-0.5 text-micro font-medium uppercase tracking-wide',
  {
    variants: {
      tone: {
        neutral: 'bg-bg text-ink-500 border border-border',
        accent: 'bg-accent-soft text-accent',
        // Teal HANYA untuk hal yang benar-benar terbukti secara kriptografis.
        verified: 'bg-verified-soft text-verified',
        positive: 'bg-positive-soft text-positive',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',

        /* Varian BERISI, dipakai lencana kind di /proofs. Kind adalah kolom
           yang dipindai mata lebih dulu daripada apa pun di baris itu; latar
           pucat membuat kelimanya terbaca sebagai satu blok abu-abu dari
           kejauhan. Yang lembut di atas tetap untuk label yang seharusnya
           tidak berteriak — `verified` termasuk. */
        solidNeutral: 'bg-ink-500 text-on-solid',
        solidAccent: 'bg-accent text-on-solid',
        solidPositive: 'bg-positive text-on-solid',
        solidWarning: 'bg-warning text-on-solid',
        solidDanger: 'bg-danger text-on-solid',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
