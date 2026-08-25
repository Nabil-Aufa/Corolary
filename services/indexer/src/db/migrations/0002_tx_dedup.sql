-- Prover dan submitter bekerja per-TRANSAKSI, bukan per-log: satu transaksi
-- Ethereum bisa memuat beberapa log yang kita minati, dan `recordFact` sudah
-- memanen SELURUH log dalam receipt sekali jalan. Tanpa indeks ini, membentuk
-- batch berisi transaksi unik memerlukan scan penuh tiap siklus.
CREATE INDEX IF NOT EXISTS observed_events_tx_idx
  ON observed_events (chain_key, block_height, tx_index);

-- Satu batch tidak boleh memuat transaksi yang sama dua kali: `_markProcessed`
-- di AttestcoinReader akan revert pada kemunculan kedua dan menjatuhkan seluruh
-- batch. Indeks ini yang dipakai untuk mendeteksinya sebelum dikirim.
CREATE INDEX IF NOT EXISTS observed_events_batch_idx
  ON observed_events (batch_id) WHERE batch_id IS NOT NULL;
