'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TIER_LABEL, TIER_MIN_SCORE } from '@corolary/shared';
import { Card, CardBody } from '@/components/ui/card';
import { Segments } from '@/components/ui/segments';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { useScoreHistory } from '@/hooks/useApi';
import type { Address, ScoreHistoryPoint, ScoreRange } from '@/types';

const RANGES = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
  { value: 'all', label: 'All' },
] as const satisfies readonly { value: ScoreRange; label: string }[];

/** Batas tier, digambar sebagai garis acuan. 0 dilewati — itu dasar sumbu. */
const TIER_LINES = [1, 2, 3, 4] as const;

export function ScoreHistoryChart({ address }: { address: Address }) {
  const [range, setRange] = useState<ScoreRange>('all');
  const history = useScoreHistory(address, range);
  const points = history.data ?? [];

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-micro uppercase tracking-wide text-ink-400">Score over time</p>
            {/* Sumbu X adalah kapan skor DICATAT di Creditcoin, bukan kapan
                dompetnya beraktivitas di mainnet. Lompatan di sini terjadi saat
                fakta baru terbukti dan skor dihitung ulang — bukan saat pemilik
                dompet melakukan sesuatu. Menyamakan keduanya adalah kekeliruan
                yang sudah berulang di proyek ini, dan grafik adalah tempat
                paling mudah untuk mengulanginya tanpa sadar. */}
            <p className="mt-1 max-w-md text-small text-ink-500">
              Each step is a recomputation on Creditcoin after new facts were proven, not a change
              in what the wallet did that day.
            </p>
          </div>
          <Segments value={range} onChange={setRange} options={RANGES} />
        </div>

        <div className="mt-5">
          {history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : history.isPending ? (
            <Skeleton className="h-[260px]" />
          ) : points.length < 2 ? (
            <Sparse points={points} />
          ) : (
            <Plot points={points} />
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Satu titik bukan garis, dan menggambarnya sebagai garis mendatar akan
 * menyiratkan riwayat yang tidak kita punya.
 */
function Sparse({ points }: { points: ScoreHistoryPoint[] }) {
  const only = points[0];
  return (
    <p className="text-body text-ink-500">
      {only === undefined ? (
        <>No score has been recorded for this address in this window yet.</>
      ) : (
        <>
          Only one recorded point so far: <span className="num text-ink-900">{only.score}</span> on{' '}
          {formatDay(only.atTime)}. A line needs a second recomputation to mean anything.
        </>
      )}
    </p>
  );
}

function Plot({ points }: { points: ScoreHistoryPoint[] }) {
  const first = points[0] as ScoreHistoryPoint;
  const last = points[points.length - 1] as ScoreHistoryPoint;
  const peak = points.reduce((a, b) => (b.score > a.score ? b : a), first);

  return (
    <figure className="m-0">
      {/* Nilai tidak boleh hanya bisa dibaca lewat tooltip. Ringkasan ini
          membawa angka yang benar-benar penting — awal, akhir, puncak — ke
          dalam teks biasa, terbaca pembaca layar maupun mata yang tidak
          menyentuh grafiknya sama sekali. */}
      <figcaption className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-small text-ink-500">
        <span>
          First recorded <span className="num text-ink-900">{first.score}</span> ·{' '}
          {formatDay(first.atTime)}
        </span>
        <span>
          Now <span className="num text-ink-900">{last.score}</span> · tier {last.tier}{' '}
          {TIER_LABEL[last.tier]}
        </span>
        {peak.score > last.score && (
          <span>
            Peak <span className="num text-ink-900">{peak.score}</span> · {formatDay(peak.atTime)}
          </span>
        )}
      </figcaption>

      <div
        className="h-[260px]"
        role="img"
        aria-label={`Credit score over time, from ${first.score} on ${formatDay(
          first.atTime,
        )} to ${last.score} on ${formatDay(last.atTime)}, across ${points.length} recorded points.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 44, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Hairline, solid, horizontal saja. Garis putus-putus di sini akan
                terbaca sebagai ambang, dan ambang yang sebenarnya adalah garis
                tier di bawah — dua arti untuk satu gaya garis. */}
            <CartesianGrid
              horizontal
              vertical={false}
              stroke="var(--color-border)"
              strokeWidth={1}
            />

            <XAxis
              dataKey="atTime"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatDay}
              tick={{ fill: 'var(--color-ink-400)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              minTickGap={40}
            />

            {/* Domain dikunci 0..1000, bukan mengikuti data. Sumbu yang menyempit
                ke rentang data membuat kenaikan 20 poin terlihat seperti
                lompatan besar — dan skor ini punya skala absolut yang bermakna:
                tiernya ditentukan angka mutlaknya, bukan posisinya relatif
                terhadap riwayatnya sendiri. */}
            <YAxis
              domain={[0, 1000]}
              ticks={[0, 200, 400, 600, 800, 1000]}
              tick={{ fill: 'var(--color-ink-400)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
            />

            {TIER_LINES.map((t) => (
              <ReferenceLine
                key={t}
                y={TIER_MIN_SCORE[t]}
                stroke="var(--color-border-strong)"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  value: `T${t}`,
                  position: 'right',
                  fill: 'var(--color-ink-400)',
                  fontSize: 10,
                }}
              />
            ))}

            <Tooltip
              content={<ScoreTooltip />}
              cursor={{ stroke: 'var(--color-border-strong)', strokeWidth: 1 }}
            />

            {/* stepAfter, bukan garis lurus. Skor TIDAK bergerak perlahan di
                antara dua perhitungan — ia bertahan pada nilai lamanya sampai
                fakta baru masuk, lalu melompat. Interpolasi linear akan
                menggambar nilai-nilai antara yang tidak pernah ada. */}
            <Area
              type="stepAfter"
              dataKey="score"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill="url(#score-fill)"
              dot={false}
              activeDot={{
                r: 4,
                fill: 'var(--color-accent)',
                stroke: 'var(--color-surface)',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

interface TooltipPayload {
  payload: ScoreHistoryPoint;
}

function ScoreTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  const point = payload?.[0]?.payload;
  if (active !== true || point === undefined) return null;

  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2 text-small shadow-sm">
      <p className="num text-body font-semibold text-ink-900">{point.score}</p>
      <p className="mt-0.5 text-ink-500">
        Tier {point.tier} · {TIER_LABEL[point.tier]}
      </p>
      <p className="mt-1 text-micro text-ink-400">
        {formatDay(point.atTime)} · block <span className="num">{point.atBlock}</span>
      </p>
    </div>
  );
}

function formatDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
