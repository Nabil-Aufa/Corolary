import { MAX_SCORE, TIER_MIN_SCORE } from '@corolary/shared';
import { cn } from '@/lib/utils';
import type { Tier } from '@/types';

const TIERS: Tier[] = [0, 1, 2, 3, 4];

/** Busur 270°, dibuka di bawah. 90° = jam 6 di koordinat SVG (y ke bawah). */
const SWEEP = 270;
const START = 135;
/** Celah antar segmen. Cukup untuk membaca lima, tidak cukup untuk terbaca putus-putus. */
const GAP = 5;
const SEGMENT = (SWEEP - GAP * (TIERS.length - 1)) / TIERS.length;

function polar(cx: number, cy: number, r: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
}

/**
 * Potongan cincin dengan keempat sudutnya dibulatkan sebesar `rc`.
 *
 * `strokeLinecap="round"` tidak bisa dipakai di sini: radius capnya SELALU
 * setengah tebal garis, jadi ujung segmen selalu jadi pill penuh dan tidak
 * ada cara memperkecilnya. Menggambar sektornya sebagai path membuat radius
 * sudut lepas dari tebal pita — itulah yang membedakan "membulat" dari
 * "berbentuk kapsul".
 */
function roundedSector(
  cx: number,
  cy: number,
  ri: number,
  ro: number,
  a0: number,
  a1: number,
  rc: number,
): string {
  const deg = 180 / Math.PI;
  const co = (rc / ro) * deg;
  const ci = (rc / ri) * deg;

  const p1 = polar(cx, cy, ro, a0 + co);
  const p2 = polar(cx, cy, ro, a1 - co);
  const p3 = polar(cx, cy, ro - rc, a1);
  const p4 = polar(cx, cy, ri + rc, a1);
  const p5 = polar(cx, cy, ri, a1 - ci);
  const p6 = polar(cx, cy, ri, a0 + ci);
  const p7 = polar(cx, cy, ri + rc, a0);
  const p8 = polar(cx, cy, ro - rc, a0);

  return [
    `M ${p1}`,
    `A ${ro} ${ro} 0 0 1 ${p2}`,
    `A ${rc} ${rc} 0 0 1 ${p3}`,
    `L ${p4}`,
    `A ${rc} ${rc} 0 0 1 ${p5}`,
    `A ${ri} ${ri} 0 0 0 ${p6}`,
    `A ${rc} ${rc} 0 0 1 ${p7}`,
    `L ${p8}`,
    `A ${rc} ${rc} 0 0 1 ${p1}`,
    'Z',
  ].join(' ');
}

/** Sektor bersudut tajam, dipakai sebagai clip — bukan untuk digambar. */
function wedge(cx: number, cy: number, ri: number, ro: number, a0: number, a1: number): string {
  return [
    `M ${polar(cx, cy, ro, a0)}`,
    `A ${ro} ${ro} 0 0 1 ${polar(cx, cy, ro, a1)}`,
    `L ${polar(cx, cy, ri, a1)}`,
    `A ${ri} ${ri} 0 0 0 ${polar(cx, cy, ri, a0)}`,
    'Z',
  ].join(' ');
}

/** Batas atas pita sebuah tier. Tier teratas ditutup oleh MAX_SCORE. */
function bandEnd(t: Tier): number {
  return t === 4 ? MAX_SCORE : TIER_MIN_SCORE[(t + 1) as Tier];
}

/**
 * Gauge lima segmen — satu per tier, bukan satu busur menerus.
 *
 * Busur menerus menyembunyikan hal yang paling menentukan di produk ini:
 * skor tidak dibayar per poin, ia dibayar per TIER. 799 dan 800 berjarak satu
 * poin dan berbeda satu tingkat rasio kolateral penuh, dan garis mulus tidak
 * punya cara menunjukkan itu. Segmen punya.
 *
 * Segmen milik tier yang sedang ditempati diisi hanya sebesar kemajuan di
 * DALAM pita itu, jadi 225 dari pita 200..399 terbaca seperempat penuh.
 */
export function TierGauge({
  score,
  tier,
  size = 232,
  className,
}: {
  score: number;
  tier: Tier;
  size?: number;
  className?: string;
}) {
  const c = size / 2;
  const ro = c - 4;
  const ri = ro - 15;
  const clamped = Math.min(Math.max(score, 0), MAX_SCORE);

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Credit score ${score} out of ${MAX_SCORE}, tier ${tier}`}
    >
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          {TIERS.map((t) => {
            const a0 = START + t * (SEGMENT + GAP);
            const start = TIER_MIN_SCORE[t];
            const fraction = Math.min(1, Math.max(0, (clamped - start) / (bandEnd(t) - start)));
            return (
              <clipPath key={t} id={`tier-fill-${t}`}>
                {/* Sedikit melebar ke luar pita supaya tepi kliping tidak
                    memakan garis tepi segmen yang dibulatkan. */}
                <path d={wedge(c, c, ri - 2, ro + 2, a0, a0 + SEGMENT * fraction)} />
              </clipPath>
            );
          })}
        </defs>

        {TIERS.map((t) => {
          const a0 = START + t * (SEGMENT + GAP);
          const d = roundedSector(c, c, ri, ro, a0, a0 + SEGMENT, 4);
          const start = TIER_MIN_SCORE[t];
          const fraction = Math.min(1, Math.max(0, (clamped - start) / (bandEnd(t) - start)));

          return (
            <g key={t}>
              {/* Trek abu yang sama dengan bilah komponen di "How this score
                  is built" — segmen yang belum dicapai bukan warna tier yang
                  dipudarkan, ia memang belum punya warna. */}
              <path d={d} fill="var(--color-border)" />
              {fraction > 0 && (
                <path d={d} fill={`var(--color-tier-${t})`} clipPath={`url(#tier-fill-${t})`} />
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-display font-semibold leading-none text-ink-900">{score}</span>
        <span className="num mt-1.5 text-micro text-ink-400">/ {MAX_SCORE}</span>
      </div>
    </div>
  );
}
