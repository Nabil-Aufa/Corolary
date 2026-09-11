'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BASELINE_COLLATERAL_RATIO_BPS, TIER_LABEL } from '@corolary/shared';
import { GradientArt } from '@/components/marketing/GradientArt';
import { Reveal } from '@/components/marketing/Reveal';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useScore } from '@/hooks/useApi';
import { formatCount, shortenAddress } from '@/lib/format';
import type { Address } from '@/types';

/** Pinjaman acuan untuk menerjemahkan rasio jadi angka dolar yang terbayangkan. */
const REFERENCE_BORROW_USD = 10_000;

/**
 * Blok besar tepat di bawah hero.
 *
 * Di situs referensi tempat ini diisi video showreel. Produk ini tidak punya
 * showreel, dan menaruh animasi dekoratif di sini akan menjadi hal pertama
 * yang dilihat pengunjung — sekaligus hal pertama yang tidak bisa mereka
 * periksa. Yang dipasang justru kebalikannya: skor dompet mainnet yang
 * benar-benar ada, dibaca hidup dari API, dan bisa diklik untuk dibedah.
 *
 * Yang SENGAJA tidak ditampilkan di sini: `capitalSavedUsd`. Untuk dompet ini
 * nilainya nol dan itu benar — kontrak mengembalikan 0 selama dompetnya belum
 * pernah meminjam di EfficiencyMarket, dan kunci privat dompet ini bukan milik
 * tim. Memajang "0.00" sebagai angka utama produk adalah cara tercepat membuat
 * seluruh halaman terbaca sebagai belum jadi. Yang dipajang adalah turunan
 * yang jujur dan pasti bukan-nol: selisih modal terkunci antara rasio
 * efektifnya dan baseline 150%.
 */
export function Preview({ address }: { address: Address }) {
  const { data, isPending, isError, error, refetch } = useScore(address);

  const lockedAtBaseline = (REFERENCE_BORROW_USD * BASELINE_COLLATERAL_RATIO_BPS) / 10_000;
  const freed =
    data === undefined ? null : lockedAtBaseline - (REFERENCE_BORROW_USD * data.collateralRatioBps) / 10_000;

  return (
    <section className="pb-[clamp(48px,6vw,96px)] pt-[clamp(32px,4vw,64px)]">
      <Reveal className="mkt-container" distance={40}>
        <div className="relative isolate overflow-hidden rounded-card bg-panel px-[clamp(24px,3.4vw,56px)] py-[clamp(40px,5vw,72px)] text-panel-ink-700">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/3 text-panel-ink-500 opacity-60"
          >
            <GradientArt variant="rays" />
          </div>

          {isError ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : isPending ? (
            <div className="grid gap-8">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-32" />
              <Skeleton className="h-5 w-72" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="num text-small text-panel-ink-500">{shortenAddress(address, 6)}</p>
                <p className="text-micro font-medium uppercase tracking-[0.12em] text-verified">
                  Tier {data.tier} · {TIER_LABEL[data.tier]}
                </p>
              </div>

              <div className="mt-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-10">
                <div>
                  <p className="num font-display text-mkt-display font-medium leading-[0.86] text-panel-ink-900">
                    {formatCount(data.score)}
                  </p>
                  <p className="mt-3 text-small text-panel-ink-500">out of 1000</p>
                </div>

                <div className="text-right">
                  <p className="num font-display text-mkt-h3 font-medium leading-none text-panel-ink-900">
                    {data.collateralRatioBps / 100}%
                  </p>
                  <p className="mt-3 text-small text-panel-ink-500">required collateral</p>
                </div>
              </div>

              {/* Kalimat penutup memakai pinjaman acuan yang disebut angkanya.
                  Tanpa menyebut $10.000 itu, "$40.000 lebih sedikit" adalah
                  angka tanpa penyebut — dan angka tanpa penyebut persis yang
                  dijanjikan produk ini untuk dihapus. */}
              {freed !== null && freed > 0 && (
                <p className="mt-12 max-w-[48ch] text-mkt-statement text-panel-ink-700">
                  On a ${formatCount(REFERENCE_BORROW_USD)} loan, that is{' '}
                  <span className="num text-panel-ink-900">${formatCount(freed)}</span> of capital
                  this wallet does not have to lock up.
                </p>
              )}

              <Link
                href={`/score/${address}`}
                className="mt-10 inline-flex min-h-11 items-center gap-2 text-small text-panel-ink-900 underline underline-offset-4 hover:text-verified focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                Inspect every fact behind this score
                <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
}
