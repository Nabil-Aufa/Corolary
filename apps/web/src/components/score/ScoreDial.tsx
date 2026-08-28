import { TIER_MIN_SCORE, MAX_SCORE } from '@corolary/shared';
import type { Tier } from '@/types';
import { cn } from '@/lib/utils';

const SIZES = { sm: 132, md: 200, lg: 248 } as const;

/**
 * Angka besar sebagai bintang utama, dikelilingi busur setipis mungkin.
 *
 * Busurnya sengaja 2px dan tidak mengisi ruang: pada ketebalan itu ia terbaca
 * sebagai SKALA ALAT UKUR, bukan sebagai gauge spidometer. Bobot visual tetap
 * ada di angkanya, yang memang satu-satunya hal yang perlu dibaca.
 */
export function ScoreDial({
  score,
  tier,
  size = 'md',
  className,
}: {
  score: number;
  tier: Tier;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];
  const r = px / 2 - 10;
  const c = px / 2;
  // Busur 270°, dibuka di bawah — celahnya memberi tempat bernapas untuk tier.
  const sweep = 270;
  const circumference = 2 * Math.PI * r;
  const arcLength = (circumference * sweep) / 360;
  const progress = Math.min(Math.max(score, 0), MAX_SCORE) / MAX_SCORE;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: px, height: px }}
      role="img"
      aria-label={`Credit score ${score} out of ${MAX_SCORE}, tier ${tier}`}
    >
      <svg width={px} height={px} className="-rotate-[225deg]" aria-hidden="true">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={2}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeDasharray={`${arcLength * progress} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Batas tier sebagai guratan kecil — ini yang membuatnya terbaca
            sebagai instrumen berskala, bukan bar progres yang dilengkungkan. */}
        {([1, 2, 3, 4] as const).map((t) => {
          const frac = TIER_MIN_SCORE[t] / MAX_SCORE;
          const angle = (sweep * frac * Math.PI) / 180;
          return (
            <circle
              key={t}
              cx={c + r * Math.cos(angle)}
              cy={c + r * Math.sin(angle)}
              r={1.75}
              fill="var(--color-border-strong)"
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            'num font-semibold leading-none text-ink-900',
            size === 'lg' ? 'text-display' : size === 'md' ? 'text-h1' : 'text-h2',
          )}
        >
          {score}
        </span>
        <span className="num mt-1 text-micro text-ink-400">/ {MAX_SCORE}</span>
      </div>
    </div>
  );
}
