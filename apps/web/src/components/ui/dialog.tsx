'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Modal di atas elemen `<dialog>` bawaan browser, bukan div bertumpuk.
 *
 * `showModal()` memberi kita empat hal secara gratis dan benar: perangkap
 * fokus, tombol Escape, backdrop, dan penempatan di top layer sehingga tidak
 * ada `z-index` yang bisa menimpanya. Menirunya dengan div berarti menulis
 * ulang keempatnya — dan biasanya salah di aksesibilitas.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      // Escape memanggil `close`, bukan langsung menutup state React —
      // kalau tidak, state dan elemen bisa berbeda pendapat soal apakah
      // modalnya terbuka.
      onClose={onClose}
      onClick={(e) => {
        // Klik yang mendarat di elemen dialog itu sendiri berarti mengenai
        // backdrop; klik di dalam kartu mengenai anaknya.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        // Overlay memakai hitam tetap, BUKAN --color-ink-900: token itu
        // membalik jadi hampir-putih di dark mode, dan backdrop terang di
        // belakang modal gelap membuat seluruh layar menyala.
        'w-[min(92vw,26rem)] rounded-[var(--radius-lg)] border border-border bg-surface p-0 text-ink-700 shadow-sm backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        'fixed inset-0 m-auto',
        className,
      )}
    >
      {children}
    </dialog>
  );
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="absolute right-4 top-4 rounded-full p-1 text-ink-400 transition-colors hover:bg-bg hover:text-ink-900"
    >
      <X size={16} strokeWidth={2} />
    </button>
  );
}
