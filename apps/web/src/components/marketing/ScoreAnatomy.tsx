'use client';

import { Check } from 'lucide-react';
import { LIQUIDATION_PENALTY_MIN } from '@corolary/shared';
import { useScore } from '@/hooks/useApi';
import type { Address, ScoreComponent } from '@/types';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Reveal } from './Reveal';
import { SectionIntro } from './SectionIntro';

interface ScoreAnatomyProps {
  address: Address;
}

/**
 * Satu komponen positif (repaymentVolume, repaymentCount, historyDuration,
 * protocolDiversity, activeStanding): angka + bilah kemajuan biasa.
 *
 * `historyDuration` boleh punya `factCount === 0` dan `factIds` kosong — ia
 * turunan dari `firstFactAt`/`lastFactAt`, bukan ditopang fakta individual,
 * jadi baris "didukung N fakta" disembunyikan alih-alih menampilkan "0".
 */
function PositiveComponentRow({ component }: { component: ScoreComponent }) {
  const pct = component.maxPoints > 0 ? (component.points / component.maxPoints) * 100 : 0;
  const showFactCount = component.factCount > 0;

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
        aria-label={`${component.label}: ${component.points} dari ${component.maxPoints} poin`}
        className="h-1.5 rounded-full bg-border"
      >
        <div
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          className="h-full rounded-full bg-accent"
        />
      </div>
      {showFactCount && (
        <p className="text-small text-ink-500">
          didukung {component.factCount} fakta
          {/* factIds maksimum 10 dan BUKAN factCount — jangan pernah disamakan. */}
          {component.factIds.length > 0 && component.factIds.length < component.factCount && (
            <> (menampilkan {component.factIds.length} terbaru)</>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * `liquidationPenalty` BUKAN bilah kemajuan.
 *
 * Komponen ini bergerak KE BAWAH: rentangnya LIQUIDATION_PENALTY_MIN (-300)
 * sampai 0, dan `maxPoints`-nya SELALU 0 — nol adalah nilai TERBAIK yang
 * mungkin, bukan nilai kosong. Kalau dirender sebagai bilah seperti lima
 * komponen lain, dompet bersih (points = 0) akan tampil "0 dari 300", yang
 * terbaca sebagai KEHILANGAN 300 poin — kebalikan penuh dari artinya. Ini
 * pernah benar-benar terjadi di proyek ini (lihat CLAUDE.md), jadi JANGAN
 * "perbaiki" baris ini kembali menjadi bilah kemajuan.
 */
function LiquidationPenaltyRow({ component }: { component: ScoreComponent }) {
  const clean = component.points === 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-body text-ink-700">{component.label}</p>
      {clean ? (
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0 text-verified" aria-hidden="true" />
          <p className="text-body text-verified">Tidak pernah kena likuidasi.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="num text-body font-medium text-danger">
            {component.points} poin
          </p>
          <p className="text-small text-ink-500">
            Penalti likuidasi mengurangi skor, dengan batas bawah {LIQUIDATION_PENALTY_MIN}{' '}
            poin di riwayat terburuk.
          </p>
        </div>
      )}
    </div>
  );
}

function ComponentRow({ component }: { component: ScoreComponent }) {
  // maxPoints === 0 (setara key === 'liquidationPenalty') adalah satu-satunya
  // komponen yang bukan bilah kemajuan — lihat komentar di LiquidationPenaltyRow.
  if (component.maxPoints === 0) {
    return <LiquidationPenaltyRow component={component} />;
  }
  return <PositiveComponentRow component={component} />;
}

/** Anatomi skor: enam komponen dari dompet nyata, bukan kotak hitam. */
export function ScoreAnatomy({ address }: ScoreAnatomyProps) {
  const { data, isPending, isError, refetch } = useScore(address);

  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-24 md:px-8 md:pb-32">
      <SectionIntro label="ANATOMI SKOR">
        Skor bukan kotak hitam — setiap komponennya bisa ditelusuri sampai ke fakta
        on-chain yang membuktikannya.
      </SectionIntro>

      <div className="mt-10 rounded-[var(--radius-card)] bg-surface p-6 md:p-8">
        {isPending ? (
          <div className="flex flex-col gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError || data === undefined ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-body text-ink-500">
              Komponen skor untuk dompet ini sedang tidak bisa diambil.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className={cn(
                'rounded-[var(--radius-sm)] border border-border-strong px-4 py-2 text-small font-medium text-ink-900',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-10 md:gap-y-8">
            {data.components.map((component, i) => (
              <Reveal key={component.key} delay={i * 0.04}>
                <ComponentRow component={component} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
