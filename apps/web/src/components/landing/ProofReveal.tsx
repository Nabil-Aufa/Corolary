'use client';

import type { ReactNode } from 'react';
import { FactKind } from '@corolary/shared';
import { Reveal } from '@/components/marketing/Reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { useFacts } from '@/hooks/useApi';
import { etherscanAddress, etherscanBlock, etherscanTx, creditcoinTx } from '@/lib/explorer';
import { formatTokenAmount, formatUsd, shortenAddress, shortenHex } from '@/lib/format';

/**
 * Satu pelunasan nyata, ditelusuri dari Ethereum sampai tercatat di Creditcoin.
 *
 * `limit: 1` — bagian ini hanya butuh fakta TERBARU, bukan daftar. `LoanRepaid`
 * dipilih (bukan kind lain) karena itu sinyal kredit yang paling langsung
 * dipahami pengunjung: seseorang melunasi utang nyata di mainnet.
 */
export function ProofReveal() {
  const { data, isPending, isError, refetch } = useFacts({ kind: FactKind.LoanRepaid, limit: 1 });
  const fact = data?.pages[0]?.data[0];

  return (
    <div className="mkt-container py-[clamp(80px,10vw,160px)]">
      <Reveal>
        <h2 className="font-display font-medium text-mkt-h2 text-panel-ink-900">
          One fact, end to end
        </h2>
      </Reveal>
      <Reveal delay={0.06}>
        <p className="mt-6 max-w-[44ch] text-mkt-statement text-panel-ink-700">
          This is the most recent repayment we&apos;ve actually recorded — not a mockup of one. Every
          value below links out to a block explorer where you can check it yourself.
        </p>
      </Reveal>

      <div className="mt-14">
        {isPending ? (
          <div className="flex flex-col">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between border-t border-panel-border py-5">
                <Skeleton className="h-3 w-32 bg-panel-border" />
                <Skeleton className="h-4 w-48 bg-panel-border" />
              </div>
            ))}
          </div>
        ) : isError || fact === undefined ? (
          <div className="border-t border-panel-border py-10">
            <p className="text-body text-panel-ink-700">
              {isError
                ? 'This fact trail could not be loaded right now.'
                : 'No repayment has been recorded yet — there is nothing to trace.'}
            </p>
            {isError && (
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-4 min-h-11 rounded-full border border-panel-border px-5 text-body font-medium text-panel-ink-900 transition-colors hover:border-panel-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Try again
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            <TraceRow label="Source protocol" delay={0}>
              <a
                href={etherscanAddress(fact.protocol)}
                target="_blank"
                rel="noopener noreferrer"
                className="num text-body text-panel-ink-900 hover:underline"
              >
                {fact.protocolName} · {shortenAddress(fact.protocol)}
              </a>
            </TraceRow>

            <TraceRow label="Ethereum block" delay={0.05}>
              <a
                href={etherscanBlock(fact.blockHeight)}
                target="_blank"
                rel="noopener noreferrer"
                className="num text-body text-panel-ink-900 hover:underline"
              >
                {fact.blockHeight}
              </a>
            </TraceRow>

            <TraceRow label="Amount repaid" delay={0.1}>
              <a
                href={etherscanTx(fact.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="num text-body text-panel-ink-900 hover:underline"
              >
                {formatTokenAmount(fact.amount, fact.assetDecimals)} {fact.assetSymbol}
                {fact.amountUsd !== null && ` · ${formatUsd(fact.amountUsd)}`}
              </a>
            </TraceRow>

            <TraceRow label="Subject wallet" delay={0.15}>
              <a
                href={etherscanAddress(fact.subject)}
                target="_blank"
                rel="noopener noreferrer"
                className="num text-body text-panel-ink-900 hover:underline"
              >
                {shortenAddress(fact.subject)}
              </a>
            </TraceRow>

            <TraceRow label="Recorded on Creditcoin" delay={0.2}>
              <a
                href={creditcoinTx(fact.creditcoinTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="num text-body text-panel-ink-900 hover:underline"
              >
                {shortenHex(fact.creditcoinTxHash)}
              </a>
            </TraceRow>
          </div>
        )}
      </div>
    </div>
  );
}

function TraceRow({ label, delay, children }: { label: string; delay: number; children: ReactNode }) {
  return (
    <Reveal delay={delay} distance={16}>
      <div className="flex flex-col gap-1 border-t border-panel-border py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="text-micro uppercase tracking-[0.1em] text-panel-ink-500">{label}</p>
        {children}
      </div>
    </Reveal>
  );
}
