'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BrandMark } from '@/components/shared/BrandMark';
import { FactKindBadge } from '@/components/shared/FactKindBadge';
import { formatRelativeTime, formatTokenAmount, formatUsd, shortenAddress } from '@/lib/format';
import type { Fact } from '@/types';

export const FACT_COLUMNS = 'grid-cols-[13rem_8rem_1fr_12rem_8rem_1.5rem]';

export function FactRow({ fact }: { fact: Fact }) {
  return (
    <Link
      href={`/proofs/${fact.factId}`}
      className={`grid ${FACT_COLUMNS} items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-accent-soft/40 md:h-[64px] md:py-0`}
    >
      <span className="flex items-center gap-2.5 truncate">
        <BrandMark name={fact.protocolName} size={24} />
        <span className="truncate text-small font-medium text-ink-900">{fact.protocolName}</span>
      </span>

      <span>
        <FactKindBadge kind={fact.kind} />
      </span>

      <span className="num truncate text-small text-ink-500">{shortenAddress(fact.subject)}</span>

      {/* Jumlah token di atas, nilai USD terbukti di bawahnya — pola dua baris
          dari Morpho. `–` berarti tidak ada harga terbukti saat itu, dan kita
          menyebutnya begitu alih-alih menaksir. */}
      <span className="flex items-center justify-end gap-2.5">
        <span className="text-right">
          <span className="num block text-small font-medium text-ink-900">
            {formatTokenAmount(fact.amount, fact.assetDecimals)} {fact.assetSymbol}
          </span>
          <span className="num block text-micro text-ink-400">{formatUsd(fact.amountUsd)}</span>
        </span>
        <BrandMark name={fact.assetSymbol} size={22} />
      </span>

      <span className="num text-right text-small text-ink-500">
        {formatRelativeTime(fact.observedAt)}
      </span>

      <ChevronRight size={16} strokeWidth={1.5} className="hidden text-ink-400 md:block" />
    </Link>
  );
}
