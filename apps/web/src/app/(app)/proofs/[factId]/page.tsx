'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Route } from 'next';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { ProofChain } from '@/components/proofs/ProofChain';
import { RawFields } from '@/components/proofs/RawFields';
import { BrandMark } from '@/components/shared/BrandMark';
import { ErrorState } from '@/components/shared/ErrorState';
import { FactKindBadge } from '@/components/shared/FactKindBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PillCopy, PillExternalLink, PillLink } from '@/components/ui/pill';
import { Skeleton } from '@/components/ui/skeleton';
import { useFact } from '@/hooks/useApi';
import { ApiError } from '@/lib/api/errors';
import { creditcoinTx, etherscanTx } from '@/lib/explorer';
import { formatTokenAmount, formatUsd, shortenAddress } from '@/lib/format';
import type { Hex } from '@/types';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;

export default function FactDetailPage() {
  const params = useParams<{ factId: string }>();
  const raw = params.factId;
  const valid = HEX32.test(raw);
  const { data, isPending, isError, error, refetch } = useFact(valid ? (raw as Hex) : undefined);

  const notFound = error instanceof ApiError && error.code === 'NOT_FOUND';

  return (
    // Wadah PERSIS sama dengan /proofs — lebar, padding, dan padding atasnya.
    // Berpindah dari daftar ke detail seharusnya tidak menggeser apa pun di
    // layar; pergeseran itu terbaca sebagai halaman yang dimuat ulang.
    <main className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-8">
      <Link
        href="/proofs"
        className="inline-flex items-center gap-1.5 text-small text-ink-500 transition-colors hover:text-accent"
      >
        <ArrowLeft size={14} strokeWidth={1.5} /> Proofs
      </Link>

      {!valid || notFound ? (
        <div className="mt-8">
          <EmptyState
            title={valid ? 'No fact with this ID' : 'Malformed fact ID'}
            description={
              valid
                ? 'The ID is well-formed but nothing has been recorded under it. It may not be indexed yet.'
                : 'A fact ID is 0x followed by 64 hexadecimal characters.'
            }
            action={
              <Link href="/proofs">
                <Button variant="secondary">Back to proofs</Button>
              </Link>
            }
          />
        </div>
      ) : isError ? (
        <div className="mt-8">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : isPending ? (
        <div className="mt-8 space-y-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-52" />
        </div>
      ) : (
        <>
          {/* ── Hero ─────────────────────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2.5">
              <BrandMark name={data.protocolName} size={28} />
              <span className="text-h3 font-medium text-ink-900">{data.protocolName}</span>
            </span>
            <FactKindBadge kind={data.kind} />
            <Badge tone="verified">Proven</Badge>
          </div>

          {/* Jumlah token tetap elemen dominan; nilai USD berdiri di sebelahnya
              dengan berat yang jelas lebih rendah, pasangan yang sama seperti
              kolom Amount di /proofs. Tidak ada baris kosong bila harga terbukti
              tidak ada — yang tidak diketahui tidak diberi tempat. */}
          <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {/* Di layar sempit, ukuran display membuang simbol aset ke barisnya
                sendiri — "WETH" berdiri sendirian setinggi 56px dan terbaca
                seperti judul, bukan seperti satuan. Satu langkah lebih kecil
                membuat jumlah dan satuannya tetap satu kesatuan, dan ia masih
                jauh elemen terbesar di layar. */}
            <p className="num text-h1 font-semibold tracking-tight text-ink-900 sm:text-display">
              {formatTokenAmount(data.amount, data.assetDecimals, { maxFractionDigits: 4 })}{' '}
              <span className="text-h2 font-medium text-ink-400 sm:text-h1">
                {data.assetSymbol}
              </span>
            </p>
            {data.amountUsd !== null && (
              <p className="num text-h3 text-ink-500">{formatUsd(data.amountUsd)}</p>
            )}
          </div>

          {/* Empat pill: satu menyalin, dua keluar ke explorer di kedua ujung
              rantai, satu masuk ke skor. Semua tautan halaman ini ada di satu
              baris — tidak ada lagi yang tersebar di dalam langkah proof. */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <PillCopy value={data.subject} label="Copy subject address">
              <span className="text-ink-500">Subject</span>
              <span className="num text-ink-900">{shortenAddress(data.subject)}</span>
            </PillCopy>

            <PillExternalLink
              href={etherscanTx(data.txHash)}
              icon={<ExternalLink size={14} strokeWidth={1.5} className="text-ink-400" />}
            >
              Etherscan
            </PillExternalLink>

            <PillExternalLink
              href={creditcoinTx(data.creditcoinTxHash)}
              icon={<ExternalLink size={14} strokeWidth={1.5} className="text-ink-400" />}
            >
              Blockscout
            </PillExternalLink>

            {/* Satu-satunya pill berisi, dan itu disengaja: tiga pill lain
                menyalin atau membawa keluar ke explorer, yang ini satu-satunya
                yang membawa pembaca lebih dalam ke produk. Panahnya tanpa kelas
                warna — varian `brand` yang memutihkannya, sama seperti ikon di
                tombol Connect. */}
            <PillLink
              href={`/score/${data.subject}` as Route}
              variant="brand"
              icon={<ArrowRight size={14} strokeWidth={1.75} />}
            >
              See their score
            </PillLink>
          </div>

          {/* ── Proof chain ──────────────────────────────────────────── */}
          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">
            Proof chain
          </h2>
          <ProofChain fact={data} />

          {/* ── Raw ──────────────────────────────────────────────────── */}
          <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">Raw</h2>
          <RawFields fact={data} />
        </>
      )}
    </main>
  );
}
