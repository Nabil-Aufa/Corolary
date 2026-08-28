'use client';

import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { factKindLabel } from '@/components/shared/FactKindBadge';
import { BrandMark } from '@/components/shared/BrandMark';
import { useProtocols } from '@/hooks/useProtocols';
import { hasAnyFilter, type FactFilterState } from '@/lib/facts-filter';
import { shortenAddress } from '@/lib/format';
import { FactKind } from '@/types';
import type { Address } from '@/types';
import { FilterMenu, type FilterOption } from './FilterMenu';

const KINDS: FactKind[] = [
  FactKind.LoanOriginated,
  FactKind.LoanRepaid,
  FactKind.Liquidated,
  FactKind.CollateralSupplied,
  FactKind.CollateralWithdrawn,
];

const KIND_OPTIONS: FilterOption[] = KINDS.map((k) => ({
  value: String(k),
  label: factKindLabel(k),
}));

export function FactFilters({
  value,
  onChange,
  isFullscreen,
  onToggleFullscreen,
}: {
  value: FactFilterState;
  onChange: (next: FactFilterState) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const protocols = useProtocols();
  // Satu keadaan untuk semua menu: membuka yang satu otomatis menutup yang lain.
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const protocolOptions: FilterOption[] = (protocols.data ?? []).map((p) => ({
    value: p.address,
    label: p.name,
    mark: <BrandMark name={p.name} size={18} />,
  }));

  function patch(next: { [K in keyof FactFilterState]?: FactFilterState[K] | undefined }) {
    const merged: FactFilterState = { ...value };
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) delete merged[k as keyof FactFilterState];
      else Object.assign(merged, { [k]: v });
    }
    onChange(merged);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2.5">
      <FilterMenu
        id="kind"
        label="Kind"
        options={KIND_OPTIONS}
        value={value.kind === undefined ? undefined : String(value.kind)}
        onChange={(next) =>
          patch({ kind: next === undefined ? undefined : (Number(next) as FactKind) })
        }
        openId={openMenu}
        onOpenChange={setOpenMenu}
      />

      <FilterMenu
        id="protocol"
        label="Protocol"
        options={protocolOptions}
        value={value.protocol}
        onChange={(next) => patch({ protocol: next === undefined ? undefined : (next as Address) })}
        openId={openMenu}
        onOpenChange={setOpenMenu}
      />

      {/* Subjek tidak punya menu — ia datang dari tautan di halaman skor.
          Ditampilkan sebagai chip yang bisa dilepas supaya jelas kenapa
          daftarnya menyempit, alih-alih terlihat seperti data yang hilang. */}
      {value.subject !== undefined && (
        <button
          type="button"
          onClick={() => patch({ subject: undefined })}
          className="ml-1 inline-flex items-center gap-2 rounded-[var(--radius-base)] border border-accent bg-accent-soft px-2.5 py-1 text-small text-accent"
        >
          <span className="num">{shortenAddress(value.subject)}</span>
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove wallet filter</span>
        </button>
      )}

      {hasAnyFilter(value) && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="ml-1 text-small text-ink-500 transition-colors hover:text-accent"
        >
          Reset
        </button>
      )}

      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? 'Exit focus mode' : 'Focus on the table'}
        className="ml-auto rounded-[var(--radius-base)] p-2 text-ink-400 transition-colors hover:bg-bg hover:text-ink-900"
      >
        {isFullscreen ? (
          <Minimize2 size={16} strokeWidth={1.75} />
        ) : (
          <Maximize2 size={16} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
