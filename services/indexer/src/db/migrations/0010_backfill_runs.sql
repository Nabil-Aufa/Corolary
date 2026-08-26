-- Cakupan backfill per (subjek, protokol).
--
-- Dibutuhkan `POST /v1/backfill`. Tanpa ini satu-satunya dedupe yang mungkin
-- adalah "sudah pernah ada job untuk subjek ini" — dan itu mengulang persis
-- pelajaran 2864bfd: dedupe terhadap ANTREAN, bukan terhadap KENYATAAN. Backfill
-- yang dijalankan lewat CLI (jalur utama sampai hari ini, termasuk dompet demo)
-- tidak pernah menulis baris `jobs`, jadi endpoint akan memindai ulang seluruh
-- riwayat yang sudah dibayar lengkap, tanpa satu pun fakta baru.
--
-- Barisnya PER PROTOKOL, bukan per subjek. `firstFactAt` adalah minimum LINTAS
-- protokol, jadi kedalaman yang tidak seragam menghasilkan kesimpulan yang salah
-- tentang dompetnya: dompet demo dipindai 24 bulan di Aave tapi 9 bulan di
-- Morpho, dan "riwayatnya mentok 8 bulan" ternyata pernyataan tentang jendela
-- pemindaian. Satu baris per subjek tidak bisa membedakan keduanya.
CREATE TABLE IF NOT EXISTS backfill_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      TEXT    NOT NULL,
  -- Alamat kontrak (checksum), sama seperti `source_cursors.protocol`.
  protocol     TEXT    NOT NULL,
  from_block   BIGINT  NOT NULL,
  to_block     BIGINT  NOT NULL,
  logs_found   INTEGER NOT NULL,
  -- FALSE bila ada rentang yang menyerah. Baris tidak lengkap TIDAK boleh
  -- dihitung sebagai cakupan: gejalanya skor yang tampak sah, hanya lebih
  -- rendah dari seharusnya, dan tidak ada yang terlihat rusak.
  complete     BOOLEAN NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backfill_runs_subject_idx
  ON backfill_runs (subject, protocol, from_block ASC) WHERE complete;
