-- Membebaskan `proof_batches.payload` untuk batch `done` — sisa terbesar dari
-- 116 MB (dari total database 216 MB) yang migrasi 0012 belum bisa sentuh.
--
-- 0012 hanya berani mengosongkan `stale` karena `/v1/facts/:factId` membaca
-- payload batch `done` untuk DUA ANGKA saja: jumlah continuity root dan jumlah
-- simpul Merkle proof. Menyimpan ~18 KB payload per batch selamanya demi dua
-- integer adalah harga yang salah, dan payload itu tidak pernah dibaca untuk
-- keperluan lain setelah batch masuk chain.
--
-- Keduanya sifat BATCH, bukan sifat fakta: `merkleProofs[0].siblings` memang
-- sudah dibaca dari anggota pertama, jadi memindahkannya ke kolom di
-- proof_batches tidak menghilangkan informasi apa pun.
ALTER TABLE proof_batches
  ADD COLUMN IF NOT EXISTS continuity_roots_count integer,
  ADD COLUMN IF NOT EXISTS merkle_siblings_count integer;

-- Diisi dari payload yang MASIH ADA, sebelum dikosongkan di bawah. Urutan dua
-- statement ini tidak boleh dibalik.
UPDATE proof_batches
SET continuity_roots_count =
      COALESCE(jsonb_array_length(payload -> 'sharedContinuityProof' -> 'roots'), 0),
    merkle_siblings_count =
      COALESCE(jsonb_array_length(payload -> 'merkleProofs' -> 0 -> 'siblings'), 0)
WHERE payload IS NOT NULL
  AND continuity_roots_count IS NULL;

-- `done` berarti proof-nya sudah dikonsumsi on-chain dan replay protection
-- FactRegistry menolak pengiriman kedua; `stale` berarti ia kedaluwarsa
-- permanen. Tidak satu pun bisa dipakai lagi.
UPDATE proof_batches
SET payload = NULL
WHERE status IN ('done', 'stale') AND payload IS NOT NULL;
