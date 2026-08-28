'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { WagmiProvider } from 'wagmi';
import { makeQueryClient } from '@/lib/query-client';
import { wagmiConfig } from '@/lib/wagmi';

export function Providers({ children }: { children: ReactNode }) {
  // useState, bukan modul-level: satu QueryClient per klien, dan di server
  // setiap request dapat cache-nya sendiri. Client modul-level akan membocorkan
  // data satu pengunjung ke pengunjung lain saat SSR.
  const [queryClient] = useState(makeQueryClient);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
