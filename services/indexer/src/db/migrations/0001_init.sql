-- Skema indexer. Sumber: docs/indexer.md §14 (diturunkan dari architecture.md §10).

CREATE TABLE IF NOT EXISTS source_cursors (
  chain_key          BIGINT NOT NULL,
  protocol           TEXT   NOT NULL,
  last_scanned_block BIGINT NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_key, protocol)
);

CREATE TABLE IF NOT EXISTS observed_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_key     BIGINT NOT NULL,
  block_height  BIGINT NOT NULL,
  tx_hash       TEXT   NOT NULL,
  tx_index      INTEGER NOT NULL,
  log_index     INTEGER NOT NULL,
  topic0        TEXT   NOT NULL,
  protocol      TEXT   NOT NULL,
  raw_log       JSONB  NOT NULL,
  status        TEXT   NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','awaiting_attestation','proving',
                                   'submitting','recorded','failed','skipped')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  run_after     TIMESTAMPTZ,
  backfill      BOOLEAN NOT NULL DEFAULT false,
  batch_id      TEXT,
  fact_id       TEXT,
  observed_at   BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT observed_events_unique_log
    UNIQUE (chain_key, block_height, tx_index, log_index)
);

CREATE INDEX IF NOT EXISTS observed_events_status_observed_at_idx
  ON observed_events (status, observed_at ASC);

CREATE INDEX IF NOT EXISTS observed_events_run_after_idx
  ON observed_events (run_after) WHERE run_after IS NOT NULL;

CREATE TABLE IF NOT EXISTS jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       TEXT   NOT NULL,
  payload    JSONB  NOT NULL,
  status     TEXT   NOT NULL DEFAULT 'pending',
  attempts   INTEGER NOT NULL DEFAULT 0,
  run_after  TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submitter_state (
  id         SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_nonce BIGINT NOT NULL
);
