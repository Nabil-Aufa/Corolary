import {
  TIER_COLLATERAL_RATIO_BPS,
  TIER_LABEL,
  TIER_MIN_SCORE,
} from '@corolary/shared';
import type { Tier } from '@/types';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Tier 4 di atas turun ke tier 0 — status terbaik dulu, sesuai cara orang membaca tabel peringkat. */
const TIERS: readonly Tier[] = [4, 3, 2, 1, 0];

interface TierTableProps {
  /** Tier dompet yang sedang ditampilkan di atas halaman, kalau ada. */
  highlightTier?: Tier;
}

/**
 * Tabel lima tier: BUKAN pinjaman tanpa jaminan, hanya modal terkunci lebih sedikit.
 *
 * Kolom "Terkunci per $10.000 dipinjam" sengaja ditambahkan di luar data mentah
 * kontrak — persentase kolateral abstrak, dolar tidak. Rasio 110% terasa dekat
 * dengan 150%; "$11.000 terkunci" vs "$15.000 terkunci" langsung terasa sebagai
 * uang sungguhan yang tidak perlu dikeluarkan.
 */
export function TierTable({ highlightTier }: TierTableProps) {
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-24 md:px-8 md:py-32">
      <h2 className="font-display text-mkt-h2 text-ink-900">
        Bukan pinjaman tanpa jaminan. Hanya modal terkunci yang jauh lebih sedikit.
      </h2>
      <p className="mt-4 max-w-2xl text-body text-ink-500">
        Setiap pinjaman tetap over-collateralized; dompet terbukti sekadar mengunci lebih
        sedikit modal, dan itu sebabnya protokol tetap solven tanpa identitas maupun jalur
        hukum.
      </p>

      <div className="mt-10 overflow-x-auto rounded-[var(--radius-card)] bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-6 py-4 text-micro uppercase tracking-[0.12em] text-ink-500">
                Tier
              </th>
              <th scope="col" className="px-6 py-4 text-micro uppercase tracking-[0.12em] text-ink-500">
                Standing
              </th>
              <th
                scope="col"
                className="hidden px-6 py-4 text-right text-micro uppercase tracking-[0.12em] text-ink-500 md:table-cell"
              >
                Skor
              </th>
              <th scope="col" className="px-6 py-4 text-right text-micro uppercase tracking-[0.12em] text-ink-500">
                Kolateral
              </th>
              <th scope="col" className="px-6 py-4 text-right text-micro uppercase tracking-[0.12em] text-ink-500">
                Terkunci per $10.000 dipinjam
              </th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier) => {
              const isHighlighted = tier === highlightTier;
              // uint256 di seluruh proyek selalu string, tapi bps di sini murni
              // konstanta angka literal (bukan lintas batas API), jadi aman sebagai number.
              const lockedPer10k = (10000 * TIER_COLLATERAL_RATIO_BPS[tier]) / 10000;

              return (
                <tr
                  key={tier}
                  aria-current={isHighlighted ? 'true' : undefined}
                  className={cn(
                    'border-b border-border last:border-b-0',
                    isHighlighted && 'bg-accent-soft',
                  )}
                >
                  <td className="px-6 py-4 text-body text-ink-900">
                    <span className="num">T{tier}</span>
                  </td>
                  <td className="px-6 py-4 text-body text-ink-700">
                    {TIER_LABEL[tier]}
                    {isHighlighted && (
                      <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-micro font-medium text-white">
                        Dompet ini
                      </span>
                    )}
                  </td>
                  <td className="hidden px-6 py-4 text-right text-body text-ink-700 md:table-cell">
                    <span className="num">{TIER_MIN_SCORE[tier]}+</span>
                  </td>
                  <td className="px-6 py-4 text-right text-body text-ink-700">
                    <span className="num">{TIER_COLLATERAL_RATIO_BPS[tier] / 100}%</span>
                  </td>
                  <td className="px-6 py-4 text-right text-body font-medium text-ink-900">
                    <span className="num">${formatCount(lockedPer10k)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
