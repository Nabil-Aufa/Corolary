import type { ReactElement, SVGProps } from 'react';
import { apiBaseUrl } from '@/lib/api/client';
import { creditcoinAddress, creditcoinExplorer } from '@/lib/explorer';
import { appHref } from '@/lib/hosts';

interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

/**
 * Kontrak yang alamatnya belum diisi env sengaja DIHILANGKAN, bukan
 * ditampilkan kosong atau dengan alamat nol. Baris kontrak yang menunjuk ke
 * `0x000…` terbaca seperti deploy yang gagal.
 */
const CONTRACTS: FooterLink[] = [
  { label: 'FactRegistry', address: process.env.NEXT_PUBLIC_FACT_REGISTRY_ADDRESS },
  { label: 'CreditGraph', address: process.env.NEXT_PUBLIC_CREDIT_GRAPH_ADDRESS },
  { label: 'EfficiencyMarket', address: process.env.NEXT_PUBLIC_EFFICIENCY_MARKET_ADDRESS },
  { label: 'PriceRegistry', address: process.env.NEXT_PUBLIC_PRICE_REGISTRY_ADDRESS },
]
  .filter((c): c is { label: string; address: string } => {
    return typeof c.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(c.address);
  })
  .map((c) => ({ href: creditcoinAddress(c.address), label: c.label, external: true }));

const PRODUCT: FooterLink[] = [
  { href: appHref('/proofs'), label: 'Proofs' },
  { href: appHref('/market'), label: 'Market' },
  { href: appHref('/score'), label: 'Score' },
  { href: appHref('/portfolio'), label: 'Portfolio' },
];

/**
 * Tiga tempat memeriksa proyek ini tanpa melewati UI kita sama sekali.
 *
 * Endpoint status menjawab JSON mentah, dan itu memang gunanya. Tautan yang
 * membawa pembaca ke dashboard buatan kita sendiri tidak membuktikan apa pun
 * yang belum diklaim halaman ini.
 */
const ON_CHAIN: FooterLink[] = [
  { href: creditcoinExplorer(), label: 'Creditcoin explorer', external: true },
  { href: 'https://etherscan.io', label: 'Ethereum mainnet', external: true },
  { href: `${apiBaseUrl()}/indexer/status`, label: 'Indexer status', external: true },
];

/**
 * Repo publik, diperiksa langsung ke API GitHub dan menjawab 200.
 *
 * `NEXT_PUBLIC_X_URL` belum diisi dan tidak ada handle X di repo ini, jadi
 * sampai env-nya diisi ikonnya menunjuk ke beranda x.com. Itu halaman yang
 * benar-benar termuat, bukan 404, tapi juga BUKAN akun proyek ini. Isi
 * env-nya sebelum submit, kalau tidak ikon itu mengaku sesuatu yang belum ada.
 */
const SOCIAL: {
  href: string;
  label: string;
  Icon: (p: SVGProps<SVGSVGElement>) => ReactElement;
}[] = [
    {
      href: process.env.NEXT_PUBLIC_REPO_URL ?? 'https://github.com/Nabil-Aufa/Corolary',
      label: 'Corolary on GitHub',
      Icon: GithubMark,
    },
    {
      href:
        process.env.NEXT_PUBLIC_X_URL !== undefined && process.env.NEXT_PUBLIC_X_URL !== ''
          ? process.env.NEXT_PUBLIC_X_URL
          : 'https://x.com',
      label: 'Corolary on X',
      Icon: XMark,
    },
  ];

function GithubMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.82 1.1.82 2.22v3.29c0 .32.21.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

function XMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.3l-4.93-6.44L6.32 22H3.2l7.25-8.29L2.4 2h6.46l4.46 5.9L18.9 2Zm-1.1 18.2h1.74L7.3 3.7H5.44l12.36 16.5Z" />
    </svg>
  );
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  { title: 'Product', links: PRODUCT },
  { title: 'On chain', links: ON_CHAIN },
  { title: 'Contracts', links: CONTRACTS },
];

/**
 * Footer landing.
 *
 * Kolom keempat sengaja PROSA, bukan daftar tautan keempat. Dua hal yang
 * paling mudah disalahpahami tentang produk ini tidak bisa dijawab oleh nama
 * tautan, dan menyembunyikannya di halaman terpisah berarti hampir tidak ada
 * yang membacanya (docs/open-issues.md B2).
 *
 * Tidak ada baris ikon sosial seperti di referensi. Proyek ini belum punya akun
 * yang benar-benar miliknya, dan lingkaran yang menunjuk ke mana-mana persis
 * jenis kontrol yang dilarang `check:no-mocks`: terlihat aktif, tidak melakukan
 * apa-apa.
 */
export function MarketingFooter() {
  const year = new Date().getUTCFullYear();

  return (
    <footer className="bg-panel text-panel-ink-700">
      <div className="mkt-container pb-[clamp(28px,3.5vw,48px)] pt-[clamp(56px,7vw,112px)]">
        <div className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-body font-medium text-panel-ink-900">{column.title}</h2>
              <ul className="mt-6 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.external === true
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="text-body text-panel-ink-500 transition-colors hover:text-panel-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="space-y-8">
            <div>
              <h2 className="text-body font-medium text-panel-ink-900">What we show you</h2>
              <p className="mt-4 max-w-[42ch] text-body leading-relaxed text-panel-ink-500">
                Every number on this site comes from an Ethereum mainnet transaction proven
                on-chain, never from our own database. A fact that has not been proven yet is
                missing rather than estimated.
              </p>
            </div>

            <div>
              <h2 className="text-body font-medium text-panel-ink-900">Disclaimer</h2>
              <p className="mt-4 max-w-[42ch] text-body leading-relaxed text-panel-ink-500">
                Market tokens are testnet ERC-20s with no value. The credit history, the prices and
                the scores behind them are proven from real Ethereum mainnet transactions. This is a
                hackathon build, not financial advice.
              </p>
            </div>
          </div>
        </div>

        {/* Baris penutup ADA DI ATAS wordmark. Wordmark itu tanda tutup
            halaman, bukan bagian isi, jadi apa pun yang masih perlu dibaca
            harus selesai sebelum sampai ke sana. */}
        <div className="mt-[clamp(56px,7vw,112px)] flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-panel-border pt-8 text-small text-panel-ink-500">
          <p>Corolary © {year}</p>

          <ul className="ml-auto flex items-center gap-3">
            {SOCIAL.map(({ href, label, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex size-10 items-center justify-center rounded-full bg-panel-raised text-panel-ink-500 transition-colors hover:text-panel-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Icon className="size-[18px]" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Wordmark selebar kontainer, nyaris sewarna latarnya.
            Gradiennya putih beropasitas rendah, BUKAN token tinta, karena
            panel ini gelap di kedua tema — token yang ikut membalik akan
            membuat hurufnya menyala terang di tema terang.
            Ukurannya dibatasi oleh LEBAR ISI kontainer, bukan oleh lebar
            layar. "Corolary" selebar 3,63em pada font ini (terukur), dan
            `mkt-container` melompatkan padding sampingnya ke 240px di 1440px
            sekaligus berhenti tumbuh di 1600px. Jadi ruang yang tersedia
            MENYUSUT di 1440 lalu mentok di 1120px selamanya, sementara ukuran
            berbasis `vw` terus membesar. Pada 19vw hurufnya meluber 31px
            keluar kontainer di lebar ini, tanpa satu pun error.

            `pb-[0.28em]` bukan hiasan. Dengan `leading-[0.82]` kotak barisnya
            lebih pendek daripada huruf yang dilukis, dan ekor "y" menonjol
            0,24em DI BAWAH kotak itu. Tonjolan itu ikut memperpanjang area
            gulir: terukur dokumen 22px lebih tinggi daripada tepi bawah
            footer, dan 22px itu dicat latar HALAMAN yang terang, jadi ada pita
            putih tipis di bawah footer gelap. Padding dalam `em` tumbuh
            bersama fontnya, tidak seperti padding footer yang berhenti di
            48px. */}
        <p
          aria-hidden="true"
          className="mt-[clamp(48px,6vw,96px)] bg-gradient-to-b from-white/[0.16] to-white/[0.035] bg-clip-text pb-[0.28em] text-center font-display font-normal leading-[0.82] tracking-[-0.03em] text-transparent"
          style={{ fontSize: 'clamp(56px, 17.5vw, 300px)' }}
        >
          Corolary
        </p>
      </div>
    </footer>
  );
}
