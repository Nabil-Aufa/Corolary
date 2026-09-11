import { ArrowUpRight } from 'lucide-react';
import { creditcoinTestnet } from '@corolary/shared/chains';
import { creditcoinAddress } from '@/lib/explorer';
import { shortenAddress } from '@/lib/format';

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

export function MarketingFooter() {
  return (
    <footer className="bg-panel text-panel-ink-700">
      <div className="mx-auto max-w-[1280px] px-6 pb-16 md:px-8">
        <div className="grid gap-10 border-t border-panel-border pt-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="text-micro font-medium uppercase tracking-[0.12em] text-panel-ink-500">
              Kontrak di {creditcoinTestnet.name}
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
              Token pasar adalah ERC-20 testnet. Riwayat kredit, harga, dan skor berasal dari
              transaksi Ethereum mainnet nyata yang dibuktikan lewat Attestcoin Protocol — token
              yang jadi stand-in, harganya tidak.
            </p>
            <p className="num mt-5 text-small text-panel-ink-500">
              {creditcoinTestnet.name} · chainId {creditcoinTestnet.id}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
