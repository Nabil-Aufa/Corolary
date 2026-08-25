-- Nama pasangan feed disimpan, bukan diturunkan dari simbol aset.
--
-- Aset WBTC dihargai oleh feed Chainlink **BTC/USD**, bukan WBTC/USD — dan
-- WBTC/USD adalah feed yang benar-benar berbeda (WBTC/BTC dikali BTC/USD).
-- Menyusun label dari simbol aset membuat API mengaku membaca feed yang tidak
-- pernah kita sentuh. Sama untuk WETH, yang dihargai feed ETH/USD.
ALTER TABLE prices ADD COLUMN IF NOT EXISTS pair TEXT;
