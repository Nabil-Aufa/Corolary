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

### B1 · Cold start: fakta lama tidak tertangkap eager proving 🔴

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
Peminjam aktif dengan 200 event → 20 batch → masih di orde **10⁻³ CTC**. Praktis nol.
**Jadi mahalnya proof historis TIDAK menghalangi backfill** — ia hanya melarang
backfill *buta seluruh chain*. Backfill per-alamat atas permintaan sepenuhnya layak.

**Konsekuensi:** ini juga jadi mekanik akuisisi yang bagus — pengguna datang untuk
mengklaim riwayat, dan tindakan itu sendiri yang mengisi registry.

**Aksi:** rancang sebagai fitur produk kelas satu, bukan skrip admin.
Pemilik: Dev A (indexer + endpoint) & Dev B (alur UI). Tenggat: sebelum M3.

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

**Aksi:** deploy `TestUSDC`/`TestWETH` di CC3 Testnet dengan faucet terbuka, dan beri
label jelas di UI: *"Token pasar adalah token testnet. Riwayat kredit, harga, dan skor
berasal dari Ethereum mainnet sungguhan."* Menyatakannya lebih dulu **memperkuat**
kredibilitas, bukan melemahkannya — juri akan menyadarinya sendiri kalau kita diam.
Masukkan kalimat ini ke deck dan video demo.

---

### B3 · Rasio kolateral berubah di tengah posisi 🟠

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

**Aksi:** implementasikan asimetri ini secara eksplisit dan beri komentar di kode —
reviewer pasti menanyakannya. Pemilik: Dev A. Tenggat: M3.

---

### B4 · Model suku bunga belum ditentukan 🟠

**Masalah.** `EfficiencyMarket` butuh model bunga; belum dispesifikasi.

**Solusi:** pakai model **linear kink** standar (gaya Aave), parameter per reserve:
```
utilization = totalBorrowed / totalSupplied
u <= kink :  rate = base + slope1 × (u / kink)
u >  kink :  rate = base + slope1 + slope2 × ((u - kink) / (1 - kink))
```
Nilai awal: `base = 0%`, `slope1 = 4%`, `slope2 = 60%`, `kink = 80%`, `reserveFactor = 10%`.
Ini bukan bagian inovatif produk — pakai yang sudah teruji, jangan menciptakan sendiri.

**Aksi:** implementasi + uji monotonisitas indeks. Pemilik: Dev A. Tenggat: M3.

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

**Aksi yang benar:**
- Batasi batch berdasarkan **total byte**, bukan hanya jumlah transaksi. Indexer harus
  menjumlahkan `encodedTx.length` dan memecah batch sebelum menembus anggaran gas.
- Ukur batas gas blok CC3 Testnet yang sebenarnya, lalu turunkan anggaran itu dari sana.
- Ukur ulang dengan transaksi Aave V3 nyata (sampel saat ini belum tentu Aave) untuk
  mendapat angka byte/log yang representatif.

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

**Aksi:** uji + implementasi fallback. Pemilik: Dev A.

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

### T5 · Rotasi aggregator Chainlink 🟠

**Masalah.** Chainlink mengganti aggregator di balik proxy saat upgrade feed. Kalau
kita hanya mempercayai satu alamat, feed **berhenti terbarui secara senyap** —
jenis kegagalan paling berbahaya karena tidak ada error yang muncul.

**Solusi:**
- `PriceRegistry` menyimpan **himpunan** aggregator tepercaya per aset, bukan satu.
- Indexer memanggil `aggregator()` pada proxy setiap N blok; kalau berubah → alert.
- `maxPriceAge` (24 jam) memastikan feed yang mati **membekukan pasar**, bukan
  menjalankannya dengan harga basi. Kegagalan senyap berubah menjadi kegagalan berisik.

**Aksi:** implementasi pemantauan. Pemilik: Dev A. Tenggat: M3.

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
| 🔴 Kritis | **B1** backfill on-demand — tanpa ini produk tidak punya cerita | sebelum M3 |
| 🔴 Kritis | **B2** posisi jujur soal token testnet — masukkan ke deck & video | sebelum M5 |
| ✅ Selesai | **T1** tipe transaksi — jalur receipt agnostik tipe | 2026-08-25 |
| 🟠 Tinggi | **T2** anggaran batch berbasis BYTE (bukan jumlah log) | terukur; batas blok CC3 masih perlu diukur |
| 🟠 Tinggi | **T3** batas batch verify | **di M1** |
| 🟠 Tinggi | **B3** kunci rasio + masa tenggang | M3 |
| 🟠 Tinggi | **B4** model bunga linear kink | M3 |
| 🟠 Tinggi | **T5** pemantauan rotasi aggregator | M3 |
| ✅ Selesai | **T4** Morpho — tabel pasar via `setMarket` | 2026-08-25 |
| 🟠 Sedang | **T8** Compound V3 — pinjam/lunas aset dasar tidak dipetakan (aman, tapi tidak lengkap) | opsional |
| 🟡 Rendah | **T6, T7** finalized tag, alert saldo gas | M2 |
| 🟢 Pantau | **O1** kesiapan writability | berkala |

> **Satu kalimat kalau harus memilih:** kerjakan **M1** dulu (satu event Aave mainnet
> nyata terbukti dan tercatat), karena T1/T2/T3 hanya bisa dijawab di sana — dan
> ketiganya berpotensi mengubah desain. Semua pekerjaan lain bertumpu pada jawaban itu.
