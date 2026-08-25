# Gap, Blocker, dan Keputusan Tertunda

> Register hidup. Setiap entri: apa masalahnya, kenapa penting, dan **solusinya**.
> Yang sudah beres tetap dicatat di §1 supaya tidak "ditemukan ulang" lalu diperdebatkan lagi.
>
> Terakhir diperbarui: 2026-08-25

---

## 1. Sudah Diselesaikan (jangan dibuka lagi)

| # | Temuan | Resolusi |
|---|---|---|
| R1 | Dokumen resmi memberi path import `EvmV1Decoder` yang salah (`contracts/decoding/...`) | Path benar: `@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol` |
| R2 | Pragma `^0.8.23` dari contoh tutorial akan gagal compile | `@gluwa/usc-contracts` v0.2.0 memakai `^0.8.28`. Seluruh kontrak Corolary ikut `^0.8.28`. |
| R3 | `VerifierInterface.sol` di repo tutorial tidak punya overload batch | Pakai `INativeQueryVerifier` resmi dari paket — punya `verifyAndEmit`/`verify` varian batch |
| R4 | `EvmV1Decoder.LogEntry` tidak memuat `logIndex` | On-chain memakai `txLogIndex` (posisi di `receipt.receiptLogs`); `logIndex` Ethereum disimpan off-chain saja |
| R5 | `getLogsByEventSignature` menghilangkan posisi log | Iterasi `receipt.receiptLogs` langsung di jalur pencatatan |
| R6 | Dua struct `MerkleProofEntry` berbeda (`hash` vs `sibling`) | Pakai milik `INativeQueryVerifier` saat memanggil precompile |
| R7 | Semantik `Fact.amount` per `FactKind` belum terkunci | Dikunci di `architecture.md` §8.1; `Liquidated` = `debtToCover` + `debtAsset` |
| R8 | Apakah batch verify didukung precompile? | **Ya** — terverifikasi dari ABI. Batching layak. |
| R9 | Ada **DUA** file `INativeQueryVerifier.sol` di paket yang sama | `contracts/write-ability/INativeQueryVerifier.sol` adalah salinan vendored yang **basi** (pragma `^0.8.20`, hanya `verify` tunggal, tanpa `verifyAndEmit`). Yang benar: `contracts/write-ability/common/INativeQueryVerifier.sol` (`^0.8.28`, lengkap dengan overload batch + `NativeQueryVerifierLib`). |
| R10 | Overload **batch** `verifyAndEmit` gagal compile — "stack too deep" | Butuh `via_ir = true`. Sudah diaktifkan di `packages/contracts/foundry.toml`. Bukan opsional: batching adalah strategi biaya inti. |
| R11 | Struktur paket dipasang lewat **npm**, bukan `forge install` | `.gitignore` mengabaikan `lib/`, jadi submodule Foundry akan hilang dari repo. `@gluwa/usc-contracts` & OpenZeppelin dipasang lewat pnpm; `remappings.txt` menunjuk ke `node_modules/`. Hanya `forge-std` yang tetap submodule (dengan pengecualian eksplisit di `.gitignore`). |

---

## 2. Blocker Produk — butuh keputusan sebelum M3

### B1 · Cold start: fakta lama tidak tertangkap eager proving 🟡 **CLI selesai, produk belum**

**Masalah.** Eager proving hanya menangkap event **baru**. Tapi seluruh nilai Corolary
ada pada riwayat yang **sudah** terjadi — peminjam yang melunasi 40 pinjaman Aave
selama dua tahun. Kalau kita hanya mengindeks ke depan, pengguna pertama punya skor 0
dan produknya tidak punya cerita sampai berbulan-bulan kemudian.

Ini bukan detail teknis. Ini **risiko eksistensial produk** dan pasti ditanya juri.

**Solusi: backfill on-demand berbatas ("Claim your history").**

1. Pengguna memasukkan alamat dan menekan *Claim history*.
2. Indexer memindai log Ethereum untuk alamat itu di seluruh protokol terdaftar,
   dibatasi jendela waktu (usul awal: **24 bulan**).
3. Transaksi yang ditemukan dibuktikan dalam **batch 10** — ini yang membuat proof
   historis yang mahal tetap terjangkau.
4. Fakta tercatat, skor terbentuk, pengguna langsung punya tier.

**Biayanya jujur:** proof historis ~**3,13×10⁻⁴ CTC** (12x lipat dari yang segar).
**Mahalnya proof historis TIDAK menghalangi backfill** — ia hanya melarang backfill
*buta seluruh chain*. Backfill per-alamat atas permintaan sepenuhnya layak.

> **Koreksi 2026-08-25.** Versi awal paragraf ini menulis "200 event → 20 batch",
> memakai `ceil(n / 10)`. Itu **salah**, dan salahnya ke arah yang berbahaya.
> Batas span 999 blok berarti transaksi yang terpisah berbulan-bulan tidak bisa
> satu batch. Terukur atas riwayat Aave nyata (66 transaksi sepanjang 180 hari):
> **27 batch**, bukan 7 — sepuluh di antaranya berisi satu transaksi.
> Efisiensi batching praktis hilang di backfill.
>
> Kesimpulannya tidak berubah, karena biaya dominannya ternyata bukan proof
> melainkan gas CC3, dan keduanya tetap kecil: **0,021 CTC proof + 0,025 CTC gas
> = 0,046 CTC** untuk 180 hari riwayat satu dompet. Yang berubah: perkiraan
> apa pun yang memakai `ceil(n/10)` harus diganti dengan `buildBatches()` atas
> tinggi blok yang sungguhan — dan itulah yang dilakukan `--dry-run`.

**Terimplementasi 2026-08-25 (sisi indexer).** `services/indexer/src/backfill/`,
dijalankan lewat:

```bash
pnpm --filter @corolary/indexer backfill --subject 0x… [--months 12] [--dry-run]
```

Kunci kelayakannya: subjek adalah parameter ber-`indexed` di keempat protokol,
jadi RPC menyaringnya di sisi server dan riwayat setahun satu dompet menyusut
jadi puluhan log. Jalur INSERT-nya sama persis dengan watcher live
(`insertLogs()`), jadi tidak ada jalur kedua yang bisa menyimpang.
Detail lengkap di `docs/indexer.md` §13.2b.

**Konsekuensi:** ini juga jadi mekanik akuisisi yang bagus — pengguna datang untuk
mengklaim riwayat, dan tindakan itu sendiri yang mengisi registry.

**Sisa aksi:** membungkusnya jadi fitur produk, bukan CLI admin — endpoint
`POST /v1/prove` sudah ada tapi hanya menerima satu transaksi, belum satu alamat;
dan alur UI *"Claim your history"*. Pemilik: Dev A (endpoint) & Dev B (UI).
Tenggat: sebelum M3.

---

### B2 · Aset apa yang dipinjamkan di CC3 Testnet? 🔴

**Masalah.** `EfficiencyMarket` butuh token ERC20 untuk disuplai dan dipinjam.
Di Creditcoin **testnet** tidak ada USDC/WETH sungguhan. Kita harus men-deploy ERC20
testnet sendiri — dan sekilas itu terlihat melanggar aturan "nol mock".

**Resolusi — dan ini harus dinyatakan terbuka di submission, bukan disembunyikan:**

Bedakan dua hal yang berbeda:

| Lapisan | Di testnet | Palsu? |
|---|---|---|
| **Fakta kredit** (riwayat Aave/Morpho/Compound) | Ethereum **mainnet** asli, dibuktikan kriptografis | **Tidak** |
| **Harga** (Chainlink) | Ethereum **mainnet** asli, dibuktikan kriptografis | **Tidak** |
| **Skor & tier** | Diturunkan dari fakta nyata | **Tidak** |
| **Token yang dipinjamkan di pasar** | ERC20 testnet | Ya — **tak terhindarkan** |

Aturan hackathon **mewajibkan** deploy di testnet. Token testnet adalah konsekuensi
langsung dari aturan itu, bukan pilihan kita. Yang dilarang pemilik proyek adalah
**data karangan** — angka yang dibuat-buat untuk membuat demo terlihat bagus.
Tidak ada satu pun angka semacam itu di Corolary.

**Terimplementasi 2026-08-25:** `src/testnet/FaucetToken.sol` (faucet terbuka,
cooldown 1 jam), di-deploy sebagai `tUSDC`/`tWETH` oleh `Deploy.s.sol`.

**Yang tidak terduga saat implementasi:** token testnet tidak punya feed Chainlink
sendiri, sementara feed mainnet sungguhan sudah dipetakan ke aset kanoniknya untuk
scoring — dan satu aggregator hanya bisa menunjuk satu aset. Diselesaikan lewat
`PriceRegistry.setPriceAlias`, sehingga `tUSDC` dinilai memakai **harga USDC
mainnet yang benar-benar dibuktikan**. Tokennya stand-in; harganya tidak.

**Aksi tersisa:** beri
label jelas di UI: *"Token pasar adalah token testnet. Riwayat kredit, harga, dan skor
berasal dari Ethereum mainnet sungguhan."* Menyatakannya lebih dulu **memperkuat**
kredibilitas, bukan melemahkannya — juri akan menyadarinya sendiri kalau kita diam.
Masukkan kalimat ini ke deck dan video demo.

---

### B3 · Rasio kolateral berubah di tengah posisi ✅ **SELESAI**

**Masalah.** Kalau skor pengguna turun (kena likuidasi di Ethereum), rasio yang
dipersyaratkan naik dari mis. 110% → 130%. Posisi yang tadinya sehat bisa **langsung
dapat dilikuidasi tanpa pengguna melakukan apa pun**. Benar secara ekonomi, tapi kejam
dan akan dipertanyakan reviewer.

**Solusi: kunci rasio saat pinjam + masa tenggang.**
- Simpan `ratioAtBorrow` di posisi saat `borrow`.
- Evaluasi kesehatan memakai `ratioAtBorrow`, **bukan** rasio terkini.
- Penurunan skor hanya berlaku untuk **pinjaman baru**.
- Kenaikan skor berlaku **segera** (menguntungkan pengguna, aman bagi protokol).
- Kalau skor turun, jadwalkan kenaikan rasio setelah masa tenggang (usul: **7 hari**)
  dengan notifikasi di UI, memberi pengguna waktu menambah kolateral.

**Terimplementasi 2026-08-25** di `EfficiencyMarket.effectiveRatioBps` +
`refreshRatio`. Rasio dikunci saat `borrow`; perbaikan berlaku segera; penurunan
menunggu `RATIO_GRACE_PERIOD = 7 days`. Penurunan didorong lewat `refreshRatio`
yang permissionless — likuidator berkepentingan memanggilnya, jadi pasar
mengoreksi dirinya tanpa keeper. Dikunci sebagai
`test_ScoreDegradationWaitsForGracePeriod` dan diverifikasi lewat mutation test.

---

### B4 · Model suku bunga belum ditentukan ✅ **SELESAI**

**Masalah.** `EfficiencyMarket` butuh model bunga; belum dispesifikasi.

**Solusi:** pakai model **linear kink** standar (gaya Aave), parameter per reserve:
```
utilization = totalBorrowed / totalSupplied
u <= kink :  rate = base + slope1 × (u / kink)
u >  kink :  rate = base + slope1 + slope2 × ((u - kink) / (1 - kink))
```
Nilai awal: `base = 0%`, `slope1 = 4%`, `slope2 = 60%`, `kink = 80%`, `reserveFactor = 10%`.
Ini bukan bagian inovatif produk — pakai yang sudah teruji, jangan menciptakan sendiri.

**Terimplementasi 2026-08-25** di `libraries/InterestRateModel.sol` dengan
parameter persis di atas. Monotonisitas kurva dan `borrowIndex` diuji
(`test_InterestCurveIsMonotonicAndKinks`, `test_InterestAccruesAndIndexIsMonotonic`).

---

### B5 · Tidak ada dompet mainnet milik tim → `capitalSavedUsd` selalu nol 🔴

**Masalah.** `capitalSavedUsdWad` mengembalikan 0 selama `effectiveRatioBps` masih
di baseline 15000, dan dompet tanpa riwayat terbukti selalu di baseline. Angka
utama produk — modal yang dihemat berkat skor — karena itu **tidak bisa bukan-nol**
sampai ada dompet berskor yang benar-benar meminjam.

Skor 813 (tier 4, 110%) milik `0x94963B928498bE7f06637C3D57ea1E74D7f73423`, alamat
mainnet yang kunci privatnya **bukan milik tim**. Di CC3 kita tidak bisa
menandatangani sebagai dia, jadi demo "pinjam di 110%" tidak bisa memakai dompet
yang skornya 813. Diverifikasi 2026-08-25: `EfficiencyMarket` nol transaksi sejak
deploy, dan smoke-test dengan dompet deployer (skor 0) menghasilkan
`capitalSavedUsdWad: 0` — benar secara desain, tapi kosong di layar.

**Jalan keluar yang diukur, menunggu keputusan pemilik proyek.** Pakai dompet
mainnet milik tim untuk supply/borrow/repay kecil di Aave mainnet. Gas 2026-08-25
= 0,15 gwei; empat transaksi ≈ **0,00012 ETH (~$0,40)**. Kolateral yang disetor
bisa ditarik lagi.

Skornya deterministik — komponennya tidak bergantung pada riwayat yang belum
terukur, jadi ini bukan proyeksi:

| Komponen | Poin | Kenapa pasti |
|---|---|---|
| protocolDiversity | 25 | linear, `popcount × 100 / 4`, 1 protokol |
| activeStanding | 200 | penuh selama < 90 hari |
| repaymentCount | 15 | 1 pelunasan → `200 × 1/13` |
| historyDuration | ~0 | dompet baru |
| **Total** | **~240** | → tier 1 → **140%** |

Demonya jadi **150% → 140%**: kecil, tapi benar-benar diperoleh dari transaksi
Ethereum mainnet nyata yang dibuktikan kriptografis — dan karena transaksinya
segar, ia melewati **jalur live** (attestation ~8 menit, tarif eager murah), yang
jauh lebih meyakinkan buat juri daripada backfill riwayat orang lain.

**Menyetor besar tidak menolong.** `repaymentVolume` setengah-jenuh di $50.000;
menyetor $100 dan $5.000 hampir tidak berbeda skornya. Ambil yang paling kecil
yang nyaman.

**Yang dibutuhkan dari pemilik proyek:** alamat dompetnya (bukan kunci privatnya)
dan jumlah yang mau disetor.

---


## 3. Blocker Teknis — hanya bisa dituntaskan saat development

### T1 · Tipe transaksi mana yang benar-benar didukung decoder? ✅ **SELESAI**

**Masalah.** ABI `EvmV1Decoder` mencantumkan `decodeTransactionType0..4`, tetapi sumber
Solidity hanya mengimplementasikan Type0 (legacy) dan Type2 (EIP-1559) secara penuh.
Hampir semua transaksi Aave modern bertipe 2, jadi kemungkinan besar aman — tapi
**belum dibuktikan**.

**Terjawab 2026-08-25 — tanpa perlu deploy sama sekali.** Membaca sumber
`EvmV1Decoder.sol` v0.2.0 langsung:

Batas Type0/Type2 hanya berlaku untuk decoder **type-specific**
(`decodeTransactionType0` / `decodeTransactionType2`) — dan **Corolary tidak pernah
memanggilnya.** Fakta selalu datang dari log, jadi kita hanya memakai
`decodeReceiptFields`, yang memanggil `_decodeReceiptChunk`. Fungsi itu memilih indeks
chunk berdasarkan tipe (`2` untuk t0–t2, `3` untuk t3–t4) dan menerima seluruh rentang
`txType <= 4`. Jalur receipt **agnostik terhadap tipe transaksi**.

Dikunci sebagai test: `test_ReceiptDecodeIsTypeAgnostic` di
`packages/contracts/test/ProtocolAssumptions.t.sol`, dijalankan atas `txBytes`
Ethereum mainnet asli dari `docs/samples/`. Transaksi sampel terkonfirmasi **Type 2**
(EIP-1559), sesuai dugaan.

**Sisa aksi:** tetap tandai `skipped` (bukan `failed`) untuk apa pun yang ditolak
decoder, supaya satu transaksi aneh tidak menghentikan pipeline. Pemilik: Dev A.

---

### T2 · Batas gas `recordFact` untuk transaksi ber-log banyak 🟠

**Masalah.** Satu transaksi Aave bisa memuat 20+ log (token transfer, aToken, pool).
Kita mengiterasi semuanya. Ditambah continuity proof panjang, `recordFact` bisa
menabrak batas gas blok — dan kita belum mengukurnya.

**Terukur 2026-08-25** atas transaksi Ethereum mainnet asli
(`docs/samples/proof-ethereum-mainnet.json`, Type 2, 4.864 byte, 10 log, 22 topic) —
`packages/contracts/test/ReceiptGasProfile.t.sol`:

| Tahap | Gas |
|---|---|
| `decodeReceiptFields` | **375.316** |
| Iterasi seluruh 10 log | **2.254** |
| Total | **377.570** |

**Ini membalik asumsi awal.** Biayanya **bukan** pada jumlah log — mengiterasi
sepuluh log hanya 2.254 gas, yaitu **0,6%** dari total. Hampir seluruh biaya ada di
ABI-decode `encodedTx` itu sendiri (≈77 gas per byte).

**Konsekuensi: `recordFactAtLogIndex` yang diusulkan tidak akan menolong.** Untuk
mencapai log mana pun, receipt harus di-decode utuh lebih dulu; memproses satu log
menghemat 225 gas dari 377.570. Mitigasi itu **dibatalkan** — jangan diimplementasikan.

**Variabel yang benar-benar mengikat adalah ukuran `encodedTx`, bukan jumlah log.**
Estimasi kasar: transaksi Aave 20-log berukuran ~10 KB → ~770k gas untuk decode saja.
Batch 10 transaksi → **~3,8 juta gas** hanya untuk decode, belum termasuk verifikasi
precompile dan biaya calldata.

**Diukur ulang 2026-08-25 atas 476 batch PRODUKSI** (bukan satu sampel):

```
gas ≈ 47,4 × byte + 658.615        R² = 0,833
```

Tesis T2 benar — **byte yang mengikat, bukan jumlah log** — tapi koefisien 77
gas/byte dari pengukuran terisolasi terlalu tinggi. Di batch nyata angkanya **47,4**,
karena continuity proof dibagi bersama seluruh anggota batch.

| Ukuran batch | n | Gas rata-rata | Gas per tx |
|---|---|---|---|
| 1 | 255 | 1.130.826 | **1.130.826** |
| 5 | 8 | 4.210.728 | 842.145 |
| 10 | 138 | 5.523.644 | **552.364** |

Batching memangkas gas per transaksi **51%**. Model biaya intinya terbukti di
produksi, bukan hanya di atas kertas.

**Batas gas blok CC3 Testnet = 75.000.000** (diukur dari `eth_getBlockByNumber`).
Batch termahal yang pernah terjadi: **12.772.214 gas (268.704 byte, 10 tx)** —
**17,0%** dari batas blok. Ruang kepala **5,9x**.

**Kesimpulan: anggaran byte TIDAK jadi diimplementasikan sekarang.**

Alasannya bukan malas, melainkan urutan biaya. Batching terjadi **sebelum** proof
diambil, jadi indexer belum tahu ukuran `encodedTx` saat membentuk batch —
`buildBatches` hanya menerima `{txHash, blockHeight, txIndex, observedAt}`.
Menegakkan batas byte berarti salah satu dari dua hal, dan keduanya buruk:

- mengambil ukuran receipt dari RPC Ethereum untuk **setiap** transaksi sebelum
  membatch — satu panggilan RPC tambahan per transaksi, untuk risiko yang belum
  pernah terjadi; atau
- memeriksa setelah proof diambil, yang berarti memecahnya **setelah proof dibayar**.

Dengan `MAX_BATCH_SIZE = 10` dan byte terbesar yang pernah terjadi di 282.208 —
**55%** dari anggaran 513.630 byte yang setara sepertiga batas blok — batas jumlah
transaksi sudah menjadi pengaman yang memadai.

**Aksi tersisa:**
- Pasang peringatan bila total byte satu batch melewati **400.000** (1,4x rekor
  saat ini). Itu memberi tahu kita **sebelum** rusak, tanpa biaya RPC apa pun.
- Tinjau ulang kalau `MAX_BATCH_SIZE` pernah dinaikkan di atas 10, atau kalau
  protokol dengan receipt jauh lebih besar ditambahkan.


Pemilik: Dev A.

---

### T3 · Batasan sebenarnya dari batch verify 🟡

**Masalah.** Dokumen menyebut maks 10 proof dan rentang 1000 blok. Yang belum jelas:
apakah precompile menolak keras di luar batas, apakah semua tinggi harus menaik, dan
bagaimana perilakunya kalau satu transaksi dalam batch tidak valid — apakah seluruh
batch gagal (kemungkinan besar ya, karena mengembalikan satu `bool`).

**Solusi:** uji empiris di M1. Asumsikan **semua-atau-tidak-sama-sekali** sampai
terbukti sebaliknya. Indexer harus bisa jatuh ke mode per-transaksi saat satu batch
gagal, agar satu transaksi buruk tidak memblokir sembilan yang sehat.

**Diuji live 2026-08-25 di CC3 Testnet** terhadap precompile asli, memakai proof
transaksi Ethereum mainnet sungguhan. 25 batch berukuran 1-10 transaksi lolos
`verifyAndEmit`, menghasilkan 150 fakta dari 59 dompet, nol kegagalan.

Terukur, dan inilah pembenaran strategi batching:

| Ukuran batch | Gas |
|---|---|
| 10 transaksi | 4.198.654 |
| 1 transaksi | 1.314.292 |

Sepuluh pengiriman tunggal akan menghabiskan ~13,1 juta gas; satu batch berisi
sepuluh menghabiskan 4,2 juta. **~3x lebih murah**, di atas penghematan biaya proof
yang sudah ada karena satu continuity proof dibagi bersama.

**Diperbarui 2026-08-25 malam — jalur fallback SUDAH dieksekusi di chain.**

16 batch masuk status `split` di produksi. Yang menentukan adalah
`batch-25830734-25830742-6`: sepuluh transaksi, revert sebagai batch, dipecah,
lalu **kesepuluh anggotanya berhasil masing-masing** sebagai 10 transaksi
Creditcoin terpisah — menghasilkan 13 fakta. Jalur per-transaksi bukan lagi kode
yang bertipe benar tapi belum pernah jalan.

**Dan itu MEMBALIK asumsi awal T3.** Dugaannya: batch gagal karena ada satu
transaksi buruk di dalamnya. Yang teramati justru sebaliknya — batch itu revert
sementara **setiap** anggotanya sah, terbukti karena kesepuluhnya lolos sendiri-
sendiri beberapa detik kemudian dengan proof yang baru dibeli.

Artinya kegagalan batch **tidak menyiratkan anggota yang buruk**. `sharedContinuityProof`
adalah titik kegagalan tunggal untuk seluruh batch: satu proof yang kedaluwarsa
menjatuhkan sepuluh transaksi yang tidak ada cacatnya. Memecah batch tetap respons
yang benar, tapi bukan karena ia mengisolasi anggota busuk — melainkan karena ia
memaksa pembelian proof baru.

**Yang MASIH belum terbukti:**

- **Semua-atau-tidak-sama-sekali belum pernah teramati dalam bentuk murninya**,
  yaitu satu anggota benar-benar tidak sah di antara anggota yang sah. Yang kita
  amati adalah kegagalan tingkat-batch, bukan kegagalan tingkat-anggota. Asumsinya
  tetap berlaku.
- **Apakah tinggi blok harus menaik: tetap tidak terjawab.** Dari 790 batch
  multi-transaksi, **nol** yang tidak menaik — jadi pertanyaannya tidak pernah
  sempat diuji. Penyebabnya bukan kebetulan: `buildBatches` mengurutkan berdasarkan
  `observedAt`, yaitu timestamp blok Ethereum, yang monoton terhadap `blockHeight`,
  dengan `blockHeight` sebagai pemecah seri. Urutan menaik dijamin **oleh
  konstruksi**. Kalau pengurutan itu pernah diubah, batasnya akan ditemukan dengan
  cara yang mahal.
- **Span di perbatasan (999 vs 1000) tetap tidak diuji di chain**, karena
  `_verifyBatch` milik kita menolaknya lebih dulu. Sekarang dikunci tes unit di
  `services/indexer/src/prover/batching.test.ts`, ditulis terhadap span **tepat
  1000** — off-by-one yang benar-benar pernah rilis.


**Aksi tersisa:** picu satu batch gagal dengan anggota yang benar-benar TIDAK SAH
(bukan sekadar proof kedaluwarsa) untuk mengamati semua-atau-tidak-sama-sekali dalam
bentuk murninya. Pemilik: Dev A.

---

### T4 · Pemetaan `Id` → `loanToken` di Morpho Blue ✅ **SELESAI**

**Masalah.** Event Morpho membawa `Id` (hash parameter pasar), bukan alamat token.
Dari log saja, alamat token **tidak bisa** diturunkan.

**Solusi:** indexer memanggil `idToMarketParams(Id)` di Morpho (Ethereum) untuk
me-resolve `loanToken`/`collateralToken`, lalu kurator mendaftarkannya ke adapter lewat
`setMarket(Id, loanToken, collateralToken)`. Pasar yang belum terdaftar → `ok == false`,
di-skip, dan memicu alert supaya kurator menambahkannya.

**Diimplementasikan 2026-08-25.** `MorphoBlueAdapter.setMarket(id, loanToken,
collateralToken)` di bawah `CURATOR_ROLE`. Pasar yang belum terdaftar mengembalikan
`ok == false` dan di-skip — adapter tidak pernah menebak token.

**Keputusan cakupan diperbarui:** pemotongan ke "Aave V3 saja" **dibatalkan** atas
keputusan pemilik proyek (2026-08-25). Keempat protokol dikirim: Aave V3, SparkLend,
Morpho Blue, Compound V3. Konsekuensinya `TARGET_DIVERSITY_PROTOCOLS = 4` kini
benar-benar bisa dipenuhi, jadi `protocolDiversity` 100 poin tercapai dan langit-langit
skor kembali mendekati 1000 — bukan ~900 seperti pada skenario Aave-only.

**Aksi tersisa:** indexer memanggil `idToMarketParams(Id)` di Morpho (Ethereum) untuk
me-resolve token, lalu memicu alert supaya kurator mendaftarkan pasar baru.

---

### T8 · Compound V3: pinjam/lunas aset dasar tidak bisa dibedakan dari satu log 🟠

**Masalah.** Saldo aset dasar Comet **bertanda** — positif menyuplai, negatif meminjam.
`supplyBase` memecah jumlahnya jadi porsi *repay* + porsi *supply*; `withdrawBase`
memecahnya jadi *withdraw* + *borrow*. Event `Supply`/`Withdraw` hanya memancarkan
**totalnya**, jadi dari satu log saja mustahil membedakan peminjam yang melunasi dari
pemberi pinjaman yang menyetor.

**Kenapa ini kritis, bukan sekadar kurang lengkap.** `docs/contracts.md` §7c semula
mengarahkan `Supply` → `LoanRepaid`. Kalau itu diikuti, siapa pun bisa menyetor USDC
ke Compound V3 dan langsung memperoleh fakta pelunasan bernilai besar — **reputasi
gratis tanpa pernah meminjam**, lalu dana langsung ditarik lagi. Seluruh argumen
Sybil-resistance runtuh.

**Yang sudah dilakukan:** `Supply`/`Withdraw` aset dasar **tidak dipetakan sama sekali**.
Compound V3 tetap menyumbang `SupplyCollateral`, `WithdrawCollateral`, dan `AbsorbDebt`
(likuidasi) — semuanya tidak ambigu. Menghitung kurang itu aman; menghitung lebih itu
fatal dan permanen.

**Jalan menuju fidelitas penuh.** Sinyal pembedanya ADA, hanya tidak di log itu: Comet
memancarkan `Transfer` terpisah **hanya untuk porsi supply/withdraw-nya**, sehingga
porsi pinjam/lunas = selisih antara jumlah di `Supply`/`Withdraw` dan jumlah di
`Transfer` yang menyertainya. Membacanya menuntut **korelasi antar log dalam satu
transaksi**, sementara `IProtocolAdapter.decodeLog` sengaja hanya melihat satu log
supaya tetap murah dan deterministik.

Kalau ini mau dikejar, ubah interfacenya jadi:
```solidity
function decodeLog(EvmV1Decoder.LogEntry[] calldata logs, uint256 index) external view returns (...);
```
Biayanya: seluruh array log harus di-ABI-encode ulang untuk **setiap** panggilan
adapter — kira-kira O(n²) terhadap ukuran log. Ukur dulu sebelum berkomitmen; anggaran
gas `recordFact` sudah didominasi decode receipt (T2).

**Aksi:** biarkan seperti sekarang kecuali volume pelunasan Compound terbukti penting
bagi demo. Pemilik: Dev A.

---

### T5 · Rotasi aggregator Chainlink ✅ **SELESAI**

**Masalah.** Chainlink mengganti aggregator di balik proxy saat upgrade feed. Kalau
kita hanya mempercayai satu alamat, feed **berhenti terbarui secara senyap** —
jenis kegagalan paling berbahaya karena tidak ada error yang muncul.

**Solusi:**
- `PriceRegistry` menyimpan **himpunan** aggregator tepercaya per aset, bukan satu.
- Indexer memanggil `aggregator()` pada proxy setiap N blok; kalau berubah → alert.
- `maxPriceAge` (24 jam) memastikan feed yang mati **membekukan pasar**, bukan
  menjalankannya dengan harga basi. Kegagalan senyap berubah menjadi kegagalan berisik.

**Terimplementasi 2026-08-25 (sisi kontrak).** `PriceRegistry` menyimpan
`assetOfAggregator` sebagai pemetaan **banyak-ke-satu**: beberapa aggregator boleh
melayani aset yang sama, jadi aggregator pengganti bisa dipercayai **sebelum**
Chainlink melakukan upgrade — tidak ada jeda di mana harga berhenti terbarui.
`maxPriceAge` (24 jam) ditegakkan di titik BACA memakai `updatedAt` yang terbukti,
sehingga feed yang mati membekukan penilaian alih-alih menjalankannya dengan harga
basi. Dikunci sebagai `test_TwoAggregatorsCanServeTheSameAsset`.

**Terimplementasi 2026-08-25 (sisi indexer).** `initPrices()` di
`services/indexer/src/prices/run.ts` memeriksa TIGA hal sekali per start, dan
ketiganya gagal secara senyap kalau tidak diperiksa:

1. aggregator di `feeds.ts` benar-benar dipercaya kontrak — kalau tidak,
   `recordPrice` melewatinya **tanpa revert**, jadi biaya proof terbayar dan nol
   harga tercatat;
2. aggregator dipetakan ke aset yang kita kira — salah petakan berarti harga
   benar disimpan di aset yang salah;
3. `proxy.aggregator()` masih sama dengan yang dikonfigurasi — inilah deteksi
   rotasinya.

Ketiganya di-log pada level **error** dan menyebutkan panggilan kurator yang
harus dijalankan. Diverifikasi live 2026-08-25: ketiga aggregator
(`0x7d4E…6Fb5`, `0x4a34…84f1`, `0xc9E1…e9d7`) masih cocok dengan yang di-deploy.

Pemeriksaan dilakukan per start, bukan "setiap N blok": rotasi aggregator adalah
peristiwa berskala bulan, dan indexer di-restart jauh lebih sering daripada itu.

---

### T5b · Jalur harga Chainlink di indexer ✅ **SELESAI**

**Masalah.** Kontrak `PriceRegistry` siap sejak deploy, tapi tidak ada yang
mengisinya. Akibatnya `amountUsd`, `priceUsd`, dan `priceSourceTxHash` bernilai
`null` di SELURUH API, dan `EfficiencyMarket` tidak bisa menilai kolateral —
punchline "150% → 110%" tidak punya angka untuk ditampilkan.

**Solusi yang dipilih: loop terpisah, bukan pipeline fakta.** Dua alasan yang
masing-masing sudah cukup:

- **Bentuk datanya berbeda.** `observed_events` mengejar KELENGKAPAN; harga hanya
  butuh ronde TERBARU per aset, dan kontrak sendiri membuang `roundId` yang lebih
  kecil. Mengalirkan harga lewat pipeline fakta berarti membeli proof untuk setiap
  ronde setiap feed selamanya — terukur ~18 ronde ETH/USD per 3.000 blok — lalu
  membuang hampir semuanya di kontrak.
- **Tujuannya kontrak lain.** `recordPrice` ada di `PriceRegistry` dan hanya punya
  varian tunggal; submitter fakta memanggil `recordFactBatch` di `FactRegistry`.

Karena hanya ronde terbaru yang penting, loop ini **tanpa state**: tidak ada cursor,
tidak ada antrean. Tiap putaran bertanya ke chain "ronde apa yang sudah kupunya?",
lalu memindai mundur dari `finalized`. Restart di titik mana pun aman.

**Ambang yang dipakai dan alasannya:**

| Konstanta | Nilai | Kenapa |
|---|---|---|
| `REFRESH_AFTER_SECONDS` | 3.600 | jauh di bawah `maxPriceAge` 86.400, jadi kegagalan sementara punya 23 jam untuk pulih sebelum pasar membeku |
| `MAX_LOOKBACK_BLOCKS` | 6.000 (~20 jam) | menjaga seluruh jalur harga di dalam jendela eager-proving 24 jam (2,59×10⁻⁵ vs 3,13×10⁻⁴ CTC) |
| `SCAN_CHUNK_BLOCKS` | 3.000 | aggregator adalah kontrak yang jarang memancarkan log; terukur <500 ms per 3.000 blok di drpc, berbeda jauh dari Aave yang harus dipotong ke 500 |
| `STALE_CONCERN_SECONDS` | 43.200 | di bawah ini, tidak adanya ronde baru adalah keadaan NORMAL — menaikkannya jadi `warn` akan menenggelamkan alarm sungguhan |

**Terverifikasi live 2026-08-25.** Ketiga harga tercatat on-chain pada percobaan
pertama: ETH/USD $2.511,24 (261.548 gas), BTC/USD $80.710,83 (286.636 gas),
USDC/USD $0,99993882 (249.452 gas). Setelahnya 26 dari 40 fakta terbaru punya
`amountUsd`, dan `tryToUsd1e18` untuk token alias mengembalikan nilai benar
(1.000 tUSDC = $999,94; 1 tWETH = $2.511,24).

**Yang masih terbuka:** hanya WETH/WBTC/USDC yang punya aggregator tepercaya.
USDT, USDe, sUSDe, USDS, dan cbBTC muncul di fakta tanpa harga, jadi `amountUsd`
untuk fakta beraset itu tetap `null`. Menambahkannya adalah panggilan
`registerAsset` + `trustAggregator` oleh kurator, bukan pekerjaan kode.

---

### T6 · Reorg Ethereum sebelum attestation 🟡

**Masalah.** Indexer bisa melihat event di blok yang kemudian ter-reorg.

**Solusi:** hanya proses log dari blok bertag **`finalized`** (bukan `latest`).
Finalitas Ethereum ~13 menit, attestation ~8 menit — jadi menunggu finalitas tidak
menambah latensi yang berarti karena kita memang harus menunggu attestation.
Sebagai jaring pengaman: attestation itu sendiri hanya terjadi pada blok terkonfirmasi,
sehingga transaksi ter-reorg tidak akan pernah punya proof yang sah.

**Aksi:** pakai tag `finalized` di watcher. Pemilik: Dev A.

---

### T7 · Gas CTC untuk dompet indexer 🟡

**Masalah.** Indexer mengirim transaksi terus-menerus. Kalau CTC habis, pipeline mati senyap.

**Solusi:** monitor saldo, alert di ambang batas, dan **jangan** memakai satu dompet
untuk semua peran. Faucet testnet punya limit — minta lebih awal, jangan saat sudah kering.

**Aksi:** alert saldo + runbook. Pemilik: Dev A.

---

## 4. Peluang yang Sedang Dipantau

### O1 · Writability ternyata SUDAH ada di paket kontrak 🟢

`@gluwa/usc-contracts` v0.2.0 (rilis 17 Agustus 2026) memuat suite writability lengkap:
`Outbox`, `Inbox`, `AttestorRegistry`, `RelayerContract`, `AcknowledgementValidator`,
`USCRelayingQuoter`, dan lainnya.

Dokumentasi masih menyatakan writability **belum rilis di testnet** dan sedang diaudit.
Jadi kontraknya ada, jalurnya mungkin belum aktif.

**Sikap:** **jangan bangun apa pun di atasnya.** Arsitektur Corolary tetap searah.
Tapi ini layak disebut di deck sebagai arah roadmap: begitu writability aktif, Corolary
bisa memancarkan attestation skor **kembali ke Ethereum**, menjadikan reputasi yang
dibangun di Creditcoin dapat dipakai di chain asalnya. Itu cerita ekspansi yang kuat
untuk pembicaraan CEIP.

**Aksi:** cek berkala apakah `Outbox` sudah aktif di CC3 Testnet. Jangan jadikan dependensi.

---

## 5. Ringkasan Prioritas

| Prioritas | Item | Kapan |
|---|---|---|
| 🟡 Sisa | **B1** backfill — CLI per-subjek ✅ 2026-08-25; endpoint per-alamat & UI belum | sebelum M3 |
| 🔴 Kritis | **B5** dompet mainnet tim untuk riwayat Aave nyata — tanpa ini `capitalSavedUsd` selalu nol | **menunggu keputusan** |
| 🔴 Kritis | **B2** posisi jujur soal token testnet — masukkan ke deck & video (kontrak ✅, komunikasi belum) | sebelum M5 |
| ✅ Selesai | **T1** tipe transaksi — jalur receipt agnostik tipe | 2026-08-25 |
| 🟠 Tinggi | **T2** anggaran batch berbasis BYTE (bukan jumlah log) | terukur; batas blok CC3 masih perlu diukur |
| 🟠 Tinggi | **T3** batas batch verify | **di M1** |
| ✅ Selesai | **B3** kunci rasio + masa tenggang 7 hari | 2026-08-25 |
| ✅ Selesai | **B4** model bunga linear kink | 2026-08-25 |
| ✅ Selesai | **T5** himpunan aggregator + kesegaran di titik baca | 2026-08-25 |
| ✅ Selesai | **T5b** jalur harga di indexer + deteksi rotasi aggregator | 2026-08-25 |
| ✅ Selesai | **T4** Morpho — tabel pasar via `setMarket` | 2026-08-25 |
| 🟠 Sedang | **T8** Compound V3 — pinjam/lunas aset dasar tidak dipetakan (aman, tapi tidak lengkap) | opsional |
| 🟡 Rendah | **T6, T7** finalized tag, alert saldo gas | M2 |
| 🟢 Pantau | **O1** kesiapan writability | berkala |

> **Satu kalimat kalau harus memilih:** kerjakan **M1** dulu (satu event Aave mainnet
> nyata terbukti dan tercatat), karena T1/T2/T3 hanya bisa dijawab di sana — dan
> ketiganya berpotensi mengubah desain. Semua pekerjaan lain bertumpu pada jawaban itu.
