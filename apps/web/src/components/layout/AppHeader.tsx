import Link from 'next/link';
import type { Route } from 'next';
import { CorolaryLogo } from '@/components/brand/CorolaryLogo';
import { NavLink } from './NavLink';
import { WalletButton } from './WalletButton';

// Urutannya mengikuti alur produk, bukan kepentingan halamannya: bukti lebih
// dulu, lalu pasar yang memakainya, lalu posisi milik sendiri. Score duduk
// paling kanan, tepat di sebelah tombol wallet, karena ia satu-satunya menu
// yang menanyakan "alamat siapa" dan karena itu berpasangan dengan dompet yang
// sedang tersambung.
const NAV: { href: Route; label: string }[] = [
  { href: '/proofs', label: 'Proofs' },
  { href: '/market', label: 'Market' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/score', label: 'Score' },
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

        {/* Tema tidak lagi punya tombol sendiri di sini — kendalinya hidup di
            panel wallet, dan dua pemicu untuk satu pengaturan hanya menambah
            hal yang harus dipindai mata di baris yang seharusnya tenang. */}
        <div className="ml-auto flex items-center">
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
