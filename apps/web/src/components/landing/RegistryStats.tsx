'use client';

import { Reveal } from '@/components/marketing/Reveal';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useIndexerStatus, usePrices } from '@/hooks/useApi';
import { formatCount } from '@/lib/format';

interface Metric {
  value: string | null;
  label: string;
}

/**
 * Angka-angka proyek ini, dan SEMUANYA hidup.
 *
 * Menggantikan dua bagian sekaligus: "The registry, right now" yang lama dan
 * "Anatomy of a score". Yang kedua mengulang layar pertama — `Preview` sudah
 * memajang skor, tier, rasio kolateral, dan modal yang dibebaskan untuk dompet
 * yang sama, lengkap dengan tautan ke rincian per komponennya.
 *
 * ── Yang sengaja TIDAK ada di sini ──
 *
 * Empat dari enam angka versi lama adalah metrik OPERASIONAL: blok tertinggal,
 * umur event terlama yang belum dibuktikan, antrean gagal. Pembaca landing
 * tidak punya cara menilai apakah "0 blok tertinggal" itu bagus, dan jumlah
 * kegagalan permanen tanpa konteks justru menimbulkan keraguan. Angka-angka itu
 * milik dashboard operasional, bukan halaman depan.
 *
 * TVL pasar juga tidak ada, dan itu keputusan yang paling disengaja. Nilainya
 * empat digit sementara sisi registry sudah lima digit; menaruh keduanya
 * berdampingan menarik perhatian tepat ke angka yang paling lemah. Rasio
 * kolateral rata-rata dibuang karena alasan yang sama — ia rata-rata atas pasar
 * yang nyaris kosong, jadi angkanya benar tapi tidak mewakili apa pun.
 */
export function RegistryStats() {
  const status = useIndexerStatus();
  const prices = usePrices();

  // Hanya status yang menggugurkan seluruh bagian. Harga cuma mengisi satu sel
  // dari enam, jadi kegagalannya tidak boleh menghapus lima angka yang sudah
  // ada — sel itu yang dilepas, bukan bagiannya.
  const metrics: Metric[] = [
    { value: status.data ? formatCount(status.data.totalFacts) : null, label: 'Proven facts recorded' },
    {
      value: status.data ? formatCount(status.data.distinctSubjects) : null,
      label: 'Wallets with a proven history',
    },
    {
      value: status.data ? formatCount(status.data.queue.recorded24h) : null,
      label: 'Facts recorded in the last 24 hours',
    },
    {
      value: status.data ? formatCount(status.data.latestEthereumBlock) : null,
      label: 'Latest mainnet block scanned',
    },
    {
      value: status.data ? formatCount(status.data.cursors.length) : null,
      label: 'Lending protocols indexed',
    },
    ...(prices.isError
      ? []
      : [
          {
            value: prices.data ? formatCount(prices.data.length) : null,
            label: 'Chainlink price feeds proven',
          },
        ]),
  ];

  return (
    <div className="mkt-container py-[clamp(80px,10vw,160px)]">
      <h2 className="font-display font-medium text-mkt-h2 text-ink-900">The registry, right now</h2>

      {status.isError ? (
        <div className="mt-10">
          <ErrorState error={status.error} onRetry={() => void status.refetch()} />
        </div>
      ) : (
        <div className="mt-10 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.05} className="flex flex-col gap-2 py-6">
              {m.value === null ? (
                <>
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-4 w-40" />
                </>
              ) : (
                <>
                  <span className="num font-display text-mkt-h3 text-ink-900">{m.value}</span>
                  <span className="text-small text-ink-500">{m.label}</span>
                </>
              )}
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
