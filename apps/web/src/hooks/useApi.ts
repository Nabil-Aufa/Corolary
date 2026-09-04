'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints, type FactsQuery } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';
import { isRetryable } from '@/lib/api/errors';
import type { Address, Hex, ScoreRange } from '@/types';

/** Kesalahan permanen tidak di-retry — mengulanginya hanya menunda pesan error. */
const retry = (count: number, error: unknown) => count < 2 && isRetryable(error);

export function useIndexerStatus() {
  return useQuery({
    queryKey: queryKeys.indexerStatus(),
    queryFn: endpoints.indexerStatus,
    // Statistik "hidup" di landing harus benar-benar terasa hidup.
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry,
  });
}

export function useChains() {
  return useQuery({ queryKey: queryKeys.chains(), queryFn: endpoints.chains, staleTime: 30_000, retry });
}

export function useScore(address: Address | undefined) {
  return useQuery({
    queryKey: queryKeys.score(address),
    queryFn: () => endpoints.score(address as Address),
    enabled: address !== undefined,
    staleTime: 30_000,
    retry,
  });
}

export function useScoreHistory(address: Address | undefined, range: ScoreRange) {
  return useQuery({
    queryKey: queryKeys.scoreHistory(address, range),
    queryFn: () => endpoints.scoreHistory(address as Address, rangeToParams(range)),
    enabled: address !== undefined,
    staleTime: 60_000,
    retry,
  });
}

function rangeToParams(range: ScoreRange): { from?: number } {
  if (range === 'all') return {};
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
  return { from: Math.floor(Date.now() / 1000) - days * 86_400 };
}

export function useFact(factId: Hex | undefined) {
  return useQuery({
    queryKey: queryKeys.fact(factId as Hex),
    queryFn: () => endpoints.fact(factId as Hex),
    enabled: factId !== undefined,
    // Fakta yang sudah tercatat permanen tidak akan pernah berubah.
    staleTime: Infinity,
    retry,
  });
}

export function useFacts(query: FactsQuery = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.facts(query),
    queryFn: ({ pageParam }) =>
      endpoints.facts(pageParam === undefined ? query : { ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    // Cursor absen berarti sudah di ujung koleksi (docs/api.md §0.6).
    getNextPageParam: (last) => last.meta?.cursor,
    staleTime: 15_000,
    retry,
  });
}

export function useMarketSummary() {
  return useQuery({
    queryKey: queryKeys.marketSummary(),
    queryFn: endpoints.marketSummary,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry,
  });
}

export function useMarketReserves() {
  return useQuery({
    queryKey: queryKeys.marketReserves(),
    queryFn: endpoints.marketReserves,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry,
  });
}

export function usePositions(address: Address | undefined) {
  return useQuery({
    queryKey: queryKeys.positions(address),
    queryFn: () => endpoints.marketPositions(address as Address),
    enabled: address !== undefined,
    staleTime: 10_000,
    retry,
  });
}

export function usePrices() {
  return useQuery({
    queryKey: queryKeys.prices(),
    queryFn: endpoints.prices,
    staleTime: 15_000,
    refetchInterval: 20_000,
    retry,
  });
}

/**
 * Status pemindaian riwayat untuk sebuah alamat, di-poll selagi berjalan.
 *
 * Ditanyakan per SUBJEK, bukan per `jobId`. `jobId` cuma ada di browser yang
 * memulai pemindaian; alamat yang sama dibuka dari tab lain akan melihat
 * tombol Scan biasa dan mengantre pemindaian kedua di atas yang sedang jalan.
 */
export function useBackfillStatus(address: Address | undefined) {
  return useQuery({
    queryKey: queryKeys.backfillBySubject(address),
    queryFn: () => endpoints.backfillBySubject(address as Address),
    enabled: address !== undefined,
    // Job yang masih hidup ditanya tiap 10 detik; yang sudah selesai tidak
    // pernah berubah lagi, jadi polling-nya berhenti sendiri.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'pending' || status === 'running' ? 10_000 : false;
    },
    retry,
  });
}

export function useStartBackfill(address: Address | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (months: number) => endpoints.startBackfill(address as Address, months),
    onSuccess: (accepted) => {
      // Respons POST membawa kedalaman JOB-nya, yang bisa berbeda dari yang
      // diminta bila ada job lain yang sudah berjalan untuk subjek ini. Ditulis
      // apa adanya ke cache supaya UI tidak pernah menampilkan angka yang
      // diminta sebagai kalau itu yang sedang dikerjakan.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.backfillBySubject(address),
      });
      if (accepted.status === 'covered') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.score(address) });
      }
    },
  });
}

/**
 * Status satu job proving, di-poll selagi belum tuntas.
 *
 * Jauh lebih lambat daripada terasa: attestation Attestcoin sendiri butuh
 * ~8 menit, jadi polling per detik hanya membebani API untuk melihat status
 * yang sama berulang kali.
 */
export function useProveJob(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.proveJob(jobId),
    queryFn: () => endpoints.proveJob(jobId as string),
    enabled: jobId !== null,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === undefined) return 10_000;
      return status === 'recorded' || status === 'failed' || status === 'skipped' ? false : 10_000;
    },
    retry,
  });
}

export function useStartProve() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (txHash: Hex) => endpoints.startProve(txHash),
    onSuccess: () => {
      // Fakta baru muncul di daftar mana pun yang sedang terbuka begitu
      // job-nya tuntas; membatalkan di sini menangkap kasus `recorded`
      // seketika — transaksi yang ternyata sudah lama jadi fakta.
      void queryClient.invalidateQueries({ queryKey: ['api', 'facts'] });
    },
  });
}
