import { BASELINE_COLLATERAL_RATIO_BPS } from '@corolary/shared';
import { Card, CardBody } from '@/components/ui/card';
import { formatRatio, formatUsd } from '@/lib/format';

const EXAMPLE_BORROW_USD = 10_000n;

/**
 * Menerjemahkan rasio kolateral menjadi kalimat yang berarti: berapa dolar
 * modal yang TIDAK perlu dikunci.
 *
 * `$10.000` di sini adalah masukan contoh yang dinyatakan terbuka, bukan data
 * karangan — aritmetikanya berjalan di atas `collateralRatioBps` sungguhan
 * milik alamat ini. Yang dilarang aturan nol-mock adalah angka yang MENGAKU
 * berasal dari chain padahal tidak; kalkulator yang menyebut asumsinya sendiri
 * adalah hal yang berbeda.
 */
export function CollateralSavingsCallout({
  collateralRatioBps,
  capitalSavedUsd,
}: {
  collateralRatioBps: number;
  capitalSavedUsd?: string;
}) {
  const yours = (EXAMPLE_BORROW_USD * BigInt(collateralRatioBps)) / 10_000n;
  const baseline = (EXAMPLE_BORROW_USD * BigInt(BASELINE_COLLATERAL_RATIO_BPS)) / 10_000n;
  const saved = baseline - yours;
  const hasRealSavings = capitalSavedUsd !== undefined && capitalSavedUsd !== '0.00';

  return (
    <Card>
      <CardBody>
        <p className="text-micro uppercase tracking-wide text-ink-400">Collateral efficiency</p>

        <p className="num mt-2 text-display font-semibold leading-none text-ink-900">
          {formatRatio(collateralRatioBps)}
          <span className="text-h2 font-normal text-ink-400">
            {' '}
            vs {formatRatio(BASELINE_COLLATERAL_RATIO_BPS)}
          </span>
        </p>

        {hasRealSavings ? (
          <p className="mt-4 text-body text-ink-500">
            Your proven history is currently freeing{' '}
            <span className="num text-ink-900">{formatUsd(capitalSavedUsd)}</span> of capital that
            would otherwise be locked.
          </p>
        ) : (
          <div className="mt-4 text-body text-ink-500">
            <p className="text-micro uppercase tracking-wide text-ink-400">
              Example · borrowing $10,000
            </p>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between gap-4">
                <dt>You would lock</dt>
                <dd className="num text-ink-900">{formatUsd(`${yours}.00`)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>An unproven wallet locks</dt>
                <dd className="num text-ink-500">{formatUsd(`${baseline}.00`)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-1">
                <dt className="text-ink-900">Capital you keep</dt>
                <dd className="num text-verified">{formatUsd(`${saved}.00`)}</dd>
              </div>
            </dl>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
