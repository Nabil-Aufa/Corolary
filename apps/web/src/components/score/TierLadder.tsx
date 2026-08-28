import { TIER_COLLATERAL_RATIO_BPS, TIER_LABEL, TIER_MIN_SCORE } from '@corolary/shared';
import { formatRatio } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Tier } from '@/types';

const TIERS: Tier[] = [0, 1, 2, 3, 4];

/** Lima segmen mendatar: di mana kamu sekarang, dan apa yang tiap tingkat beri. */
export function TierLadder({ tier }: { tier: Tier }) {
  return (
    <ol className="flex gap-1">
      {TIERS.map((t) => {
        const active = t === tier;
        return (
          <li key={t} className="flex-1">
            <div
              className={cn(
                'h-1 rounded-full',
                t <= tier ? 'bg-accent' : 'bg-border',
              )}
            />
            <div className="mt-2">
              <p
                className={cn(
                  'text-micro uppercase tracking-wide',
                  active ? 'text-accent' : 'text-ink-400',
                )}
              >
                {TIER_LABEL[t]}
              </p>
              <p className={cn('num text-micro', active ? 'text-ink-900' : 'text-ink-400')}>
                {formatRatio(TIER_COLLATERAL_RATIO_BPS[t])}
                <span className="text-ink-400"> · {TIER_MIN_SCORE[t]}+</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
