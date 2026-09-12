'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { HealthFactorBar } from '@/components/market/HealthFactorBar';
import { MarketActionDialog, type ActionGroup } from '@/components/market/MarketActionDialog';
import { PositionTable } from '@/components/market/PositionTable';
import { FactRow } from '@/components/proofs/FactRow';
import { BackfillPanel } from '@/components/score/BackfillPanel';
import { NextTierGuidance } from '@/components/score/NextTierGuidance';
import { ScoreHero } from '@/components/score/ScoreHero';
import { AddressDisplay } from '@/components/shared/AddressDisplay';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFacts, useMarketReserves, usePositions, useScore } from '@/hooks/useApi';
import type { Address } from '@/types';

export default function PortfolioPage() {
  const { address } = useAccount();
  const score = useScore(address);
  const positions = usePositions(address);
  const facts = useFacts(address === undefined ? {} : { subject: address, limit: 10 });
  // Baris posisi tahu asetnya, tapi dialog butuh harga, APY, dan likuiditas —
  // semuanya hidup di reserve, bukan di posisi. Dicocokkan di sini supaya
  // PositionTable tetap tidak perlu tahu apa pun soal pasar.
  const reserves = useMarketReserves();
  const [action, setAction] = useState<{ asset: Address; group: ActionGroup } | null>(null);
  const activeReserve = reserves.data?.find((r) => r.asset === action?.asset);

  // Halaman ini sengaja TIDAK menerima alamat lewat URL. /score/[address]
  // adalah explorer publik; ini "punyaku", dan pembedaan itu yang membuat
  // keduanya tidak saling menduplikasi.
  if (address === undefined) {
    return (
      <main className="mx-auto max-w-[1280px] px-6 py-24 md:px-8">
        <EmptyState
          title="Connect your wallet"
          description="Your portfolio shows the score, positions, and proven history tied to the wallet you connect."
          action={
            <Link href="/score">
              <Button variant="secondary">Or look up any address</Button>
            </Link>
          }
        />
      </main>
    );
  }

  const recent = facts.data?.pages.flatMap((p) => p.data) ?? [];
  const scored = score.data !== undefined && score.data.factCount > 0;

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-12 md:px-8">
      <PageHeader title="Portfolio" aside={<AddressDisplay address={address} />} />

      {/* Kepala yang sama persis dengan /score/[address] — komponen yang sama,
          bukan salinan. Pertanyaannya identik ("skorku berapa, apa untungnya"),
          jadi menjawabnya dengan dial kecil di kartu terpisah membuat halaman
          milik sendiri terasa seperti ringkasan kelas dua dari explorer
          publik, padahal justru ini yang dilihat pemiliknya tiap hari. */}
      {score.isError ? (
        <ErrorState error={score.error} onRetry={() => void score.refetch()} />
      ) : score.isPending ? (
        <Skeleton className="h-[360px] lg:h-[312px]" />
      ) : (
        <ScoreHero
          score={score.data}
          footer={
            // Tanpa fakta terbukti tidak ada apa pun untuk dibedah, jadi
            // tautannya akan mengantar ke halaman yang lebih kosong daripada
            // yang ditinggalkan.
            scored ? (
              <Link href={`/score/${address}`} className="text-small text-accent hover:underline">
                See full breakdown →
              </Link>
            ) : undefined
          }
        />
      )}

      {/* Dompet tanpa riwayat terbukti tetap dapat hero yang sama, bukan kotak
          kosong. Angkanya tidak dikarang: skor 0, tier 0, dan kolateral 150%
          adalah keadaan on-chain yang sebenarnya untuk dompet yang belum
          terbukti apa pun — dan kolom kanan hero sudah mengucapkannya dengan
          benar ("the same collateral as a wallet with no proven history").
          Yang ditambahkan di bawahnya adalah jalan keluarnya, karena "belum
          dipindai" tidak sama dengan "tidak punya riwayat". */}
      {score.data !== undefined && !scored && (
        <>
          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">
            Start this history
          </h2>
          <BackfillPanel address={address} indexedFacts={score.data.factCount} />
        </>
      )}

      {/* Halaman ini yang dispesifikasikan sebagai "apa yang harus saya
          lakukan selanjutnya". Hero menunjukkan POSISI; panel ini yang
          menjawab caranya. */}
      {scored && (
        <>
          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">
            What happens next
          </h2>
          <NextTierGuidance score={score.data} />
        </>
      )}

      <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">Positions</h2>
      {positions.data && positions.data.positions.length > 0 ? (
        <>
          <div className="pb-4">
            <HealthFactorBar healthFactorBps={positions.data.healthFactorBps} />
          </div>
          <PositionTable
            positions={positions.data.positions}
            onAct={(asset, group) => setAction({ asset, group })}
          />
        </>
      ) : (
        <EmptyState
          title="No active position"
          description="You have not supplied or borrowed in the Corolary market yet."
          action={
            <Link href="/market">
              <Button variant="secondary">Open the market</Button>
            </Link>
          }
        />
      )}

      <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">
        Recent activity
      </h2>
      {facts.isError ? (
        <ErrorState error={facts.error} onRetry={() => void facts.refetch()} />
      ) : recent.length > 0 ? (
        <Card>
          {recent.map((f) => (
            <FactRow key={f.factId} fact={f} />
          ))}
        </Card>
      ) : facts.isPending ? (
        <Skeleton className="h-40" />
      ) : (
        <EmptyState
          title="No proven facts yet"
          description="Facts appear here once this wallet's mainnet lending activity has been scanned and proven."
        />
      )}

      {/* Skor yang sudah ada TIDAK berarti riwayatnya sudah lengkap.
          `firstFactAt` adalah minimum lintas protokol, jadi satu protokol yang
          dipindai lebih dangkal menahan seluruh angka: dompet demo pernah
          dibaca "mentok 8 bulan" padahal ada dua transaksi Morpho 91 hari
          lebih tua, dan memindainya menggeser skor 797 -> 813. Karena itu
          panelnya muncul juga saat skornya sudah ada — cabang kosong di atas
          sudah memuatnya sendiri. */}
      {scored && (
        <>
          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">
            Deepen this history
          </h2>
          <BackfillPanel address={address} indexedFacts={score.data?.factCount ?? 0} />
        </>
      )}

      {action !== null && activeReserve !== undefined && (
        <MarketActionDialog
          open
          onClose={() => setAction(null)}
          reserve={activeReserve}
          group={action.group}
          account={positions.data}
        />
      )}
    </main>
  );
}
