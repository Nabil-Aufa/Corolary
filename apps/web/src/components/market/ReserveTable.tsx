'use client';

import { ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { etherscanTx } from '@/lib/explorer';
import { formatBps, formatTokenAmount, formatUsdPrice } from '@/lib/format';
import type { Reserve } from '@/types';
import type { ActionGroup } from './MarketActionDialog';
import { ActionMenu } from './ActionMenu';

const COLS = 'grid-cols-[1fr_6rem_6rem_6rem_8rem_4rem]';

export function ReserveTable({
  reserves,
  isLoading,
  className,
  onAct,
}: {
  reserves: Reserve[];
  isLoading?: boolean;
  className?: string;
  /**
   * Aksi dibuka dari BARIS, bukan dari sepasang tombol global di bawah tabel.
   * Tombol global memaksa langkah "pilih aset" yang barisnya sudah menjawab —
   * dan pada tabel dua baris, langkah itu murni gesekan.
   */
  onAct?: (reserve: Reserve, group: ActionGroup) => void;
}) {
  return (
    // Kartu ini meregang mengikuti kolom sebelahnya (lihat market/page.tsx).
    // Kelebihan tingginya dibagikan ke BARIS lewat `flex-1`, bukan ditinggalkan
    // menumpuk di bawah baris terakhir: ruang kosong sebesar satu baris penuh
    // terbaca seperti data yang gagal dimuat, bukan seperti tabel yang selesai.
    // Karena itu 76px jadi `min-h` — lantai tinggi baris, bukan ukurannya.
    <Card className={cn('flex flex-col', className)}>
      <div
        className={`hidden h-11 shrink-0 ${COLS} items-center gap-4 border-b border-border px-5 text-micro uppercase tracking-wide text-ink-400 md:grid`}
      >
        <span>Asset</span>
        <span className="text-right">Supply APY</span>
        <span className="text-right">Borrow APY</span>
        <span className="text-right">Utilization</span>
        <span className="text-right">Total supplied</span>
        <span className="text-right">{onAct === undefined ? '' : 'Actions'}</span>
      </div>

      {isLoading === true
        ? Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex min-h-[76px] flex-1 items-center gap-4 border-b border-border px-5 last:border-b-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="ml-auto h-4 w-40" />
            </div>
          ))
        : reserves.map((r) => (
            <div
              key={r.asset}
              className={`grid ${COLS} flex-1 items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 md:min-h-[76px] md:py-0`}
            >
              <div className="min-w-0">
                <p className="text-body font-medium text-ink-900">{r.symbol}</p>
                <p className="num flex items-center gap-1 text-micro text-ink-400">
                  {formatUsdPrice(r.priceUsd)}
                  {/* Harga BUKAN Fact — PriceRegistry menyimpan ronde terbaru
                      per aset, bukan catatan permanen ber-ID. Jadi tautannya
                      ke Etherscan, bukan ke /proofs/[factId]. */}
                  {r.priceSourceTxHash !== null && (
                    <a
                      href={etherscanTx(r.priceSourceTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      title="Chainlink round that proves this price"
                      className="text-verified transition-opacity hover:opacity-70"
                    >
                      <ExternalLink size={11} strokeWidth={1.5} />
                    </a>
                  )}
                </p>
              </div>

              <span className="num text-right text-small text-ink-900">
                {formatBps(r.supplyApyBps)}
              </span>
              <span className="num text-right text-small text-ink-900">
                {formatBps(r.borrowApyBps)}
              </span>
              <span className="num text-right text-small text-ink-500">
                {formatBps(r.utilizationBps, 1)}
              </span>
              <span className="num text-right text-small text-ink-900">
                {formatTokenAmount(r.totalSupplied, r.decimals)}
              </span>

              {onAct !== undefined && (
                <span className="flex justify-end">
                  <ActionMenu groups={groupsFor(r)} onSelect={(group) => onAct(r, group)} />
                </span>
              )}
            </div>
          ))}
    </Card>
  );
}

/**
 * Aset kolateral-saja tidak mendapat pilihan Borrow.
 *
 * `addReserve(tWeth, 1000, false)` membuat `borrow` untuk tWETH selalu revert
 * dengan `BorrowDisabled`. Menampilkannya berarti memasang kontrol yang tidak
 * pernah bisa berhasil — dan pengguna baru akan menyimpulkan produknya rusak,
 * bukan bahwa asetnya memang bukan untuk dipinjam. Menyetorkannya sebagai
 * kolateral tetap boleh, jadi dua pilihan lainnya tetap ada.
 */
function groupsFor(r: Reserve): ActionGroup[] {
  return r.borrowEnabled ? ['lend', 'collateral', 'debt'] : ['lend', 'collateral'];
}
