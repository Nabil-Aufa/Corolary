-- Dua perbaikan tidak berhubungan digabung karena keduanya migrasi kecil dan
-- keduanya menyembuhkan baris lama, bukan menambah skema baru.

-- (1) `NoRelevantLogs` dulu jatuh ke `fatal` lewat cabang "custom error tak
-- dikenal" di errors.ts (lihat classifySubmitError), sehingga last_error yang
-- tersimpan berbentuk persis `'custom error tak dikenal: NoRelevantLogs'`.
-- Sekarang custom error itu ada di SKIP_ERRORS dan diklasifikasi `skip`, tapi
-- baris yang SUDAH tersimpan dengan status lama tidak akan membaik sendiri —
-- observed_events hanya ditulis ulang saat statusnya berubah. Predikat di
-- bawah dicocokkan dengan bentuk string yang benar-benar ditulis kode
-- (bukan ditebak): lihat pesan fallback di errors.ts dan pemakaiannya lewat
-- markTx()/UPDATE observed_events di submit.ts.
UPDATE observed_events
SET status = 'skipped'
WHERE status = 'failed' AND last_error ILIKE '%NoRelevantLogs%';

-- (2) `proof_batches.payload` menyimpan seluruh argumen recordFactBatch
-- (encodedTransactions dkk) dan mendominasi ukuran database: 116 MB dari
-- 216 MB total, 6.282 baris.
--
-- HANYA batch `stale` yang dikosongkan di sini, BUKAN `done`. Investigasi
-- (grep `payload` di services/indexer dan services/api) menemukan
-- services/api/src/routes/facts.ts membaca `proof_batches.payload` untuk
-- batch `done` guna menghitung `continuityProofRootsCount` dan
-- `merkleProofSiblingsCount` di endpoint `/v1/facts/:factId` — payload
-- `done` masih dipakai jalur baca LIVE dan TIDAK aman dikosongkan tanpa
-- mengubah API itu (mis. memindahkan kedua angka itu ke tabel `facts` saat
-- `persistReceipt`). Payload `stale` sebaliknya aman: proof-nya kedaluwarsa
-- permanen (tidak akan pernah dikirim ulang) dan `persistReceipt` tidak
-- pernah dipanggil untuk batch yang gagal, jadi tidak ada baris `facts`
-- yang menunjuk ke batch stale lewat `batch_id`.
ALTER TABLE proof_batches ALTER COLUMN payload DROP NOT NULL;

UPDATE proof_batches
SET payload = NULL
WHERE status = 'stale' AND payload IS NOT NULL;
