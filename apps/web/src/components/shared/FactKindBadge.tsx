import { Badge } from '@/components/ui/badge';
import { FactKind } from '@/types';

const LABEL: Record<FactKind, string> = {
  [FactKind.LoanOriginated]: 'Borrowed',
  [FactKind.LoanRepaid]: 'Repaid',
  [FactKind.Liquidated]: 'Liquidated',
  [FactKind.CollateralSupplied]: 'Supplied',
  [FactKind.CollateralWithdrawn]: 'Withdrawn',
};

// Likuidasi satu-satunya yang merah: ia satu-satunya yang mengurangi skor.
const TONE: Record<FactKind, 'neutral' | 'accent' | 'danger'> = {
  [FactKind.LoanOriginated]: 'accent',
  [FactKind.LoanRepaid]: 'accent',
  [FactKind.Liquidated]: 'danger',
  [FactKind.CollateralSupplied]: 'neutral',
  [FactKind.CollateralWithdrawn]: 'neutral',
};

export function factKindLabel(kind: FactKind): string {
  return LABEL[kind] ?? 'Unknown';
}

export function FactKindBadge({ kind }: { kind: FactKind }) {
  return <Badge tone={TONE[kind] ?? 'neutral'}>{factKindLabel(kind)}</Badge>;
}
