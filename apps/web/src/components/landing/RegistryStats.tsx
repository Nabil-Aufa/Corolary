'use client';

import { Activity, Blocks, Layers, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Reveal } from '@/components/marketing/Reveal';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useIndexerStatus, usePrices } from '@/hooks/useApi';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Metric {
  icon: LucideIcon;
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
    {
      icon: ShieldCheck,
      value: status.data ? formatCount(status.data.totalFacts) : null,
      label: 'Proven facts recorded',
    },
    {
      icon: Wallet,
      value: status.data ? formatCount(status.data.distinctSubjects) : null,
      label: 'Wallets with a proven history',
    },
    {
      icon: Activity,
      value: status.data ? formatCount(status.data.queue.recorded24h) : null,
      label: 'Facts recorded in 24 hours',
    },
    {
      icon: Blocks,
      value: status.data ? formatCount(status.data.latestEthereumBlock) : null,
      label: 'Latest mainnet block scanned',
    },
    {
      icon: Layers,
      value: status.data ? formatCount(status.data.cursors.length) : null,
      label: 'Lending protocols indexed',
    },
    ...(prices.isError
      ? []
      : [
          {
            icon: TrendingUp,
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
        <div className="mt-[clamp(40px,5vw,72px)] grid grid-cols-1 gap-[clamp(12px,1.2vw,20px)] sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.05}>
              <StatCard metric={m} tint={i % 2 === 0 ? 'mint' : 'lavender'} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Kartu bento: ikon di atas, angka dan keterangannya menempel ke DASAR kartu.
 *
 * Yang menahannya di dasar `mt-auto`, bukan `justify-between`, dan bedanya
 * kelihatan justru saat datanya belum datang: dengan `justify-between` kartu
 * yang isinya kerangka muat tidak akan setinggi kartu yang isinya angka, jadi
 * kisinya bergoyang begitu angka pertama mendarat. Tinggi minimumnya yang
 * memastikan keenam kartu sudah punya bentuk akhirnya sebelum itu.
 */
function StatCard({ metric, tint }: { metric: Metric; tint: 'mint' | 'lavender' }) {
  const Icon = metric.icon;

  return (
    <div
      className={cn(
        'flex h-full min-h-[clamp(160px,15vw,240px)] flex-col rounded-card p-[clamp(22px,2vw,36px)]',
        // Kedua warna ini sudah ada di tokens dan punya pasangan gelapnya, jadi
        // kartunya ikut membalik bersama halaman. Menuliskan hex pucat di sini
        // akan jadi dua bidang terang di atas halaman gelap.
        tint === 'mint' ? 'bg-verified-soft' : 'bg-accent-soft',
      )}
    >
      <Icon aria-hidden="true" className="size-7 shrink-0 stroke-[1.5] text-ink-900" />

      <div className="mt-auto pt-8">
        {metric.value === null ? (
          <>
            <Skeleton className="h-[clamp(34px,3.1vw,64px)] w-40" />
            <Skeleton className="mt-3 h-3 w-32" />
          </>
        ) : (
          <>
            {/* Ukurannya dibatasi oleh nilai TERPANJANG, bukan oleh selera.
                Nomor blok mainnet sepuluh karakter, dan pada font ini satu
                karakter tabular selebar 0,53em — terukur, bukan ditaksir.
                Jebakannya ada di lebar 1440px: `.mkt-container` melompat dari
                padding 120px ke 240px di sana, jadi kartunya MENYUSUT persis
                saat fontnya masih membesar. Pada 3,4vw angkanya 261px di dalam
                kartu selebar 239px — meluber tanpa ada yang error, dan hanya
                di dua rentang lebar itu.
                Membesarkan angka karena itu menuntut ruang mendatarnya
                ditambah dulu: padding kartu yang dikurangi, bukan cuma
                fontnya yang dinaikkan. */}
            <p className="num font-display text-[clamp(34px,3.1vw,64px)] font-medium leading-[1.05] text-ink-900">
              {metric.value}
            </p>
            <p className="mt-3 text-micro font-medium uppercase tracking-[0.12em] text-ink-500">
              {metric.label}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
