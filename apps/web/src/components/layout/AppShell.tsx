'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';

/**
 * Rute yang mengisi layar PERSIS setinggi viewport: tidak ada scroll halaman,
 * dan karena itu tidak ada footer.
 *
 * /proofs adalah tabel, bukan dokumen. Yang bergerak saat pengguna men-scroll
 * seharusnya barisnya — halaman yang ikut bergeser membuat header kolom hilang
 * dari pandangan tepat saat ia paling dibutuhkan. Footer pun tidak punya
 * tempat: ia hanya bisa dicapai dengan menggulung sesuatu yang sengaja
 * dibuat tidak bergulung.
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
      {!isFixedHeight && <AppFooter />}
    </div>
  );
}
