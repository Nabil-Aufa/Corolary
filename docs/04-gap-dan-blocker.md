# Gap, Blocker & Cara Memverifikasinya

Terakhir diperbarui **9 Agustus 2026**.

> **Yang berubah 9 Agustus.** Lima gap ditutup dengan pengukuran (**G5, G10, G14, G15**,
> plus C12–C16 baru). Satu di antaranya ditutup karena **premisnya ternyata salah** —
> G5 bukan bug Creditcoin, melainkan URL usang di dokumen kita. Tiga gap baru dibuka
> untuk Babak 5 (**G16–G18**). Sisa gap terbuka: **9**, dan **tidak satu pun blocker**.

Aturan main dokumen ini: **tidak ada asumsi yang boleh masuk deck tanpa diukur.**
Setiap baris punya cara pembuktian konkret. Kalau sebuah gap ditutup, pindahkan ke §1
beserta angkanya.

---

## 1. Sudah tertutup — dengan pengukuran sendiri

| # | Pertanyaan | Jawaban terukur | Tanggal |
|---|---|---|---|
| C1 | Bisakah kontrak Creditcoin memverifikasi event kontrak Ethereum **yang bukan milik kita**? | **Ya.** `verifySingle → true` atas tx USDC Circle; `from`/`to`/`value` terbaca. | 1 Agt |
| C2 | Ada dana untuk deploy & transaksi tulis? | ⚠️ **DIBUKA ULANG 9 Agt.** Kunci akun lama hilang; tiga akun baru sudah dibuat tapi **saldo 0** — deployer `0x825003Ed…` menunggu faucet Discord. Lihat G20. | 1 Agt → 9 Agt |
| C3 | Apakah CC3 testnet meng-attest **Ethereum mainnet**? | **Ya.** chainKey 3 = chainId 1, live. `verifySingle → true`, 1.357 ms. | 2 Agt |
| C4 | Berapa biaya `ingest` sebenarnya? | ~15,6 gas/byte txBytes. Kecil 46.394 gas (0,0000232 CTC); 32 KB → 498.909 gas. | 2 Agt |
| C5 | Apakah calldata mainnet raksasa menabrak block limit? | **Tidak.** Terburuk 115 KB ≈ 1,8 jt gas = **2,4%** dari limit 75 jt. | 2 Agt |
| C6 | Apakah batching hemat? | **Ya, 21%.** 37.079 vs 46.746 gas/tx. Fungsi = **overload `verifyAndEmit`**. | 2 Agt |
| C7 | Apakah data cukup hidup untuk demo jujur? | Mainnet USDC 5.920 log/20 mnt, USDT 8.634. Sepolia lending **mati**. | 2 Agt |
| C8 | **Apakah produk ini mainnet-able?** | **Ya.** Attestcoin live di Creditcoin mainnet (102030); `verifySingle → true`. | 2 Agt |
| C9 | Berapa lag attestation, dan stabil? | ⚠️ **DIGANTIKAN C14.** Angka lama ~44/~74 adalah sampel tunggal; lag sebenarnya **pita**. | 2 Agt |
| C11 | **Bisakah frontend baca langsung dari chain?** | **Ya.** `eth_call` tanpa batas. `eth_getLogs` maks **10.000 blok / 10 dtk** (≈42 jam riwayat), filter alamat tidak menolong. Block time 15 dtk. Detail: `01-riset-mendalam.md` §1.5c. | 2 Agt |
| C10 | **Berapa besar attestor set & bagaimana kuorumnya?** (eks-G9) | Dibaca dari pallet `attestation`: **7 attestor** terdaftar (mainnet), sampel VRF **5**, `AuthorizedOnly`, interval **10 blok**, **`minBondRequirement = 0`**. Detail: `01-riset-mendalam.md` §1.5b. ⚠️ diukur pada spec ≤130 — **ukur ulang di 131** | 2 Agt |
| C12 | **Apakah Proof API Creditcoin mainnet benar-benar rusak?** (eks-G5) | **TIDAK.** URL-nya berubah. `proofbuilder.cc3-mainnet-usc.creditcoin.network` → **HTTP 200, proof lengkap, 1.052 ms**, TLS valid. Premis G5 salah. | 9 Agt |
| C13 | **Apakah `EvmV1Decoder` ada di Creditcoin mainnet?** | **Ya.** `0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C`, `eth_getCode` mengembalikan bytecode. Tidak perlu deploy sendiri. | 9 Agt |
| C14 | **Berapa lag attestation di bawah Attestor V2 (spec 131)?** (eks-G14 separuh) | **Pita, bukan titik.** Testnet 32–42 blok (kedua chainKey), CC mainnet 65–73. Lebar pita = `chainAttestationInterval` = 10. Model §1.5b terkonfirmasi kuantitatif. | 9 Agt |
| C15 | **Alamat treasury nyata untuk observatory?** (eks-G10) | **Sky LitePSM Pocket** `0x37305B1c…` — **4.251.196.990 USDC** dan `eth_getCode == 0x` (**EOA**). Plus Resolv & Reserve eUSD dengan catatan. Ethena **dicabut**. Detail: `01` §3.5. | 9 Agt |
| C16 | **Apa persisnya yang di-commit attestation?** | `(tx, receipt)` saja — **tanpa block header, tanpa `stateRoot`**. Membuktikan **saldo** di Ethereum mustahil permanen. Dasar RT11 dan Babak 5. Detail: `01` §1.7. | 9 Agt |
| C17 | **Adakah chain sumber baru?** | **Tidak.** `get_chain_by_key(0..6)`: testnet hanya key 1 (Sepolia) & 3 (ETH); mainnet hanya key 1 (ETH). "Omnichain" tetap haram. | 9 Agt |
| C18 | **Apakah biaya benar naik >10×/hari umur tx?** (eks-G8) | **TIDAK.** Naik lalu **datar**: 1 root (≤100 blok) → 11 (150) → **~61 dan berhenti** (200 blok s/d 30 hari). Backfill dibatasi waktu, bukan biaya. | 9 Agt |
| C19 | **Apakah fungsi pencari jangkar ChainInfo bekerja?** (eks-G19) | **Ya.** `find_highest_attested_before(25.713.420)` → 25.713.410 (interval 10 blok terkonfirmasi); `is_height_attested`, `get_attestation_bounds` semua benar. Gratis lewat `eth_call`. | 9 Agt |
| C20 | **Ada dana?** (eks-G20) | **Ya.** Deployer baru `0x825003Ed…` = **10.000 tCTC**, nonce 0. Akun lama mati. | 9 Agt |
| C21 | **Proof API kena rate limit?** (eks-G3) | **Tidak.** 60 panggilan beruntun → 60× HTTP 200, nol 429. p50 **1.072 ms**. Throughput dibatasi latensi (~0,9 req/dtk), bukan throttling. | 9 Agt |
| C22 | **Slot `balanceOf` USDC di Base?** (eks-G16) | **Slot 9**, cocok 3/3 holder nyata. `eth_getProof` → 9 node akun + 8 node storage. | 9 Agt |
| C23 | **Di mana `rootClaim` Base berada?** (eks-G17) | **`topics[3]` — INDEXED**, jadi ada di receipt log → jalurnya identik dengan `Transfer`. Factory Base `0x43edb88c…`, gameType **621**, ~3 usulan/jam. ⚠️ 21 factory aktif di L1 — filter alamat **dan** gameType. | 9 Agt |
| C24 | **Berapa besar calldata MPT proof?** (eks-G18) | **≈7.440 byte** ≈ 116.000 gas = **0,15%** block limit. Bukan kendala. | 9 Agt |
| C25 | **Apakah Attestor V2 mengubah model kepercayaan?** | **Tidak.** Diukur ulang di spec 131 tanpa `@polkadot/api`: `attestorsCount` 4/7/7 · `targetSampleSize` 3/**5**/5 · `AuthorizedOnly` · interval 10 · **`minBondRequirement` = 0**. ⚠️ Satu koreksi: Sepolia `targetSampleSize` = **5**, bukan 3. Daftar klaim terlarang §7 tetap berlaku. | 9 Agt |

---

## 2. Gap — indeks

Bagian di bawah diurutkan **berdasarkan risiko**, bukan nomor, jadi pakai tabel ini
untuk menemukan yang kamu cari.

| Gap | Status | Isi singkat |
|---|---|---|
| **G1** | 🔴 terbuka | Batch di level kontrak kita belum diukur |
| **G2** | 🔴 terbuka | Batas batch (10 proof / 1000 blok) belum ditabrak |
| **G3** | ✅ ditutup | Rate limit proof API — **tidak ada**, p50 1.072 ms |
| **G4** | 🔴 terbuka | `RawProofBuilder` — satu-satunya ketergantungan server tersisa |
| **G5** | ✅ ditutup | Proof API mainnet — **tidak rusak**, URL berubah |
| **G6** | 🟠 terbuka | Perilaku saat reorg Ethereum |
| **G7** | 🟡 terbuka | `estimateGas` pada precompile |
| **G8** | ✅ ditutup | Biaya vs umur tx — **naik lalu DATAR**, docs menyesatkan |
| **G9** | ✅ ditutup | Attestor set & quorum |
| **G10** | ✅ ditutup | Target observatory — terverifikasi on-chain |
| **G11** | 🟢 terbuka | Tx raksasa (115 KB) belum dieksekusi sungguhan |
| **G12** | 🟢 terbuka | `haircutBps` — prinsip desain, isinya sudah diputuskan |
| **G13** | 🔴 terbuka | Worker belum terbukti hidup — **butuh VPS**, runbook siap |
| **G14** | ✅ ditutup | `maxStalenessBlocks` = 63 / 111 |
| **G15** | ✅ ditutup | `maxMintPerWindowBps` = 500 (5%) |
| **G16** | ✅ ditutup | Slot `balanceOf` USDC di Base = **9** |
| **G17** | ✅ ditutup | `rootClaim` ada di **topic3**; factory & gameType terukur |
| **G18** | ✅ ditutup | Bukti MPT ≈ 7.440 byte = 0,15% block limit |
| **G19** | ✅ ditutup | Fungsi pencari jangkar ChainInfo bekerja |
| **G20** | ✅ ditutup | Dana — 10.000 tCTC masuk, sudah terdistribusi |
| **G21** | 🔴 terbuka | Dashboard belum punya rumah — **butuh akun**, keputusan siap |
| **G22** | 🔴 terbuka | `forge script --broadcast` di Creditcoin — **uji sebelum Fase 2** |

## 2b. Gap terbuka — diurutkan berdasarkan risiko

### 🔴 G1 — Batch di level *kontrak kita* belum pernah diukur

**Status:** kita mengukur `verifyAndEmit` batch **langsung ke precompile**, bukan lewat
kontrak yang juga men-decode 5 receipt dan menjalankan logika.

**Kalau salah:** biaya batch sesungguhnya bisa jauh di atas 21% penghematan, karena
decoding 5 receipt jauh lebih mahal daripada 5 verifikasi. Bisa membalik keputusan
arsitektur worker.

**Cara verifikasi:** setelah `ReserveLedger` ada, `estimateGas` pada `ingestBatch` dengan
5 tx nyata vs 5× `ingest`. Bandingkan. **Lakukan sebelum menulis logika batching di worker.**

---

### 🔴 G2 — Batas batch (10 proof / 1000 blok) belum diuji

**Status:** angka dari `[docs]`, tidak pernah kita tabrak sendiri.

**Kalau salah:** worker menumpuk batch yang selalu gagal, antrean membengkak, biaya naik
karena tx menua (>10×/hari).

**Cara verifikasi:** naikkan ukuran batch 2→5→10→11 dan rentang blok sampai >1000, catat
di mana persisnya revert dan pesan errornya. Hard-code batas hasil ukur, bukan batas docs.

---

### ✅ G3 — Rate limit Proof Builder API — **DITUTUP 9 Agustus 2026**

60 panggilan beruntun ke `proof-by-tx` (CC3 testnet), tanpa jeda:

```
60 panggilan / 65,2 dtk  →  0,9 req/dtk
kode respons : {200: 60}       ← nol error, nol 429
latensi      : min 1.053 ms · p50 1.072 ms · p95 1.259 ms · maks 1.484 ms
```

**Tidak ada rate limit yang terdeteksi.** Throughput dibatasi **latensi**, bukan
throttling — API-nya memproses satu per satu ~1,07 dtk.

**Konsekuensi desain:**
- Worker yang memantau satu treasury tidak akan mendekati batas apa pun.
- **Tapi ~1 dtk/proof itu plafon throughput**: backfill 10.000 transaksi ≈ **3 jam**
  wallclock. Itu yang membatasi backfill sekarang, bukan biaya (lihat G8).
- Paralelisme belum diuji. Kalau butuh backfill besar, uji dulu 4–8 permintaan serentak
  **sebelum** mengandalkannya.

⚠️ Ini **tidak** mengurangi prioritas **G4** (`RawProofBuilder`). API-nya sehat hari ini;
yang tetap tidak kita punya adalah **jalur yang tidak bergantung padanya sama sekali.**

---

### 🔴 G4 — `RawProofBuilder` belum pernah dijalankan — **NAIK PRIORITAS 9 Agt**

**Status:** belum disentuh sama sekali.

⚠️ **Alasan lama gap ini ("proof API mainnet rusak") sudah gugur** — G5 ternyata salah
premis, dan API mainnet-nya hidup. **Tapi gap ini justru naik prioritas**, karena
alasannya sekarang berbeda dan lebih penting.

**Kenapa naik jadi 🔴:** tanpa `RawProofBuilder`, seluruh sistem bergantung pada **satu
server milik Creditcoin**. Kalau server itu mati atau kena rate limit (G3), pipeline
berhenti, angka cadangan jadi basi — persis kegagalan yang produk ini janji cegah. Dan
klaim inti kita, *"berjalan sendiri tanpa manusia"*, jadi bergantung pada mesin orang lain.

Ini juga **satu-satunya ketergantungan server yang tersisa** di seluruh arsitektur.
Frontend sudah baca langsung dari chain; worker permissionless; kontrak immutable. Hanya
ini yang belum.

**Keputusan (spek §8.2b):** jalankan **dua-duanya**. Hosted sebagai jalur utama,
`RawProofBuilder` sebagai **fallback otomatis** saat hosted gagal 3× berturut-turut atau
membalas 429/5xx.

**Cara verifikasi:** bangun proof untuk tx yang sama lewat kedua jalur, bandingkan
**byte per byte**, lalu verifikasi keduanya on-chain. Ukur waktu dan apakah butuh
archive node.

**Imbalannya sepadan** — satu kalimat deck yang tidak bisa ditiru tim mana pun:
*"Kami tidak bergantung pada server siapa pun — termasuk server Creditcoin."*

---

### ✅ G19 — Memperpendek continuity proof — **DITUTUP 9 Agustus, dan jawabannya lebih baik dari dugaan**

Fungsi ChainInfo diuji langsung (semua bekerja, `eth_call` gratis):

```
is_height_attested(25.713.370)          → true
is_height_attested(att + 500)           → false
find_highest_attested_before(25.713.420) → 25.713.410   ← tepat 10 blok — interval terkonfirmasi
find_lowest_attested_after(25.713.370)   → 25.713.370   ← blok itu sendiri ter-attest
get_attestation_bounds(25.713.370)       → parentHeight 25.713.360 + digest
```

**Tapi penghematan sesungguhnya bukan dari memilih jangkar — melainkan dari KECEPATAN.**
Pengukuran G8 menunjukkan panjang proof ditentukan **umur transaksi**, bukan pilihan
rentang: 1 root kalau ≤100 blok di belakang tinggi ter-attest, ~61 kalau lebih.

→ **Optimasi yang benar: ingest cepat, bukan pilih jangkar pintar.**

Yang tetap wajib dipakai dari ChainInfo:

| Fungsi | Kegunaan |
|---|---|
| `is_height_attested` | Panggil **sebelum** proof API. Menghapus hampir semua `BlockNotReady` tanpa satu pun HTTP terbuang |
| `get_latest_attestation_height_and_hash` | Gerbang kesegaran `mint()` (RT10) + indikator dashboard |
| `find_highest_attested_before` | Cari blok ter-attest terbaru yang aman untuk diproses |

⚠️ Beri **margin ~10 blok** di bawah tinggi ter-attest — pandangan proof API tertinggal
sedikit di belakang ChainInfo (terukur: −0 dan −5 blok gagal, −10 blok berhasil).

---

### ✅ G5 — Proof API Creditcoin mainnet — **DITUTUP 9 Agustus. PREMISNYA SALAH.**

**Status lama:** *"terkonfirmasi rusak, self-signed certificate, layak dilaporkan ke tim
Creditcoin dan disebut di submission sebagai temuan."*

**Kenyataannya:** API-nya **tidak pernah rusak. URL-nya yang berubah.**

```
❌ proof-gen-api.cc3-mainnet.creditcoin.network   → tidak resolve (endpoint pensiun)
✅ proofbuilder.cc3-mainnet-usc.creditcoin.network → HTTP 200, TLS valid, 1.052 ms
```

Diuji end-to-end atas tx USDC Ethereum mainnet nyata (blok 25.712.180): proof lengkap
kembali — `merkleProof.siblings` 8, `continuityProof.roots` 1, `txBytes` 10.849 B.

⚠️ **TINDAKAN WAJIB — hapus dari `05-rencana-build.md` Fase 8:**
*"Laporkan bug TLS proof API mainnet (G5) ke tim Creditcoin — dan sebutkan temuan itu di
submission."* Melaporkan bug yang tidak ada, memakai URL yang sudah mereka pensiunkan,
kepada tim yang menjurikan kita — itu own-goal yang merusak kredibilitas seluruh deck.

**Pelajaran yang lebih besar dari gap ini:** kesimpulan negatif ("X rusak") **lebih
berbahaya daripada angka yang salah**, karena tidak ada yang mengeceknya ulang. Semua
temuan berbentuk *"infrastruktur mereka bermasalah"* wajib diverifikasi ulang tepat
sebelum submission.

---

### 🟠 G6 — Perilaku saat reorg Ethereum

**Status:** belum dipikirkan tuntas.

**Kalau salah:** worker mencatat event dari blok yang kemudian di-reorg, lalu mengirim
proof yang gagal selamanya dan macet di retry loop.

**Analisis awal:** attestation hanya mencakup blok yang sudah final, jadi proof-nya
sendiri aman. Risikonya ada di **cursor worker**, yang memindai jauh di depan tip
attestation dan bisa menemukan event di blok yang belum final.

**Cara verifikasi:** paksa worker memindai sampai `head` (bukan sampai tip attestation),
lalu amati apa yang terjadi pada event di blok non-final. **Mitigasi yang direncanakan:**
worker hanya menandai `DISCOVERED` sampai kedalaman aman, dan memvalidasi ulang
`transactionHash` masih ada di blok yang sama sebelum membangun proof.

---

### 🟡 G7 — `estimateGas` pada precompile gagal secara misterius

**Status:** terdokumentasi di SDK — `pallet-evm` **tidak meneruskan revert reason saat
mode estimasi** pada precompile. SDK menyediakan `computeGasLimit()` dengan fallback
heuristik berbasis panjang continuity proof.

**Kalau diabaikan:** transaksi gagal dengan pesan yang tidak informatif, dan debugging
jadi neraka.

**Cara verifikasi:** sengaja kirim proof tidak valid, bandingkan pesan error dari
`estimateGas` vs eksekusi nyata. Pakai `computeGasLimit()` sejak awal, jangan
`estimateGas` polos.

---

### ✅ G8 — Biaya vs umur transaksi — **DITUTUP 9 Agustus. ANGKA `[docs]` MENYESATKAN.**

**Klaim `[docs]`:** biaya naik >10× per hari umur transaksi (10 mnt = 10 hash,
24 jam = 1.000 hash). **Terukur: tidak benar.** Biaya naik lalu **DATAR.**

```
 −10 … −100 blok dari tinggi ter-attest  → roots =  1     (~0–20 menit)
 −150 blok                                → roots = 11     ← TEBING
 −200 … −300 blok                         → roots = 61
 7 hari / 14 hari / 30 hari               → roots = 61     ← DATAR
```

**Tiga keputusan yang keluar dari ini:**

1. **Ingest dalam ~100 blok setelah blok ter-attest** → 1 root, bukan 61. Itu **~61×**
   pada variabel biaya dominan. Lag attestation 32–42 blok, jadi jendela murahnya
   ~60 blok ≈ **12 menit**. Polling 1–2 menit aman.
2. **TIDAK ADA ambang "menyerah".** Pertanyaan asli gap ini salah premis — worker tidak
   perlu menyerah pada transaksi lama, karena biayanya **berhenti naik**. Yang benar:
   **prioritaskan yang baru**, jangan buang yang lama.
3. **Backfill riwayat dalam sekarang MURAH** — ~4×10⁻⁵ CTC/tx untuk umur berapa pun.
   Dengan 10.000 tCTC = ratusan juta transaksi. Yang membatasi tinggal **waktu**
   (latensi proof 1,5–5 dtk untuk tx tua) dan pemindaian log.
   ⚠️ Ini **mencabut satu baris dari daftar "Jangan sentuh"** di `02-keputusan-ide.md`.

⚠️ **Plateau bergeser antar sesi** (81 vs 61 root). Pakai rentang **60–85**, jangan satu
angka, dan jangan taruh angka tunggal di deck.

📌 **Temuan operasional bonus:** blok pada −0 dan −5 dari tinggi ter-attest **gagal**
dengan `BlockNotReady` — pandangan proof API tertinggal sedikit di belakang ChainInfo.
**Worker wajib beri margin ~10 blok.** Tanpa ini: kegagalan misterius di awal tiap siklus.

---

### ✅ G9 — Ukuran attestor set & quorum — **DITUTUP 2 Agustus 2026**

Dibaca langsung dari storage pallet `attestation` lewat Substrate RPC. Angka lama
(*"5 attestor, quorum 3"*) **terbukti salah** — nilainya berbeda per chain dan per
lingkungan.

Ringkas (lengkap di `01-riset-mendalam.md` §1.5b):

- **7 attestor terdaftar** untuk Ethereum mainnet di Creditcoin mainnet (4 untuk ETH
  mainnet di CC3 testnet, 7 untuk Sepolia)
- **`targetSampleSize` = 5** di mainnet, **3** di testnet — VRF memilih sampel acak
  sebesar ini per attestation; hanya sampel itu yang memberi suara
- **`chainElectionPolicy` = `AuthorizedOnly`** di semua lingkungan — set permissioned
- **`minBondRequirement` = 0**, `invulnerables` kosong → **tidak ada jaminan ekonomi
  dan tidak ada slashing.** Jangan pernah klaim sebaliknya.
- `chainAttestationInterval` = **10 blok**; `maturityStrategy` = `EvmSafe` (testnet) vs
  `EvmFinalized` (mainnet) — **ini yang menjelaskan lag 44 vs 74 blok secara persis**

**Konsekuensi untuk deck:** dua klaim baru masuk daftar terlarang —
*"economically secured"/"slashing"*, dan angka *"5 attestor, quorum 3"*.

---

### ✅ G10 — Alamat treasury nyata untuk observatory — **DITUTUP 9 Agustus**

Daftar final, terverifikasi on-chain, ada di **`01-riset-mendalam.md` §3.5**:

| Target | Status |
|---|---|
| **Sky LitePSM "Pocket"** `0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341` | ⭐ **utama.** 4.251.196.990 USDC **mentah**, `eth_getCode == 0x` → **EOA**. Plus kontroversi keamanan publik Des 2024 yang belum pernah selesai |
| **Resolv (USR)** | korban 22 Mar 2026; **kolateral utuh, yang jebol otoritas mint**; jendela pemulihan sampai 26 Agt 2026 |
| **Reserve eUSD** `0xF014FEF4…` | bukti kategori pelanggan (RPay LatAm). ⚠️ kolateral dibungkus, USDC mentah = 0 — enumerasi dulu |
| ❌ **Ethena** | **dicabut** dari daftar sah — off-exchange custody, gagal tes RT1 |

**Tes kelayakan untuk kandidat baru:** (1) USDC mentah, (2) satu alamat yang bisa
dijelaskan satu kalimat, (3) model kustodi 1:1 — lolos anti-contoh Aave (`01` §3.6).

*(Catatan historis di bawah dipertahankan karena alasannya masih berlaku.)*

⚠️ **Dikoreksi 2 Agustus 2026.** Versi sebelumnya menyebut Circle, Paxos, Ondo, BUIDL,
dan Maple sebagai kandidat. Itu **salah dan berbahaya** — backing mereka off-chain, dan
mengarahkan observatory ke sana persis klaim yang dilarang RT1 / `03-spesifikasi-produk.md`
§4.2. Mengikuti instruksi lama ini akan membangun pembeda utama produk di atas klaim
yang membunuh deck.

**Kandidat yang sah** — ⚠️ **daftar ini digantikan oleh hasil verifikasi 9 Agt di atas.**
Versi lama menyebut *"Ethena USDe · Sky USDS · Liquity LUSD · Resolv USR"*; **Ethena
sudah dicabut** karena backing-nya di off-exchange custody. Yang tetap sah: **Sky
(LitePSM Pocket) · Liquity · Resolv**, plus **fintech mana pun yang memegang USDC di
treasury Ethereum** — yang terakhir ini justru kasus produk intinya.

**Cara verifikasi:** untuk tiap kandidat sah di atas, telusuri alamat dengan volume
`Transfer` tertinggi, pastikan ada aliran dalam 1 jam terakhir, dan pastikan alamatnya
bisa dijelaskan dalam satu kalimat kepada juri. Simpan hasilnya sebagai daftar
konfigurasi.

**USDC tetap sah sebagai aset cadangan** — membuktikan *"fintech X memegang N USDC"*
berbeda total dari membuktikan backing Circle. Jangan tertukar.

---

### 🟢 G11 — Tx treasury raksasa (115 KB) belum pernah dieksekusi sungguhan

**Status:** 1,8 juta gas adalah **ekstrapolasi**, bukan eksekusi.

**Kalau salah:** satu tx Safe batch besar yang menyentuh treasury bisa memacetkan worker.

**Cara verifikasi:** cari tx mainnet >100 KB yang menyentuh alamat mana pun, jalankan
`ingest` sungguhan (bukan estimasi) terhadapnya. Ini murah — lakukan sekali dan selesai.

---

### 🔴 G22 — Apakah `forge script --broadcast` bekerja di Creditcoin?

*Baru 9 Agustus 2026. Ditemukan saat mengirim dana antar akun.*

**Status:** `cast send` **terbukti patah** di Creditcoin — testnet **dan** mainnet.
Penyebabnya presisi: `eth_getBlockByNumber` Creditcoin **tidak menyertakan `mixHash`**
(satu-satunya field yang hilang; semua field lain lengkap). Alloy — mesin di balik
Foundry — mewajibkannya, jadi loop tunggu-receipt gagal deserialisasi dan mengulang
selamanya.

⚠️ **Dan transaksinya tetap terkirim.** Kami mengalaminya: layar penuh error, tapi
100 tCTC sudah pindah dan nonce sudah naik. **Siapa pun yang mengira gagal lalu
mengulang akan mengirim dua kali.**

**Kalau tidak diuji lebih awal:** seluruh rencana deploy Fase 2 berdiri di atas
`script/Deploy.s.sol` + `forge script --broadcast`, yang memakai loop yang sama.
Menemukannya saat deploy kontrak sungguhan = jam-jam terbuang di fase paling genting.

**Yang sudah diverifikasi bekerja:** `cast call` · `cast receipt` · `cast tx` ·
`cast block-number` · `cast chain-id` · `cast send --async`.

**Cara verifikasi (Fase 0, sebelum menulis `Deploy.s.sol`):**
1. Deploy kontrak sepele (`contract Ping { uint public x = 1; }`) lewat
   `forge create` dan `forge script --broadcast`. Catat mana yang lolos.
2. Kalau patah, uji jalan keluarnya berurutan: `--skip-simulation` · `--slow` ·
   `forge create --async` · atau bangun tx mentah lalu `cast publish`.
3. **Apa pun hasilnya, verifikasi alamat kontrak lewat RPC mentah** — jangan pernah
   percaya pada berhasil/gagalnya perintah Foundry di chain ini.

**Aturan yang berlaku sejak sekarang:** setiap transaksi tulis di Creditcoin
diverifikasi lewat `eth_getTransactionCount` / `eth_getTransactionReceipt`, bukan lewat
exit code Foundry.

---

### 🔴 G21 — Dashboard belum punya rumah *(belum pernah dibahas di dokumen mana pun)*

*Baru 9 Agustus 2026.*

**Status:** seluruh dokumen membahas VPS untuk **worker** (§8.5, G13), tapi **tidak ada
satu baris pun** tentang di mana **dashboard** akan hidup.

**Kenapa ini gap nyata, bukan detail:** submission **6 September**, pengumuman
**18 September**. Juri membuka dashboard **berhari-hari sampai berminggu-minggu** setelah
video direkam — persis alasan G13 ada. Kegagalannya identik:

- Free tier yang **tidur** setelah tidak ada trafik → juri membuka, loading selamanya
- Free tier yang **kedaluwarsa** dalam 30 hari
- Preview URL yang berubah tiap deploy → tautan di submission mati
- Deploy dari branch yang salah → juri melihat versi ber-mock (gerbang Fase 6c bocor)

**Syarat yang harus dipenuhi:**

| Syarat | Kenapa |
|---|---|
| **URL produksi tetap**, bukan preview | Tautan submission tidak boleh berubah |
| **Tidak pernah tidur** | Juri tidak akan menunggu cold start |
| Hidup **minimal sampai 18 September** | Tanggal pengumuman |
| Deploy dari **bundle pasca-Fase 6c** | Nol mock — cek tanggal build |
| **Statis** (Next.js export / Vite build) | Frontend baca langsung dari chain (§9.0), jadi tidak butuh server sama sekali |

✅ **KEPUTUSAN & ATURAN SUDAH DITULIS 9 Agt** — `03-spesifikasi-produk.md` **§9.4**:
host statis (Cloudflare Pages / Vercel / Netlify / GitHub Pages), empat aturan yang
mengikat, dan uji akhir 4 langkah.

⏳ **Sisa: buat akunnya dan hubungkan repo.** Itu langkah yang butuh manusia — pembuatan
akun tidak bisa didelegasikan. Setelah itu G21 tertutup.

---

### 🔴 G13 — Worker belum terbukti hidup tanpa dijaga

**Status:** desainnya sudah (§8.5 spek: VPS + systemd + hampir-stateless), tapi **belum
pernah dijalankan** lebih dari beberapa menit.

**Kalau gagal:** ini **kegagalan paling mahal di seluruh proyek**. Juri membuka dashboard
berhari-hari setelah video direkam — kalau worker mati, mereka melihat angka beku, dan
klaim inti *"berjalan sendiri tanpa manusia"* runtuh di depan orang yang menilainya.
Submission 6 Sept, pengumuman **18 Sept** → worker harus hidup **~2 minggu tanpa disentuh.**

✅ **RUNBOOK LENGKAP SUDAH DITULIS 9 Agt** — `03-spesifikasi-produk.md` §8.5:
spesifikasi VPS yang dipilih (Hetzner CX22 / DO Basic, Ubuntu 24.04, sewa sampai
30 Sept), skrip hardening, unit systemd lengkap dengan `MemoryMax` dan
`ProtectSystem=strict`, penempatan kunci operator, **rotasi journald** (pembunuh worker
jangka panjang #1), dan konfigurasi dead-man's switch.

⏳ **Sisa: daftar provider + bayar + tambahkan SSH key.** Itu langkah yang butuh manusia.
Setelah server ada, seluruh sisanya tinggal salin-tempel.

**Cara verifikasi, bertingkat:**
1. Jalan 48 jam di VPS tanpa intervensi → indikator kesegaran tetap hijau
2. Bunuh paksa prosesnya di tengah jalan → systemd hidupkan lagi → posisi dibangun ulang
   dari kontrak, tidak ada ingest ganda
3. Putus jaringan 10 menit → worker menyusul sendiri setelah tersambung
4. Cek disk & log seminggu kemudian — rotasi log benar-benar jalan
5. Cek saldo akun operator masih cukup untuk sisa periode

**Yang paling sering membunuh worker jangka panjang, urut kemungkinan:** disk penuh
karena log, RPC provider mengubah rate limit, saldo gas habis, memory leak di proses
Node yang berjalan berminggu-minggu.

⚠️ **Keputusan VPS tunggal (tanpa worker cadangan) menaikkan taruhan gap ini.** Tidak ada
yang menambal kalau dia mati. Karena itu **dead-man's switch wajib**, bukan opsional —
tanpa itu kamu baru tahu worker mati saat juri sudah melihat angka basi.

---

### 🟢 G12 — Pendekatan `haircutBps` belum diuji ke juri

**Status:** keputusan desain, bukan bug. v1 menolak price oracle dan hanya menerima aset
ber-unit-of-account sama, dengan potongan risiko yang diset saat deploy.

**Risiko:** juri bertanya "kenapa tidak multi-aset penuh?" dan jawabannya harus siap:
memasukkan price oracle **membatalkan seluruh klaim "tanpa oracle"** — itu bukan
penyederhanaan, itu prinsip.

---

### ✅ G14 — `maxStalenessBlocks` — **DITUTUP 9 Agustus dengan pengukuran**

*Konsekuensi RT10 lapis 1.*

Temuan yang membalik asumsi: **lag bukan konstanta, dia PITA** yang berayun sepanjang
`chainAttestationInterval` (10 blok). Angka "44 blok" di dokumen 2 Agustus adalah satu
sampel dari pita itu. Terukur di spec 131 (`01-riset-mendalam.md` §1.5d):

```
CC3 testnet ← Sepolia  (key 1) : 32–41 blok
CC3 testnet ← ETH main (key 3) : 33–42 blok
CC mainnet  ← ETH main (key 1) : 65–73 blok
```

**Nilai yang dikunci:**

| Parameter | CC3 testnet | CC mainnet | Turunan |
|---|---|---|---|
| `attestationWindowBlocks` | **42** | **74** | batas **atas** pita, bukan rata-rata |
| `maxStalenessBlocks` | **63** | **111** | batas atas × **1,5** — menyerap satu attestation terlewat penuh |

⚠️ **Kenapa bukan ~44:** kalau ambangnya di sekitar rata-rata, `mint()` yang sah akan
revert `ReserveViewStale` setiap kali lag menyentuh ujung atas pita — **beberapa kali per
jam**, termasuk saat demo.

⚠️ **Sisa pekerjaan:** jalankan `tools/recon/attestation-lag.mjs` **≥2 jam** sebelum
deploy final dan pastikan tidak ada sampel yang keluar dari pita. Kontrak `immutable`
(RT9) — angka ini hanya bisa diperbaiki dengan redeploy.

---

### ✅ G15 — `maxMintPerWindowBps` — **DIPUTUSKAN 9 Agustus: 500 bps (5%)**

*Konsekuensi RT10 lapis 2.*

**Nilai: `maxMintPerWindowBps = 500`** — maksimal **5% dari cadangan terbukti** boleh
dicetak dalam satu jendela attestation.

**Diturunkan dari skenario konkret, bukan dari selera:**

- **Batas atas kerugian.** Skenario RT10 butuh penyerang memegang **dua** kunci
  (treasury Ethereum *dan* mint Creditcoin). Kalau itu terjadi, 5% membatasi kerugian
  *tambahan* ke ≤5% cadangan per jendela ~9 menit. Klaim decknya jadi angka, bukan
  kata sifat: *"penerbitan tanpa backing dibatasi 5% per jendela ~9 menit, ditegakkan on-chain."*
- **Batas bawah kegunaan.** Untuk treasury $1 juta, 5% = **$50.000 per ~9 menit** =
  ~$330.000/jam. Jauh di atas kebutuhan penerbitan wajar sebuah fintech, jadi tidak
  mengganggu operasi yang sah.
- **Aman untuk demo.** Cadangan demo kita kecil dan `mint()` demo lebih kecil lagi,
  jadi cap ini tidak akan tersentuh secara tidak sengaja di depan juri — **tapi tetap
  bisa diperagakan sengaja** dengan satu mint besar (test Fase 3).

⚠️ Masuk `deployments/<network>.json`. Kontrak `immutable` — mengubahnya = redeploy.

---

### ✅ G16 — Slot storage `balanceOf` USDC di Base — **DITUTUP 9 Agustus 2026**

```
USDC di Base : 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
SLOT balanceOf : 9        ← diverifikasi di 3 holder nyata, semuanya cocok

kunci storage = keccak256( pad32(holder) ‖ pad32(9) )
```

Metode: ambil holder dari log `Transfer` nyata, coba slot 0–19, bandingkan
`eth_getStorageAt(kunci)` dengan `balanceOf(holder)`. **Slot 9 cocok 3/3; slot lain 0/3.**

`eth_getProof` bekerja dan mengembalikan bukti lengkap:

```
accountProof : 9 node
storageProof : 8 node
storageHash  : 0x20e8ff330d6da5ada1de5752…
```

⚠️ **Tetap wajib** sebelum deploy: ulangi di **blok kedua yang berbeda** dan buat fixture
test-nya. Slot yang salah **tidak error** — dia mengembalikan angka salah yang meyakinkan.

⚠️ USDC di Base itu **proxy** — layout bisa berubah kalau di-upgrade, dan kontrak kita
`immutable` (RT9). Konsekuensi diterima: **upgrade token = redeploy.**

---

### ✅ G17 — Dispute game Base — **DITUTUP 9 Agustus 2026**

Dipindai langsung dari Ethereum mainnet, 300 blok (~1 jam):

```
event  : DisputeGameCreated(address indexed disputeProxy,
                            uint32  indexed gameType,
                            bytes32 indexed rootClaim)
topic0 : 0x5b565efe82411da98814f356d0e7bcb8f0219b8d970307c5afb4a6903a8b2e35

25 event dalam ~1 jam, tersebar di 21 alamat factory berbeda
factory Base : 0x43edb88c4b80fdd2adff2412a7bebf9df42cb40e
               3 usulan/jam · jarak ~94 blok (~19 menit) · gameType 621
```

**🎯 Temuan yang menyederhanakan Babak 5 secara signifikan:**

> **`rootClaim` ada di `topic3` — artinya dia INDEXED, dan ikut masuk ke receipt log.**

Jadi kita **tidak perlu mem-parse calldata sama sekali** — `rootClaim` datang langsung
dari `getLogsByEventSignature()` di `EvmV1Decoder`, jalur yang sudah kita pakai untuk
`Transfer`. Bentuk kodenya identik dengan yang sudah ada.

⚠️ **Dua filter WAJIB, jangan salah satu saja:**
1. **Alamat factory** — ada 21 factory aktif di L1; sebagian besar milik chain lain.
2. **`gameType`** — terlihat 1, 8, 42, 621, 1337 berseliweran. Menerima gameType yang
   salah = menerima root dari permainan permissioned/uji, bukan fault proof sungguhan.

Dua-duanya masuk konfigurasi `immutable`, **hasil ukur, bukan angka docs**.

⏳ **Sisa yang belum diukur:** event/kondisi **resolusi** dan jeda nyata usulan→resolusi
(~3,5–7 hari menurut docs). Itu yang menentukan aturan arah aman asimetris §14.4.
Butuh pemindaian rentang panjang — kerjakan saat Babak 5 benar-benar dimulai.

---

### ✅ G18 — Biaya calldata MPT proof — **DITUTUP 9 Agustus 2026**

Dari `eth_getProof` nyata di Base (9 node akun + 8 node storage):

```
total calldata bukti ≈ 7.440 byte
≈ 116.000 gas @ 15,6 gas/byte  →  0,15% dari block limit 75.000.000
biaya ≈ 0,000058 CTC
```

**Jauh di bawah batas mana pun.** Ukuran proof **bukan** kendala untuk Babak 5.

⚠️ Ini biaya *calldata*. Biaya *eksekusi* verifikasi MPT (keccak per node) belum
terhitung — tapi 17 node × ~30 keccak ≈ ribuan gas, bukan ratusan ribu.
`estimateGas` sungguhan tetap dilakukan setelah `ingestAnchor` ada.

---

### ✅ G20 — Dana — **DITUTUP 9 Agustus 2026**

Kunci akun lama hilang, tiga akun baru digenerate fresh, dan **faucet sudah masuk**:

```
DEPLOYER 0x825003EdbE16AedfC63f99836553a15B1299f35e   ✅ 10.000 tCTC   nonce 0
OPERATOR 0x7C1195c7e31ED2Dd4cE207D926d2fA3bA2e15Ff3   ⏳ diisi ~100 tCTC dari deployer
ISSUER   0x2d27Da63Bbe23633c82ff553CfF009D974294e08   ⏳ diisi ≤20 tCTC dari deployer

⚰️ 0x4e83Fa344E529f4c03948691BDD5A9A83384ED05 — akun LAMA, kunci hilang, jangan dipakai
```

Sisa: transfer dari deployer ke dua akun lain (bagian Fase 0, bukan gap).

⚠️ **Pencegahan agar tidak terulang:** ketiga kunci wajib masuk **password manager pada
jam yang sama saat dibuat**. Akun lama hilang persis karena langkah ini ditunda sejak
2 Agustus. `.env` di-gitignore — aman dari GitHub, **tidak** aman dari folder yang hilang.

---

## 3. Blocker: TIDAK ADA

Per 9 Agustus 2026, **nol penghalang.**

**Yang berubah dibanding 7 Agustus** — enam hal yang sebelumnya berpotensi jadi
penghalang sudah **hilang, bukan sekadar terjadwal**:

- ~~Proof API mainnet rusak~~ → hidup, 1,05 dtk (C12)
- ~~Decoder mainnet belum ada~~ → sudah terdeploy (C13)
- ~~Dua parameter `immutable` belum punya angka~~ → G14 & G15 punya nilai final
- ~~Target observatory belum dipilih~~ → terverifikasi on-chain (C15)
- ~~Biaya backfill tidak diketahui~~ → **terukur, dan jauh lebih murah dari dugaan** (G8)
- ~~Tidak ada dana~~ → **faucet masuk, 10.000 tCTC** (G20)

**Semua prasyarat Fase 1 sudah terpenuhi. Kontrak boleh mulai ditulis** — dengan satu
syarat non-teknis: **commit pertama ≥13 Agustus** (aturan lomba, `00-hackathon.md`).

⚠️ Dua kewajiban yang tetap, dan dua-duanya verifikasi, bukan penghalang:
1. Jalankan `attestation-lag.mjs` **≥2 jam** sebelum deploy final — konfirmasi pita G14.
2. Salin ketiga private key ke **password manager**.

## 4. Urutan verifikasi yang disarankan

Kelompokkan berdasarkan kapan hasilnya dibutuhkan, bukan berdasarkan tingkat risiko:

| Kapan | Gap |
|---|---|
| **Sebelum menulis kontrak** | ~~G9~~ ✅ · ~~G14~~ ✅ · ~~G15~~ ✅ · G12 (prinsip desain, sudah diputuskan) |
| **Segera setelah kontrak jadi** | G1, G2, G11 |
| **Sebelum menulis worker** | G3, G6, G7, G8 |
| **Segera setelah worker jalan** | **G13** — deploy VPS + uji 48 jam. Jangan ditunda ke akhir. **Ini gap dengan risiko tertinggi yang tersisa.** |
| **Sebelum bicara produksi/mainnet** | G4 (~~G5~~ ✅ ditutup) |
| **Sebelum merekam demo** | ~~G10~~ ✅ ditutup — target sudah terverifikasi |
| **Hanya kalau Babak 5 dikerjakan** | **G16** (slot storage — ukur duluan, ini yang paling berbahaya), G17, G18 |

**Ringkasan status (9 Agustus 2026):** **25** pertanyaan tertutup dengan pengukuran ·
**12** gap ditutup · **10** gap terbuka · **0 blocker**.

Sepuluh yang terbuka, dikelompokkan menurut apa yang menghalanginya:

| Butuh | Gap |
|---|---|
| **Kontrak kita** | G1, G2, G7, G11 |
| **Worker** | G4, G6 |
| **VPS + 48 jam uji** | G13 |
| **Deploy pertama** | G22 — uji sebelum menulis `Deploy.s.sol` |
| **Akun + pembayaran** *(runbook sudah lengkap)* | G13, G21 |
| **Tidak ada — sudah diputuskan isinya** | G12 |
