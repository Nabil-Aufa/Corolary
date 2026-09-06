'use client';

import { Check, Copy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { useCopy } from '@/hooks/useCopy';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FactWithProof } from '@/types';

/**
 * Kolom tabel Raw, dipegang satu konstanta seperti FACT_COLUMNS di /proofs —
 * baris header dan baris isi harus mustahil berbeda.
 */
const RAW_COLUMNS = 'md:grid-cols-[16rem_minmax(0,1fr)_2rem]';

interface RawRowProps {
  label: string;
  value: string;
  /** Nilai penuh yang disalin. Tanpa ini barisnya bukan tombol. */
  copyValue?: string | undefined;
}

function RawRow({ label, value, copyValue }: RawRowProps) {
  const { copied, copy } = useCopy();
  const copyable = copyValue !== undefined;

  const shell = cn(
    'relative flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left last:border-b-0',
    'md:grid md:items-center md:gap-4 md:py-3',
    RAW_COLUMNS,
    // Di bawah md ikonnya melayang di pojok, jadi nilainya butuh ruang supaya
    // tidak berjalan di bawahnya. Di md ke atas ikon punya kolomnya sendiri.
    copyable && 'pr-10 transition-colors hover:bg-accent-soft/40 md:pr-4',
  );

  const body = (
    <>
      {/* Kedua kolom sewarna. Yang membedakan mana label dan mana nilai adalah
          posisinya di kolom, bukan tintanya — dan tabel ini sudah punya header
          kolom yang menyatakannya. */}
      <span className="text-small text-ink-900">{label}</span>
      <span className="num break-all text-small text-ink-900">{value}</span>
      {copyable && (
        // Absolut di layar sempit, sel grid biasa di lebar penuh. Menyembunyikannya
        // di bawah md akan mencabut satu-satunya cara menyalin hash justru di
        // perangkat yang paling sulit menyeleksi teks dengan tangan.
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
 * Pita pengelompokan.
 *
 * Bukan hiasan: "Log index (block-wide)" dan "Log index (in tx)" adalah dua
 * angka berbeda yang paling sering tertukar sepanjang proyek ini, dan berdiri
 * bersebelahan tanpa konteks keduanya terbaca seperti salah satunya salah
 * ketik. Pita ini yang menyatakan bahwa keduanya memang milik hal yang sama.
 */
function RawGroupRow({ title }: { title: string }) {
  return (
    // Sel tabelnya tetap putih; yang berlatar abu hanya judulnya, dalam bentuk
    // chip yang sama dengan metadata di Proof chain — tanpa garis tepi, karena
    // di sini ia berdiri sendirian dan tidak ada tetangga yang perlu dipisah.
    //
    // Garis bawahnya tetap ada. Chip-nya sendiri sudah memisahkan judul dari
    // baris di bawahnya, tapi menghilangkan satu garis membuat kisi tabelnya
    // putus — dan yang paling terlihat justru putusnya, bukan pengelompokannya.
    <div className="border-b border-border px-4 py-3">
      <Chip bordered={false} className="font-semibold text-ink-900">
        {title}
      </Chip>
    </div>
  );
}

export function RawFields({ fact }: { fact: FactWithProof }) {
  return (
    <Card className="overflow-hidden">
      {/* Header kolom hanya di md ke atas — di bawah itu tiap baris menumpuk
          label di atas nilainya, dan header dua kolom tidak lagi menjelaskan
          apa pun. Pola yang sama dipakai tabel /proofs. */}
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

      <RawGroupRow title="On-chain location" />
      <RawRow label="Block height" value={formatCount(fact.blockHeight)} />
      <RawRow label="Tx index" value={String(fact.txIndex)} />
      <RawRow label="Log index (block-wide)" value={String(fact.logIndex)} />
      <RawRow label="Log index (in tx)" value={String(fact.txLogIndex)} />
      <RawRow label="Chain key" value={String(fact.chainKey)} />

      <RawGroupRow title="Identity" />
      <RawRow label="Fact ID" value={fact.factId} copyValue={fact.factId} />
      <RawRow label="Asset" value={fact.asset} copyValue={fact.asset} />
      <RawRow label="Protocol" value={fact.protocol} copyValue={fact.protocol} />

      <RawGroupRow title="Batch" />
      <RawRow
        label="Batch ID"
        value={fact.proof.batchId ?? '–'}
        copyValue={fact.proof.batchId ?? undefined}
      />
    </Card>
  );
}
