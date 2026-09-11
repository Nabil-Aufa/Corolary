import type { ReactNode } from 'react';
import { BASELINE_COLLATERAL_RATIO_BPS, TIER_LABEL } from '@corolary/shared';
import { TierBars } from '@/components/score/TierBars';
import { TierGauge } from '@/components/score/TierGauge';
import { Card } from '@/components/ui/card';
import { formatCount, formatRatio, formatRelativeTime } from '@/lib/format';
import type { CreditScore } from '@/types';

/**
 * Kepala halaman skor: gauge di kiri, rasio kolateral di kanan.
 *
 * Satu kartu, dua kolom, dipisah hairline yang sama dengan pemisah baris
 * tabel. Dua kartu terpisah menyajikan skor dan rasio kolateral sebagai dua
 * statistik sejajar — padahal yang satu SEBAB dan yang satu AKIBAT, dan
 * hubungan itu inti produknya.
 *
 * Dipakai bersama oleh `/score/[address]` dan `/portfolio`. Keduanya menjawab
 * pertanyaan yang persis sama — "skorku berapa, dan apa untungnya" — jadi dua
 * salinan markup yang bisa menyimpang berarti explorer publik dan halaman
 * milik sendiri perlahan menjelaskan produk yang sama dengan dua cara.
 */
export function ScoreHero({ score, footer }: { score: CreditScore; footer?: ReactNode }) {
  return (
    <Card>
      <div className="grid items-center lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col items-center gap-5 p-6 lg:p-8">
          <TierGauge score={score.score} tier={score.tier} />

          {/* Tanpa badge. Dua baris di dalam pill memaksa pill itu tumbuh jadi
              kotak, dan yang tersisa cuma border yang mengurung teks tanpa
              menambah arti — sementara badge di produk ini selalu satu baris
              micro huruf kapital. */}
          <div className="text-center">
            <p className="text-h3 font-semibold tracking-tight text-ink-900">Tier {score.tier}</p>
            <p className="mt-0.5 text-body text-ink-500">{TIER_LABEL[score.tier]}</p>
          </div>

          <p className="text-micro text-ink-400">
            <span className="num">{formatCount(score.factCount)}</span> proven{' '}
            {score.factCount === 1 ? 'fact' : 'facts'}
            {score.firstFactAt !== null && <>, since {formatRelativeTime(score.firstFactAt)}</>}
          </p>

          {footer}
        </div>

        <div className="border-t border-border p-6 lg:border-l lg:border-t-0 lg:p-8">
          <p className="text-small text-ink-400">Required collateral</p>
          <p className="num mt-1 text-[4.5rem] font-semibold leading-none tracking-tight text-ink-900 sm:text-[6rem] lg:text-[8.125rem]">
            {formatRatio(score.collateralRatioBps)}
          </p>
          {/* Satu baris, bukan paragraf. Rasio di atasnya sudah menjawab
              "berapa"; kalimat ini cukup menjawab "dibanding apa", dan versi
              tiga barisnya mendorong tangga tier jauh dari angka yang ia
              jelaskan. */}
          <p className="mt-4 text-body text-ink-500 lg:text-h3">
            {score.collateralRatioBps >= BASELINE_COLLATERAL_RATIO_BPS ? (
              <>The same collateral as a wallet with no proven history.</>
            ) : (
              <>
                <span className="num">
                  {(BASELINE_COLLATERAL_RATIO_BPS - score.collateralRatioBps) / 100}
                </span>{' '}
                percentage points less capital locked than the{' '}
                <span className="num">{formatRatio(BASELINE_COLLATERAL_RATIO_BPS)}</span> baseline.
              </>
            )}
          </p>
          <TierBars score={score.score} tier={score.tier} className="mt-6" />
        </div>
      </div>
    </Card>
  );
}
