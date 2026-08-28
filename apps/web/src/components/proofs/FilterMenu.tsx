'use client';

import type { ReactNode } from 'react';
import { Check, ListFilter, X } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  mark?: ReactNode;
}

/**
 * Pemicu filter + panel pilihan, seperti pola Morpho.
 *
 * Pilihannya TUNGGAL, bukan ganda. Referensinya memakai kotak centang yang
 * mengesankan bisa memilih beberapa sekaligus, tapi `GET /v1/facts` hanya
 * menerima satu `kind` dan satu `protocol` (docs/api.md §4). Menampilkan
 * kotak centang lalu diam-diam mengganti pilihan sebelumnya akan membohongi
 * pengguna tentang apa yang sedang disaring — jadi yang terpilih ditandai
 * centang, dan memilih yang lain menggantikannya.
 */
/**
 * Keadaan "menu mana yang terbuka" dipegang PEMANGGIL, bukan tiap menu.
 *
 * Kalau tiap menu menyimpan `open`-nya sendiri, membuka yang kedua tidak
 * menutup yang pertama dan keduanya saling menimpa. Satu keadaan bersama
 * membuat "hanya satu boleh terbuka" jadi sifat bawaan, bukan aturan yang
 * harus dijaga di tiap tempat pemakaian.
 */
export function FilterMenu({
  id,
  label,
  options,
  value,
  onChange,
  openId,
  onOpenChange,
}: {
  id: string;
  label: string;
  options: FilterOption[];
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  openId: string | null;
  onOpenChange: (next: string | null) => void;
}) {
  const open = openId === id;
  const setOpen = (next: boolean) => onOpenChange(next ? id : null);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        data-popover-trigger
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-[var(--radius-base)] px-2.5 py-1.5 text-body transition-colors hover:bg-bg',
          selected !== undefined ? 'text-ink-900' : 'text-ink-700 hover:text-ink-900',
        )}
      >
        <ListFilter size={15} strokeWidth={1.75} className="text-ink-400" />
        {selected?.label ?? label}
        {selected !== undefined && (
          <X
            size={14}
            strokeWidth={2}
            className="text-ink-400 transition-colors hover:text-ink-900"
            role="button"
            aria-label={`Clear ${label} filter`}
            onClick={(e) => {
              // Jangan biarkan klik ini ikut membuka panelnya.
              e.stopPropagation();
              onChange(undefined);
              setOpen(false);
            }}
          />
        )}
      </button>

      <Popover open={open} onClose={() => setOpen(false)} align="left" className="w-[15rem] p-1.5">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-micro uppercase tracking-wide text-ink-400">{label}</span>
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="text-small text-ink-500 transition-colors hover:text-accent"
          >
            Clear
          </button>
        </div>

        <ul>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(active ? undefined : o.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-base)] px-2.5 py-2 text-left transition-colors hover:bg-bg"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
                      active ? 'border-accent bg-accent text-white' : 'border-border-strong',
                    )}
                  >
                    {active && <Check size={11} strokeWidth={3} />}
                  </span>
                  {o.mark}
                  <span className="text-small text-ink-900">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}
