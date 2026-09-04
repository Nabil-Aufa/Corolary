'use client';

import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatUnits } from 'viem';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { usePrices } from '@/hooks/useApi';
import { etherscanTx } from '@/lib/explorer';
import { formatDuration, formatUsdPrice } from '@/lib/format';
import type { PriceEntry } from '@/types';

const COLS = 'grid-cols-[1fr_8rem_9rem_7rem_4rem]';

/**
 * Ambang peringatan, sebagai pecahan dari anggaran aset itu sendiri.
 *
 * Bukan angka jam yang tetap. Anggaran per aset berbeda delapan kali lipat di
 * registry yang hidup — 3 jam untuk WETH/WBTC/DAI, 28 jam untuk USDC — jadi
 * "peringatan pada 20 jam" akan berarti "tidak pernah menyala" untuk yang
 * pertama dan "menyala terus" untuk yang kedua.
 */
const WARN_FRACTION = 0.8;

/**
 * Harga yang menopang setiap angka USD di pasar ini, beserta ronde Chainlink
 * yang membuktikannya.
 *
 * Panel ini ada karena satu mode kegagalan yang sudah benar-benar terjadi:
 * pada 2026-09-04 registry on-chain menyimpan ronde berumur sepuluh hari
 * sementara `/v1/market/reserves` tetap menampilkan `priceUsd` yang sehat dari
 * mirror Postgres. Dashboard hijau, pasar beku, dan tidak ada satu pun error —
 * `tryToUsd1e18` hanya menjawab `false` dan setiap operasi berisiko revert.
 * Umur di sini dibandingkan dengan anggaran yang dibaca dari KONTRAK, jadi
 * pembekuan berikutnya punya gejala sebelum ada yang mencoba meminjam.
 */
export function PriceProvenance() {
  const prices = usePrices();

  if (prices.isError) {
    return <ErrorState error={prices.error} onRetry={() => void prices.refetch()} />;
  }
  if (prices.isPending) return <Skeleton className="h-[220px]" />;

  const entries = prices.data ?? [];
  if (entries.length === 0) {
    return (
      <Card>
        <div className="px-5 py-8 text-center text-body text-ink-500">
          No proven price rounds are recorded yet.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div
        className={`hidden h-11 ${COLS} items-center gap-4 border-b border-border px-5 text-micro uppercase tracking-wide text-ink-400 md:grid`}
      >
        <span>Feed</span>
        <span className="text-right">Price</span>
        <span className="text-right">Round age</span>
        <span className="text-right">Round</span>
        <span className="text-right">Proof</span>
      </div>

      {entries.map((p) => (
        <Row key={p.asset} price={p} />
      ))}
    </Card>
  );
}

function Row({ price }: { price: PriceEntry }) {
  const stale = price.ageSeconds > price.maxAgeSeconds;
  const nearing = !stale && price.ageSeconds > price.maxAgeSeconds * WARN_FRACTION;

  return (
    <div
      className={`grid ${COLS} items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 md:h-[68px] md:py-0`}
    >
      <div className="min-w-0">
        <p className="text-body font-medium text-ink-900">{price.pair}</p>
        {/* Label feed datang dari kolomnya sendiri, tidak pernah disusun dari
            simbol aset: WBTC dihargai feed BTC/USD, dan "WBTC/USD" adalah feed
            Chainlink yang benar-benar berbeda. */}
        <p className="text-micro text-ink-400">prices {price.assetSymbol}</p>
      </div>

      <span className="num text-right text-small text-ink-900">
        {formatUsdPrice(formatUnits(BigInt(price.answer), price.decimals))}
      </span>

      <span className="flex items-center justify-end gap-1.5 text-right text-small">
        {(stale || nearing) && (
          <AlertTriangle
            size={14}
            strokeWidth={2}
            className={stale ? 'text-danger' : 'text-warning'}
          />
        )}
        {/* Status tidak pernah disampaikan lewat warna saja — ikon dan teks
            umurnya membawa arti yang sama tanpa melihat warna. */}
        <span className={stale ? 'num text-danger' : nearing ? 'num text-warning' : 'num text-ink-500'}>
          {formatDuration(price.ageSeconds)}
        </span>
        <span className="text-micro text-ink-400">/ {formatDuration(price.maxAgeSeconds)}</span>
      </span>

      <span className="num text-right text-small text-ink-500">{price.roundId}</span>

      <span className="flex justify-end">
        <a
          href={etherscanTx(price.sourceTxHash)}
          target="_blank"
          rel="noreferrer"
          title={`Chainlink AnswerUpdated round ${price.roundId} at Ethereum block ${price.sourceBlock}`}
          className="text-verified transition-opacity hover:opacity-70"
        >
          <ExternalLink size={14} strokeWidth={1.5} />
        </a>
      </span>
    </div>
  );
}
