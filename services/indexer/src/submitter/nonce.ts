import { sql } from '../db/client.js';
import { creditcoin, submitter } from '../chain/providers.js';
import { stageLogger } from '../logger.js';

const log = stageLogger('submitter');

/**
 * Nonce dikelola eksplisit di aplikasi, bukan dari getTransactionCount('pending')
 * tiap panggilan: nilai 'pending' bisa tidak konsisten antar node di balik load
 * balancer, dan submitter adalah satu-satunya penulis dari kunci ini.
 */
export async function reconcileNonce(): Promise<number> {
  const [latest, pending] = await Promise.all([
    creditcoin.getTransactionCount(submitter.address, 'latest'),
    creditcoin.getTransactionCount(submitter.address, 'pending'),
  ]);
  const rows = await sql<{ next_nonce: string }[]>`
    SELECT next_nonce FROM submitter_state WHERE id = 1
  `;
  const stored = rows[0] ? Number(rows[0].next_nonce) : 0;

  // LUBANG NONCE: nonce diklaim tapi transaksinya tidak pernah tersiar.
  //
  // Terjadi kalau proses mati di antara `claimNextNonce()` dan `send` — dan itu
  // persis yang terjadi setiap kali indexer di-kill di tengah pengiriman.
  // Akibatnya fatal dan senyap: setiap transaksi berikutnya memakai nonce di
  // ATAS lubang, jadi tidak satu pun bisa masuk blok. Submitter tampak jalan,
  // batch tampak terkirim, dan tidak ada yang pernah tercatat.
  //
  // `max(onChain, stored)` sendirian TIDAK bisa menyembuhkannya — ia justru
  // mempertahankan lubangnya selamanya. Yang membedakan "ada tx menggantung di
  // mempool" dari "nonce hangus" adalah selisih pending vs latest: kalau
  // keduanya sama, tidak ada apa pun yang menggantung, sehingga nilai tersimpan
  // yang lebih tinggi hanya bisa berarti lubang.
  let next: number;
  if (pending === latest && stored > latest) {
    next = latest;
  } else {
    next = Math.max(pending, stored);
  }

  await sql`
    INSERT INTO submitter_state ${sql({ id: 1, next_nonce: next })}
    ON CONFLICT (id) DO UPDATE SET next_nonce = ${next}
  `;
  if (next !== stored) {
    // Dicatat eksplisit: menggeser nonce adalah tindakan yang harus terlihat di
    // log, bukan penyesuaian diam-diam.
    log.warn({ latest, pending, stored, next }, 'nonce direkonsiliasi');
  }
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
