'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Panel mengambang yang ditambatkan ke pemicunya.
 *
 * Bukan `<dialog>`: popover tidak boleh memerangkap fokus atau memblokir
 * halaman — pengguna harus bisa mengklik apa pun di belakangnya untuk
 * menutupnya. Yang dibutuhkan hanya tiga: tutup saat klik di luar, tutup saat
 * Escape, dan kembalikan fokus ke pemicu.
 */
export function Popover({
  open,
  onClose,
  children,
  className,
  align = 'right',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const el = ref.current;
      // `closest` supaya klik pada pemicunya sendiri tidak menutup lalu
      // membuka kembali dalam satu gerakan.
      if (el !== null && !el.contains(e.target as Node) && !(e.target as Element).closest?.('[data-popover-trigger]')) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'dialog-view absolute top-[calc(100%+8px)] z-50 rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
