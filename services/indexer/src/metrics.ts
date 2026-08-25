import { sql } from './db/client.js';
import { ETH_CHAIN_KEY } from './chain/providers.js';

export interface IndexerStatus {
  oldestUnprovenAgeSeconds: number;
  queue: Record<string, number>;
  cursorLagBlocks: Record<string, number>;
}

/**
 * Metrik tunggal paling penting di seluruh sistem.
 *
 * Proof < 24 jam ~12x lebih murah. Backlog internal — bukan lag attestation
 * (~8 menit, cuma 0,5% dari anggaran) — adalah satu-satunya hal yang bisa
 * mendorong event melewati batas itu. Event backfill dikecualikan: umurnya
 * memang selalu > 24 jam by design, dan memasukkannya membuat alert selalu
 * menyala sehingga berhenti dibaca.
 */
export async function oldestUnprovenAgeSeconds(): Promise<number> {
  const rows = await sql<{ oldest: string | null }[]>`
    SELECT min(observed_at) AS oldest
    FROM observed_events
    WHERE chain_key = ${ETH_CHAIN_KEY}
      AND backfill = false
      AND status NOT IN ('recorded', 'skipped', 'failed')
  `;
  const oldest = rows[0]?.oldest;
  if (!oldest) return 0;
  return Math.max(0, Math.floor(Date.now() / 1000) - Number(oldest));
}

export async function queueSizes(): Promise<Record<string, number>> {
  const rows = await sql<{ status: string; n: string }[]>`
    SELECT status, count(*) AS n FROM observed_events
    WHERE chain_key = ${ETH_CHAIN_KEY}
    GROUP BY status
  `;
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

export const WARN_AGE_SECONDS = 12 * 3600;
export const CRITICAL_AGE_SECONDS = 20 * 3600;
export const LATE_AGE_SECONDS = 24 * 3600;
