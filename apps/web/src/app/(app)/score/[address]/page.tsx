'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isAddress } from 'viem';
import { ExternalLink } from 'lucide-react';
import { BackfillPanel } from '@/components/score/BackfillPanel';
import { ComponentBreakdown } from '@/components/score/ComponentBreakdown';
import { NextTierGuidance } from '@/components/score/NextTierGuidance';
import { ScoreHero } from '@/components/score/ScoreHero';
import { ScoreHistoryChart } from '@/components/score/ScoreHistoryChart';
import { AddressDisplay } from '@/components/shared/AddressDisplay';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useScore } from '@/hooks/useApi';
import { etherscanAddress } from '@/lib/explorer';
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
          <ScoreHero score={data} />

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
