import type { Address, Hex } from '@/types';
import type { FactsQuery } from './endpoints';

/**
 * Prefix 'api' memisahkan namespace kita dari key internal wagmi
 * (`['readContract', ...]`) di QueryClient yang sama — satu client, dua
 * penghuni, tanpa risiko tabrakan key.
 */
export const queryKeys = {
  health: () => ['api', 'health'] as const,
  chains: () => ['api', 'chains'] as const,
  indexerStatus: () => ['api', 'indexer-status'] as const,
  facts: (q: FactsQuery) => ['api', 'facts', q] as const,
  fact: (factId: Hex) => ['api', 'fact', factId] as const,
  score: (address: Address | undefined) => ['api', 'score', address] as const,
  // Sengaja TANPA rentang. Satu alamat = satu permintaan, dan pemilih
  // 30d/90d/1y disaring di klien — lihat komentar di useScoreHistory.
  scoreHistory: (address: Address | undefined) => ['api', 'score-history', address] as const,
  marketSummary: () => ['api', 'market-summary'] as const,
  marketReserves: () => ['api', 'market-reserves'] as const,
  positions: (address: Address | undefined) => ['api', 'positions', address] as const,
  prices: () => ['api', 'prices'] as const,
  backfillJob: (jobId: string | null) => ['api', 'backfill', jobId] as const,
  proveJob: (jobId: string | null) => ['api', 'prove', jobId] as const,
  backfillBySubject: (address: Address | undefined) =>
    ['api', 'backfill-subject', address] as const,
};
