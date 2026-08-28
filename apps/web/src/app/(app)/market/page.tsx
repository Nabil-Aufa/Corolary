'use client';

import { useAccount } from 'wagmi';
import { CollateralSavingsCallout } from '@/components/market/CollateralSavingsCallout';
import { HealthFactorBar } from '@/components/market/HealthFactorBar';
import { PositionTable } from '@/components/market/PositionTable';
import { ReserveTable } from '@/components/market/ReserveTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatPill } from '@/components/shared/StatPill';
import { Card, CardBody } from '@/components/ui/card';
import { useMarketReserves, useMarketSummary, usePositions } from '@/hooks/useApi';
import { formatBps, formatUsd } from '@/lib/format';

export default function MarketPage() {
  const { address } = useAccount();
  const summary = useMarketSummary();
  const reserves = useMarketReserves();
  const positions = usePositions(address);

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-12 md:px-8">
      <PageHeader
        title="Market"
        description="Borrow against collateral, priced by a score that is derived entirely from proven history."
        aside={
          <div className="flex gap-3">
            <StatPill
              label="Total supplied"
              value={summary.data ? formatUsd(summary.data.totalSuppliedUsd) : null}
              isLoading={summary.isPending}
            />
            <StatPill
              label="Utilization"
              value={summary.data ? formatBps(summary.data.utilizationBps, 1) : null}
              isLoading={summary.isPending}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {reserves.isError ? (
            <ErrorState error={reserves.error} onRetry={() => void reserves.refetch()} />
          ) : (
            <ReserveTable reserves={reserves.data ?? []} isLoading={reserves.isPending} />
          )}

          {reserves.data?.every((r) => r.totalSupplied === '0') === true && (
            <p className="mt-3 text-small text-ink-500">
              {/* Kolam kosong dinyatakan apa adanya. Menyembunyikannya di balik
                  angka contoh akan melanggar satu-satunya hal yang dijual
                  produk ini. */}
              No liquidity has been supplied to this market yet, so rates are zero. Supply an asset
              to start the pool.
            </p>
          )}
        </div>

        <div className="space-y-6">
          {positions.data ? (
            <CollateralSavingsCallout
              collateralRatioBps={positions.data.collateralRatioBps}
              capitalSavedUsd={positions.data.capitalSavedUsd}
            />
          ) : (
            <Card>
              <CardBody>
                <p className="text-micro uppercase tracking-wide text-ink-400">
                  Collateral efficiency
                </p>
                <p className="mt-2 text-body text-ink-500">
                  Connect a wallet to see the collateral ratio your proven history unlocks.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <h2 className="mt-12 pb-4 text-h2 font-semibold tracking-tight text-ink-900">Your position</h2>

      {address === undefined ? (
        <EmptyState
          title="No wallet connected"
          description="Connect a wallet to see your supplied assets, debt, and health factor."
        />
      ) : positions.isError ? (
        <ErrorState error={positions.error} onRetry={() => void positions.refetch()} />
      ) : positions.data && positions.data.positions.length > 0 ? (
        <>
          <div className="pb-4">
            <HealthFactorBar healthFactorBps={positions.data.healthFactorBps} />
          </div>
          <PositionTable positions={positions.data.positions} />
        </>
      ) : (
        <EmptyState
          title="No active position"
          description="Supply an asset to begin. Your collateral ratio is already set by your proven score."
        />
      )}
    </main>
  );
}
