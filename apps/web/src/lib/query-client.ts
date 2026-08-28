import { QueryClient } from '@tanstack/react-query';

/**
 * Satu QueryClient dipakai bersama wagmi dan lapisan data API.
 * Namespace dipisah lewat prefix key (`['api', ...]` milik kita), bukan lewat
 * dua client terpisah — docs/frontend.md §7.3.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data fakta/skor bergerak dalam hitungan menit, bukan detik.
        // Refetch tiap fokus jendela hanya menambah beban tanpa menambah
        // kebenaran, dan bikin angka "berkedip" saat demo direkam.
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        retry: 2,
      },
    },
  });
}
