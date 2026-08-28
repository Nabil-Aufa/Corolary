'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/hooks/useIsMounted';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Tema sebenarnya baru diketahui di klien. Merender ikon sebelum itu membuat
  // server dan klien menghasilkan markup berbeda, dan React akan mengeluh.
  const mounted = useIsMounted();

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {mounted ? (
        isDark ? (
          <Sun size={18} strokeWidth={1.5} />
        ) : (
          <Moon size={18} strokeWidth={1.5} />
        )
      ) : (
        <span className="h-[18px] w-[18px]" />
      )}
    </Button>
  );
}
