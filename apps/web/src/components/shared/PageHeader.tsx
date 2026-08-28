import type { ReactNode } from 'react';

/**
 * Judul besar rata kiri + satu baris penjelas, dengan satu slot statistik di
 * kanan. Pola ini diambil dari Morpho: yang menahan perhatian adalah datanya,
 * bukan hero yang di-center dan menghabiskan satu layar penuh.
 */
export function PageHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 pb-8">
      <div>
        <h1 className="text-h1 font-semibold tracking-tight text-ink-900">{title}</h1>
        {description !== undefined && (
          <p className="mt-2 max-w-2xl text-body text-ink-500">{description}</p>
        )}
      </div>
      {aside}
    </div>
  );
}
