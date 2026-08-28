import { Card } from '@/components/ui/card';
import { formatTokenAmount } from '@/lib/format';
import type { PositionEntry } from '@/types';

const COLS = 'grid-cols-[1fr_8rem_8rem_7rem]';

export function PositionTable({ positions }: { positions: PositionEntry[] }) {
  return (
    <Card>
      <div
        className={`hidden h-11 ${COLS} items-center gap-4 border-b border-border px-5 text-micro uppercase tracking-wide text-ink-400 md:grid`}
      >
        <span>Asset</span>
        <span className="text-right">Supplied</span>
        <span className="text-right">Borrowed</span>
        <span className="text-right">Collateral</span>
      </div>

      {positions.map((p) => (
        <div
          key={p.asset}
          className={`grid ${COLS} items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 md:h-[68px] md:py-0`}
        >
          <span className="text-body font-medium text-ink-900">{p.symbol}</span>
          <span className="num text-right text-small text-ink-900">
            {formatTokenAmount(p.supplied, p.decimals)}
          </span>
          <span className="num text-right text-small text-ink-900">
            {formatTokenAmount(p.borrowed, p.decimals)}
          </span>
          <span className="text-right text-small text-ink-500">
            {p.collateralEnabled ? 'Enabled' : '—'}
          </span>
        </div>
      ))}
    </Card>
  );
}
