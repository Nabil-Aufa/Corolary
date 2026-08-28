'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Address, ScoreComponent, ScoreComponentKey } from '@/types';

const LABEL: Record<ScoreComponentKey, string> = {
  repaymentVolume: 'Repayment volume',
  repaymentCount: 'Repayment count',
  historyDuration: 'History duration',
  liquidationPenalty: 'Liquidation penalty',
  protocolDiversity: 'Protocol diversity',
  activeStanding: 'Active standing',
};

const EXPLAIN: Record<ScoreComponentKey, string> = {
  repaymentVolume: 'Total value repaid across all protocols, half-saturating at $50,000.',
  repaymentCount: 'How many separate repayments, half-saturating at 12.',
  historyDuration: 'Time since the first proven fact, half-saturating at 365 days.',
  liquidationPenalty: 'Deducted when a position was force-closed. Severity-weighted, capped at −300.',
  protocolDiversity: 'Linear, 25 points for each of the four indexed protocols.',
  activeStanding: 'Recency-weighted activity over a 365-day lookback.',
};

export function ComponentBreakdown({
  components,
  subject,
}: {
  components: ScoreComponent[];
  subject: Address;
}) {
  const [open, setOpen] = useState<ScoreComponentKey | null>(null);

  return (
    <Card>
      {components.map((c) => {
        const isPenalty = c.key === 'liquidationPenalty';
        const isOpen = open === c.key;
        // Penalti tidak punya "progres" — 0 poin adalah hasil TERBAIK, dan
        // merendernya sebagai bar 0% akan terbaca seperti kegagalan.
        const pct = isPenalty || c.maxPoints === 0 ? 0 : (c.points / c.maxPoints) * 100;

        return (
          <div key={c.key} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : c.key)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-accent-soft/30"
            >
              <ChevronDown
                size={16}
                strokeWidth={1.5}
                className={cn('shrink-0 text-ink-400 transition-transform', isOpen && 'rotate-180')}
              />

              <span className="flex-1 text-body text-ink-900">{LABEL[c.key]}</span>

              {isPenalty ? (
                <span className={cn('num text-small', c.points === 0 ? 'text-verified' : 'text-danger')}>
                  {c.points === 0 ? 'No liquidations' : c.points}
                </span>
              ) : (
                <>
                  <span className="num w-24 text-right text-small text-ink-900">
                    {c.points}
                    <span className="text-ink-400"> / {c.maxPoints}</span>
                  </span>
                  <span className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-border sm:block">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </>
              )}
            </button>

            {isOpen && (
              <div className="px-6 pb-5 pl-16">
                <p className="text-small text-ink-500">{EXPLAIN[c.key]}</p>

                {c.factCount > 0 && (
                  <p className="mt-3 text-small text-ink-500">
                    Backed by <span className="num text-ink-900">{formatCount(c.factCount)}</span>{' '}
                    proven {c.factCount === 1 ? 'fact' : 'facts'}.{' '}
                    {/* factIds dibatasi 10 oleh API. Menyebut "10 terbaru"
                        secara eksplisit mencegah UI mengaku menampilkan
                        seluruh bukti padahal tidak. */}
                    {c.factIds.length > 0 && c.factIds.length < c.factCount && (
                      <>Showing the {c.factIds.length} most recent below. </>
                    )}
                    <Link
                      href={`/proofs?subject=${subject}`}
                      className="text-accent hover:underline"
                    >
                      See all →
                    </Link>
                  </p>
                )}

                {c.factIds.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {c.factIds.map((id) => (
                      <li key={id}>
                        <Link
                          href={`/proofs/${id}`}
                          className="num text-small text-ink-500 transition-colors hover:text-accent"
                        >
                          {id.slice(0, 18)}…{id.slice(-6)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
