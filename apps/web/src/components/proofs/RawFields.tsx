'use client';

import { Check, Copy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCopy } from '@/hooks/useCopy';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FactWithProof } from '@/types';

/** Lebar kolom label, dipegang satu konstanta supaya header dan baris mustahil berbeda. */
const RAW_COLUMNS = 'md:grid-cols-[16rem_minmax(0,1fr)_2rem]';

interface Row {
  label: string;
  value: string;
  /** Nilai penuh yang disalin. Tanpa ini barisnya bukan tombol. */
  copyValue?: string | undefined;
}

function RawRow({ label, value, copyValue, isLast }: Row & { isLast: boolean }) {
  const { copied, copy } = useCopy();
  const copyable = copyValue !== undefined;

  const shell = cn(
    'relative flex w-full flex-col gap-1 px-4 py-3 text-left',
    !isLast && 'border-b border-border',
    'md:grid md:items-center md:gap-4',
    RAW_COLUMNS,
    copyable && 'pr-10 transition-colors hover:bg-accent-soft/40 md:pr-4',
  );

  const body = (
    <>
      <span className="text-small text-ink-900">{label}</span>
      <span className="num break-all text-small text-ink-900">{value}</span>
      {copyable && (
        <span className="absolute right-4 top-3 md:static md:justify-self-end">
          {copied ? (
            <Check size={14} strokeWidth={2} className="text-verified" />
          ) : (
            <Copy size={14} strokeWidth={1.5} className="text-ink-400" />
          )}
        </span>
      )}
    </>
  );

  if (!copyable) return <div className={shell}>{body}</div>;

  return (
    <button type="button" onClick={() => copy(copyValue)} aria-label={`Copy ${label}`} className={shell}>
      {body}
    </button>
  );
}

/**
 * Satu tabel per kelompok, masing-masing berjudul sendiri.
 *
 * Dulu ketiganya satu tabel dengan pita pengelompokan di dalamnya, di bawah
 * judul "Raw". Judul itu tidak mengatakan apa pun — yang membawa arti adalah
 * nama kelompoknya, jadi nama kelompok yang naik jadi judul.
 */
function RawTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <h3 className="text-h3 font-semibold tracking-tight text-ink-900">{title}</h3>
      <Card className="mt-3 overflow-hidden">
        <div
          className={cn(
            'hidden h-11 items-center gap-4 border-b border-border px-4 text-small text-ink-500 md:grid',
            RAW_COLUMNS,
          )}
        >
          <span>Field</span>
          <span>Value</span>
          <span />
        </div>

        {rows.map((r, i) => (
          <RawRow key={r.label} {...r} isLast={i === rows.length - 1} />
        ))}
      </Card>
    </section>
  );
}

export function RawFields({ fact }: { fact: FactWithProof }) {
  return (
    <div className="grid gap-8">
      <RawTable
        title="On-chain location"
        rows={[
          { label: 'Block height', value: formatCount(fact.blockHeight) },
          { label: 'Tx index', value: String(fact.txIndex) },
          // Dua angka ini paling sering tertukar di proyek ini. Berdiri
          // bersebelahan dengan label yang menyebut cakupannya, keduanya
          // tidak lagi bisa dibaca sebagai salah ketik satu sama lain.
          { label: 'Log index (block-wide)', value: String(fact.logIndex) },
          { label: 'Log index (in tx)', value: String(fact.txLogIndex) },
          { label: 'Chain key', value: String(fact.chainKey) },
        ]}
      />

      <RawTable
        title="Identity"
        rows={[
          { label: 'Fact ID', value: fact.factId, copyValue: fact.factId },
          { label: 'Asset', value: fact.asset, copyValue: fact.asset },
          { label: 'Protocol', value: fact.protocol, copyValue: fact.protocol },
        ]}
      />

      <RawTable
        title="Batch"
        rows={[
          {
            label: 'Batch ID',
            value: fact.proof.batchId ?? '–',
            copyValue: fact.proof.batchId ?? undefined,
          },
          { label: 'Batch size', value: formatCount(fact.proof.batchSize) },
          // Kedua angka ini dulu hidup sebagai chip di dalam Proof chain.
          // Chip-nya dilepas, dan halaman ini satu-satunya tempat keduanya
          // pernah ditampilkan — jadi keduanya pindah ke sini, bukan hilang.
          { label: 'Merkle siblings', value: formatCount(fact.proof.merkleProofSiblingsCount) },
          { label: 'Continuity roots', value: formatCount(fact.proof.continuityProofRootsCount) },
        ]}
      />
    </div>
  );
}
