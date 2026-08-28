'use client';

import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useIsMounted } from '@/hooks/useIsMounted';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

/** Tiga pilihan tema berdampingan; yang aktif ditandai kotak, bukan warna. */
export function ThemeSegments() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();

  return (
    <div className="flex items-center gap-0.5">
      {OPTIONS.map(({ value, label, Icon }) => {
        // Sebelum hydration tema aktif belum diketahui; menandai salah satu
        // lebih dulu berarti menebak, dan tebakan yang salah akan berkedip.
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-label={`${label} theme`}
            aria-pressed={active}
            className={cn(
              'rounded-[var(--radius-sm)] border p-1.5 transition-colors',
              active
                ? 'border-border-strong bg-bg text-ink-900'
                : 'border-transparent text-ink-400 hover:text-ink-700',
            )}
          >
            <Icon size={15} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
