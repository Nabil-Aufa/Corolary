'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ActionGroup } from './MarketActionDialog';

/**
 * Satu pemicu per baris, dan pilihannya baru muncul saat diminta.
 *
 * Sebelumnya tiap grup punya tombolnya sendiri di baris. Itu berarti lebar
 * kolom tumbuh mengikuti JUMLAH aksi, dan aksi ketiga — kolateral — tidak
 * pernah kebagian tempat. Akibatnya ada lubang yang tidak terlihat: tanpa jalan
 * menyetor kolateral, `Borrow` selalu gagal untuk pengguna baru, dan tombolnya
 * tetap tampak siap dipakai.
 *
 * Menu menghapus pertukaran itu. Lebar kolomnya tetap satu tombol berapa pun
 * jumlah aksinya, dan tiap pilihan punya ruang untuk satu baris penjelas —
 * yang sebelumnya harus dititipkan ke tooltip.
 */
const LABEL: Record<ActionGroup, { title: string; hint: string }> = {
  lend: {
    title: 'Supply',
    hint: 'Earn interest. Does not back borrowing.',
  },
  collateral: {
    title: 'Collateral',
    hint: 'Backs borrowing. Earns nothing.',
  },
  debt: {
    title: 'Borrow',
    hint: 'Against your collateral, at your proven ratio.',
  },
};

export function ActionMenu({
  groups,
  onSelect,
}: {
  groups: readonly ActionGroup[];
  onSelect: (group: ActionGroup) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <Button
        variant="secondary"
        size="iconSm"
        data-popover-trigger
        aria-label="Market actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Chevron, bukan elipsis. Tiga titik berarti "masih ada lagi" — menu
            luapan untuk hal yang tidak cukup penting ditampilkan langsung. Yang
            ada di balik tombol ini justru satu-satunya cara berinteraksi dengan
            pasar, dan chevron menyatakan hal yang sebenarnya: ada sesuatu yang
            terbuka ke bawah. */}
        <ChevronDown
          size={15}
          strokeWidth={1.75}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </Button>

      <Popover open={open} onClose={() => setOpen(false)} className="w-[15rem] p-1.5">
        <div role="menu">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(g);
              }}
              className="block w-full rounded-[var(--radius-base)] px-3 py-2 text-left transition-colors hover:bg-accent-soft"
            >
              <span className="block text-body font-medium text-ink-900">{LABEL[g].title}</span>
              <span className="mt-0.5 block text-micro leading-snug text-ink-400">
                {LABEL[g].hint}
              </span>
            </button>
          ))}
        </div>
      </Popover>
    </span>
  );
}
