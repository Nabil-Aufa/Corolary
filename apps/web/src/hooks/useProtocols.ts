'use client';

import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';
import type { Address } from '@/types';

export interface ProtocolOption {
  address: Address;
  name: string;
}

/**
 * Daftar protokol yang benar-benar diawasi indexer, untuk mengisi dropdown filter.
 *
 * Sumbernya `cursors[]` di /v1/indexer/status — bukan konstanta di frontend.
 * Kalau Dev A menambah protokol kelima, filternya ikut tanpa aku menyentuh
 * apa pun; dan kalau satu protokol dicabut, ia hilang dari filter alih-alih
 * menawarkan pilihan yang selalu mengembalikan nol hasil.
 */
export function useProtocols() {
  return useQuery({
    queryKey: queryKeys.indexerStatus(),
    queryFn: endpoints.indexerStatus,
    staleTime: 300_000,
    select: (status): ProtocolOption[] =>
      status.cursors.map((c) => ({ address: c.protocol, name: c.protocolName })),
  });
}
