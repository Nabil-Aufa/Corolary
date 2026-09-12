import { ArrowUpRight } from 'lucide-react';
import { CorolaryLogo } from '@/components/brand/CorolaryLogo';
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
  {
    label: 'FactRegistry',
    address: process.env.NEXT_PUBLIC_FACT_REGISTRY_ADDRESS,
  },
  {
    label: 'CreditGraph',
    address: process.env.NEXT_PUBLIC_CREDIT_GRAPH_ADDRESS,
  },
  {
    label: 'EfficiencyMarket',
    address: process.env.NEXT_PUBLIC_EFFICIENCY_MARKET_ADDRESS,
  },
  {
    label: 'PriceRegistry',
    address: process.env.NEXT_PUBLIC_PRICE_REGISTRY_ADDRESS,
  },
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

/** Halaman aplikasi, yang hidup di host berbeda — karena itu href penuh. */
const APP_LINKS = [
  { href: appHref('/proofs'), label: 'Proofs' },
  { href: appHref('/market'), label: 'Market' },
  { href: appHref('/score'), label: 'Score' },
  { href: appHref('/portfolio'), label: 'Portfolio' },
];

const LINK_CLASS =
  'inline-flex min-h-9 items-center text-body text-ink-700 transition-colors hover:text-ink-900 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const COLUMN_TITLE_CLASS = 'text-micro font-semibold uppercase tracking-[0.12em] text-ink-900';

/**
 * Footer, pada struktur referensi: pita full-bleed, satu kartu terang di
 * dalamnya, dan wordmark raksasa di bawah kartu.
 *
 * Pitanya sewarna `Outro` di atasnya, bukan biru merek. Biru penuh selebar
 * layar di paling bawah membuat footer terbaca sebagai bagian BARU, padahal
 * tugasnya menutup; sewarna bagian sebelumnya, kartu terang di dalamnya yang
 * jadi bentuk barunya — mekanisme yang sama dengan curtain di seluruh halaman.
 *
 * Dua blok dari referensi TIDAK ada di sini, dan ketiadaannya disengaja.
 *
 * Form newsletter: proyek ini tidak punya satu pun. Referensi menaruh input
 * email dengan tombol "Subscribe" di kiri kartu; memasangnya di sini berarti
 * sebuah kolom yang menerima alamat orang lalu tidak mengirimkannya ke mana
 * pun. Yang menggantikannya cuma satu kalimat. Tidak ada tombol di sini:
 * `Outro` tepat di atasnya SUDAH satu ajakan bertindak, dan mengulanginya
 * dua ratus piksel kemudian membuat keduanya terbaca lebih lemah.
 *
 * Baris empat ikon sosial: proyek ini punya nol kanal sosial. Empat lingkaran
 * yang semuanya menunjuk ke mana-mana persis jenis tombol yang dilarang
 * `check:no-mocks` — terlihat aktif, tidak melakukan apa-apa.
 *
 * Kolomnya tiga karena grup tautan yang benar-benar ada memang tiga: bagian di
 * halaman ini, halaman aplikasi, dan kontrak yang ter-deploy. Yang terakhir
 * menyusut sendiri kalau env-nya belum diisi, jadi kolomnya bisa berisi kurang
 * dari empat baris — itu lebih jujur daripada mengisinya dengan tautan karangan.
 */
export function MarketingFooter() {
  return (
    <footer data-nav="dark" className="bg-panel p-6">
      <div className="rounded-[clamp(20px,2vw,28px)] bg-bg px-5 pb-6 pt-[clamp(32px,4vw,64px)] sm:px-[clamp(20px,3vw,56px)]">
        <div className="grid gap-x-10 gap-y-12 min-[900px]:grid-cols-[45fr_55fr]">
          {/* Kiri: satu kalimat, satu pintu, lalu barisan legal. */}
          <div>
            <p className="max-w-[30ch] font-display text-mkt-h3 font-medium leading-tight text-ink-900">
              Every number here can be traced back to a mainnet transaction.
            </p>

            {/* Dinyatakan di muka, bukan disembunyikan (docs/open-issues.md B2). */}
            <p className="mt-8 max-w-[46ch] text-small text-ink-500">
              Market tokens are testnet ERC-20s. Credit history, prices and scores all come from
              real Ethereum mainnet transactions proven through the Attestcoin Protocol. The tokens
              are stand-ins, the prices are not.
            </p>
          </div>

          {/* Kanan: tiga kolom tautan. */}
          <nav
            aria-label="Footer"
            className="grid grid-cols-1 gap-x-8 gap-y-10 min-[600px]:grid-cols-2 min-[900px]:grid-cols-3"
          >
            <div>
              <h2 className={COLUMN_TITLE_CLASS}>This page</h2>
              <ul className="mt-4 space-y-1">
                {SECTIONS.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className={LINK_CLASS}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className={COLUMN_TITLE_CLASS}>The app</h2>
              <ul className="mt-4 space-y-1">
                {APP_LINKS.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className={LINK_CLASS}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-[600px]:col-span-2 min-[900px]:col-span-1">
              <h2 className={COLUMN_TITLE_CLASS}>Contracts</h2>
              <ul className="mt-4 space-y-1">
                {CONTRACTS.map((c) => (
                  <li key={c.label}>
                    <a
                      href={creditcoinAddress(c.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      // The only link whose label is two pieces plus an icon.
                      // Without wrapping it sets a min-content floor wider than
                      // its column and pushes the whole page sideways at 1024.
                      className={`${LINK_CLASS} flex-wrap gap-x-2`}
                    >
                      {c.label}
                      <span className="num text-ink-400">{shortenAddress(c.address, 4)}</span>
                      <ArrowUpRight size={13} strokeWidth={1.5} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        {/* Wordmark. Teks, bukan SVG: yang ada di repo adalah mark bundar, bukan
            kata. `clamp` dengan satuan vw supaya ia tumbuh bersama kartu, dan
            `leading-[0.78]` memotong ruang bawah huruf sehingga dasarnya duduk
            di tepi kartu seperti di referensi. `select-none` karena ini ornamen
            — sudah ada satu "Corolary" yang bisa dibaca di navbar. */}
        <div className="relative mt-[clamp(40px,6vw,88px)] overflow-hidden [container-type:inline-size]">
          <p
            aria-hidden="true"
            className="select-none font-display font-medium leading-[0.78] tracking-[-0.04em] text-panel"
            // 25.3cqw, because this word measures 3.95x its font-size in the
            // display face and `cqw` is a hundredth of the CARD's inner width.
            // Viewport units cannot do this job: `100vw` counts the scrollbar,
            // so the fit would drift the moment the scrollbar is hidden.
            style={{ fontSize: 'clamp(40px, 25.3cqw, 520px)' }}
          >
            Corolary
          </p>
          {/* Di kanan ATAS wordmark, bukan di sebelahnya: bersebelahan berarti
              keduanya berebut lebar yang sama dan wordmark-nya tidak pernah
              sampai ke tepi kartu. */}
          <span className="absolute right-0 top-0 text-panel [&_svg]:size-[clamp(20px,2.4vw,40px)]">
            <CorolaryLogo />
          </span>
        </div>
      </div>
    </footer>
  );
}
