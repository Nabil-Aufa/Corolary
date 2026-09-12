'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BrandMark } from '@/components/shared/BrandMark';
import { FactKindBadge } from '@/components/shared/FactKindBadge';
import { formatRelativeTime, formatTokenAmount, formatUsd, shortenAddress } from '@/lib/format';
import { StackedCell } from '@/components/ui/stacked-cell';
import type { Fact } from '@/types';

/**
 * Kolom hanya dari `md` ke atas — di bawahnya baris menumpuk, mengikuti
 * `proofs/RawFields.tsx`. Tanpa awalan `md:` kelima kolom tetapnya
 * (13+8+12+8+1,5rem) menuntut 680px sebelum jarak dan padding, jadi baris ini
 * tidak pernah bisa masuk layar ponsel. Header di `proofs/page.tsx` memakai
 * konstanta yang sama dan sudah `hidden md:grid`, jadi awalannya tidak
 * mengubah apa pun di sana.
 */
export const FACT_COLUMNS = 'md:grid-cols-[13rem_8rem_1fr_12rem_8rem_1.5rem]';

export function FactRow({ fact }: { fact: Fact }) {
  return (
    <Link
      href={`/proofs/${fact.factId}`}
      className={`flex flex-col gap-2 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-accent-soft/40 md:grid ${FACT_COLUMNS} md:h-[64px] md:items-center md:gap-4 md:py-0`}
    >
      <span className="flex items-center gap-2.5 truncate">
        <BrandMark name={fact.protocolName} size={24} />
        <span className="truncate text-small font-medium text-ink-900">{fact.protocolName}</span>
      </span>

      <span>
        <FactKindBadge kind={fact.kind} />
      </span>

      <StackedCell label="Subject" className="truncate text-ink-500 md:text-left">
        {shortenAddress(fact.subject)}
      </StackedCell>

      {/* Jumlah token di atas, nilai USD terbukti di bawahnya — pola dua baris
          dari Morpho. `–` berarti tidak ada harga terbukti saat itu, dan kita
          menyebutnya begitu alih-alih menaksir. */}
      <StackedCell label="Amount" className="flex items-center justify-end gap-2.5">
        <span className="text-right">
          <span className="num block text-small font-medium text-ink-900">
            {formatTokenAmount(fact.amount, fact.assetDecimals)} {fact.assetSymbol}
          </span>
          <span className="num block text-micro text-ink-400">{formatUsd(fact.amountUsd)}</span>
        </span>
        <BrandMark name={fact.assetSymbol} size={22} />
      </StackedCell>

      <StackedCell label="Observed" className="text-ink-500">
        {formatRelativeTime(fact.observedAt)}
      </StackedCell>

      <ChevronRight size={16} strokeWidth={1.5} className="hidden text-ink-400 md:block" />
    </Link>
  );
}
