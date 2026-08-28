'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { TIER_LABEL } from '@corolary/shared';
import { HealthFactorBar } from '@/components/market/HealthFactorBar';
import { PositionTable } from '@/components/market/PositionTable';
import { FactRow } from '@/components/proofs/FactRow';
import { ScoreDial } from '@/components/score/ScoreDial';
import { TierLadder } from '@/components/score/TierLadder';
import { AddressDisplay } from '@/components/shared/AddressDisplay';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFacts, usePositions, useScore } from '@/hooks/useApi';
import { formatCount } from '@/lib/format';

export default function PortfolioPage() {
  const { address } = useAccount();
  const score = useScore(address);
  const positions = usePositions(address);
  const facts = useFacts(address === undefined ? {} : { subject: address, limit: 10 });

  // Halaman ini sengaja TIDAK menerima alamat lewat URL. /score/[address]
  // adalah explorer publik; ini "punyaku", dan pembedaan itu yang membuat
  // keduanya tidak saling menduplikasi.
  if (address === undefined) {
    return (
      <main className="mx-auto max-w-[1280px] px-6 py-24 md:px-8">
        <EmptyState
          title="Connect your wallet"
          description="Your portfolio shows the score, positions, and proven history tied to the wallet you connect."
          action={
            <Link href="/score">
              <Button variant="secondary">Or look up any address</Button>
            </Link>
          }
        />
      </main>
    );
  }

  const recent = facts.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-12 md:px-8">
      <PageHeader title="Portfolio" aside={<AddressDisplay address={address} />} />

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card>
          <CardBody className="flex flex-col items-center gap-4">
            {score.isPending ? (
              <Skeleton className="h-[132px] w-[132px] rounded-full" />
            ) : score.data ? (
              <>
                <ScoreDial score={score.data.score} tier={score.data.tier} size="sm" />
                <Badge tone="accent">
                  Tier {score.data.tier} · {TIER_LABEL[score.data.tier]}
                </Badge>
                <Link href={`/score/${address}`} className="text-small text-accent hover:underline">
                  See full breakdown →
                </Link>
              </>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex h-full flex-col">
            <p className="text-micro uppercase tracking-wide text-ink-400">Where you stand</p>
            {score.isError ? (
              <ErrorState error={score.error} onRetry={() => void score.refetch()} />
            ) : score.data ? (
              <>
                <p className="mt-2 text-body text-ink-500">
                  <span className="num text-ink-900">{formatCount(score.data.factCount)}</span>{' '}
                  proven facts back this score.
                </p>
                <div className="mt-auto pt-8">
                  <TierLadder tier={score.data.tier} />
                </div>
              </>
            ) : (
              <Skeleton className="mt-4 h-24" />
            )}
          </CardBody>
        </Card>
      </div>

      <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">Positions</h2>
      {positions.data && positions.data.positions.length > 0 ? (
        <>
          <div className="pb-4">
            <HealthFactorBar healthFactorBps={positions.data.healthFactorBps} />
          </div>
          <PositionTable positions={positions.data.positions} />
        </>
      ) : (
        <EmptyState
          title="No active position"
          description="You have not supplied or borrowed in the Corolary market yet."
          action={
            <Link href="/market">
              <Button variant="secondary">Open the market</Button>
            </Link>
          }
        />
      )}

      <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">Recent activity</h2>
      {facts.isError ? (
        <ErrorState error={facts.error} onRetry={() => void facts.refetch()} />
      ) : recent.length > 0 ? (
        <Card>
          {recent.map((f) => (
            <FactRow key={f.factId} fact={f} />
          ))}
        </Card>
      ) : facts.isPending ? (
        <Skeleton className="h-40" />
      ) : (
        <EmptyState
          title="No proven history for this wallet"
          description="Corolary only scores Ethereum mainnet lending activity that has been proven through Attestcoin."
        />
      )}
    </main>
  );
}
