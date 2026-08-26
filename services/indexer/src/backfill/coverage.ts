import { sql } from '../db/client.js';

/**
 * Mencatat sampai mana riwayat sebuah subjek benar-benar sudah dipindai.
 *
 * Dipanggil `backfillSubject`, jadi CLI dan job dari `POST /v1/backfill`
 * sama-sama menulisnya. Itu syaratnya: kalau hanya jalur job yang mencatat,
 * dedupe di API buta terhadap semua backfill CLI yang sudah dibayar.
 *
 * Pembacanya ada di `services/api/src/routes/backfill.ts`. Kalau bentuk baris
 * ini berubah, predikat di sana ikut berubah — dan kegagalannya senyap: dedupe
 * berhenti cocok, lalu tiap permintaan memindai ulang riwayat yang sudah utuh.
 */
export async function recordCoverage(row: {
  subject: string;
  /**
   * ALAMAT kontrak, bukan nama pendek — sengaja sama dengan `source_cursors`.
   *
   * Itulah yang membuat cek cakupan di API bebas dari drift: ia menuntut satu
   * baris lengkap untuk SETIAP protokol yang benar-benar diawasi watcher,
   * dibaca dari `source_cursors`. Kalau protokol kelima ditambahkan, semua
   * cakupan lama otomatis jadi tidak lengkap — yang memang benar, karena
   * protokol itu belum pernah dipindai untuk subjek mana pun.
   */
  protocol: string;
  fromBlock: number;
  toBlock: number;
  logsFound: number;
  complete: boolean;
}): Promise<void> {
  await sql`
    INSERT INTO backfill_runs ${sql({
      subject: row.subject,
      protocol: row.protocol,
      from_block: row.fromBlock,
      to_block: row.toBlock,
      logs_found: row.logsFound,
      complete: row.complete,
    })}
  `;
}
