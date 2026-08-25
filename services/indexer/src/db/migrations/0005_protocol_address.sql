-- `protocol` menyimpan ALAMAT kontrak, bukan nama pendek.
--
-- Kontrak tipe (packages/shared: IndexerCursor.protocol, Fact.protocol) memakai
-- `Address`, dan `facts` memang sudah menyimpan alamat karena nilainya datang
-- dari event on-chain. Membiarkan `observed_events`/`source_cursors` memakai
-- nama berarti dua penamaan untuk hal yang sama, dan API harus menebak mana
-- yang dipakai di mana. Nama untuk tampilan diturunkan dari alamat.
UPDATE source_cursors SET protocol = CASE protocol
  WHEN 'aave-v3'     THEN '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
  WHEN 'spark'       THEN '0xC13e21B648A5Ee794902342038FF3aDAB66BE987'
  WHEN 'morpho-blue' THEN '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'
  WHEN 'compound-v3' THEN '0xc3d688B66703497DAA19211EEdff47f25384cdc3'
  ELSE protocol END
WHERE protocol NOT LIKE '0x%';

UPDATE observed_events SET protocol = CASE protocol
  WHEN 'aave-v3'     THEN '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
  WHEN 'spark'       THEN '0xC13e21B648A5Ee794902342038FF3aDAB66BE987'
  WHEN 'morpho-blue' THEN '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'
  WHEN 'compound-v3' THEN '0xc3d688B66703497DAA19211EEdff47f25384cdc3'
  ELSE protocol END
WHERE protocol NOT LIKE '0x%';
