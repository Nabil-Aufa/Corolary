'use client';

import { TIER_LABEL } from '@corolary/shared';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useScore } from '@/hooks/useApi';
import type { Address, ScoreComponent } from '@/types';
import { Reveal } from '@/components/marketing/Reveal';

interface ScoreShowcaseProps {
  address: Address;
}

/**
 * Anatomi skor SATU dompet nyata — pengganti testimoni. Produk ini tidak
 * mengumpulkan kutipan pelanggan; yang setara adalah skor yang bisa diperiksa
 * siapa pun lewat `componentsOf(address)` on-chain.
 */
export function ScoreShowcase({ address }: ScoreShowcaseProps) {
  const { data, isPending, isError, error, refetch } = useScore(address);

  return (
    <section className="py-[clamp(80px,10vw,160px)]">
      <div className="mkt-container">
        <Reveal>
          <h2 className="font-display font-medium text-mkt-h2 text-ink-900">Anatomy of a score</h2>
        </Reveal>

        <div className="mt-14">
          {isPending ? (
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
              <Skeleton className="h-40 w-64" />
              <div className="flex flex-col gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </div>
          ) : isError || data === undefined ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : data.factCount === 0 ? (
            <p className="max-w-[44ch] text-body text-ink-700">
              This wallet has no proven history yet — there is no score to show until it has at
              least one fact recorded on-chain.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
              <Reveal>
                <div>
                  <p className="num font-display text-mkt-display text-ink-900">{data.score}</p>
                  <p className="mt-1 text-body text-ink-500">/ 1000</p>
                  <p className="mt-6 text-mkt-h3 font-display font-medium text-ink-900">
                    {TIER_LABEL[data.tier]}
                  </p>
                </div>
              </Reveal>

              <div className="flex flex-col gap-6">
                {data.components.map((component, i) => (
                  <Reveal key={component.key} delay={i * 0.04}>
                    <ComponentRow component={component} />
                  </Reveal>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * `liquidationPenalty` bergerak KE BAWAH: rentangnya -300..0 dan `maxPoints`
 * SELALU 0, jadi nol adalah hasil TERBAIK. Merendernya sebagai bilah kemajuan
 * membuat dompet bersih tampil "0 dari 300" — kebalikan penuh dari artinya
 * (lihat CLAUDE.md). Ditangani terpisah dan tanpa bilah.
 */
function ComponentRow({ component }: { component: ScoreComponent }) {
  if (component.maxPoints === 0) {
    const clean = component.points === 0;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-body text-ink-700">{component.label}</p>
        {clean ? (
          <p className="text-body text-verified">No liquidations</p>
        ) : (
          <p className="num text-body font-medium text-danger">{component.points} points</p>
        )}
      </div>
    );
  }

  const pct = (component.points / component.maxPoints) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-body text-ink-700">{component.label}</p>
        <p className="num shrink-0 text-body font-medium text-ink-900">
          {component.points} / {component.maxPoints}
        </p>
      </div>
      <div
        role="img"
        aria-label={`${component.label}: ${component.points} of ${component.maxPoints} points`}
        className="h-1.5 rounded-full bg-border"
      >
        <div
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          className="h-full rounded-full bg-accent"
        />
      </div>
    </div>
  );
}
