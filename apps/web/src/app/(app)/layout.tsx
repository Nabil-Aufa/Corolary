import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

/**
 * Kerangka aplikasi: navigasi penuh dan footer dengan pengungkapan token
 * testnet. Dipakai /proofs, /score, /market, /portfolio.
 *
 * Landing sengaja TIDAK memakai ini — halaman itu punya tugas berbeda
 * (meyakinkan pengunjung baru), jadi ia punya kerangkanya sendiri di
 * (marketing)/layout.tsx. URL kedua grup tetap di root, jadi pemisahan ini
 * tidak mengubah satu pun alamat halaman.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
