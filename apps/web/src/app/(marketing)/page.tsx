'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TIER_COLLATERAL_RATIO_BPS, TIER_LABEL, TIER_MIN_SCORE } from '@corolary/shared';
import { FactRow } from '@/components/proofs/FactRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatPill } from '@/components/shared/StatPill';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChains, useFacts, useIndexerStatus, useMarketSummary } from '@/hooks/useApi';
import { formatBps, formatCount, formatDuration } from '@/lib/format';
import type { Tier } from '@/types';

const STEPS = [
  'A borrower repays a loan on Ethereum mainnet: Aave, Morpho, Compound, or Spark.',
  'Attestcoin attestors reach consensus on the block containing that transaction.',
  'A proof is built inside the cheap window, under 24 hours, batched ten at a time.',
  'FactRegistry verifies it on Creditcoin and stores the fact permanently.',
  'CreditGraph derives a score, and the market prices collateral against it.',
];

const TIERS: Tier[] = [4, 3, 2, 1, 0];

export default function HomePage() {
  const indexer = useIndexerStatus();
  const chains = useChains();
  const summary = useMarketSummary();
  const facts = useFacts({ limit: 5 });

  const source = chains.data?.find((c) => c.isSourceForFacts);
  const latest = facts.data?.pages[0]?.data ?? [];

  return (
    <main className="mx-auto max-w-[1280px] px-6 md:px-8">
      <section className="py-20">
        <h1 className="max-w-3xl text-display font-semibold leading-[1.05] tracking-tight text-ink-900">
          Reputation that follows from proof.
        </h1>
        <p className="mt-5 max-w-2xl text-body text-ink-500">
          Lending history from Aave, Morpho, Compound, and Spark on Ethereum mainnet, proven
          cryptographically through Attestcoin and used to cut required collateral from 150% to
          110%.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/score">
            <Button size="lg">
              Check a score <ArrowRight size={16} strokeWidth={1.5} />
            </Button>
          </Link>
          <Link href="/proofs">
            <Button size="lg" variant="secondary">
              Explore the proofs
            </Button>
          </Link>
        </div>
      </section>

      {/* Setiap angka di bawah datang dari API. Kalau salah satu gagal diambil,
          yang muncul adalah `–`, bukan angka contoh. */}
      <section className="flex flex-wrap gap-3 border-y border-border py-6">
        <StatPill
          label="Facts recorded 24h"
          value={indexer.data ? formatCount(indexer.data.queue.recorded24h) : null}
          isLoading={indexer.isPending}
        />
        <StatPill
          label="Attestation lag"
          value={source ? formatDuration(source.lagSeconds) : null}
          isLoading={chains.isPending}
        />
        <StatPill
          label="Mainnet block scanned"
          value={indexer.data ? formatCount(indexer.data.latestEthereumBlock) : null}
          isLoading={indexer.isPending}
        />
        <StatPill
          label="Avg collateral ratio"
          value={summary.data ? formatBps(summary.data.avgCollateralRatioBps, 0) : null}
          isLoading={summary.isPending}
        />
      </section>

      <section className="py-16">
        <h2 className="text-h2 font-semibold tracking-tight text-ink-900">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-5">
          {STEPS.map((step, i) => (
            <li key={i} className="border-t border-border pt-4">
              <span className="num text-micro text-accent">0{i + 1}</span>
              <p className="mt-2 text-small text-ink-500">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="pb-16">
        <div className="flex items-baseline justify-between pb-4">
          <h2 className="text-h2 font-semibold tracking-tight text-ink-900">Latest proven facts</h2>
          <Link href="/proofs" className="text-small text-accent hover:underline">
            See all →
          </Link>
        </div>

        {facts.isPending ? (
          <Skeleton className="h-72" />
        ) : latest.length === 0 ? (
          <EmptyState
            title="No facts recorded yet"
            description="The indexer is waiting for its first fact. Attestation runs roughly every 8 minutes."
          />
        ) : (
          <Card>
            {latest.map((f) => (
              <FactRow key={f.factId} fact={f} />
            ))}
          </Card>
        )}
      </section>

      <section className="pb-24">
        <h2 className="text-h2 font-semibold tracking-tight text-ink-900">
          Tiered efficiency, not unsecured lending
        </h2>
        <p className="mt-3 max-w-2xl text-body text-ink-500">
          Every loan stays over-collateralized. A proven borrower simply locks far less capital,
          which is why the protocol stays solvent without identity or legal recourse.
        </p>

        <Card className="mt-6">
          <div className="hidden h-11 grid-cols-[6rem_1fr_8rem_8rem] items-center gap-4 border-b border-border px-5 text-micro uppercase tracking-wide text-ink-400 md:grid">
            <span>Tier</span>
            <span>Standing</span>
            <span className="text-right">Score</span>
            <span className="text-right">Collateral</span>
          </div>
          {TIERS.map((t) => (
            <div
              key={t}
              className="grid grid-cols-[6rem_1fr_8rem_8rem] items-center gap-4 border-b border-border px-5 py-3 last:border-b-0"
            >
              <span className="num text-small text-ink-500">T{t}</span>
              <span className="text-small text-ink-900">{TIER_LABEL[t]}</span>
              <span className="num text-right text-small text-ink-500">{TIER_MIN_SCORE[t]}+</span>
              <span className="num text-right text-small text-ink-900">
                {TIER_COLLATERAL_RATIO_BPS[t] / 100}%
              </span>
            </div>
          ))}
        </Card>
      </section>
    </main>
  );
}
