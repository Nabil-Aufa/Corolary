import Link from 'next/link';
import { CorolaryLogo } from '@/components/brand/CorolaryLogo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/button';

/**
 * Header landing: tanpa navigasi halaman, tanpa tombol wallet.
 *
 * Pengunjung baru tidak punya alasan untuk connect wallet sebelum tahu ini apa,
 * dan menaruh nav lengkap di sini menyamarkan satu-satunya aksi yang kita
 * inginkan dari mereka — masuk ke app.
 *
 * `sticky` disengaja meski bagian gelap lewat di bawahnya: latarnya
 * `bg-bg/80` dengan blur, jadi ia tetap terbaca di atas panel maupun halaman
 * terang. Header buram penuh akan memotong sudut membulat panel saat panel itu
 * meluncur naik, dan itu justru merusak efek yang jadi inti halaman ini.
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center px-6 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-[var(--radius-base)] text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <CorolaryLogo className="h-[22px] w-[22px]" />
          <span className="font-display text-h3 font-medium tracking-tight">Corolary</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href="/proofs">
            {/* Pil, bukan sudut biasa — bentuk CTA utama di seluruh landing. */}
            <Button variant="brand" shape="pill">
              Buka app
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
