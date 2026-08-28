import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Elevasi lewat border 1px, bukan shadow (docs/frontend.md §2.4). Shadow tebal
 * berwarna adalah salah satu hal yang secara eksplisit dihindari — ia membuat
 * data terasa seperti kartu permainan, bukan seperti catatan.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[var(--radius-lg)] border border-border bg-surface', className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6', className)} {...props} />;
}
