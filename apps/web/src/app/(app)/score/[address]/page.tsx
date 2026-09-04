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
import { ScoreDial } from '@/components/score/ScoreDial';
import { TierLadder } from '@/components/score/TierLadder';
import { AddressDisplay } from '@/components/shared/AddressDisplay';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
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
          {/* Kalimat lama berbunyi "wallet ini tidak punya event terindeks",
              yang terbaca seolah dompetnya memang kosong. Itu kekeliruan yang
              sama yang berulang di proyek ini: menyamakan jendela pemindaian
              dengan riwayat yang benar-benar ada. Panel di bawahnya sekarang
              menawarkan jalan keluarnya, jadi kalimatnya bisa jujur. */}
          <EmptyState
            title="Nothing indexed for this address yet"
            description="Corolary only scores Ethereum mainnet lending activity that has been proven through Attestcoin. This wallet has not been scanned, which is not the same as having no history."
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
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <Card>
              <CardBody className="flex flex-col items-center gap-4">
                <ScoreDial score={data.score} tier={data.tier} size="lg" />
                <Badge tone="accent">
                  Tier {data.tier} · {TIER_LABEL[data.tier]}
                </Badge>
                <p className="text-small text-ink-500">
                  <span className="num text-ink-900">{formatCount(data.factCount)}</span> proven
                  facts
                  {data.firstFactAt !== null && <> · since {formatRelativeTime(data.firstFactAt)}</>}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex h-full flex-col">
                <p className="text-micro uppercase tracking-wide text-ink-400">
                  Required collateral
                </p>
                <p className="num mt-2 text-display font-semibold leading-none text-ink-900">
                  {formatRatio(data.collateralRatioBps)}
                </p>
                <p className="mt-3 max-w-md text-body text-ink-500">
                  Against a{' '}
                  <span className="num">{formatRatio(BASELINE_COLLATERAL_RATIO_BPS)}</span> baseline
                  for wallets with no proven history, which is{' '}
                  <span className="num text-ink-900">
                    {(BASELINE_COLLATERAL_RATIO_BPS - data.collateralRatioBps) / 100}
                  </span>{' '}
                  percentage points of capital you do not have to lock.
                </p>
                <div className="mt-auto pt-8">
                  <TierLadder tier={data.tier} />
                </div>
              </CardBody>
            </Card>
          </div>

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
