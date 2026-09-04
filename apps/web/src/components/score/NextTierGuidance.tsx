'use client';

import { CircleDot, Lock, TrendingUp } from 'lucide-react';
import { TIER_COLLATERAL_RATIO_BPS, TIER_LABEL } from '@corolary/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { formatRatio } from '@/lib/format';
import { guidanceFor, type LeverCertainty } from '@/lib/score-levers';
import type { CreditScore } from '@/types';

const MARK: Record<LeverCertainty, { Icon: typeof TrendingUp; tone: string; label: string }> = {
  // Satu-satunya yang boleh disebut pasti. `protocolDiversity` linear —
  // 25 poin per protokol, dihitung `popcount(bitmap) * 100 / 4` tanpa
  // penjenuhan — jadi hasilnya diketahui SEBELUM dikerjakan.
  exact: { Icon: TrendingUp, tone: 'text-verified', label: 'Exact' },
  // Angkanya benar menurut rumus kontrak, tapi masukannya belum tentu ada.
  formula: { Icon: CircleDot, tone: 'text-accent', label: 'From the formula' },
  // Tidak bisa dipercepat oleh tindakan apa pun.
  none: { Icon: Lock, tone: 'text-ink-400', label: 'Time only' },
};

const LABEL: Record<string, string> = {
  repaymentVolume: 'Repayment volume',
  repaymentCount: 'Repayment count',
  historyDuration: 'History duration',
};

export function NextTierGuidance({ score }: { score: CreditScore }) {
  const { nextTier, pointsNeeded, levers, saturated } = guidanceFor(score);

  return (
    <Card>
      <CardBody>
        <p className="text-micro uppercase tracking-wide text-ink-400">What raises this score</p>

        {nextTier === null ? (
          <p className="mt-2 max-w-2xl text-body text-ink-500">
            This wallet is already at the highest tier, and its collateral ratio is at the floor of{' '}
            <span className="num text-ink-900">{formatRatio(score.collateralRatioBps)}</span>. More
            points are still possible, but they no longer change what it costs to borrow.
          </p>
        ) : (
          <p className="mt-2 max-w-2xl text-body text-ink-500">
            <span className="num text-ink-900">{pointsNeeded}</span> more points reach tier{' '}
            <span className="num text-ink-900">{nextTier}</span> {TIER_LABEL[nextTier]}, which drops
            the required collateral from{' '}
            <span className="num">{formatRatio(score.collateralRatioBps)}</span> to{' '}
            <span className="num text-ink-900">
              {formatRatio(TIER_COLLATERAL_RATIO_BPS[nextTier])}
            </span>
            .
          </p>
        )}

        {levers.length === 0 ? (
          <p className="mt-4 text-body text-ink-500">
            Every component is already at its maximum.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {levers.map((lever) => {
              const { Icon, tone, label } = MARK[lever.certainty];
              return (
                <li key={lever.key} className="flex gap-3">
                  <Icon size={17} strokeWidth={2} className={`mt-0.5 shrink-0 ${tone}`} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-body font-medium text-ink-900">
                      {lever.title}
                      {/* Tingkat kepastian ikut ditulis, bukan disembunyikan.
                          Menaruh "+25 poin dari satu protokol lagi" dan
                          "+25 poin dari $12k pelunasan lagi" dengan bobot yang
                          sama membuat keduanya terbaca sama bisa ditepati —
                          padahal yang pertama aritmetika dan yang kedua
                          bergantung pada aktivitas mainnet yang belum terjadi. */}
                      <Badge tone={lever.certainty === 'exact' ? 'verified' : 'neutral'}>
                        {label}
                      </Badge>
                    </p>
                    <p className="mt-1 text-small leading-relaxed text-ink-500">{lever.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {saturated.length > 0 && (
          // Disebut sekali, di bawah, sebagai catatan — bukan sebagai saran.
          // Komponen ini masih punya sisa poin di atas kertas, tapi masukannya
          // sudah di ekor kurva: menaruhnya sejajar dengan tuas yang nyata
          // membuat keduanya terbaca sama layak dikejar.
          <p className="mt-5 border-t border-border pt-4 text-small text-ink-500">
            {saturated.map((k) => LABEL[k]).join(' and ')}{' '}
            {saturated.length === 1 ? 'is' : 'are'} deep into saturation. The remaining points
            there cost far more input than they are worth. The lever is elsewhere.
          </p>
        )}

        {/* Ini satu-satunya tempat di frontend yang menyalin rumus kontrak,
            dan menyebutkannya adalah bagian dari klaim produk: yang dihitung
            di sini bukan skornya, melainkan masukan yang dibutuhkan untuk poin
            berikutnya — pertanyaan yang tidak dijawab kontrak sama sekali. */}
        <p className="mt-6 text-micro leading-relaxed text-ink-400">
          Point targets are derived from the same constants CreditGraph uses on-chain. The score
          itself always comes from the contract; nothing here is estimated on top of it.
        </p>
      </CardBody>
    </Card>
  );
}
