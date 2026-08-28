'use client';

import { ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { etherscanTx } from '@/lib/explorer';
import { formatBps, formatTokenAmount, formatUsdPrice } from '@/lib/format';
import type { Reserve } from '@/types';

const COLS = 'grid-cols-[1fr_7rem_7rem_7rem_9rem]';

export function ReserveTable({
  reserves,
  isLoading,
}: {
  reserves: Reserve[];
  isLoading?: boolean;
}) {
  return (
    <Card>
      <div
        className={`hidden h-11 ${COLS} items-center gap-4 border-b border-border px-5 text-micro uppercase tracking-wide text-ink-400 md:grid`}
      >
        <span>Asset</span>
        <span className="text-right">Supply APY</span>
        <span className="text-right">Borrow APY</span>
        <span className="text-right">Utilization</span>
        <span className="text-right">Total supplied</span>
      </div>

      {isLoading === true
        ? Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex h-[76px] items-center gap-4 border-b border-border px-5 last:border-b-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="ml-auto h-4 w-40" />
            </div>
          ))
        : reserves.map((r) => (
            <div
              key={r.asset}
              className={`grid ${COLS} items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 md:h-[76px] md:py-0`}
            >
              <div className="min-w-0">
                <p className="text-body font-medium text-ink-900">{r.symbol}</p>
                <p className="num flex items-center gap-1 text-micro text-ink-400">
                  {formatUsdPrice(r.priceUsd)}
                  {/* Harga BUKAN Fact — PriceRegistry menyimpan ronde terbaru
                      per aset, bukan catatan permanen ber-ID. Jadi tautannya
                      ke Etherscan, bukan ke /proofs/[factId]. */}
                  {r.priceSourceTxHash !== null && (
                    <a
                      href={etherscanTx(r.priceSourceTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      title="Chainlink round that proves this price"
                      className="text-verified transition-opacity hover:opacity-70"
                    >
                      <ExternalLink size={11} strokeWidth={1.5} />
                    </a>
                  )}
                </p>
              </div>

              <span className="num text-right text-small text-ink-900">
                {formatBps(r.supplyApyBps)}
              </span>
              <span className="num text-right text-small text-ink-900">
                {formatBps(r.borrowApyBps)}
              </span>
              <span className="num text-right text-small text-ink-500">
                {formatBps(r.utilizationBps, 1)}
              </span>
              <span className="num text-right text-small text-ink-900">
                {formatTokenAmount(r.totalSupplied, r.decimals)}
              </span>
            </div>
          ))}
    </Card>
  );
}
