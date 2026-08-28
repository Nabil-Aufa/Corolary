'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { shortenAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Address } from '@/types';

interface AddressDisplayProps {
  address: Address | string;
  truncate?: boolean;
  copyable?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  truncate = true,
  copyable = true,
  className,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard bisa ditolak (konteks non-secure, izin dicabut). Diam saja —
      // alamatnya tetap terlihat dan bisa diseleksi manual.
    }
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="num text-ink-900">{truncate ? shortenAddress(address) : address}</span>
      {copyable && (
        <button
          type="button"
          onClick={copy}
          aria-label="Copy address"
          className="text-ink-400 transition-colors hover:text-accent"
        >
          {copied ? (
            <Check size={14} strokeWidth={1.5} className="text-verified" />
          ) : (
            <Copy size={14} strokeWidth={1.5} />
          )}
        </button>
      )}
    </span>
  );
}
