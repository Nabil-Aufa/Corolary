import { Skeleton } from '@/components/ui/skeleton';

/**
 * Satu angka dan namanya, dalam satu baris.
 *
 * Angkanya lebih dulu karena itu yang dicari mata; labelnya mengikuti sebagai
 * keterangan. Pemisahnya jarak, bukan tanda baca — titik tengah menambah satu
 * simbol yang harus dibaca tanpa menambah arti.
 */
export function StatPill({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string | null;
  isLoading?: boolean;
}) {
  return (
    <div className="inline-flex items-baseline gap-2.5 rounded-[var(--radius-base)] border border-border bg-surface px-4 py-2">
      {isLoading === true ? (
        <Skeleton className="h-4 w-16" />
      ) : (
        // `—` saat data gagal diambil. TIDAK PERNAH angka terakhir yang masih
        // diingat, dan tidak pernah nilai contoh — aturan nol-mock berlaku
        // paling ketat justru di angka ringkasan seperti ini.
        <span className="num text-body font-semibold text-ink-900">{value ?? '—'}</span>
      )}
      <span className="whitespace-nowrap text-small text-ink-500">{label}</span>
    </div>
  );
}
