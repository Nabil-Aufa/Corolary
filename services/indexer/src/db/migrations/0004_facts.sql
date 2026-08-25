-- Mirror baca-cepat dari state on-chain (architecture.md §10).
-- CHAIN TETAP SUMBER KEBENARAN. Tabel ini ada supaya API tidak perlu
-- memindai log Creditcoin untuk setiap permintaan halaman.

CREATE TABLE IF NOT EXISTS facts (
  fact_id            TEXT PRIMARY KEY,
  chain_key          BIGINT NOT NULL,
  block_height       BIGINT NOT NULL,
  tx_hash            TEXT   NOT NULL,
  tx_index           INTEGER NOT NULL,
  -- Posisi log di receipt.receiptLogs — inilah yang dipakai on-chain untuk
  -- menurunkan factId. BUKAN logIndex block-wide Ethereum.
  tx_log_index       INTEGER NOT NULL,
  -- logIndex block-wide, off-chain saja, untuk menautkan ke Etherscan.
  log_index          INTEGER,
  kind               SMALLINT NOT NULL,
  subject            TEXT   NOT NULL,
  protocol           TEXT   NOT NULL,
  asset              TEXT   NOT NULL,
  amount             NUMERIC(78,0) NOT NULL,
  observed_at        BIGINT NOT NULL,
  recorded_at        BIGINT NOT NULL,
  creditcoin_tx_hash TEXT   NOT NULL,
  creditcoin_block   BIGINT NOT NULL,
  batch_id           TEXT
);

-- Paginasi GET /v1/facts: terbaru dulu, descending (blockHeight, txIndex, logIndex).
CREATE INDEX IF NOT EXISTS facts_order_idx
  ON facts (block_height DESC, tx_index DESC, tx_log_index DESC);
CREATE INDEX IF NOT EXISTS facts_subject_idx ON facts (subject, block_height DESC);
CREATE INDEX IF NOT EXISTS facts_kind_idx    ON facts (kind, block_height DESC);
CREATE INDEX IF NOT EXISTS facts_protocol_idx ON facts (protocol, block_height DESC);

CREATE TABLE IF NOT EXISTS scores (
  subject       TEXT PRIMARY KEY,
  score         INTEGER NOT NULL,
  tier          SMALLINT NOT NULL,
  ratio_bps     INTEGER NOT NULL,
  components    JSONB   NOT NULL DEFAULT '[]'::jsonb,
  fact_count    INTEGER NOT NULL DEFAULT 0,
  first_fact_at BIGINT,
  last_fact_at  BIGINT,
  computed_at   BIGINT  NOT NULL,
  onchain_block BIGINT  NOT NULL
);

CREATE TABLE IF NOT EXISTS score_history (
  id       BIGSERIAL PRIMARY KEY,
  subject  TEXT NOT NULL,
  score    INTEGER NOT NULL,
  tier     SMALLINT NOT NULL,
  at_block BIGINT NOT NULL,
  at_time  BIGINT NOT NULL,
  UNIQUE (subject, at_block, score)
);
CREATE INDEX IF NOT EXISTS score_history_subject_idx
  ON score_history (subject, at_block DESC);

CREATE TABLE IF NOT EXISTS prices (
  asset        TEXT PRIMARY KEY,
  aggregator   TEXT NOT NULL,
  answer       NUMERIC(78,0) NOT NULL,
  decimals     SMALLINT NOT NULL,
  round_id     NUMERIC(78,0) NOT NULL,
  updated_at   BIGINT NOT NULL,
  source_block BIGINT NOT NULL,
  fact_id      TEXT
);

-- TIDAK ada di architecture.md §10, ditambahkan karena kontrak tipe
-- `Fact` menjanjikan `assetSymbol` dan `assetDecimals`, sementara log Ethereum
-- hanya membawa alamat token. Alternatifnya memanggil symbol()/decimals() ke
-- RPC Ethereum pada setiap permintaan halaman — mahal dan rapuh. Di-cache di
-- sini karena kedua nilai itu praktis tidak pernah berubah.
CREATE TABLE IF NOT EXISTS assets (
  address    TEXT PRIMARY KEY,
  symbol     TEXT NOT NULL,
  decimals   SMALLINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
