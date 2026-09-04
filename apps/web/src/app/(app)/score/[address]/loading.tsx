import { Skeleton } from '@/components/ui/skeleton';

/**
 * Halaman skor punya skeleton-nya sendiri karena bentuknya paling berbeda dari
 * yang lain — dial bundar di kiri, kartu rasio di kanan — dan karena bundelnya
 * paling berat: ia satu-satunya route yang menarik Recharts. Justru di sinilah
 * jendela "route sedang dimuat" paling terasa, dan paling pantas ditutup dengan
 * bentuk yang benar.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-12 md:px-8">
      <div className="flex flex-wrap items-center gap-3 pb-8">
        <Skeleton className="h-7 w-[26rem] max-w-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Skeleton className="h-[248px] w-[248px] rounded-full" />
        <Skeleton className="h-[248px]" />
      </div>
    </div>
  );
}
