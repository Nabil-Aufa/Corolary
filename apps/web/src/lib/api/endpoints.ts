import { apiFetch, apiFetchWithMeta, toQuery, type ApiResult } from './client';
import type {
  AccountPositions,
  Address,
  BackfillJob,
  BackfillJobAccepted,
  ChainStatus,
  CreditScore,
  Fact,
  FactWithProof,
  HealthStatus,
  Hex,
  IndexerStatus,
  MarketSummary,
  PriceEntry,
  Reserve,
  ScoreHistoryPoint,
} from '@/types';

export interface FactsQuery {
  subject?: Address | string;
  kind?: number;
  protocol?: Address | string;
  cursor?: string;
  limit?: number;
}

/** Satu fungsi per baris di docs/api.md §0.10. */
export const endpoints = {
  health: () => apiFetch<HealthStatus>('/health'),
  chains: () => apiFetch<ChainStatus[]>('/chains'),
  indexerStatus: () => apiFetch<IndexerStatus>('/indexer/status'),

  // Satu-satunya endpoint berpaginasi — pemanggilnya butuh `meta.cursor`,
  // jadi metanya sengaja tidak dibuang seperti di endpoint lain.
  facts: (q: FactsQuery = {}): Promise<ApiResult<Fact[]>> =>
    apiFetchWithMeta<Fact[]>(`/facts${toQuery({ ...q })}`),
  fact: (factId: Hex) => apiFetch<FactWithProof>(`/facts/${factId}`),

  score: (address: Address) => apiFetch<CreditScore>(`/score/${address}`),
  scoreHistory: (address: Address, q: { from?: number; to?: number; limit?: number } = {}) =>
    apiFetch<ScoreHistoryPoint[]>(`/score/${address}/history${toQuery({ ...q })}`),

  marketSummary: () => apiFetch<MarketSummary>('/market/summary'),
  marketReserves: () => apiFetch<Reserve[]>('/market/reserves'),
  marketPositions: (address: Address) =>
    apiFetch<AccountPositions>(`/market/positions/${address}`),

  prices: () => apiFetch<PriceEntry[]>('/prices'),

  startBackfill: (address: Address, months?: number) =>
    apiFetch<BackfillJobAccepted>('/backfill', {
      method: 'POST',
      body: JSON.stringify(months === undefined ? { address } : { address, months }),
    }),
  backfillJob: (jobId: string) => apiFetch<BackfillJob>(`/backfill/${jobId}`),
};
