# Corolary

Riwayat kredit on-chain yang terbukti secara kriptografis, diturunkan dari aktivitas
pinjam-meminjam **nyata di Ethereum mainnet** lewat **Attestcoin Protocol**, dipakai
untuk membuka **efisiensi kolateral** di pasar pinjaman **Creditcoin**.

Dibangun untuk hackathon **BUIDL CTC 2026 Fall**. Tim: 2 orang (Dev A = backend+onchain,
Dev B = frontend).

---

## Baca ini dulu

Sebelum menulis kode apa pun di repo ini:

1. **`docs/architecture.md`** — tulang punggung. Semua kontrak antar-bagian ada di sini.
2. **`docs/attestcoin-research.md`** — batasan protokol yang sudah diverifikasi live.
3. **`docs/workstreams.md`** — siapa memiliki file mana.
4. **`docs/shared-types.md`** — kontrak tipe antara backend dan frontend.
5. **`docs/open-issues.md`** — gap & blocker yang masih terbuka, beserta solusinya.
   Cek ini sebelum memutuskan sesuatu terasa "belum diputuskan" — kemungkinan besar
   sudah ada resolusinya di sana.

Kalau ada konflik antar dokumen, `docs/architecture.md` yang menang.

---

## Aturan keras (melanggar ini = merusak produk)

### 1. NOL MOCK DATA di produk akhir
Permintaan eksplisit pemilik proyek, dan bagian dari penilaian hackathon.

- Setiap angka yang tampil di UI harus berasal dari transaksi Ethereum mainnet nyata
  yang dibuktikan lewat Attestcoin, atau dari state kontrak Creditcoin nyata.
- Dilarang: seed data, angka hardcoded, grafik dari data karangan, tombol
  "Coming soon", fitur yang tidak berfungsi.
- Fixture dev hanya boleh di `apps/web/src/lib/dev-fixtures.ts`, dijaga
  `NEXT_PUBLIC_USE_FIXTURES` yang default `false`.
- `pnpm check:no-mocks` harus lulus sebelum submit.

### 2. WAJIB cek status transaksi sumber
Block Prover Precompile **tidak** memvalidasi sukses/gagalnya transaksi Ethereum —
ia hanya membuktikan inklusi. Setiap jalur yang mengonsumsi transaksi terbukti **HARUS**:

```solidity
EvmV1Decoder.ReceiptFields memory r = EvmV1Decoder.decodeReceiptFields(encodedTx);
require(r.receiptStatus == 1, "source tx reverted");
```

Tanpa ini, transaksi Ethereum yang **revert** tetap lolos dan meracuni registry.
Ini lubang keamanan #1 di proyek ini.

### 3. WAJIB validasi alamat emitter
Terbukti "sebuah log ada di transaksi ini" ≠ "log ini dari Aave". Selalu cek alamat
pemancar log cocok dengan protokol yang terdaftar. Tanpa ini siapa pun bisa men-deploy
kontrak peniru yang memancarkan event Aave palsu, dan proof-nya akan sah.

### 4. Eager proving, jangan lazy
Proof **10x lebih murah** bila dibuat < 24 jam setelah transaksi
(2,59×10⁻⁵ vs 3,13×10⁻⁴ CTC). Indexer membuktikan event selagi segar lalu menyimpan
faktanya permanen. **Jangan pernah** membuat jalur yang mem-prove data lama on-demand
di jalur panas.

### 5. Searah saja — writability belum ada
Attestcoin Writability (Creditcoin → Ethereum) **belum rilis**, masih audit.
Jangan rancang apa pun yang butuh menulis balik ke Ethereum.

### 6. uint256 selalu string di TypeScript
`amount`, saldo, harga — semuanya `string` di lintas batas TS. Jangan pernah `number`.
uint256 melebihi `Number.MAX_SAFE_INTEGER`.

### 7. Batas kepemilikan file
- **Dev B hanya menyentuh `apps/web/**`.** Tidak ada pengecualian.
- **Dev A memiliki sisanya.**
- `packages/shared` searah: A menulis, B membaca. B minta perubahan, bukan mengedit.
- Mengubah bentuk API = commit yang menyentuh `docs/api.md` **dan**
  `packages/shared/src/types.ts` bersamaan.

---

## Fakta jaringan (terverifikasi live 2026-08-22, jangan ditebak ulang)

| Item | Nilai |
|---|---|
| Creditcoin CC3 Testnet RPC | `https://rpc.cc3-testnet.creditcoin.network` |
| CC3 Testnet chainId | **102031** (`0x18e8f`) |
| Block Prover Precompile | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo Precompile | `0x0000000000000000000000000000000000000fd3` |
| Proof Builder API | `https://prover.cc3-testnet.creditcoin.network` |
| Decoder contract (testnet) | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| SDK | `@gluwa/usc-sdk@0.18.0` |
| **Source chain yang dipakai** | **`chainKey = 3` → Ethereum MAINNET** (chainId 1) |
| `chainKey = 1` | Sepolia — **jangan dipakai untuk produk akhir** |
| Lag attestation | ~38 blok ≈ 8 menit |
| Batas batch proof | 10 tx, rentang 1000 blok |

**Kenapa `chainKey 3` penting:** hackathon mewajibkan deploy di testnet, tapi kita
tidak boleh pakai mock data. CC3 Testnet bisa membaca Ethereum **mainnet** asli — jadi
kedua syarat terpenuhi sekaligus. Peserta lain akan pakai Sepolia dan token karangan.

**RPC Ethereum harus archive-capable DAN sanggup `eth_getLogs` 2000 blok.** Dua syarat
terpisah. Diuji live 2026-08-25: **drpc** (`https://eth.drpc.org`) lulus keduanya tanpa
perlu daftar; **Alchemy free tier lulus archive tapi membatasi `eth_getLogs` ke 10 blok**,
jadi `CHUNK_SIZE = 2000` mustahil di sana.

---

## Perintah

```bash
# Setup
pnpm install
docker compose up -d              # postgres lokal
cp .env.example .env

# Kontrak (packages/contracts)
forge build
forge test -vvv
forge test --match-test testFoo -vvvv
pnpm contracts:deploy:testnet
pnpm contracts:abi                # generate ABI ke packages/shared/src/abis

# Backend
pnpm db:migrate
pnpm dev:indexer
pnpm dev:api

# Frontend
pnpm dev:web

# Mutu
pnpm lint
pnpm typecheck
pnpm test
pnpm check:no-mocks               # WAJIB lulus sebelum submit
```

---

## Peta arsitektur singkat

```
Ethereum mainnet (Aave V3 / Morpho / Compound / Chainlink)
        │  event nyata
        ▼
services/indexer   watcher → tunggu attestation → prover (batch) → submitter
        ▼
FactRegistry.sol   verifikasi via precompile → adapter decode → simpan permanen
        ▼
CreditGraph.sol    skor 0..1000 + tier
        ▼
EfficiencyMarket   rasio kolateral 150% → 110% mengikuti skor
        ▼
services/api  →  apps/web
```

Tiga lapis: **FactRegistry** (infrastruktur, inti produk) → **CreditGraph** (skor)
→ **EfficiencyMarket** (pasar).

---

## Jebakan yang sudah diketahui

- **Pragma WAJIB `^0.8.28`, bukan `^0.8.23`.** `@gluwa/usc-contracts` v0.2.0 memakai
  `^0.8.28`. Contoh `USCBase.sol` di repo tutorial memakai `^0.8.23` dan akan gagal
  compile begitu kamu meng-import `EvmV1Decoder`.
- **Path import `EvmV1Decoder` yang ditulis dokumentasi resmi SALAH.** Yang benar:
  `@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol`
  (dokumentasi menulis `contracts/decoding/...`, path itu tidak ada).
- **`EvmV1Decoder.LogEntry` TIDAK punya `logIndex`.** Strukturnya hanya
  `{address address_; bytes32[] topics; bytes data;}`. Indeks log harus diambil dari
  posisi iterasi di `receipt.receiptLogs` — dan karena itu **jangan pakai
  `getLogsByEventSignature`** di jalur pencatatan fakta: ia mengembalikan array
  terfilter sehingga posisi aslinya hilang.
- **Jangan salin `VerifierInterface.sol` dari repo tutorial** — versinya tertinggal dan
  tidak memuat overload batch. Pakai
  `@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol`,
  yang punya `verifyAndEmit`/`verify` varian batch. Batching adalah strategi biaya inti kita.
- **Ada DUA struct `MerkleProofEntry` yang berbeda** di paket yang sama:
  `INativeQueryVerifier.MerkleProofEntry` memakai field `hash`, sedangkan
  `BlockProverTypes.MerkleProofEntry` memakai field `sibling`. Untuk memanggil
  precompile, pakai yang dari `INativeQueryVerifier`. Keduanya bertipe
  `(bytes32, bool)` sehingga **ABI-nya identik** — kompiler tidak akan menolong
  kalau kamu salah pilih.
- **Ada DUA file `INativeQueryVerifier.sol`** di paket yang sama. Yang di
  `contracts/write-ability/INativeQueryVerifier.sol` adalah salinan vendored yang
  **basi**: pragma `^0.8.20`, hanya `verify` tunggal, **tanpa** `verifyAndEmit`.
  Yang benar selalu `contracts/write-ability/common/INativeQueryVerifier.sol`.
  Aturan praktis: di paket ini, **`common/` selalu yang benar**.
- **`via_ir = true` WAJIB.** Overload batch `verifyAndEmit` menerima array calldata
  bersarang dan menabrak "stack too deep" di codegen lama. Sudah dibuktikan, bukan
  dugaan. Tanpa ini, strategi batching — inti model biaya proyek — tidak bisa dipanggil.
- **Dependensi Solidity dipasang lewat pnpm, bukan `forge install`.** `.gitignore`
  mengabaikan `lib/`, jadi submodule Foundry akan hilang dari repo. `remappings.txt`
  menunjuk ke `node_modules/`. Hanya `forge-std` yang tetap submodule.
- **Biaya gas `recordFact` didominasi ukuran `encodedTx`, BUKAN jumlah log.** Terukur
  atas tx mainnet nyata: decode receipt 4.864 byte = 375.316 gas, sementara mengiterasi
  seluruh 10 log hanya 2.254 gas (0,6%). Batasi batch berdasarkan **total byte**.

- **Subjek Aave `Borrow` adalah `onBehalfOf`, bukan `user`.** Untuk `Repay`, subjeknya
  `user` (yang berutang), bukan `repayer`. Salah pilih = seluruh skor teracuni.
- **Offset `amount` Aave TIDAK sama untuk semua event.** Pada `Borrow` dan `Supply`,
  `user` **tidak** di-index sehingga ia menempati `data[0]` dan `amount` bergeser ke
  **`data[1]`**. Pada `Repay`, `Withdraw`, dan `LiquidationCall`, `amount` memang di
  `data[0]`. Membaca word 0 untuk `Borrow`/`Supply` akan mencatat **alamat dompet
  sebagai jumlah pinjaman** — angka astronomis yang meracuni skor tanpa gejala.
  Diverifikasi dari `aave-v3-origin/IPool.sol` dan dikunci sebagai tes.
- **`observedAt` adalah satu-satunya field Fact yang TIDAK terbukti kriptografis.**
  Receipt Ethereum tidak memuat timestamp. Untuk urutan, durasi, dan kesegaran,
  pakai `blockHeight` — bukan `observedAt`.
- **Morpho punya DUA jebakan yang sama seperti Aave.** Pada `Borrow` dan
  `WithdrawCollateral`, `caller` tidak di-index sehingga `assets` ada di **`data[1]`**.
  Subjeknya selalu `onBehalf`/`borrower`, tidak pernah `caller` atau `receiver`.
  Pada `Liquidate`, pakai `repaidAssets` (word 0), bukan `seizedAssets` (word 2).
- **JANGAN petakan `Supply`/`Withdraw` aset dasar Compound V3.** Saldo aset dasar
  Comet bertanda, dan event-nya hanya memancarkan total — menyetor sebagai pemberi
  pinjaman tidak bisa dibedakan dari melunasi utang. Memetakannya berarti siapa pun
  bisa menyetor USDC lalu menarik lagi untuk mendapat reputasi gratis. Hanya
  `SupplyCollateral`, `WithdrawCollateral`, dan `AbsorbDebt` yang tidak ambigu.
- **Aggregator Chainlink bisa berganti** saat upgrade feed. Resolve `aggregator()`
  dari proxy secara berkala; simpan himpunan aggregator tepercaya, jangan hardcode satu.
- **Di `AnswerUpdated`, harganya ada di TOPIC, bukan `data`.** `current` adalah
  parameter indexed: `topics[1]` = harga, `topics[2]` = roundId, `data[0]` = updatedAt.
  Membaca `data[0]` sebagai harga menghasilkan timestamp ~1,8e9, yang pada feed
  berdesimal 8 terbaca sebagai **$18** — masuk akal, dan karena itu tidak akan
  terlihat seperti kesalahan.
- **Dokumentasi Creditcoin memakai path lama.** `docs.creditcoin.org/creditcoin-usc`
  sekarang 404. Pakai `docs.creditcoin.org/attestcoin-protocol`.
- **Nama "USC" masih ada di mana-mana** (nama repo, paket npm, nama kontrak) meski
  protokolnya sudah di-rebrand jadi Attestcoin. Keduanya hal yang sama.
- **Backend pakai ethers v6, frontend pakai viem/wagmi.** Disengaja — SDK Attestcoin
  memaksa ethers. Jangan diseragamkan; keduanya tak pernah bertemu di satu file.
- **Kolom `amount` di Postgres harus `NUMERIC(78,0)`**, bukan `BIGINT`.
- **`llamarpc` mengembalikan `eth_getLogs` KOSONG tanpa error.** Untuk rentang yang
  benar-benar berisi 711 log Aave, ia menjawab `result: []` dengan status sukses. Tidak
  ada exception, tidak ada retry yang terpicu — indexer akan menyimpulkan Aave sepi dan
  melewatkan seluruh riwayat secara diam-diam. Karena itu RPC baru **wajib dicocokkan
  hasilnya dengan provider kedua**, bukan sekadar dicek "tidak error".
- **Pola `lib/` di `.gitignore` menelan `services/api/src/lib/`.** Pola tanpa
  garis miring di depan cocok dengan direktori bernama `lib` **di mana pun**,
  bukan hanya milik Foundry. Tujuh file sumber API tidak ikut ter-commit tanpa
  satu pun peringatan — `git status` bersih, build lokal jalan, dan repo hasil
  clone gagal. Sudah dijangkar jadi `/packages/contracts/lib/`. Aturan praktis:
  setelah menambah direktori baru, jalankan `git status --short | wc -l` dan
  cocokkan dengan jumlah file yang kamu buat.
- **CC3 Testnet menagih ~3,5x lipat gas simulasi lokal untuk operasi
  penyimpanan.** Terukur: `grantRole` = **203.235** gas menurut `eth_estimateGas`
  CC3, sementara simulasi forge memperkirakan ~57.000. Deployment tanpa
  `--gas-estimate-multiplier` yang besar akan mengirim transaksi dengan limit di
  bawah kebutuhan, dan gejalanya menyesatkan: `gasUsed == gasLimit` persis, yang
  terbaca seperti revert logika padahal murni kehabisan gas. Perintah deploy
  memakai **800**.
- **`forge script` WAJIB pakai `--slow` di CC3.** Tanpa itu forge mengestimasi
  SELURUH transaksi terhadap state yang sama, yaitu sebelum apa pun ter-deploy.
  Panggilan ke kontrak yang belum ada diestimasi sebagai revert murah (~66k) lalu
  kehabisan gas saat benar-benar dijalankan. Efeknya: kontrak ter-deploy tapi
  **nol konfigurasi** — role kosong, chainKey kosong, adapter kosong — dan
  registry yang tampak hidup padahal tidak bisa menerima apa pun.
- **`forge script` melaporkan "Transaction Failure" palsu di CC3.** Blok CC3
  tidak punya `mixHash`, sehingga block-watcher `alloy` gagal men-deserialize dan
  forge menandai transaksi gagal padahal sukses. `cast` membaca blok yang sama
  tanpa masalah. **Jangan percaya status dari forge di chain ini** — verifikasi
  dengan `eth_getCode` dan `cast call` ke state sebenarnya.
- **Jangan `JSON.stringify()` untuk kolom `jsonb` di postgres.js.** Driver-nya
  sudah menserialisasi objek sendiri, jadi men-stringify lebih dulu menyimpan
  nilainya sebagai **string JSON**, bukan objek: `jsonb_typeof` mengembalikan
  `'string'` dan setiap operator `->` mengembalikan `NULL` **tanpa error**.
  Terjadi di `proof_batches.payload` — submitter membaca `payload.heights` sebagai
  `undefined`, dan itu baru ketahuan saat pengiriman pertama. Pakai objek polos
  atau `sql.json(obj)`.
- **`pkill -f 'tsx src/main.ts'` TIDAK mematikan indexer.** Command line aslinya
  memuat path lengkap tsx cli, bukan string itu. Empat instance sempat berjalan
  bersamaan tanpa disadari dan menghasilkan persis pola kerusakan di
  `docs/indexer.md` §15: batch yatim tanpa event, dan campuran hasil dari dua
  versi kode. Pakai `pkill -f 'Corolary/services/indexer'`, lalu verifikasi
  dengan `pgrep` — jangan diasumsikan berhasil.
- **ethers v6 diam-diam menggabungkan permintaan bersamaan jadi JSON-RPC batch.**
  Begitu `getBlock` dijalankan paralel, ethers mengirim satu batch berisi 12
  permintaan, dan drpc free plan menolak **seluruh batch** dengan HTTP 500
  "Batch of more than 3 requests are not allowed". Yang gagal bukan satu
  permintaan melainkan semuanya, dan errornya muncul sebagai server error
  alih-alih rate limit sehingga mudah salah didiagnosis. Perbaikannya
  `batchMaxCount: 3` di opsi provider, bukan membatalkan paralelisme —
  paralelisme itu yang memangkas satu chunk Aave dari 39,6 detik ke 4,17 detik.
- **Batas span batch adalah 999, bukan 1000.** `AttestcoinReader._verifyBatch`
  menolak `span >= MAX_BATCH_BLOCK_RANGE`, jadi rentang tepat 1000 blok revert.
  `docs/indexer.md` §10.4 menulis `span > 1000` dan itu off-by-one: batch dengan
  span tepat 1000 lolos pemeriksaan sisi indexer lalu revert on-chain **setelah
  proof-nya dibayar**.
- **Biaya watcher ditentukan jumlah BLOK UNIK, bukan lebar rentang.** Chunk Aave
  500 blok berisi 321 log tersebar di ~300 blok, dan tiap blok butuh satu
  `getBlock` untuk timestamp. Compound dengan 1 log di rentang yang sama selesai
  80x lebih cepat. Karena itu `chunkSize` diatur per protokol, bukan global.
- **Di zsh, `set -- $VAR` TIDAK memecah kata.** Berbeda dari bash. Skrip verifikasi RPC
  sempat mengirim `toBlock` kosong karena ini, dan kedua provider menjawab 0 log —
  terlihat seperti temuan nyata padahal query-nya yang cacat.
- **Di tes Foundry, jangan pakai `vm.warp(block.timestamp + X)` di dalam LOOP.**
  Dengan `via_ir`, optimizer meng-hoist `TIMESTAMP` keluar dari loop, sehingga
  setiap iterasi warp ke detik yang SAMA dan loopnya diam-diam tidak memajukan
  waktu sama sekali — tesnya tetap hijau sambil menguji hal yang salah. Lacak
  waktu di variabel lokal (`t += 1 days; vm.warp(t);`).
- **Backfill WAJIB di-scope per subjek, bukan per rentang blok.** Subjek adalah
  parameter ber-`indexed` di keempat protokol, jadi RPC menyaringnya di sisi
  server: riwayat 6 bulan satu dompet = 69 log. Memindai rentang yang sama tanpa
  filter subjek menghasilkan ratusan ribu log, dan tiap transaksinya dibayar pada
  tarif lazy 3,13×10⁻⁴ CTC. `docs/indexer.md` §13.2 menjelaskan mode rentang —
  itu benar untuk menambah protokol baru, bukan untuk memberi kedalaman riwayat.
- **drpc bisa membalas `-32000 "method handler crashed"`** pada `eth_getLogs`
  rentang lebar — bukan 403, bukan 429, bukan timeout. Klasifikasi retry berbasis
  kata kunci sempit akan melewatkannya, dan satu kegagalan menjatuhkan seluruh
  run backfill 20 menit. Perlakukan SEMUA error RPC sebagai transien; kegagalan
  struktural ditangani dengan memecah rentang, bukan dengan daftar kata kunci.
- **Pekerjaan pemindaian panjang harus menulis per potongan, bukan di akhir.**
  Backfill 12 bulan × 4 protokol = ~2.100 panggilan RPC, ~20 menit. Mengumpulkan
  semuanya di memori lalu insert di akhir berarti satu kegagalan membuang
  segalanya — dan itu benar-benar terjadi di percobaan pertama.
- **Posisi subjek di `topics` BERBEDA antar event, bahkan di satu protokol.**
  Aave: `topics[2]` untuk Borrow/Repay/Supply/Withdraw tapi `topics[3]` untuk
  LiquidationCall. Morpho: `topics[2]` untuk Borrow/WithdrawCollateral,
  `topics[3]` untuk Repay/Liquidate/SupplyCollateral. Compound: `topics[1]`
  untuk WithdrawCollateral, `topics[2]` untuk SupplyCollateral/AbsorbDebt.
  Salah posisi **tidak** menghasilkan data salah — adapter tetap mencatat subjek
  yang benar. Yang terjadi: filter memanen log dompet LAIN, dan kita membayar
  proof untuk riwayat orang lain.
- **`ceil(tx / 10)` adalah perkiraan batch yang SALAH untuk backfill.** Batas span
  999 blok berarti transaksi yang terpisah berbulan-bulan tidak bisa satu batch.
  Terukur atas 66 transaksi Aave sepanjang 180 hari: **27 batch**, bukan 7 —
  sepuluh di antaranya berisi satu transaksi. Efisiensi batching, inti model
  biaya untuk lalu lintas live, praktis hilang di backfill.
- **drpc memblokir berdasarkan User-Agent, dan hasilnya terlihat seperti rate
  limit.** Terukur pada permintaan yang IDENTIK: UA `Python-urllib` dijawab
  **403 Forbidden**, `curl/8.7.1` dijawab **429**, dan `Mozilla/5.0` dilayani
  normal. Skrip Python tanpa UA eksplisit karena itu **tidak akan pernah
  berhasil sekali pun**, dan 403-nya sangat mudah salah didiagnosis sebagai ban
  akibat terlalu banyak permintaan — kesimpulan itu sempat ditulis di sini dan
  keliru. Setiap klien HTTP mentah ke RPC publik wajib memasang User-Agent.
- **drpc free menolak `eth_getLogs` rentang > 10.000 blok** bahkan dengan filter
  topic, dan batas itu **menyusut seiring umur blok**: pada blok ~20,57 juta
  (≈24 bulan lalu) rentang 10.000 dijawab `"Request timeout on the free plan"`
  sementara rentang 1.000 dilayani normal. Backfill bergerak MUNDUR, jadi
  rentangnya harus adaptif — ukuran yang terbukti berhasil diingat untuk
  potongan berikutnya, bukan direset tiap kali.
- **Skor `historyDuration` memakai half-saturation, bukan linear.**
  `saturating(days, 365, 200)` berarti 365 hari hanya memberi 100 dari 200 poin,
  dan 730 hari memberi 133. Menggandakan jendela backfill dari 6 ke 12 bulan
  hanya menambah ~34 poin; memindai keempat protokol menambah 75 lewat
  `protocolDiversity`. Tuas biayanya ada di cakupan protokol, bukan di kedalaman
  waktu.
- **`roundId` proxy Chainlink ≠ `roundId` di event `AnswerUpdated`.** Proxy
  mengembalikan roundId gabungan berfase (`phaseId << 64 | aggregatorRound`,
  angka ~1,8e19), sementara event dipancarkan **aggregator** dan membawa nomor
  ronde miliknya sendiri — ETH/USD ada di 32.938, USDC/USD di 1.151. Karena
  monotonisitas `PriceRegistry` diperiksa terhadap nilai dari event, mencampur
  keduanya sekali saja akan menyimpan roundId raksasa yang membuat **setiap
  ronde berikutnya ditolak diam-diam** lewat `roundId <= p.roundId`, dan harga
  membeku permanen tanpa satu pun error.
- **Aggregator Chainlink adalah kontrak yang JARANG memancarkan log, jadi
  `eth_getLogs` rentang lebar di sana murah.** Terukur di drpc 2026-08-25:
  3.000 blok selesai <500 ms untuk ketiga feed, padahal Aave di rentang yang
  sama harus dipotong ke 500. Batas chunk memang harus per-kontrak, bukan
  global — dan arahnya bisa ke DUA sisi, tidak selalu mengecil.
- **Jangan susun label pasangan harga dari simbol aset.** WBTC dihargai oleh feed
  **BTC/USD**; "WBTC/USD" adalah feed Chainlink yang benar-benar berbeda
  (WBTC/BTC dikali BTC/USD). Menyusunnya dari simbol membuat API mengaku membaca
  feed yang tidak pernah disentuh. Sama untuk WETH ↔ ETH/USD.
- **Harga TIDAK boleh lewat pipeline fakta.** Pipeline fakta mengejar
  kelengkapan; harga hanya butuh ronde terbaru, dan `recordPrice` sendiri
  membuang `roundId` yang lebih kecil. Mengalirkannya ke sana berarti membeli
  proof untuk ~18 ronde ETH/USD per 3.000 blok lalu membuang hampir semuanya.
  Loop harga terpisah dan tanpa state.
- **Loop harga WAJIB satu proses dengan submitter fakta.** Keduanya memakai kunci
  submitter yang sama, jadi keduanya mengklaim nonce dari baris
  `submitter_state` yang sama. Dua proses = nonce saling menimpa.
- **`PriceRegistry.setPriceAlias` di-resolve dari KONTRAK di sisi API, bukan
  disalin ke SQL.** Join `prices` per alamat akan mengembalikan `null` untuk
  tUSDC/tWETH walaupun `tryToUsd1e18` on-chain menjawab benar — dan itu terlihat
  seperti "harga belum ada", bukan seperti join yang salah.
- **`cast send` di CC3 bisa kehabisan gas dengan gejala yang terbaca seperti
  revert.** `eth_estimateGas` CC3 dijawab terhadap state beberapa blok lebih
  tua; untuk `repay`, bunga terus berjalan sehingga kebutuhan gas naik di antara
  estimasi dan eksekusi. Terukur: limit **224.001**, kebutuhan **228.804** —
  transaksi mati dengan `status 0x0` dan **`gasUsed == gasLimit` PERSIS**. Itu
  satu-satunya pembeda dari revert logika. Pakai `--gas-limit` eksplisit yang
  longgar, jangan mengandalkan estimasi cast. Sekeluarga dengan
  `forge --gas-estimate-multiplier 800`.
- **"Repay all" tidak boleh mengirim `type(uint256).max` begitu saja.** `repay`
  meng-clamp `amount > debt` ke `debt`, jadi max aman terhadap **utang** — tapi
  tidak terhadap **saldo**: kalau saldo < utang, `transferFrom` revert dan
  gejalanya terbaca seperti bug kontrak. Yang benar `min(utang, saldo)`, lalu
  tarik supply untuk menutup sisanya. Terukur: utang 4.804.687.652 lawan saldo
  4.335.937.523 karena sebagian tUSDC terkunci sebagai supply.
- **Melunasi persis sebesar yang dipinjam SELALU menyisakan debu.** Bunga
  berjalan di antara `borrow` dan `repay`, jadi `amount < debt` dan sisanya terus
  berbunga selamanya. Terukur: sisa **15** unit. Sama untuk menarik dana dari
  supply lalu melunasi — saldo mendarat persis sebesar utang lama, lalu satu blok
  bunga membuatnya kurang lagi. Selalu sertakan penyangga.
- **`capitalSavedUsdWad` mengembalikan 0 untuk dompet berskor 0**, karena
  `effectiveRatioBps` = baseline 15000 dan fungsinya `return 0` bila rasio ≥
  baseline. Itu benar, bukan bug — tapi berarti angka penghematan modal
  **mustahil bukan-nol** tanpa dompet yang punya riwayat mainnet terbukti.
- **`firstFactAt` adalah minimum LINTAS PROTOKOL, jadi kedalaman backfill harus
  seragam.** Dompet demo dipindai 24 bulan di Aave tapi hanya 9 bulan di Morpho,
  dan kesimpulannya "riwayatnya mentok 8 bulan" — padahal ada dua transaksi
  Morpho dari 2025-09-23. Memindai sisanya menggeser `firstFactAt` mundur 91
  hari, `historyDuration` 80 → 95, dan skor 797 → **813**, menembus tier 4.
  Dua transaksi seharga 0,000626 CTC. Selama satu protokol saja belum dipindai
  sedalam yang lain, "tidak ada riwayat lebih tua" adalah pernyataan tentang
  jendela pemindaian, bukan tentang dompetnya.
- **Jangan taksir skor dari jendela pemindaian.** Empat kali berturut-turut
  taksiran meleset dengan pola yang sama: jumlah bulan yang diminta dianggap
  sama dengan riwayat yang benar-benar ada. Whale dengan 1.374 transaksi
  diproyeksikan 788–848, ternyata **684**; dompet demo diproyeksikan 829,
  ternyata **797**. Satu-satunya angka yang bisa dipercaya datang dari
  `componentsOf(address)` on-chain.
- **`protocolDiversity` linear, bukan setengah-jenuh** — `popcount(bitmap) * 100 / 4`,
  tepat 25 poin per protokol. Karena itu ia bisa dihitung pasti sebelum
  dikerjakan, tidak seperti komponen lain. Dompet di 1 protokol mentok di 759
  bahkan bila ketiga protokol sisanya terisi penuh; itu cukup untuk memutuskan
  tanpa memindai apa pun.
- **Submitter cuma memuat ABI `FactRegistry`.** Custom error dari kontrak lain —
  precompile Attestcoin termasuk — tidak punya selector di ABI itu, jadi ethers
  menyerah dengan `execution reverted (unknown custom error)`: kalimat yang sama
  untuk sebab yang berbeda-beda. 49 event ditandai gagal permanen dengan teks itu
  dan nol petunjuk. Payload-nya selalu ada di `err.data`; ia cuma tidak pernah
  dibaca. Selalu catat selector 4-byte-nya.
- **Backfill yang menyerah di satu rentang tetap melaporkan ringkasan sukses.**
  `failures` dicatat di baris error TERPISAH sesudah baris ringkasan, jadi
  ringkasannya terbaca lengkap dan exit code-nya 0. Gejalanya paling berbahaya
  dari semua: skor tetap sah, hanya lebih rendah dari seharusnya, dan tidak ada
  yang tampak rusak. Sekarang `rentangGagal` ikut di baris ringkasan dan exit
  code jadi 2.
- **Gerbang yang tidak menemukan berkas apa pun HARUS gagal, bukan lulus.**
  `check-no-mocks.mjs` memakai `new URL('..', import.meta.url).pathname`, yang
  di Windows menghasilkan `/D:/Web3/CTC/` — dengan garis miring di depan.
  Keempat root pemindaian jadi tidak ditemukan dan skripnya melaporkan
  "LULUS SEBAGIAN" setelah memeriksa **nol berkas**. Di Linux jalurnya kebetulan
  benar, jadi CI tidak akan pernah menangkapnya. Pakai `fileURLToPath()`; dan
  sekarang nol-berkas maupun root non-frontend yang hilang divonis GAGAL.
- **`turbo run build` menyeret `forge build`.** `packages/contracts` punya skrip
  `build`, jadi `pnpm build` di root gagal di host mana pun yang tidak punya
  Foundry. Untuk deploy, satu-satunya yang perlu dibangun adalah
  `@corolary/shared` (exports-nya menunjuk `./dist`); kedua service jalan lewat
  `tsx` langsung dari sumber.
- **`tsx` wajib di `dependencies`, bukan `devDependencies`.** Host menyetel
  `NODE_ENV=production` dan install produksi melewatkan devDependencies —
  service naik lalu mati dengan `tsx: not found`. Karena `tsx` memang runtime
  bagi kedua service, tempatnya di `dependencies` adalah klasifikasi yang benar,
  bukan siasat.
- **`liquidationPenalty` bergerak KE BAWAH.** Kontrak menulis
  `points[3] = -penalty`, jadi rentangnya -300..0 dan `maxPoints`-nya **0**.
  Indexer sempat menyimpan 300, sehingga dompet yang tidak pernah kena likuidasi
  tampil "0 dari 300" — terbaca sebagai kehilangan 300 poin, kebalikan penuh
  dari artinya. Diperbaiki di `persist.ts` + migrasi 0011.
- **Platform hosting memakai `PORT`, dan salah port TIDAK menghasilkan error.**
  API kita membaca `API_PORT`; Railway/Fly/Render menyuntikkan `PORT` dan
  mengarahkan traffic ke sana. Kalau tidak dipetakan, service naik dengan sehat,
  log-nya bersih, dan satu-satunya gejala adalah domain yang tidak pernah
  menjawab. `PORT` sekarang menang atas `API_PORT` di `services/api/src/config.ts`.
- **`ETHEREUM_RPC_URL_FALLBACK` ada di `.env` tapi TIDAK dibaca kode mana pun.**
  Ia memberi rasa aman yang palsu: kalau drpc jatuh, tidak ada yang beralih ke
  Alchemy. Sebelum mengandalkannya sebagai redundansi, cek `grep -rn FALLBACK
  services packages` — hasilnya kosong.
- **`maxPriceAge` harus diukur dari heartbeat feed TERLAMBAT, bukan dipilih
  bulat.** Default 24 jam sama persis dengan heartbeat Chainlink USDC/USD, dan
  terukur dari aggregator mainnet 2026-08-26 jarak antar ronde adalah **23,00
  jam** (1148→1149 dan 1150→1151, keduanya 82.812 detik) diselingi ronde
  pemicu-deviasi berjarak 1 jam. Artinya margin untuk SELURUH pipeline kita —
  attestation ~8 menit, prove, submit — cuma satu jam, jadi harga stablecoin
  pasti melewati batas secara berkala. Gejalanya bukan error: `tryToUsd1e18`
  mengembalikan `ok = false` dan pasar tUSDC membeku diam-diam sampai ronde
  berikutnya masuk. Dinaikkan ke **28 jam** (100.800 detik) di chain dan di
  `Deploy.s.sol` — tanpa yang kedua, redeploy mengembalikan bug-nya.
- **Batas per-aset tidak bisa ditambahkan tanpa redeploy berantai.**
  `EfficiencyMarket.priceRegistry` di-set di konstruktor dan tidak punya setter,
  jadi mengganti `PriceRegistry` berarti men-deploy ulang `EfficiencyMarket` dan
  `CreditGraph` juga — sekaligus membatalkan alamat yang sudah dipublikasikan di
  README dan verifikasi Blockscout-nya. Periksa ada-tidaknya setter SEBELUM
  merencanakan perbaikan yang menyentuh alamat kontrak.
- **Harga bukan jumlah uang, dan tidak boleh memakai formatter yang sama.**
  `wadToUsd` dua desimal membuat USDC $0,99994916 terbaca `"0.99"` — tak
  terbedakan dari $0,99, selisih 1% pada aset yang seluruh gunanya menempel di
  $1. Dua desimal benar untuk nilai total, salah untuk harga per unit; pakai
  `wadToUsdPrice` (enam desimal, tipe `UsdPrice`).
- **Batch verify precompile itu semua-atau-tidak-sama-sekali, dan revert-nya
  `Error(string)` — bukan custom error.** Terbukti 2026-08-26 (`pnpm --filter
  @corolary/indexer t3`): satu byte dibalik di `encodedTx` salah satu anggota
  menjatuhkan seluruh batch berisi 7 dengan `Error("Merkle proof validation
  failed")`; idem bila yang dirusak satu simpul Merkle proof. Karena datang
  sebagai `Error(string)`, ia jatuh ke `retryable` di klasifikasi default — dan
  retry adalah hal paling tidak berguna untuk kegagalan deterministik: delapan
  percobaan berikutnya revert dengan pesan yang sama persis, lalu antrean
  berhenti tanpa ada pihak yang terlihat salah. Sekarang `splitBatch`/`staleProof`.
- **Eksperimen precompile pakai `eth_call`, jangan transaksi.** Revert di
  `eth_call` sudah konklusif untuk semua-atau-tidak-sama-sekali (kalau seluruh
  panggilan revert, tidak ada state yang berubah), biayanya nol, dan registry
  tidak tersentuh. Wajib disertai KONTROL memakai payload utuh: tanpa itu,
  revert pada varian rusak tidak membuktikan apa pun — batch-nya bisa saja
  memang sudah busuk sejak awal karena proof kedaluwarsa, mode kegagalan yang
  berbeda dan sudah lama diketahui.
- **Jangan turunkan ambang blok dari cursor watcher.** Cek cakupan backfill
  sempat memakai `MAX(last_scanned_block) - months*blok` sebagai batas bawah,
  lalu menuntut `from_block <= batas`. Cursor SELALU tertinggal di belakang head
  yang dipakai backfill, jadi cakupan yang baru saja ditulis dijawab "belum
  tercakup": terukur `from_block` 25.617.433 lawan ambang 25.615.294 — meleset
  2.139 blok, persis sebesar ketertinggalan cursor. Gejalanya bukan error
  melainkan dedupe yang tidak pernah cocok, dan tiap permintaan memindai ulang
  riwayat yang sudah lengkap. Ukur kedalaman dari lebar barisnya sendiri
  (`to_block - from_block`), yang tidak bergantung pada apa pun yang bergerak.
- **Respons untuk job yang sudah berjalan wajib membawa parameter JOB-nya,
  bukan parameter PERMINTAAN.** `POST /v1/backfill` sempat menggemakan `months`
  yang diminta padahal yang dikembalikan adalah job lain yang sedang antre:
  minta 12 bulan saat job 1 bulan berjalan dijawab `months: 12`. Tidak ada yang
  salah secara teknis, dan justru itu masalahnya — ia versi API dari kekeliruan
  yang sudah berulang empat kali di proyek ini: menyamakan jendela pemindaian
  dengan riwayat yang benar-benar ada.
- **Token testnet dinilai lewat `PriceRegistry.setPriceAlias`.** `tUSDC`/`tWETH`
  tidak punya feed Chainlink sendiri, dan satu aggregator hanya bisa menunjuk satu
  aset. Alias membuat mereka memakai harga mainnet yang benar-benar dibuktikan —
  tokennya stand-in, harganya tidak.

---

## Gaya

- TypeScript strict. Tanpa `any` implisit.
- Solidity `^0.8.28` — **dipaksa oleh `@gluwa/usc-contracts` v0.2.0**, bukan 0.8.23.
  Custom error, bukan string `require`, di kontrak baru.
- Komentar menjelaskan **kenapa**, bukan **apa**.
- Bahasa dokumen: Indonesia. Identifier kode, commit, dan komentar: Inggris.
