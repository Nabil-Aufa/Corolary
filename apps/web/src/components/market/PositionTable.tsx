import { Card } from '@/components/ui/card';
import { formatTokenAmount } from '@/lib/format';
import type { Address, PositionEntry } from '@/types';
import type { ActionGroup } from './MarketActionDialog';
import { ActionMenu } from './ActionMenu';

const COLS = 'grid-cols-[1fr_7rem_7rem_7rem_4rem]';

export function PositionTable({
  positions,
  onAct,
}: {
  positions: PositionEntry[];
  onAct?: (asset: Address, group: ActionGroup) => void;
}) {
  return (
    <Card>
      <div
        className={`hidden h-11 ${COLS} items-center gap-4 border-b border-border px-5 text-micro uppercase tracking-wide text-ink-400 md:grid`}
      >
        <span>Asset</span>
        <span className="text-right">Supplied</span>
        <span className="text-right">Borrowed</span>
        <span className="text-right">Collateral</span>
        <span className="text-right">{onAct === undefined ? '' : 'Actions'}</span>
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
          <span className="num text-right text-small text-ink-900">
            {formatTokenAmount(p.collateral, p.decimals)}
          </span>

          {/* Hanya ember yang benar-benar berisi yang dapat tombol. Tombol
              "Repay" pada baris tanpa utang adalah kontrol yang tidak bisa
              berbuat apa-apa — persis yang dilarang aturan nol-mock. */}
          {onAct !== undefined && (
            <span className="flex justify-end">
              <ActionMenu
                groups={groupsFor(p)}
                onSelect={(group) => onAct(p.asset, group)}
              />
            </span>
          )}
        </div>
      ))}
    </Card>
  );
}

/**
 * Hanya ember yang benar-benar berisi yang muncul di menu.
 *
 * "Repay" pada baris tanpa utang adalah kontrol yang tidak bisa berbuat
 * apa-apa — persis yang dilarang aturan nol-mock. Baris ini hanya ada karena
 * salah satu dari ketiganya tidak nol, jadi menunya tidak akan pernah kosong.
 */
function groupsFor(p: PositionEntry): ActionGroup[] {
  const groups: ActionGroup[] = [];
  if (p.supplied !== '0') groups.push('lend');
  if (p.collateral !== '0') groups.push('collateral');
  if (p.borrowed !== '0') groups.push('debt');
  return groups;
}
