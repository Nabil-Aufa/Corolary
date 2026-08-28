import { formatHealthFactor } from '@/lib/format';
import { cn } from '@/lib/utils';

const DANGER_BPS = 10_000; // 1.0 — di bawah ini dapat dilikuidasi
const WARNING_BPS = 12_000; // 1.2

export function HealthFactorBar({ healthFactorBps }: { healthFactorBps: number | null }) {
  // null = tidak ada utang. Rasionya memang tak terdefinisi, dan menampilkan
  // angka raksasa (kontrak mengembalikan type(uint256).max) akan konyol.
  if (healthFactorBps === null) {
    return <span className="text-small text-ink-400">No debt</span>;
  }

  const tone =
    healthFactorBps < DANGER_BPS ? 'danger' : healthFactorBps < WARNING_BPS ? 'warning' : 'verified';
  // Dipetakan ke skala 0–3.0; di atas itu bar penuh dan angkanya yang bicara.
  const pct = Math.min(100, (healthFactorBps / 30_000) * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
        <span
          className={cn(
            'block h-full rounded-full',
            tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-verified',
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span
        className={cn(
          'num text-small',
          tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink-900',
        )}
      >
        {formatHealthFactor(healthFactorBps)}
      </span>
    </div>
  );
}
