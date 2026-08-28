import { cn } from '@/lib/utils';

/** Placeholder saat memuat. TIDAK PERNAH berisi angka contoh — kalau data belum
 *  ada, yang benar adalah menampilkan ketiadaan, bukan angka yang masuk akal. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[var(--radius-sm)] bg-border', className)} />;
}
