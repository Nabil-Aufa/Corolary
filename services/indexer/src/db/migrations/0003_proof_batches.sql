-- Proof yang sudah dibayar harus SELAMAT dari restart.
--
-- Kalau prover menyerahkan proof ke submitter hanya lewat memori, proses yang
-- mati di antara keduanya membuang CTC yang sudah dikeluarkan dan memaksa
-- proving ulang. Menyimpannya di sini membuat submitter bisa melanjutkan
-- pekerjaan yang proof-nya sudah ada.
--
-- `payload` memuat persis argumen recordFactBatch: heights[], merkleProofs[],
-- encodedTransactions[], observedAts[], sharedContinuityProof.
CREATE TABLE IF NOT EXISTS proof_batches (
  batch_id    TEXT PRIMARY KEY,
  chain_key   BIGINT NOT NULL,
  min_height  BIGINT NOT NULL,
  max_height  BIGINT NOT NULL,
  tx_count    INTEGER NOT NULL,
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ready'
               CHECK (status IN ('ready','submitting','done','failed','split')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  run_after   TIMESTAMPTZ,
  tx_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proof_batches_status_idx
  ON proof_batches (status, created_at ASC);
