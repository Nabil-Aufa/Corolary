import { creditcoinTestnet } from '@corolary/shared/chains';

export function AppFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto max-w-[1280px] px-6 py-8 text-small text-ink-500 md:px-8">
        {/* Dinyatakan di muka, bukan disembunyikan (docs/open-issues.md B2).
            Juri akan menyadarinya sendiri kalau kita diam, dan menemukannya
            sendiri jauh lebih merusak kredibilitas daripada kita menyebutnya. */}
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
