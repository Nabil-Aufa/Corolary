'use client';

import { Activity, Gauge } from 'lucide-react';
import { useIndexerStatus } from '@/hooks/useApi';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Reveal } from './Reveal';
import { SectionIntro } from './SectionIntro';
import { GradientArt } from './GradientArt';

/** Kartu tipe A: satu angka besar yang bergerak, dibaca langsung dari API. */
function StatCard({
  value,
  label,
  isPending,
  isError,
  tint,
  className,
}: {
  value: number | undefined;
  label: string;
  isPending: boolean;
  isError: boolean;
  tint: 'a' | 'b';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] p-8',
        tint === 'a' ? 'bg-tint-a' : 'bg-tint-b',
        className,
      )}
    >
      {isPending ? (
        <Skeleton className="h-12 w-32" />
      ) : (
        <p className="num font-display text-mkt-stat font-medium text-ink-900">
          {isError || value === undefined ? '–' : formatCount(value)}
        </p>
      )}
      <p className="mt-3 text-micro uppercase tracking-[0.12em] text-ink-500">{label}</p>
    </div>
  );
}

/**
 * Mosaik statistik hidup.
 *
 * `refetchInterval` di `useIndexerStatus` (15 detik) sudah membuat angka-angka
 * ini bergerak sendiri saat halaman terbuka lama — komponen ini hanya perlu
 * merender ulang apa yang datang, tanpa polling tambahan sendiri.
 */
export function StatMosaic() {
  const { data, isPending, isError } = useIndexerStatus();

  const marketFrozen = data?.marketFrozen;
  const marketKnown = !isPending && !isError && marketFrozen !== undefined;

  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-24 md:px-8 md:pb-32">
      <SectionIntro label="ANGKA HIDUP">
        Setiap angka di bawah dibaca langsung dari API produksi dan bergerak
        sendiri — tidak ada yang ditulis tangan.
      </SectionIntro>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
        <Reveal delay={0} className="md:col-span-2">
          <StatCard
            value={data?.totalFacts}
            label="Fakta terbukti permanen"
            isPending={isPending}
            isError={isError}
            tint="a"
          />
        </Reveal>

        <Reveal delay={0.06} className="md:col-span-2">
          <StatCard
            value={data?.distinctSubjects}
            label="Dompet ter-skor"
            isPending={isPending}
            isError={isError}
            tint="b"
          />
        </Reveal>

        <Reveal delay={0.12} className="md:col-span-2">
          <StatCard
            value={data?.latestEthereumBlock}
            label="Blok mainnet terpindai"
            isPending={isPending}
            isError={isError}
            tint="a"
          />
        </Reveal>

        <Reveal delay={0.18} className="md:col-span-3">
          <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-tint-b p-8">
            <GradientArt variant="arcs" className="absolute inset-0 opacity-60" />
            <div className="relative flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-ink-500" aria-hidden="true" />
                {marketKnown && (
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      marketFrozen ? 'bg-warning' : 'bg-verified',
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="text-mkt-statement font-display text-ink-900">
                {!marketKnown
                  ? 'Status pasar sedang tidak bisa dipastikan.'
                  : marketFrozen
                    ? 'Pasar sedang beku — harga terakhir sudah kedaluwarsa.'
                    : 'Pasar hidup: harga kolateral masih segar dan diperiksa on-chain.'}
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.24} className="md:col-span-3">
          <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-tint-a p-8">
            <GradientArt variant="chevron" className="absolute inset-0 opacity-60" />
            <div className="relative flex flex-col gap-3">
              <Activity className="h-5 w-5 text-ink-500" aria-hidden="true" />
              <p className="text-mkt-statement font-display text-ink-900">
                {isPending || isError || data === undefined
                  ? 'Jumlah fakta yang tercatat dalam 24 jam terakhir sedang tidak bisa diambil.'
                  : (
                    <>
                      <span className="num">{formatCount(data.queue.recorded24h)}</span> fakta
                      tercatat dalam 24 jam terakhir.
                    </>
                  )}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
