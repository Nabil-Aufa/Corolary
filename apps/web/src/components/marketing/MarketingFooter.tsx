import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { creditcoinTestnet } from '@corolary/shared/chains';
import { creditcoinAddress } from '@/lib/explorer';
import { shortenAddress } from '@/lib/format';
import { appHref } from '@/lib/hosts';

/**
 * Alamat kontrak, bukan tautan sosial.
 *
 * Footer landing biasanya tempat pengumpul tautan. Di sini ia mengerjakan satu
 * hal yang benar-benar berguna: menutup pertanyaan "apakah ini benar-benar
 * ter-deploy". Alamat yang bisa diklik ke explorer menjawabnya dalam dua detik,
 * dan itu murah dilakukan.
 *
 * Kontrak yang alamatnya belum diisi env sengaja DIHILANGKAN, bukan
 * ditampilkan kosong atau dengan alamat nol — baris kontrak yang menunjuk ke
 * `0x000…` terbaca seperti deploy yang gagal.
 */
const CONTRACTS = [
  { label: 'FactRegistry', address: process.env.NEXT_PUBLIC_FACT_REGISTRY_ADDRESS },
  { label: 'CreditGraph', address: process.env.NEXT_PUBLIC_CREDIT_GRAPH_ADDRESS },
  { label: 'EfficiencyMarket', address: process.env.NEXT_PUBLIC_EFFICIENCY_MARKET_ADDRESS },
  { label: 'PriceRegistry', address: process.env.NEXT_PUBLIC_PRICE_REGISTRY_ADDRESS },
].filter((c): c is { label: string; address: string } => {
  return typeof c.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(c.address);
});

/** Jangkar di halaman ini. Id-nya milik `MarketingHeader`, jadi keduanya harus
 *  berubah bersama kalau sebuah bagian dihapus. */
const SECTIONS = [
  { href: '#pipeline', label: 'Pipeline' },
  { href: '#proof', label: 'Proof' },
  { href: '#registry', label: 'Registry' },
  { href: '#faq', label: 'FAQ' },
];

/** Halaman aplikasi, yang hidup di host berbeda — karena itu `appHref`, bukan
 *  `Link` biasa. */
const APP_LINKS = [
  { href: appHref('/proofs'), label: 'Proofs' },
  { href: appHref('/market'), label: 'Market' },
  { href: appHref('/score'), label: 'Score' },
  { href: appHref('/portfolio'), label: 'Portfolio' },
];

/**
 * Di referensi, dua pil di kiri atas adalah alamat email dan nomor telepon —
 * cara menghubungi agensinya. Produk ini tidak dijual lewat percakapan, jadi
 * yang setara adalah dua pintu masuk ke hal yang bisa diperiksa sendiri.
 *
 * Baris ikon sosial di kanan bawah referensi TIDAK ada di sini. Kita cuma
 * punya satu kanal yang benar-benar milik proyek ini, dan empat lingkaran yang
 * tiga di antaranya menunjuk ke mana-mana persis jenis tombol yang dilarang
 * `check:no-mocks`: terlihat aktif, tidak melakukan apa-apa.
 */
const DOORS = [
  {
    href: appHref('/proofs'),
    label: 'Open the app',
    caption: 'Source chain',
    // Tanpa nomor chainKey-nya, dan itu disengaja. Nilai 3 memang benar, tapi
    // tidak ada konstanta untuknya di `@corolary/shared` — satu-satunya sumber
    // hidupnya `/v1/indexer/status`. Menuliskannya sebagai angka di sini
    // membuat footer mengaku tahu sesuatu yang tidak pernah dibacanya, persis
    // hal yang diperingatkan `check:no-mocks` untuk diperiksa manusia.
    value: 'Ethereum mainnet, read through Attestcoin',
  },
  {
    href: appHref('/score'),
    label: 'Check a score',
    caption: 'Settlement',
    value: `${creditcoinTestnet.name} · chainId ${creditcoinTestnet.id}`,
  },
];

export function MarketingFooter() {
  return (
    <footer className="bg-panel text-panel-ink-700">
      <div className="mkt-container pb-[clamp(32px,4vw,56px)] pt-[clamp(56px,7vw,112px)]">
        <div className="grid gap-x-10 gap-y-14 md:grid-cols-12">
          <div className="flex flex-wrap gap-x-10 gap-y-12 md:col-span-7">
            {DOORS.map((door) => (
              <div key={door.label}>
                <a
                  href={door.href}
                  className="inline-flex min-h-11 items-center rounded-full border border-panel-border px-7 text-[clamp(15px,1.15vw,19px)] text-panel-ink-900 transition-colors hover:border-panel-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {door.label}
                </a>
                <p className="mt-6 max-w-[26ch] text-small leading-relaxed">
                  <span className="mr-2 uppercase tracking-[0.12em] text-panel-ink-500">
                    {door.caption}
                  </span>
                  <span className="text-panel-ink-900">{door.value}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Dua kolom tautan, rata KANAN seperti di referensi. Rata kiri
              membuatnya terbaca sebagai lanjutan kolom alamat di sebelahnya,
              bukan sebagai daftar tersendiri. */}
          <nav aria-label="Footer" className="md:col-span-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:text-right">
              <ul className="space-y-4">
                {SECTIONS.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-[clamp(15px,1.15vw,19px)] text-panel-ink-900 transition-colors hover:text-panel-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
              <ul className="space-y-4">
                {APP_LINKS.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-[clamp(15px,1.15vw,19px)] text-panel-ink-900 transition-colors hover:text-panel-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-[clamp(56px,7vw,112px)] grid gap-10 border-t border-panel-border pt-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="text-micro font-medium uppercase tracking-[0.12em] text-panel-ink-500">
              Contracts on {creditcoinTestnet.name}
            </p>
            <ul className="mt-5 space-y-2">
              {CONTRACTS.map((c) => (
                <li key={c.label}>
                  <a
                    href={creditcoinAddress(c.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-small text-panel-ink-700 hover:text-panel-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="w-40 shrink-0">{c.label}</span>
                    <span className="num text-panel-ink-500">{shortenAddress(c.address, 6)}</span>
                    <ArrowUpRight size={13} strokeWidth={1.5} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-7">
            {/* Dinyatakan di muka, bukan disembunyikan (docs/open-issues.md B2). */}
            <p className="max-w-xl text-small text-panel-ink-500">
              Market tokens are testnet ERC-20s. Credit history, prices and scores all come from
              real Ethereum mainnet transactions proven through the Attestcoin Protocol. The tokens
              are stand-ins, the prices are not.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 text-small text-panel-ink-500">
          <p>
            <Link
              href={'/' as Route}
              className="text-panel-ink-700 transition-colors hover:text-panel-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Corolary
            </Link>
            <span className="ml-4">Built for BUIDL CTC 2026 Fall</span>
          </p>
          <p className="num">
            {creditcoinTestnet.name} · chainId {creditcoinTestnet.id}
          </p>
        </div>
      </div>
    </footer>
  );
}
