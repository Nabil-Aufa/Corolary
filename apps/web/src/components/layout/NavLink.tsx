'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { cn } from '@/lib/utils';

export function NavLink({ href, label }: { href: Route; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      // Halaman aktif ditandai WARNA dan BERAT saja, tanpa blok latar.
      // Blok berwarna menambah satu permukaan lagi ke header yang seharusnya
      // rata; warna teks sudah cukup untuk menjawab "saya di mana".
      className={cn(
        'whitespace-nowrap rounded-[var(--radius-base)] px-3 py-1.5 text-small transition-colors',
        isActive ? 'font-semibold text-accent' : 'font-medium text-ink-500 hover:text-ink-900',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {label}
    </Link>
  );
}
