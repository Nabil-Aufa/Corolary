'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ProofChain } from '@/components/proofs/ProofChain';
import { AddressDisplay } from '@/components/shared/AddressDisplay';
import { ErrorState } from '@/components/shared/ErrorState';
import { FactKindBadge } from '@/components/shared/FactKindBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFact } from '@/hooks/useApi';
import { ApiError } from '@/lib/api/errors';
import { formatCount, formatTokenAmount, formatUsd } from '@/lib/format';
import type { Hex } from '@/types';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;

export default function FactDetailPage() {
  const params = useParams<{ factId: string }>();
  const raw = params.factId;
  const valid = HEX32.test(raw);
  const { data, isPending, isError, error, refetch } = useFact(valid ? (raw as Hex) : undefined);

  const notFound = error instanceof ApiError && error.code === 'NOT_FOUND';

  return (
    <main className="mx-auto max-w-[840px] px-6 py-12 md:px-8">
      <Link
        href="/proofs"
        className="inline-flex items-center gap-1.5 text-small text-ink-500 transition-colors hover:text-accent"
      >
        <ArrowLeft size={14} strokeWidth={1.5} /> Proofs
      </Link>

      {!valid || notFound ? (
        <div className="mt-8">
          <EmptyState
            title={valid ? 'No fact with this ID' : 'Malformed fact ID'}
            description={
              valid
                ? 'The ID is well-formed but nothing has been recorded under it. It may not be indexed yet.'
                : 'A fact ID is 0x followed by 64 hexadecimal characters.'
            }
            action={
              <Link href="/proofs">
                <Button variant="secondary">Back to proofs</Button>
              </Link>
            }
          />
        </div>
      ) : isError ? (
        <div className="mt-8">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : isPending ? (
        <div className="mt-8 space-y-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <FactKindBadge kind={data.kind} />
            <span className="text-body text-ink-500">{data.protocolName}</span>
            <Badge tone="verified">Proven</Badge>
          </div>

          <p className="num mt-4 text-h1 font-semibold tracking-tight text-ink-900">
            {formatTokenAmount(data.amount, data.assetDecimals, { maxFractionDigits: 4 })}{' '}
            <span className="text-ink-500">{data.assetSymbol}</span>
          </p>
          <p className="num mt-1 text-body text-ink-500">{formatUsd(data.amountUsd)}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-small text-ink-500">
            <span>Subject</span>
            <AddressDisplay address={data.subject} truncate={false} />
            <Link
              href={`/score/${data.subject}`}
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              See their score
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
          </div>

          <h2 className="mt-12 pb-6 text-h2 font-semibold tracking-tight text-ink-900">
            Proof chain
          </h2>
          <Card>
            <CardBody>
              <ProofChain fact={data} />
            </CardBody>
          </Card>

          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">Raw</h2>
          <Card>
            <CardBody className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {(
                [
                  ['Fact ID', data.factId],
                  ['Chain key', String(data.chainKey)],
                  ['Block height', formatCount(data.blockHeight)],
                  ['Tx index', String(data.txIndex)],
                  ['Log index (block-wide)', String(data.logIndex)],
                  ['Log index (in tx)', String(data.txLogIndex)],
                  ['Asset', data.asset],
                  ['Protocol', data.protocol],
                  ['Batch', data.proof.batchId ?? '—'],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-micro uppercase tracking-wide text-ink-400">{label}</p>
                  <p className="num break-all text-small text-ink-900">{value}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </>
      )}
    </main>
  );
}
