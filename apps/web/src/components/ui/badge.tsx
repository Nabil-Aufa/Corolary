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
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
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
