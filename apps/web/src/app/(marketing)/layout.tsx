import type { ReactNode } from 'react';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { SmoothScroll } from '@/components/marketing/SmoothScroll';

/** Kerangka landing. Satu tugas: mengantar pengunjung masuk ke app. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
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
