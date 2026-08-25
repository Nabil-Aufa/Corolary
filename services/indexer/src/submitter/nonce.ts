import { sql } from '../db/client.js';
import { creditcoin, submitter } from '../chain/providers.js';

/**
 * Nonce dikelola eksplisit di aplikasi, bukan dari getTransactionCount('pending')
 * tiap panggilan: nilai 'pending' bisa tidak konsisten antar node di balik load
 * balancer, dan submitter adalah satu-satunya penulis dari kunci ini.
 */
export async function reconcileNonce(): Promise<number> {
  const onChain = await creditcoin.getTransactionCount(submitter.address, 'latest');
  const rows = await sql<{ next_nonce: string }[]>`
    SELECT next_nonce FROM submitter_state WHERE id = 1
  `;
  const stored = rows[0] ? Number(rows[0].next_nonce) : 0;

  // Ambil yang LEBIH BESAR. On-chain 'latest' adalah batas bawah yang pasti
  // benar; nilai tersimpan melindungi dari mundur ke nonce yang sudah terpakai
  // kalau ada tx yang belum ter-mine.
  const next = Math.max(onChain, stored);

  await sql`
    INSERT INTO submitter_state ${sql({ id: 1, next_nonce: next })}
    ON CONFLICT (id) DO UPDATE SET next_nonce = ${next}
  `;
  return next;
}

/** Klaim atomik dalam satu statement — tidak ada dua pemanggil yang dapat nonce sama. */
export async function claimNextNonce(): Promise<number> {
  const rows = await sql<{ claimed: string }[]>`
    UPDATE submitter_state
    SET next_nonce = next_nonce + 1
    WHERE id = 1
    RETURNING next_nonce - 1 AS claimed
  `;
  const row = rows[0];
  if (!row) throw new Error('submitter_state kosong — panggil reconcileNonce() saat start');
  return Number(row.claimed);
}

/** Dipakai setelah tx ditolak sebelum masuk mempool, supaya tidak ada nonce bolong. */
export async function releaseNonce(nonce: number): Promise<void> {
  await sql`
    UPDATE submitter_state SET next_nonce = ${nonce}
    WHERE id = 1 AND next_nonce = ${nonce + 1}
  `;
}
