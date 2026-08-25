-- Harga bukan Fact. PriceRegistry tidak menurunkan factId dan tidak memancarkan
-- satu pun — ia menyimpan ronde terbaru per aset, bukan catatan permanen
-- ber-ID. Kolom `fact_id` di 0004 menjanjikan sesuatu yang tidak pernah ada.
--
-- Artefak yang BENAR-BENAR bisa ditelusuri untuk sebuah harga adalah transaksi
-- Ethereum yang memuat log `AnswerUpdated` itu: ia yang dibuktikan, dan ia yang
-- bisa dibuka pengguna di Etherscan.
ALTER TABLE prices RENAME COLUMN fact_id TO source_tx_hash;

-- Sisi Creditcoin: transaksi recordPrice yang menuliskannya. Melengkapi jejak
-- dua sisi yang sama seperti facts.creditcoin_tx_hash.
ALTER TABLE prices ADD COLUMN IF NOT EXISTS creditcoin_tx_hash TEXT;

-- block.timestamp Creditcoin saat tercatat. Berbeda dari `updated_at`, yang
-- adalah waktu Ethereum yang TERBUKTI dan satu-satunya dasar kesegaran harga.
ALTER TABLE prices ADD COLUMN IF NOT EXISTS recorded_at BIGINT;
