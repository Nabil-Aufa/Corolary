import type { Metadata } from 'next';
import { Google_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// SATU keluarga font untuk seluruh produk — copy, label, dan angka.
//
// Monospace sempat dipakai untuk angka demi kolom yang sejajar, tapi hasilnya
// terbaca generik. Google Sans memberi perataan yang sama lewat `tabular-nums`
// (lihat kelas `.num` di globals.css) tanpa mengganti keluarga font, jadi
// hierarki dibangun dari BERAT dan UKURAN saja.
const googleSans = Google_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-family',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Corolary: Proven credit, portable collateral',
  description:
    'Cryptographically proven on-chain credit history from Ethereum mainnet, unlocking collateral efficiency on Creditcoin.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes menulis class tema ke <html>
    // sebelum React hydrate, jadi markup server dan klien memang berbeda di
    // atribut itu — dan itu disengaja.
    <html lang="en" className={googleSans.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        {/* Header dan footer TIDAK di sini. Landing dan app punya kerangka
            yang berbeda, dan itu ditentukan oleh layout masing-masing route
            group — (marketing) dan (app). */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
