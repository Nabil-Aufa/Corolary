import Link from 'next/link';
import { CorolaryLogo } from '@/components/brand/CorolaryLogo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/button';

/** Tinggi navbar. Tumpukan kartu sticky di `FeatureStack` berhenti tepat di
 *  bawah angka ini, jadi mengubahnya di sini tanpa mengubahnya di sana membuat
 *  kartu pertama terselip di belakang navbar. */
const BAR = 64;

/**
 * Navbar landing: logo, tiga tautan, satu tombol pil.
 *
 * CATATAN KONTRAS YANG BELUM SELESAI: navbar ini berlatar terang, sementara
 * separuh halaman di bawahnya berupa panel gelap. Di atas panel itu tautannya
 * jadi sulit dibaca. Versi adaptif — membalik warna mengikuti bagian di
 * belakangnya — sudah dicoba dengan tiga mekanisme dan KETIGANYA mati di
 * halaman ini: `IntersectionObserver` tidak mengirim satu callback pun, event
 * `scroll` pada window tidak pernah menyala (Lenis menggulir tanpa memicunya),
 * dan callback `requestAnimationFrame` yang dijadwalkan dari efek komponen ini
 * tidak pernah dieksekusi. Ketiganya gagal DIAM — tanpa satu pun error — jadi
 * siapa pun yang mencoba lagi akan mengira kodenya yang salah. Sebabnya ada di
 * luar komponen ini dan belum ditemukan.
 *
 * Tetap `sticky` dan tembus pandang: header buram penuh akan memotong sudut
 * membulat panel persis saat panel itu meluncur naik, dan sudut itu seluruh
 * efek halaman ini.
 */
export function MarketingHeader() {
  const link =
    'hidden min-h-11 items-center px-3 text-small text-ink-700 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex';

  return (
    <header
      className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md"
      style={{ height: BAR }}
    >
      <div className="mkt-container flex h-full items-center">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-[var(--radius-base)] text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <CorolaryLogo className="h-[22px] w-[22px]" />
          <span className="font-display text-h3 font-medium tracking-tight">Corolary</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Disembunyikan di layar sempit, bukan dilipat jadi menu hamburger.
              Tiga tautan tidak membenarkan sebuah drawer, dan tombol di
              sebelahnya sudah mengantar ke tempat yang sama. */}
          <Link href="/proofs" className={link}>
            Proofs
          </Link>
          <Link href="/market" className={link}>
            Market
          </Link>
          <Link href="/score" className={link}>
            Score
          </Link>

          <ThemeToggle />

          <Link href="/proofs">
            {/* Pil, bukan sudut biasa — bentuk CTA utama di seluruh landing.
                Warnanya TIDAK ikut membalik: `brand` sengaja satu biru untuk
                kedua tema, dan tombol yang berubah rupa saat digulir terbaca
                seperti tombol yang berbeda. */}
            <Button variant="brand" shape="pill">
              Launch app
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
