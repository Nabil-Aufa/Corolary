import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  action,
  bordered = true,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * Kotak bergaris putus-putus. Dimatikan ketika keadaan kosong ini sudah
   * diapit kartu lain — dua bingkai untuk satu pesan terasa lebih ramai
   * daripada halaman yang benar-benar berisi.
   */
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 text-center',
        bordered ? 'rounded-[var(--radius-lg)] border border-dashed border-border py-16' : 'py-10',
      )}
    >
      <p className="text-h3 font-medium text-ink-900">{title}</p>
      {description !== undefined && (
        <p className="max-w-md text-small text-ink-500">{description}</p>
      )}
      {action}
    </div>
  );
}
