'use client';

import { Reveal } from '@/components/marketing/Reveal';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useIndexerStatus } from '@/hooks/useApi';
import { formatCount, formatDuration } from '@/lib/format';
import type { IndexerStatus } from '@/types';

interface Metric {
  label: string;
  value: string;
}

/** Tepat enam angka nyata dari `/v1/indexer/status` — tidak lebih, tidak kurang. */
function metricsOf(data: IndexerStatus): Metric[] {
  return [
    { label: 'Proven facts recorded', value: formatCount(data.totalFacts) },
    { label: 'Wallets with a proven history', value: formatCount(data.distinctSubjects) },
    { label: 'Facts recorded in 24 hours', value: formatCount(data.queue.recorded24h) },
    { label: 'Latest mainnet block scanned', value: formatCount(data.latestEthereumBlock) },
    { label: 'Blocks behind attestation', value: formatCount(data.lagBlocks) },
    { label: 'Oldest unproven event', value: formatDuration(data.oldestUnprovenAgeSeconds) },
  ];
}

/**
 * Panel gelap "The registry, right now" — enam angka hidup dari indexer.
 *
 * Semua enam datang dari satu panggilan `useIndexerStatus()`, jadi loading
 * dan error ditangani sekali untuk seluruh grid alih-alih per sel.
 */
export function Insights() {
  const { data, isPending, isError, error, refetch } = useIndexerStatus();

  return (
    <div className="mkt-container py-[clamp(80px,10vw,160px)]">
      <h2 className="font-display font-medium text-mkt-h2 text-panel-ink-900">
        The registry, right now
      </h2>

      {isError ? (
        <div className="mt-10">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : (
        <div className="mt-10 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
          {isPending || data === undefined
            ? Array.from({ length: 6 }, (_, i) => (
                <Reveal key={i} delay={i * 0.05} className="flex flex-col gap-2 py-6">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-4 w-40" />
                </Reveal>
              ))
            : metricsOf(data).map((m, i) => (
                <Reveal key={m.label} delay={i * 0.05} className="flex flex-col gap-2 py-6">
                  <span className="num font-display text-mkt-h3 text-panel-ink-900">{m.value}</span>
                  <span className="text-small text-panel-ink-500">{m.label}</span>
                </Reveal>
              ))}
        </div>
      )}
    </div>
  );
}
