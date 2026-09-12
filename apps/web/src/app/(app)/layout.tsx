import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BootScreen } from '@/components/shared/BootScreen';

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
  return (
    <>
      {/* Layar boot yang sama dengan landing, dengan batas tunggu jauh lebih
          pendek: di sini tidak ada hero WebGL, jadi satu-satunya gerbang
          adalah font dan ia selesai dalam hitungan milidetik. Batas 8 detik
          milik landing di halaman ini bukan jaring pengaman, ia cuma lama.

          Ia TIDAK muncul lagi saat seseorang berpindah dari landing ke sini:
          `hasBooted()` menandai satu pemuatan halaman, dan navigasi klien
          tidak menyiapkan apa pun yang perlu ditutupi. */}
      <BootScreen maxMs={3000} />
      <AppShell>{children}</AppShell>
    </>
  );
}
