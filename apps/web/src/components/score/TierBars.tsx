import { MAX_SCORE, TIER_LABEL, TIER_MIN_SCORE } from '@corolary/shared';
import { cn } from '@/lib/utils';
import type { Tier } from '@/types';

const TIERS: Tier[] = [0, 1, 2, 3, 4];

/** Batas atas pita sebuah tier. Tier teratas ditutup oleh MAX_SCORE. */
function bandEnd(t: Tier): number {
  return t === 4 ? MAX_SCORE : TIER_MIN_SCORE[(t + 1) as Tier];
}

/**
 * Gradien satu blok, diambil dari POSISINYA di sepanjang tangga.
 *
 * Kelima blok harus terbaca sebagai satu gradien terang ke gelap yang
 * terpotong, bukan lima gradien sendiri-sendiri — jadi tiap blok mulai dari
 * warna tier sebelumnya dan berakhir di warna tiernya. Warnanya token
 * `--color-tier-*`, yang sama dengan segmen gauge dan membalik arah di tema
 * gelap; menulis hex di sini akan membuat keduanya berpisah diam-diam.
 */
function gradientOf(t: Tier): string {
  const from = t === 0 ? 'var(--color-tier-0)' : `var(--color-tier-${t - 1})`;
  return `linear-gradient(to right, ${from}, var(--color-tier-${t}))`;
}

/**
 * Lima tier sebagai blok mendatar yang terisi sampai skornya.
 *
 * Blok tier yang sedang ditempati hanya terisi sebesar kemajuan di DALAM
 * pitanya, jadi 815 dari pita 800..1000 terbaca baru sedikit terisi — sama
 * seperti segmen gauge di sebelahnya.
 */
export function TierBars({
  score,
  tier,
  className,
}: {
  score: number;
  tier: Tier;
  className?: string;
}) {
  const clamped = Math.min(Math.max(score, 0), MAX_SCORE);

  return (
    <ol className={cn('grid grid-cols-5 gap-1.5 sm:gap-2', className)}>
      {TIERS.map((t) => {
        const current = t === tier;
        const reached = t < tier;
        const start = TIER_MIN_SCORE[t];
        const fraction = reached
          ? 1
          : current
            ? Math.min(1, Math.max(0, (clamped - start) / (bandEnd(t) - start)))
            : 0;

        return (
          <li key={t} className="min-w-0 text-center" aria-current={current ? 'step' : undefined}>
            <div className="relative h-12 overflow-hidden rounded-[var(--radius-base)] bg-border sm:h-[72px]">
              {fraction > 0 && (
                // `clip-path`, bukan lebar yang dipersempit. Gradiennya harus
                // tetap membentang selebar blok; mempersempit elemennya akan
                // memampatkan gradien ke dalam irisan yang terisi saja.
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background: gradientOf(t),
                    clipPath: `inset(0 ${(1 - fraction) * 100}% 0 0)`,
                  }}
                />
              )}
            </div>

            <p
              className={cn(
                'mt-2 truncate text-[10px] tracking-tight sm:text-body sm:tracking-normal lg:text-h3',
                current ? 'font-semibold text-ink-900' : reached ? 'text-ink-900' : 'text-ink-400',
              )}
            >
              {TIER_LABEL[t]}
            </p>
            {/* Tier yang ditempati menampilkan skor sebenarnya, sisanya
                ambangnya. Tier yang belum dicapai TIDAK ditulis "0" — itu
                terbaca seolah dompetnya punya skor nol di tier tersebut. */}
            <p className={cn('num text-micro', current ? 'text-ink-900' : 'text-ink-400')}>
              {current ? score : `${start}+`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
