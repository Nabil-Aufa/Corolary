'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tooltip hover/fokus, dirender sendiri alih-alih memakai atribut `title`.
 *
 * `title` bawaan browser tidak bisa diberi gaya, muncul terlambat sekitar satu
 * detik, dan tidak pernah tampil untuk pengguna keyboard. Yang ini muncul
 * seketika, ikut tema, dan terpicu oleh fokus juga.
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            'dialog-view absolute right-0 top-[calc(100%+8px)] z-50 w-[17rem] rounded-[var(--radius-base)] border border-border bg-surface p-3 text-left text-small font-normal normal-case tracking-normal text-ink-700 shadow-sm',
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
