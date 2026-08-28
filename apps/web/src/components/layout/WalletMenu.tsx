'use client';

import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, Power } from 'lucide-react';
import { useSwitchChain } from 'wagmi';
import { creditcoinTestnet } from '@corolary/shared/chains';
import { WalletAvatar } from '@/components/shared/WalletAvatar';
import { Button } from '@/components/ui/button';
import { shortenAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Address } from '@/types';
import { ThemeSegments } from './ThemeSegments';

export function WalletMenu({
  address,
  isWrongNetwork,
  onDisconnect,
}: {
  address: Address;
  isWrongNetwork: boolean;
  onDisconnect: () => void;
}) {
  const { switchChain, isPending } = useSwitchChain();
  const [copied, setCopied] = useState(false);
  // Baris jaringan terbuka sendiri kalau memang ada yang salah — pengguna
  // tidak perlu menemukannya dulu untuk tahu ada yang perlu diperbaiki.
  const [networkOpen, setNetworkOpen] = useState(isWrongNetwork);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard bisa ditolak. Alamatnya tetap terlihat dan bisa diseleksi.
    }
  }

  return (
    <div className="w-[22rem] p-2.5">
      <div className="flex items-center gap-2.5 px-2.5 py-2.5">
        <WalletAvatar address={address} size={26} />
        <span className="num text-body font-medium text-ink-900">{shortenAddress(address)}</span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy address"
          className="text-ink-400 transition-colors hover:text-accent"
        >
          {copied ? (
            <Check size={14} strokeWidth={2} className="text-verified" />
          ) : (
            <Copy size={14} strokeWidth={1.75} />
          )}
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          aria-label="Disconnect"
          className="ml-auto text-ink-400 transition-colors hover:text-danger"
        >
          <Power size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="my-2.5 h-px bg-border" />

      <div className="flex items-center justify-between px-2.5 py-2.5">
        <span className="text-small text-ink-700">Theme</span>
        <ThemeSegments />
      </div>

      <button
        type="button"
        onClick={() => setNetworkOpen((v) => !v)}
        aria-expanded={networkOpen}
        className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-base)] px-2.5 py-2.5 text-left transition-colors hover:bg-bg"
      >
        <span className="text-small text-ink-700">Network</span>
        <span className="flex items-center gap-1.5">
          {isWrongNetwork && (
            <AlertTriangle size={14} strokeWidth={2} className="text-warning" aria-hidden="true" />
          )}
          <span
            className={cn('text-small', isWrongNetwork ? 'text-warning' : 'text-ink-900')}
          >
            {creditcoinTestnet.name}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={cn('text-ink-400 transition-transform', networkOpen && 'rotate-180')}
          />
        </span>
      </button>

      {networkOpen && (
        <div className="slide-down">
          <div>
            <div className="px-2.5 pb-1.5 pt-2">
              <Button
                variant="brand"
                size="md"
                className="w-full"
                disabled={isPending || !isWrongNetwork}
                onClick={() => switchChain({ chainId: creditcoinTestnet.id })}
              >
                {isPending
                  ? 'Switching…'
                  : isWrongNetwork
                    ? 'Switch network'
                    : 'Already connected'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
