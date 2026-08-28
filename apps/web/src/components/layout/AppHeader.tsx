import Link from 'next/link';
import type { Route } from 'next';
import { CorolaryLogo } from '@/components/brand/CorolaryLogo';
import { NavLink } from './NavLink';
import { ThemeToggle } from './ThemeToggle';
import { WalletButton } from './WalletButton';

// Skor lebih dulu: itu yang dicari pengunjung. Bukti datang setelah ada klaim
// yang perlu dibuktikan. Juri digiring ke /proofs lewat CTA di landing, bukan
// dengan membalik urutan menu.
const NAV: { href: Route; label: string }[] = [
  { href: '/score', label: 'Score' },
  { href: '/proofs', label: 'Proofs' },
  { href: '/market', label: 'Market' },
  { href: '/portfolio', label: 'Portfolio' },
];

/**
 * Header menyatu dengan halaman: latar yang sama, tanpa garis pemisah.
 *
 * Garis bawah membuat navigasi terbaca sebagai lapisan terpisah yang mengambang
 * di atas konten. Tanpa garis, ia terbaca sebagai bagian dari halaman — dan
 * satu-satunya elemen berkontras tinggi di seluruh layar jadi tombol Connect,
 * yang memang satu-satunya aksi utama di sini.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur">
      <div className="flex h-16 items-center gap-8 px-8 md:px-12">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-ink-900">
          <CorolaryLogo className="h-[22px] w-[22px]" />
          <span className="text-h3 font-semibold tracking-tight">Corolary</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>

      <nav
        aria-label="Main"
        className="flex items-center gap-1 overflow-x-auto px-8 pb-2 md:hidden"
      >
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
    </header>
  );
}
