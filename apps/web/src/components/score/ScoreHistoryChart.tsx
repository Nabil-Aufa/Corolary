'use client';

import { useMemo, useState } from 'react';
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

const RANGE_DAYS: Record<Exclude<ScoreRange, 'all'>, number> = { '30d': 30, '90d': 90, '1y': 365 };

/**
 * Penyaringan rentang terjadi DI SINI, bukan di server.
 *
 * `GET /v1/score/:address/history` menjanjikan `from`/`to` di `docs/api.md` §7
 * tapi rutenya tidak pernah membacanya, jadi mengirimkannya membuat keempat
 * pilihan mengembalikan data yang sama sambil terlihat bekerja. Lihat
 * `useScoreHistory`.
 */
function withinRange(points: ScoreHistoryPoint[], range: ScoreRange): ScoreHistoryPoint[] {
  if (range === 'all') return points;
  const cutoff = Date.now() / 1000 - RANGE_DAYS[range] * 86_400;
  return points.filter((p) => p.atTime >= cutoff);
}

export function ScoreHistoryChart({ address }: { address: Address }) {
  const [range, setRange] = useState<ScoreRange>('all');
  const history = useScoreHistory(address);
  const all = history.data;
  const points = useMemo(() => withinRange(all ?? [], range), [all, range]);

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tanpa kalimat penjelas. Yang perlu diketahui dari grafik ini ada
              di angkanya, dan angka itu sekarang tepat di bawah garisnya. */}
          <p className="text-micro uppercase tracking-wide text-ink-400">Score over time</p>
          <Segments value={range} onChange={setRange} options={RANGES} />
        </div>

        <div className="mt-5">
          {history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : history.isPending ? (
            <Skeleton className="h-[260px]" />
          ) : (
            <Plot points={points} range={range} />
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/** Titik tunggal: sama dengan `activeDot`, supaya titik yang diam dan yang disorot terbaca satu benda. */
const SINGLE_DOT = {
  r: 5,
  fill: 'var(--color-accent)',
  // `Area` mewariskan `fill-opacity` 0.6 miliknya ke setiap titik. Untuk garis
  // itu tidak terlihat; untuk satu titik yang berdiri sendirian, titiknya jadi
  // biru pucat yang nyaris hilang di atas garis tier.
  fillOpacity: 1,
  stroke: 'var(--color-surface)',
  strokeWidth: 2,
} as const;

/**
 * Rentang sumbu X untuk data yang terlalu sedikit untuk menentukannya sendiri.
 *
 * `dataMin`/`dataMax` dari satu titik menghasilkan domain selebar nol, dan dari
 * nol titik tidak menghasilkan apa-apa — dua-duanya membuat sumbunya runtuh.
 * Satu titik diberi sehari di kiri-kanan supaya ia berdiri di tengah, bukan
 * menempel di tepi dan terbaca sebagai potongan garis yang terpotong.
 */
function xDomainFor(
  points: ScoreHistoryPoint[],
  range: ScoreRange,
): [number, number] | [string, string] {
  if (points.length >= 2) return ['dataMin', 'dataMax'];
  const only = points[0];
  if (only !== undefined) return [only.atTime - 86_400, only.atTime + 86_400];
  const now = Math.floor(Date.now() / 1000);
  return [now - (range === 'all' ? 30 : RANGE_DAYS[range]) * 86_400, now];
}

/**
 * Kerangka grafiknya SELALU digambar, berapa pun titiknya.
 *
 * Dulu kurang dari dua titik diganti satu kalimat, dan kartu berisi kalimat di
 * tempat grafik terbaca seperti grafik yang gagal dimuat. Yang tetap dijaga
 * adalah alasan lamanya: satu titik digambar sebagai TITIK, bukan garis datar,
 * karena garis menyiratkan riwayat yang tidak kita punya.
 */
function Plot({ points, range }: { points: ScoreHistoryPoint[]; range: ScoreRange }) {
  const first = points[0];
  const last = points[points.length - 1];
  const peak =
    first === undefined ? undefined : points.reduce((a, b) => (b.score > a.score ? b : a), first);
  const single = points.length === 1;

  return (
    <figure className="m-0">
      <div
        className="h-[260px]"
        role="img"
        aria-label={
          first === undefined || last === undefined
            ? 'Credit score over time. No score recorded in this window.'
            : single
              ? `Credit score over time. One recorded point: ${first.score} on ${formatDay(first.atTime)}.`
              : `Credit score over time, from ${first.score} on ${formatDay(first.atTime)} to ${
                  last.score
                } on ${formatDay(last.atTime)}, across ${points.length} recorded points.`
        }
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
              domain={xDomainFor(points, range)}
              {...(single && first !== undefined ? { ticks: [first.atTime] } : {})}
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
              dot={single ? SINGLE_DOT : false}
              activeDot={SINGLE_DOT}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Di BAWAH grafik, dipisah jarak — bukan titik. Nilainya tetap teks
          biasa supaya terbaca pembaca layar maupun mata yang tidak menyentuh
          grafiknya sama sekali. */}
      <figcaption className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-small text-ink-500">
        {first === undefined || last === undefined || peak === undefined ? (
          <span>No score recorded in this window.</span>
        ) : (
          <>
            <span className="flex gap-2">
              <span>First recorded</span>
              <span className="num text-ink-900">{first.score}</span>
              <span>{formatDay(first.atTime)}</span>
            </span>
            <span className="flex gap-2">
              <span>Now</span>
              <span className="num text-ink-900">{last.score}</span>
              <span>
                Tier {last.tier} {TIER_LABEL[last.tier]}
              </span>
            </span>
            {peak.score > last.score && (
              <span className="flex gap-2">
                <span>Peak</span>
                <span className="num text-ink-900">{peak.score}</span>
                <span>{formatDay(peak.atTime)}</span>
              </span>
            )}
          </>
        )}
      </figcaption>
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
