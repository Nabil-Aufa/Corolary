'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BASELINE_COLLATERAL_RATIO_BPS, TIER_LABEL } from '@corolary/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { useScore } from '@/hooks/useApi';
import { formatCount, shortenAddress } from '@/lib/format';
import type { Address } from '@/types';
import { GradientArt } from './GradientArt';
import { Reveal } from './Reveal';

/**
 * Alamat mainnet NYATA dengan riwayat terbukti — bukan contoh.
 *
 * Ada di env supaya bisa diganti tanpa deploy ulang; nilai cadangannya adalah
 * dompet yang riwayatnya sudah dipindai penuh dan terdokumentasi di
 * docs/open-issues.md §B5.
 */
const FEATURED = (process.env.NEXT_PUBLIC_FEATURED_ADDRESS ??
  '0x94963B928498bE7f06637C3D57ea1E74D7f73423') as Address;

/** Pinjaman acuan untuk menerjemahkan rasio jadi rupiah-yang-bisa-dibayangkan. */
const REFERENCE_BORROW_USD = 10_000;

/**
 * Bukti hidup, bukan render.
 *
 * Ini menggantikan blok media besar di situs referensi. Pilihannya disengaja:
 * produk ini menjual keterbuktian, jadi gambar yang paling meyakinkan adalah
 * angka yang benar-benar dibaca dari chain dan bisa diklik untuk diperiksa.
 *
 * Yang TIDAK ditampilkan di sini: `capitalSavedUsd`. Untuk dompet ini ia nol
 * dan itu benar — `capitalSavedUsdWad` mengembalikan 0 selama dompetnya belum
 * pernah meminjam di EfficiencyMarket, dan kunci privat dompet ini bukan milik
 * tim. Menampilkannya berarti memamerkan "0.00" sebagai angka utama produk.
 * Yang ditampilkan justru turunan yang jujur dan pasti bukan-nol: selisih
 * modal terkunci antara rasio efektifnya dan baseline 150%.
 */
export function LiveScoreCard() {
  const score = useScore(FEATURED);
  const d = score.data;

  const lockedAtBaseline = (REFERENCE_BORROW_USD * BASELINE_COLLATERAL_RATIO_BPS) / 10_000;
  const lockedEffective =
    d === undefined ? null : (REFERENCE_BORROW_USD * d.collateralRatioBps) / 10_000;
  const freed = lockedEffective === null ? null : lockedAtBaseline - lockedEffective;

  return (
    <Reveal className="mx-auto max-w-[1280px] px-6 md:px-8" distance={40}>
      <div className="relative isolate overflow-hidden rounded-[var(--radius-card)] bg-panel px-6 py-12 text-panel-ink-700 md:px-12 md:py-16">
        {/* Bentuk abstrak, bukan gambar — lihat GradientArt. Ia duduk di bawah
            seluruh isi dan tidak pernah menerima pointer. */}
        <div className="absolute inset-x-0 bottom-0 -z-10 h-2/3 text-panel-ink-500 opacity-60">
          <GradientArt variant="rays" />
        </div>

        {score.isPending ? (
          <LoadingBody />
        ) : score.isError || d === undefined ? (
          <ErrorBody onRetry={() => void score.refetch()} />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="num text-small text-panel-ink-500">{shortenAddress(FEATURED, 6)}</p>
              <p className="text-micro font-medium uppercase tracking-[0.12em] text-verified">
                Tier {d.tier} · {TIER_LABEL[d.tier]}
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-10">
              <div>
                <p className="num font-display text-[clamp(4rem,13vw,9rem)] font-medium leading-[0.86] tracking-[-0.03em] text-panel-ink-900">
                  {formatCount(d.score)}
                </p>
                <p className="mt-3 text-small text-panel-ink-500">dari 1000</p>
              </div>
              <div className="text-right">
                <p className="num font-display text-[clamp(2.5rem,7vw,4.5rem)] font-medium leading-none tracking-[-0.02em] text-panel-ink-900">
                  {d.collateralRatioBps / 100}%
                </p>
                <p className="mt-3 text-small text-panel-ink-500">kolateral yang diminta</p>
              </div>
            </div>

            <dl className="mt-12 grid gap-8 border-t border-panel-border pt-8 sm:grid-cols-3">
              <Metric
                value={freed === null ? null : `$${formatCount(freed)}`}
                label={`modal yang tidak perlu dikunci per $${formatCount(REFERENCE_BORROW_USD)} dipinjam`}
                emphasis
              />
              <Metric value={formatCount(d.factCount)} label="fakta terbukti kriptografis" />
              <Metric
                value={formatCount(d.onChainBlock)}
                label="blok Creditcoin saat skor dihitung"
              />
            </dl>

            <Link
              href={`/score/${FEATURED}`}
              className="mt-10 inline-flex items-center gap-2 rounded-full border border-panel-border px-5 py-3 text-body font-medium text-panel-ink-900 transition-colors hover:border-panel-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Lihat dari mana angkanya
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
    </Reveal>
  );
}

function Metric({
  value,
  label,
  emphasis = false,
}: {
  value: string | null;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dd
        className={`num font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-medium leading-none tracking-[-0.02em] ${
          emphasis ? 'text-verified' : 'text-panel-ink-900'
        }`}
      >
        {value ?? '–'}
      </dd>
      <dt className="mt-3 text-small text-panel-ink-500">{label}</dt>
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-5 w-40 bg-panel-raised" />
      <div className="flex items-end justify-between gap-8">
        <Skeleton className="h-28 w-52 bg-panel-raised" />
        <Skeleton className="h-16 w-32 bg-panel-raised" />
      </div>
      <Skeleton className="h-24 w-full bg-panel-raised" />
    </div>
  );
}

/**
 * Kegagalan di sini TIDAK boleh menampilkan angka apa pun, termasuk nol.
 *
 * Kartu ini adalah satu-satunya bukti di layar pertama; "0" yang terbaca
 * seperti data akan lebih merusak daripada kotak kosong yang jujur.
 */
function ErrorBody({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-8">
      <p className="font-display text-mkt-statement font-medium text-panel-ink-900">
        Skor dompet ini sedang tidak bisa diambil.
      </p>
      <p className="mt-3 max-w-md text-body text-panel-ink-500">
        Angkanya hidup dari API, jadi kami memilih tidak menampilkan apa pun daripada menampilkan
        angka yang tidak sedang benar.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-full border border-panel-border px-5 py-3 text-body font-medium text-panel-ink-900 transition-colors hover:border-panel-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Coba lagi
      </button>
    </div>
  );
}
