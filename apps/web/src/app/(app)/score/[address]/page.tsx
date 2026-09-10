'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isAddress } from 'viem';
import { ExternalLink } from 'lucide-react';
import { BASELINE_COLLATERAL_RATIO_BPS, TIER_LABEL } from '@corolary/shared';
import { BackfillPanel } from '@/components/score/BackfillPanel';
import { ComponentBreakdown } from '@/components/score/ComponentBreakdown';
import { NextTierGuidance } from '@/components/score/NextTierGuidance';
import { ScoreHistoryChart } from '@/components/score/ScoreHistoryChart';
import { TierBars } from '@/components/score/TierBars';
import { TierGauge } from '@/components/score/TierGauge';
import { AddressDisplay } from '@/components/shared/AddressDisplay';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useScore } from '@/hooks/useApi';
import { etherscanAddress } from '@/lib/explorer';
import { formatCount, formatRatio, formatRelativeTime } from '@/lib/format';
import type { Address } from '@/types';

export default function ScorePage() {
  const params = useParams<{ address: string }>();
  const raw = params.address;
  const valid = isAddress(raw);
  const { data, isPending, isError, error, refetch } = useScore(
    valid ? (raw as Address) : undefined,
  );

  if (!valid) {
    return (
      <main className="mx-auto max-w-[1280px] px-6 py-12 md:px-8">
        <EmptyState
          title="That is not a valid Ethereum address"
          description="An address is 0x followed by 40 hexadecimal characters."
          action={
            <Link href="/score">
              <Button variant="secondary">Try another address</Button>
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-12 md:px-8">
      <div className="flex flex-wrap items-center gap-3 pb-8">
        <AddressDisplay address={raw} truncate={false} className="text-h3" />
        <a
          href={etherscanAddress(raw)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-small text-ink-500 transition-colors hover:text-accent"
        >
          Etherscan <ExternalLink size={13} strokeWidth={1.5} />
        </a>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <Skeleton className="h-[248px] w-[248px] rounded-full" />
          <Skeleton className="h-[248px]" />
        </div>
      ) : data.factCount === 0 ? (
        // Bukan dial berisi 0. Alamat tanpa riwayat terbukti belum punya skor —
        // menampilkan angka nol seolah itu penilaian adalah kebohongan kecil
        // yang merusak satu-satunya klaim produk ini.
        <div className="grid gap-6">
          {/* Tanpa kotak bergaris. Tepat di bawahnya ada panel pemindaian
              berkartu, dan dua bingkai bertumpuk untuk satu pesan membuat
              halaman kosong terasa lebih ramai daripada halaman berisi. */}
          <EmptyState
            bordered={false}
            title="Nothing indexed for this address yet"
            description="Scores come only from proven Ethereum mainnet lending activity. Scan this wallet below to find its history."
            action={
              <Link href="/proofs">
                <Button variant="secondary">Browse proven facts</Button>
              </Link>
            }
          />
          <BackfillPanel address={raw as Address} />
        </div>
      ) : (
        <>
          {/* Satu kartu, dua kolom, dipisah hairline yang sama dengan pemisah
              baris tabel. Dua kartu terpisah menyajikan skor dan rasio
              kolateral sebagai dua statistik sejajar — padahal yang satu
              SEBAB dan yang satu AKIBAT, dan hubungan itu inti produknya. */}
          <Card>
            <div className="grid items-center lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="flex flex-col items-center gap-5 p-6 lg:p-8">
                <TierGauge score={data.score} tier={data.tier} />

                {/* Tanpa badge. Dua baris di dalam pill memaksa pill itu
                    tumbuh jadi kotak, dan yang tersisa cuma border yang
                    mengurung teks tanpa menambah arti — sementara badge di
                    produk ini selalu satu baris micro huruf kapital. */}
                <div className="text-center">
                  <p className="text-h3 font-semibold tracking-tight text-ink-900">
                    Tier {data.tier}
                  </p>
                  <p className="mt-0.5 text-body text-ink-500">{TIER_LABEL[data.tier]}</p>
                </div>

                <p className="text-micro text-ink-400">
                  <span className="num">{formatCount(data.factCount)}</span> proven{' '}
                  {data.factCount === 1 ? 'fact' : 'facts'}
                  {data.firstFactAt !== null && <>, since {formatRelativeTime(data.firstFactAt)}</>}
                </p>
              </div>

              <div className="border-t border-border p-6 lg:border-l lg:border-t-0 lg:p-8">
                <p className="text-small text-ink-400">Required collateral</p>
                <p className="num mt-1 text-[4.5rem] font-semibold leading-none tracking-tight text-ink-900 sm:text-[6rem] lg:text-[8.125rem]">
                  {formatRatio(data.collateralRatioBps)}
                </p>
                {/* Satu baris, bukan paragraf. Rasio di atasnya sudah menjawab
                    "berapa"; kalimat ini cukup menjawab "dibanding apa", dan
                    versi tiga barisnya mendorong tangga tier jauh dari angka
                    yang ia jelaskan. */}
                <p className="mt-4 text-body text-ink-500 lg:text-h3">
                  {data.collateralRatioBps >= BASELINE_COLLATERAL_RATIO_BPS ? (
                    <>The same collateral as a wallet with no proven history.</>
                  ) : (
                    <>
                      <span className="num">
                        {(BASELINE_COLLATERAL_RATIO_BPS - data.collateralRatioBps) / 100}
                      </span>{' '}
                      percentage points less capital locked than the{' '}
                      <span className="num">{formatRatio(BASELINE_COLLATERAL_RATIO_BPS)}</span>{' '}
                      baseline.
                    </>
                  )}
                </p>
                <TierBars score={data.score} tier={data.tier} className="mt-6" />
              </div>
            </div>
          </Card>

          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">
            How this score is built
          </h2>
          <ComponentBreakdown components={data.components} subject={raw as Address} />

          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">
            What happens next
          </h2>
          <NextTierGuidance score={data} />

          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">
            How it got here
          </h2>
          <ScoreHistoryChart address={raw as Address} />

          {/* Skor yang sudah ada TIDAK berarti riwayatnya sudah lengkap.
              `firstFactAt` adalah minimum lintas protokol, jadi satu protokol
              yang dipindai lebih dangkal menahan seluruh angka: dompet demo
              pernah dibaca "mentok 8 bulan" padahal ada dua transaksi Morpho
              91 hari lebih tua, dan memindainya menggeser skor 797 -> 813.
              Karena itu panelnya ada di kedua cabang, bukan cuma yang kosong. */}
          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">
            Deepen this history
          </h2>
          <BackfillPanel address={raw as Address} />
        </>
      )}
    </main>
  );
}
