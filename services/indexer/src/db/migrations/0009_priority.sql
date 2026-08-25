-- Prioritas antrean.
--
-- Dibutuhkan oleh B1 ("Claim your history"): pengguna yang menekan tombol dan
-- menunggu hasil tidak boleh antre di belakang lalu lintas latar. Terukur
-- 2026-08-25: antrean penuh butuh ~110 menit untuk habis — tidak ada pengguna
-- yang menunggu selama itu untuk melihat skornya sendiri.
--
-- Default 0 supaya perilaku lama tidak berubah. Urutan lengkapnya jadi:
--   prioritas DESC, lalu backfill ASC (yang segar dulu, karena punya tenggat
--   24 jam), lalu observed_at ASC (yang tertua dulu di dalam kelompoknya).
ALTER TABLE observed_events ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE proof_batches   ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS proof_batches_priority_idx
  ON proof_batches (priority DESC, created_at ASC) WHERE status = 'ready';
