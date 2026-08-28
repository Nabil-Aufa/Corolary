import { isAddress } from 'viem';
import type { FactsQuery } from '@/lib/api/endpoints';
import type { Address } from '@/types';
import { FactKind } from '@/types';

/** State filter halaman /proofs. Sumber kebenarannya URL, bukan useState. */
export interface FactFilterState {
  subject?: Address;
  kind?: FactKind;
  protocol?: Address;
}

const VALID_KINDS: ReadonlySet<number> = new Set([
  FactKind.LoanOriginated,
  FactKind.LoanRepaid,
  FactKind.Liquidated,
  FactKind.CollateralSupplied,
  FactKind.CollateralWithdrawn,
]);

/**
 * Baca filter dari URL, buang yang tidak sah.
 *
 * Parameter URL bisa diketik siapa saja. Meneruskan `?kind=99` ke API hanya
 * menghasilkan INVALID_PARAM yang tampil sebagai error merah — padahal yang
 * benar adalah mengabaikannya dan menampilkan daftar apa adanya.
 */
export function parseFilters(params: URLSearchParams): FactFilterState {
  const out: FactFilterState = {};

  const subject = params.get('subject');
  if (subject !== null && isAddress(subject)) out.subject = subject;

  const kind = params.get('kind');
  if (kind !== null && kind !== '') {
    const n = Number(kind);
    if (Number.isInteger(n) && VALID_KINDS.has(n)) out.kind = n as FactKind;
  }

  const protocol = params.get('protocol');
  if (protocol !== null && isAddress(protocol)) out.protocol = protocol;

  return out;
}

/** Filter → query string kanonik. Kunci kosong dibuang, urutannya stabil. */
export function filtersToSearch(filters: FactFilterState): string {
  const params = new URLSearchParams();
  if (filters.subject !== undefined) params.set('subject', filters.subject);
  if (filters.kind !== undefined) params.set('kind', String(filters.kind));
  if (filters.protocol !== undefined) params.set('protocol', filters.protocol);
  const s = params.toString();
  return s === '' ? '' : `?${s}`;
}

/**
 * Filter → argumen useFacts.
 *
 * Kunci yang tidak dipakai DIHILANGKAN, bukan diisi `undefined` — dengan
 * `exactOptionalPropertyTypes` keduanya berbeda, dan `undefined` yang ikut
 * terkirim akan masuk ke query key sehingga cache-nya terpecah tanpa alasan.
 */
export function filtersToQuery(filters: FactFilterState, limit: number): FactsQuery {
  const q: FactsQuery = { limit };
  if (filters.subject !== undefined) q.subject = filters.subject;
  if (filters.kind !== undefined) q.kind = filters.kind;
  if (filters.protocol !== undefined) q.protocol = filters.protocol;
  return q;
}

export function hasAnyFilter(filters: FactFilterState): boolean {
  return (
    filters.subject !== undefined || filters.kind !== undefined || filters.protocol !== undefined
  );
}
