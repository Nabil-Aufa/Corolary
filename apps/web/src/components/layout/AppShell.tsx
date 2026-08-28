'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppHeader } from './AppHeader';

/**
 * Aplikasi tidak punya footer sama sekali — itu milik landing.
 *
 * Di dalam app, footer hanya mengulang hal yang sudah dibaca pengunjung
 * sebelum masuk, dan menambah satu hal lagi untuk digulung di halaman yang
 * tugasnya menampilkan data.
 *
 * Yang masih dibedakan di sini adalah SCROLL: /proofs mengisi layar persis
 * setinggi viewport. Ia tabel, bukan dokumen, dan halaman yang ikut bergeser
 * membuat header kolom hilang dari pandangan tepat saat ia paling dibutuhkan.
 */
const FIXED_HEIGHT_ROUTES: ReadonlySet<string> = new Set(['/proofs']);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFixedHeight = FIXED_HEIGHT_ROUTES.has(pathname);

  return (
    <div className={cn('flex flex-col', isFixedHeight ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <AppHeader />
      {/* min-h-0 memungkinkan anak flex menyusut di bawah tinggi kontennya —
          tanpa itu, kotak scroll di dalamnya akan memanjang dan mendorong
          halaman, persis yang ingin dihindari. */}
      <div className={cn('flex-1', isFixedHeight && 'min-h-0')}>{children}</div>
    </div>
  );
}
