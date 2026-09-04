'use client';

import { formatUnits, parseUnits } from 'viem';
import { formatTokenAmount, formatUsd } from '@/lib/format';
import type { UsdPrice } from '@/types';

/**
 * Berapa banyak, dalam satuan token, dengan saldo dan nilai USD-nya.
 *
 * Nilainya string sepanjang hidupnya — tidak pernah `number`. Aturan 6 di
 * CLAUDE.md berlaku penuh di sini: `parseUnits` menerima string, dan mengonversi
 * ke `number` lebih dulu akan membulatkan diam-diam pada saldo besar.
 */
export function AmountField({
  value,
  onChange,
  symbol,
  decimals,
  max,
  maxLabel,
  priceUsd,
}: {
  value: string;
  onChange: (value: string) => void;
  symbol: string;
  decimals: number;
  /** Batas atas dalam satuan terkecil (uint256 string). */
  max: string;
  maxLabel: string;
  priceUsd: UsdPrice | null;
}) {
  /**
   * Yang diterima hanya angka desimal, dan desimalnya tidak boleh melebihi
   * milik token. Ditolak di titik ketik, bukan saat submit: `parseUnits` akan
   * MELEMPAR untuk "1.0000001" pada token 6 desimal, dan error yang muncul
   * setelah seseorang menekan tombol terasa seperti kegagalan sistem, padahal
   * karakter ketujuh itu tidak pernah punya arti.
   */
  function accept(raw: string) {
    const next = raw.replace(',', '.');
    if (next === '') return onChange('');
    if (!/^\d*\.?\d*$/.test(next)) return;
    const [, frac] = next.split('.');
    if (frac !== undefined && frac.length > decimals) return;
    onChange(next);
  }

  const usd = usdValueOf(value, decimals, priceUsd);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor="amount" className="text-micro uppercase tracking-wide text-ink-400">
          Amount
        </label>
        <button
          type="button"
          onClick={() => onChange(formatUnits(BigInt(max), decimals))}
          className="text-micro uppercase tracking-wide text-ink-400 transition-colors hover:text-accent"
        >
          {maxLabel} <span className="num text-ink-500">{formatTokenAmount(max, decimals)}</span>
        </button>
      </div>

      <div className="mt-1.5 flex h-12 items-center gap-2 rounded-[var(--radius-base)] border border-border bg-bg px-4 focus-within:border-border-strong">
        <input
          id="amount"
          value={value}
          onChange={(e) => accept(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.0"
          className="num min-w-0 flex-1 bg-transparent text-body text-ink-900 outline-none placeholder:text-ink-400"
        />
        <span className="text-small font-medium text-ink-500">{symbol}</span>
      </div>

      {/* Nilai USD hanya muncul kalau harganya benar-benar terbukti. Menampilkan
          "$0.00" untuk aset tanpa harga akan mengarang angka. */}
      <p className="mt-1.5 h-4 text-small text-ink-400">
        {usd === null ? '' : `≈ ${formatUsd(usd)}`}
      </p>
    </div>
  );
}

/** `null` bila harga belum terbukti atau jumlahnya belum berbentuk angka. */
function usdValueOf(value: string, decimals: number, priceUsd: UsdPrice | null): string | null {
  if (priceUsd === null || value === '' || value === '.') return null;
  try {
    // Harga dikonversi ke integer berskala 1e6 lebih dulu supaya seluruh
    // perkalian tetap di BigInt. `UsdPrice` punya enam desimal (lihat
    // docs/api.md §9) — memakai float di sini akan mengembalikan presisi yang
    // sengaja dijaga di sisi API.
    const price = parseUnits(priceUsd, 6);
    const amount = parseUnits(value, decimals);
    const cents = (amount * price) / 10n ** BigInt(decimals) / 10_000n;
    return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
  } catch {
    return null;
  }
}
