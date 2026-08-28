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
 */
export function MarketingHeader() {
  return (
    <header className="bg-bg">
      <div className="flex h-16 items-center px-8 md:px-12">
        <Link href="/" className="flex items-center gap-2.5 text-ink-900">
          <CorolaryLogo className="h-[22px] w-[22px]" />
          <span className="text-h3 font-semibold tracking-tight">Corolary</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href="/proofs">
            <Button variant="brand">Launch app</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
