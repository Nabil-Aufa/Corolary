-- Status `stale`: proof-nya kedaluwarsa, bukan salah dan bukan gagal.
--
-- Precompile menganggarkan continuity proof pada checkpoint tertentu, dan
-- checkpoint Creditcoin terus maju. Batch yang menganggur cukup lama — mis.
-- karena submitter mati — akan revert dengan
-- "Continuity proof does not match attestation or checkpoint" meski isinya
-- tidak pernah salah dan proof-nya sudah dibayar.
--
-- Ini menyanggah asumsi di docs/indexer.md §14 bahwa proof yang sudah dibayar
-- "selamat dari restart". Ia selamat dari restart yang CEPAT. Terukur
-- 2026-08-25: 21 batch yang menganggur ~45 menit semuanya revert begini.
--
-- Dibedakan dari `failed` karena artinya berbeda secara operasional: `failed`
-- butuh manusia, `stale` sembuh sendiri dengan membeli proof baru.
ALTER TABLE proof_batches DROP CONSTRAINT IF EXISTS proof_batches_status_check;
ALTER TABLE proof_batches ADD CONSTRAINT proof_batches_status_check
  CHECK (status IN ('ready','submitting','done','failed','split','stale'));
