import type { ReactNode } from 'react';
import { BootScreen } from '@/components/shared/BootScreen';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { SmoothScroll } from '@/components/marketing/SmoothScroll';

/** Kerangka landing. Satu tugas: mengantar pengunjung masuk ke app. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Di atas segalanya, dan dirender di server juga: overlay yang baru
          muncul setelah hydrate justru memamerkan halaman setengah jadi yang
          seharusnya ia tutupi. */}
      <BootScreen />

      {/* Scroll berinersia HANYA di landing. App adalah antarmuka padat data
          yang orang gulir untuk mencari baris tertentu, dan inersia justru
          membuat pencarian itu lebih sulit. */}
      <SmoothScroll />
      <MarketingHeader />
      <div className="flex-1">{children}</div>
      <MarketingFooter />
    </div>
  );
}
