import { creditcoinTestnet } from '@corolary/shared/chains';

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[1280px] px-6 py-10 text-small text-ink-500 md:px-8">
        {/* Dinyatakan di muka, bukan disembunyikan (docs/open-issues.md B2). */}
        <p className="max-w-3xl">
          Market tokens are testnet ERC-20s. Credit history, prices, and scores come from real
          Ethereum mainnet transactions proven through the Attestcoin Protocol.
        </p>
        <p className="num mt-3 text-ink-400">
          {creditcoinTestnet.name} · chainId {creditcoinTestnet.id}
        </p>
      </div>
    </footer>
  );
}
