-- `liquidationPenalty.maxPoints` seharusnya 0, bukan 300.
--
-- Kontrak menuliskan `points[3] = -penalty`, jadi komponen ini bergerak dari
-- -300 sampai 0: nilai TERBAIK yang mungkin adalah nol. Baris lama menyimpan
-- 300, dan akibatnya UI merender dompet yang tidak pernah kena likuidasi
-- sebagai "0 dari 300" — terbaca seperti kehilangan 300 poin, padahal artinya
-- bersih sempurna.
--
-- Nilainya sudah benar di `packages/shared/src/constants.ts` dan di
-- `docs/api.md` sejak awal; yang menyimpang cuma penulis di indexer. Karena
-- skor hanya ditulis ulang ketika berubah, baris yang sudah tersimpan tidak
-- akan membaik sendiri — harus diperbaiki di sini.
UPDATE scores
SET components = (
  SELECT jsonb_agg(
    CASE WHEN c->>'key' = 'liquidationPenalty'
         THEN jsonb_set(c, '{maxPoints}', '0'::jsonb)
         ELSE c END
    ORDER BY ord
  )
  FROM jsonb_array_elements(components) WITH ORDINALITY AS t(c, ord)
)
WHERE components @> '[{"key":"liquidationPenalty","maxPoints":300}]'::jsonb;
