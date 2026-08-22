# Riset Mendalam — BUIDL CTC 2026 Fall

Disusun **2 Agustus 2026** · diperbarui **9 Agustus 2026** (pengukuran ulang di bawah
Attestor V2 / spec 131, plus §1.7 yang baru).

Semua angka di dokumen ini **diukur sendiri**, kecuali yang ditandai `[docs]` (dari
dokumentasi Creditcoin) atau `[web]` (dari riset pasar). Skrip pengukurannya sudah
dihapus bersama repo lama dan **harus dibangun ulang** sebagai `tools/recon/` — daftar
lengkap beserta ekspektasi lolosnya ada di **§9**.

---

## 0. Ringkasan eksekutif

### 0.1 Temuan asli (2 Agustus)

1. **CC3 Testnet meng-attest Ethereum MAINNET, live.** Kontrak kita boleh berada di
   Creditcoin testnet (memenuhi syarat lomba) sambil membaca uang sungguhan senilai
   puluhan miliar dolar. Terverifikasi end-to-end, bukan dari docs.
2. **Biaya ingest praktis nol** dan jauh dari batas blok. Kekhawatiran ukuran calldata
   mainnet tidak terbukti jadi masalah.
3. **Sepolia adalah kebun stablecoin, tapi kuburan lending.** Aave/Compound/Morpho
   nyaris atau sepenuhnya mati di Sepolia. Di mainnet, Aave hidup.
4. **Dua stablecoin runtuh tahun ini karena minting tanpa backing** — Resolv USR
   (Maret) dan StablR (Mei). Keduanya kegagalan kunci admin, bukan bug kontrak.
   Ini persis kelas kegagalan yang desain kita cegah secara struktural.

### 0.2 Yang berubah 9 Agustus — baca ini sebelum menulis kode

Lima temuan, berurutan dari yang paling mengubah keputusan:

1. **§1.7 BARU — attestation TIDAK berkomitmen pada block header Ethereum.**
   Dibaca dari sumber SDK, bukan docs. Konsekuensinya permanen: **membuktikan *saldo*
   di Ethereum mustahil selamanya.** Ini yang memaksa ledger mulai dari nol dan yang
   melahirkan RT11 — batas protokol, bukan pilihan desain. Sekaligus dasar Babak 5.
2. **G5 SALAH — Proof API mainnet tidak rusak, URL-nya yang berubah.** Diuji end-to-end
   hari ini: HTTP 200 + proof lengkap dalam **1.052 ms**. Rencana lama "laporkan bug ini
   ke tim Creditcoin di submission" **dibatalkan** — itu melaporkan bug yang tidak ada
   ke juri sendiri.
3. **`EvmV1Decoder` sudah ada di Creditcoin mainnet** (`0x9D094C9f…`). Jalur produksi
   kini bebas hambatan sepenuhnya.
4. **Lag attestation bukan angka tunggal, tapi PITA** — dan turun sedikit di bawah
   Attestor V2. Ini langsung menentukan `maxStalenessBlocks` yang `immutable`. Lihat §1.5d.
5. **Tiga "jebakan SDK" di dokumen lama tidak seluruhnya benar.** `mergeProofs`
   diekspor publik, dan `merkleProofs` yang "kosong" itu artefak `JSON.stringify(Map)`.
   Batching jauh lebih mudah daripada yang kita kira. Lihat §1.4.

---

## 1. Attestcoin / USC — kemampuan sebenarnya

### 1.1 Primitive inti

> Buktikan bahwa sebuah **transaksi Ethereum beserta receipt & event log-nya**
> ter-include di sebuah blok, lalu verifikasi bukti itu **sinkron dalam satu
> transaksi** di Creditcoin lewat precompile `0x0FD2`.

Bukan bridge, bukan messaging, bukan price feed. Ini **oracle untuk *kejadian*.**
Arahnya satu arah: source chain → Creditcoin. Tidak ada callback ke Ethereum.

### 1.2 Chain sumber yang benar-benar aktif — **TEMUAN UTAMA**

Dari precompile ChainInfo `0x0fd3`, bukan dari docs:

```
chainKey 1  → chainId 11155111  "Sepolia ethereum"   attested height 11.401.550
chainKey 3  → chainId 1         "Ethereum"           attested height 25.665.310
```

**Ethereum mainnet ter-attest dan hidup.** Diuji end-to-end:

```
tx 0xfa5db44f5636d16e15f6d48ada900df974e2f63e8545435895b537ff5f027203
block 25.665.308 (Ethereum mainnet)

proof build (hosted API)  : 1.947 ms
verifySingle di Creditcoin: true      (1.357 ms)
receipt status            : 1
log berhasil didekode     : 248
```

Konsekuensi strategis: demo kita bisa menunjuk **Circle USDC ($49,6 M), Tether USDT
($92,1 M), BlackRock BUIDL, Ondo USDY, Aave V3 mainnet** — bukan token mainan.
Tidak ada peserta musim 1 yang melakukan ini.

Latensi mainnet identik dengan Sepolia: **44 blok ≈ 8,8 menit wallclock.**

⚠️ **Angka 44 itu satu sampel dari 2 Agustus.** Diukur ulang 9 Agustus di bawah Attestor
V2: lag adalah **pita 33–42 blok**. Untuk semua keputusan parameter, pakai **§1.5d**.

### 1.2b Creditcoin MAINNET — produk ini bisa naik produksi hari ini

Diuji terpisah terhadap Creditcoin mainnet, bukan testnet:

```
Creditcoin mainnet RPC : https://mainnet3.creditcoin.network
                         (alias: https://rpc.cc3-mainnet.creditcoin.network)
chainId                : 102030          head: 4.045.052

supported chains       : chainKey 1 → chainId 1 (Ethereum mainnet)
attested height        : 25.665.410
lag                    : 74 blok ≈ 14,8 menit

verifySingle di Creditcoin MAINNET, atas tx USDC Ethereum mainnet sungguhan → true
```

**Attestcoin sudah live di Creditcoin mainnet.** Ini bukan teknologi testnet-only.

⚠️ **DIKOREKSI 9 Agustus 2026.** Dari tiga "selisih" yang tercatat di versi 2 Agustus,
**hanya satu yang masih benar.** Dua lainnya adalah kesimpulan yang salah dan sudah
dibatalkan:

1. ✅ **MASIH BENAR — chainKey berbeda antar lingkungan.** Di CC3 *testnet*: `3` =
   Ethereum mainnet, `1` = Sepolia. Di Creditcoin *mainnet*: `1` = Ethereum mainnet.
   Dibaca ulang 9 Agt langsung dari precompile ChainInfo `0x0fd3` (`get_chain_by_key`),
   bukan dari docs. Nilai ini **wajib dibuat konfigurasi**, jangan di-hardcode.
   Tidak ada chain sumber lain — `get_chain_by_key(0,2,4,5,6)` kosong di kedua
   lingkungan. **Kata "omnichain" tetap haram.**
2. ❌ **SALAH — `EvmV1Decoder` SUDAH ADA di Creditcoin mainnet.**
   `0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C` — `eth_getCode` mengembalikan bytecode,
   diverifikasi 9 Agt. Tidak perlu deploy sendiri.
3. ❌ **SALAH — Proof API mainnet TIDAK rusak. URL-nya yang berubah.**
   Endpoint yang benar: **`https://proofbuilder.cc3-mainnet-usc.creditcoin.network`**
   (TLS valid, `ssl_verify_result=0`). Yang lama (`proof-gen-api.cc3-mainnet…`) memang
   tidak resolve — tapi karena sudah tidak dipakai, bukan karena rusak.

   Diuji end-to-end 9 Agustus, tx USDC Ethereum mainnet nyata di blok 25.712.180:

   ```
   GET /api/v1/proof-by-tx/1/0x9dd3e53b0207d90ac01e02997148a4b9fc8f96ad1db4272935f53b60edc5ed70
   → HTTP 200 dalam 1.052 ms   headerNumber 25.712.180  txIndex 0
     txBytes 10.849 B · merkleProof.siblings 8 · continuityProof.roots 1
   ```

   **Konsekuensi yang harus ditindak:** hapus butir *"laporkan bug TLS proof API mainnet
   ke tim Creditcoin"* dari `05-rencana-build.md` Fase 8. Melaporkan bug yang tidak ada,
   dengan URL yang sudah mereka ganti, ke tim yang menjurikan kita — itu own-goal.

   **Bonus terukur:** untuk tx yang sama, `continuityProof.roots` = **1 di CC mainnet**
   vs **21 di CC3 testnet**. Karena biaya `[docs]` berbanding lurus dengan jumlah
   continuity hash, **ingest di mainnet justru lebih murah daripada di testnet.**

Catatan: `eth_getCode` pada `0x0FD2`/`0x0fd3` mengembalikan `0x` **baik di testnet
maupun mainnet** — itu normal untuk precompile native, jangan disalahartikan sebagai
"tidak terpasang". Cek yang benar adalah memanggil fungsinya.

### 1.3 Biaya & gas — terukur langsung

Diukur dengan `estimateGas` pada `verifyAndEmit` di precompile, dari akun ber-dana.
Gas price CC3 testnet: **0,5 gwei**. Block gas limit: **75.000.000**.

| Kasus | txBytes | Gas | Biaya |
|---|---|---|---|
| Sepolia, tx kecil | 1.664 B | 46.394 | 0,0000232 CTC |
| Mainnet, tx kecil | 3.456 B | 75.573 | 0,0000378 CTC |
| Mainnet, tx besar | 31.936 B | 498.909 | 0,000249 CTC |

Skala **≈ 15,6 gas per byte txBytes**, linear. Tx mainnet terburuk yang kami temui
(115.104 B, Safe batch 248 log) ekstrapolasi ke ~1,8 juta gas = **2,4% block limit**.

Rumus resmi `[docs]`: `Cost ≈ 2,3×10⁻⁵ + 2,9×10⁻⁷ × (jumlah continuity hash)` CTC.
Pengukuran kami (0,0000232 CTC untuk kasus terkecil) cocok dengan suku basis. Docs
juga menyebut plafon beban decoding **0,0375 CTC** untuk tx patologis.

**Umur transaksi adalah faktor biaya terbesar** `[docs]`:

| Umur tx | Continuity hash | Biaya |
|---|---|---|
| 10 menit | 10 | 2,59×10⁻⁵ CTC |
| 24 jam | 1.000 | 3,13×10⁻⁴ CTC (**>10×**) |

### ⚠️ DIUKUR SENDIRI 9 AGUSTUS — angka `[docs]` di atas MENYESATKAN

Tabel `[docs]` itu menyiratkan biaya naik **tanpa batas** seiring umur transaksi. Kami
mengukurnya sendiri, dan **itu tidak benar.** Biaya naik lalu **DATAR**.

Diukur dari tinggi ter-attest (bukan dari head), tiap titik satu tx USDC nyata:

```
  −0 … −5   blok   → BlockNotReady   (view proof API sedikit tertinggal — lihat catatan)
 −10 … −100 blok   → roots =  1      ← ~0–20 menit
 −150       blok   → roots = 11      ← ~30 menit   ⟵ TEBING
 −200 … −300 blok  → roots = 61      ← ~40–60 menit
  7 hari           → roots = 61
 14 hari           → roots = 61
 30 hari           → roots = 61      ← DATAR, tidak naik lagi
```

**Tiga konsekuensi yang mengubah keputusan desain:**

1. **Ada TEBING, bukan kurva.** Antara ~100 dan ~200 blok di belakang tinggi ter-attest,
   continuity proof melompat dari **1 root** ke **~61 root**. Itu **~61× pada variabel
   biaya yang dominan.**

   → **Worker harus ingest dalam ~100 blok (~20 menit) setelah blok ter-attest.**
   Karena lag attestation 32–42 blok, jendela murahnya ~60 blok ≈ **12 menit**.
   Polling 1–2 menit aman — tapi sekarang ada **alasan terukur**, bukan sekadar longgar.

2. **Setelah tebing, biaya BERHENTI naik.** 40 menit, 7 hari, dan 30 hari sama-sama
   ~61 root. Jadi:

   ❌ **"Backfill riwayat dalam itu mahal" — TIDAK BENAR.** Membuktikan transaksi
   berumur 30 hari **sama mahalnya** dengan yang berumur 40 menit: ~61 root ≈
   1,8×10⁻⁵ CTC di atas biaya basis → total ~4×10⁻⁵ CTC per transaksi.
   Dengan 10.000 tCTC, itu **ratusan juta transaksi**.

   Yang membatasi backfill sekarang bukan **biaya**, tapi **waktu**: latensi proof API
   naik dari ~0,8 dtk (baru) ke 1,5–5 dtk (7–30 hari), dan pemindaian `eth_getLogs`.

   ⚠️ Ini **mencabut satu baris dari daftar "Jangan sentuh"** di `02-keputusan-ide.md`.

3. **Nilai plateau bergeser antar pengukuran** — 81 root di satu sesi, 61 di sesi
   berikutnya. Kemungkinan besar bergantung posisi checkpoint relatif terhadap blok yang
   ditanya. **Pakai rentang 60–85, jangan satu angka**, dan jangan taruh angka tunggal
   di deck.

📌 **Catatan operasional penting:** blok pada `−0` dan `−5` dari tinggi ter-attest
**gagal** dengan `BlockNotReady`. Pandangan proof API sedikit tertinggal di belakang
`get_latest_attestation_height_and_hash`. **Worker wajib memberi margin ~10 blok** di
bawah tinggi ter-attest sebelum meminta proof — tanpa itu, kegagalan misterius di awal
tiap siklus.

### 1.4 Batch — terukur, dan ada jebakan API

Precompile mengekspos **overload**, bukan fungsi bernama beda:

```
verify        (uint64, uint64,   bytes,   (bytes32,(bytes32,bool)[]),   (bytes32,bytes32[]))
verify        (uint64, uint64[], bytes[], (bytes32,(bytes32,bool)[])[], (bytes32,bytes32[]))
verifyAndEmit (uint64, uint64,   bytes,   (bytes32,(bytes32,bool)[]),   (bytes32,bytes32[]))
verifyAndEmit (uint64, uint64[], bytes[], (bytes32,(bytes32,bool)[])[], (bytes32,bytes32[]))
calculateTxIndex((bytes32,(bytes32,bool)[]))
```

Memanggil `verifyAndEmitBatch` (nama di dokumentasi SDK) → `execution reverted:
"Unknown selector"`. Nama on-chain-nya tetap `verifyAndEmit`, hanya beda arity.

Hasil ukur, 5 tx USDC mainnet di 5 blok berurutan:

| | Gas | Biaya | Per tx |
|---|---|---|---|
| 5× single | 233.734 | 0,000117 CTC | 46.746 |
| 1× batch | **185.396** | 0,0000927 CTC | **37.079** |

**Hemat 21%.** Sumbernya: continuity proof bersama menyusut dari 25 root (7+6+5+4+3)
menjadi **7 root** untuk rentang blok 25.665.364–25.665.368, plus satu base tx cost
alih-alih lima.

⚠️ **DIKOREKSI 9 Agustus 2026** — dibaca dari sumber `@gluwa/usc-sdk` 0.18.0, bukan dari
percobaan. Dari tiga jebakan yang tercatat, **dua tidak benar**:

| Catatan lama | Kenyataan (9 Agt) |
|---|---|
| "`getBatchProof()` mengembalikan `merkleProofs` **kosong `{}`**" | ❌ **Kemungkinan besar artefak serialisasi.** Tipenya `Map<number, Map<number, BatchMerkleProofEntry>>` dan SDK mengisinya dari `Object.entries(data.merkleProofs)` — jadi API-nya memang mengirim datanya. **`JSON.stringify(new Map(...))` menghasilkan `{}`.** Uji ulang dengan `[...map.entries()]` **sebelum** membangun jalur manual. |
| "`ContinuityProofBuilder` tidak diekspor — jangan cari" | ⚠️ **Setengah benar.** Kelasnya memang tidak di-reexport dari root, **tapi `mergeProofs` diekspor publik** sebagai `sdk.proofProvider.mergeProofs([[height, proof], …])`. Untuk batching kamu **tidak butuh** `ContinuityProofBuilder` sama sekali. (Kalau tetap perlu: `package.json` tidak punya field `exports`, jadi deep-import `dist/proof-provider/raw/continuity-proof` legal.) |
| "`verifyAndEmitBatch` → Unknown selector" | ⚠️ **Benar hanya sebagai nama fungsi on-chain.** Sebagai **method SDK**, `blockProver.verifyAndEmitBatch(...)` ada dan me-resolve overload `verifyAndEmit(uint64,uint64[],bytes[],…)` dengan benar. Boleh dipakai. |

**Jalur batching yang benar, dan lebih sederhana daripada yang kita kira:**

```
getProof(txHash) per tx
  → heights[], txBytes[], merkleProofs[]
  → mergeProofs([[h1,cp1], [h2,cp2], …])  → satu continuity proof bersama
  → verifyAndEmitBatch(chainKey, heights, txBytes, merkleProofs, merged)
```

⚠️ `INativeQueryVerifier.sol` kita **belum mendeklarasikan overload batch.** Harus
ditambah kalau mau batching on-chain.

### 1.5 Batasan keras — wajib jadi bahan desain

| Batasan | Angka | Implikasi |
|---|---|---|
| Arah data | Satu arah: source → Creditcoin | Tidak ada callback. **Tidak bisa melikuidasi di Ethereum.** Writability ada di roadmap Attestcoin tapi **masih audit, belum rilis** — boleh disebut sebagai roadmap, haram sebagai kemampuan. |
| Chain sumber | Ethereum saja (Sepolia + mainnet) — diverifikasi ulang 9 Agt dari precompile | Kata "omnichain" = bohong. |
| **Yang bisa dibuktikan** | **Kejadian (tx + receipt + log). BUKAN keadaan/saldo.** | **§1.7.** Ini batas terdalam produk — ledger wajib mulai dari nol, dan RT11 lahir dari sini. |
| Latensi end-to-end | **Pita, bukan titik** (§1.5d): testnet **32–42 blok** (~6,9–9,0 mnt), CC mainnet **65–73 blok** (~13–14,6 mnt) | Klaim docs "15 detik" hanya langkah verifikasi. Untuk publik bulatkan **"~9 menit"**. |
| Batch | Maks 10 proof, rentang 1000 blok `[docs]` | Agregasi massal tidak feasible. |
| Attestor set | 7 terdaftar, sampel VRF 5, `AuthorizedOnly` (§1.5b) | **Jangan jual "fully decentralized".** |
| Jaminan ekonomi | **Tidak ada** — `minBondRequirement = 0` | **Jangan jual "economically secured" / "slashing".** |
| Biaya vs umur tx | >10× per hari | Ingest segera, jangan backfill. |

### 1.5b Model kepercayaan — dibaca dari state chain, bukan docs

**Ini menutup G9.** Dokumentasi Creditcoin tidak menyebut satu angka pun tentang
attestor. Semua di bawah ini dibaca langsung dari storage pallet `attestation` lewat
Substrate RPC — endpoint yang sama dengan EVM RPC juga melayani JSON-RPC Substrate.

✅ **DIUKUR ULANG 9 Agustus 2026 di specVersion 131 (Attestor V2) — angka di bawah
sudah dikoreksi dan TERKONFIRMASI.** Dibaca langsung dari storage Substrate dengan
twox128 yang diimplementasikan sendiri (xxhash64 murni Python, diverifikasi dengan tiga
vektor uji) — **tanpa `@polkadot/api`**, jadi bisa diulang kapan saja dari `tools/recon/`.

| Storage | CC3 Testnet (chainKey 3 = ETH mainnet) | CC3 Testnet (chainKey 1 = Sepolia) | **Creditcoin Mainnet** (chainKey 1 = ETH mainnet) |
|---|---|---|---|
| `attestorsCount` | **4** | **7** | **7** |
| `maxAttestors` | 100 | 100 | 100 |
| `targetSampleSize` | **3** | **5** ⚠️ *dikoreksi — sebelumnya tertulis 3* | **5** |
| `chainElectionPolicy` | **`AuthorizedOnly`** (0x01) | **`AuthorizedOnly`** (0x01) | **`AuthorizedOnly`** (0x01) |
| `chainAttestationInterval` | **10 blok** | **10 blok** | **10 blok** |
| `minBondRequirement` | *(tidak diset)* | *(tidak diset)* | **`0`** (u128 nol) |
| `invulnerables` | kosong | kosong | kosong |
| `Attestors` (entri terdaftar) | — | 11 total (4 + 7) ✓ | **7** ✓ |
| `maturityStrategy` | `EvmSafe` | `EvmSafe` | **`EvmFinalized`** |

⚠️ `maturityStrategy` **tidak ada di storage** — kemungkinan konstanta runtime, bukan
item storage. Nilainya tetap konsisten dengan lag terukur (§1.5d), jadi dipertahankan —
tapi tandai `[docs]`, bukan hasil ukur.

**Kesimpulan yang penting: Attestor V2 TIDAK mengubah model kepercayaan.** Set tetap
kecil dan permissioned, dan **`minBondRequirement` tetap 0.** Seluruh daftar klaim
terlarang §7 tetap berlaku apa adanya — *"economically secured"* dan *"slashing"* tetap
haram, dan angka yang dipakai di deck sekarang berasal dari spec yang sedang berjalan.

**Cara kerjanya**, digabung dengan `[docs]`: attestor harus **terdaftar dan
terotorisasi** (`AuthorizedOnly` — bukan set terbuka). Untuk tiap attestation, **VRF
memilih sampel acak** sebanyak `targetSampleSize` dari attestor terdaftar; hanya sampel
itu yang berhak memberi suara. Suara mereka digabung jadi **satu tanda tangan
teragregasi BLS**, lalu validator Creditcoin memverifikasi kuorum sebelum commit.

**Tiga hal yang wajib jujur di deck:**

1. **Set-nya kecil dan permissioned.** 7 attestor terdaftar di mainnet, sampel 5 per
   attestation. Ini **bukan** desentralisasi skala Ethereum. Catatan sesi sebelumnya
   yang menyebut *"5 attestor, quorum 3"* **salah** — angkanya berbeda per chain dan
   per lingkungan.
2. **Tidak ada jaminan ekonomi.** `minBondRequirement = 0` di mainnet, `invulnerables`
   kosong, dan tidak ada slashing yang terdokumentasi. **Jangan pernah menyebut
   "economically secured" atau "slashing".** Keamanannya bersandar pada otorisasi dan
   agregasi tanda tangan, bukan pada modal yang dipertaruhkan.
3. **Ini asumsi kepercayaan produk kita juga.** Kalimat jujur: *"cadangan dibuktikan
   secara kriptografis ter-include di Ethereum; kepercayaan yang tersisa ada pada kuorum
   attestor Creditcoin, bukan pada issuer dan bukan pada satu operator oracle."*

**Bonus: ini menjelaskan latensi yang kita ukur, persis.**

```
CC3 Testnet   : EvmSafe      (~32 blok safe head)  + interval 10 blok ≈ 42   → terukur 44 ✓
CC Mainnet    : EvmFinalized (~64 blok, 2 epoch)   + interval 10 blok ≈ 74   → terukur 74 ✓
```

Jadi angka ~8,8 menit dan ~14,8 menit bukan pengamatan kebetulan — keduanya turun dari
`maturityStrategy` + `chainAttestationInterval` yang bisa dibaca siapa pun di chain.
**Latensi ini desain protokol dan tidak akan membaik**, jadi jangan janjikan sebaliknya.

⚠️ **Diperbaiki 9 Agustus:** model di atas benar, tapi hasilnya **pita, bukan titik** —
`chainAttestationInterval = 10` berarti jarak ke kepala rantai berayun sepanjang 10 blok
antar attestation. Angka final yang dipakai untuk parameter kontrak: **§1.5d**.

Cara membaca ulang (Substrate RPC ada di endpoint yang sama):

```js
import { ApiPromise, HttpProvider } from '@polkadot/api';
const api = await ApiPromise.create({
  provider: new HttpProvider('https://rpc.cc3-testnet.creditcoin.network'), noInitWarn: true });
await api.query.attestation.attestorsCount.entries();     // per chainKey
await api.query.attestation.targetSampleSize.entries();
await api.query.attestation.chainElectionPolicy.entries();
await api.query.attestation.minBondRequirement.entries();
await api.query.supportedChains.supportedChains.entries();
```

### 1.5c Batas RPC Creditcoin — penentu arsitektur frontend

Diukur 2 Agustus 2026 terhadap `rpc.cc3-testnet.creditcoin.network`.

```
block time                 : 15 detik
eth_getLogs, hasil maks    : 10.000 log per permintaan
eth_getLogs, timeout       : 10 detik

Dengan filter alamat:
   10.000 blok  →  OK, ~3 detik          (≈ 42 jam riwayat)
  100.000 blok  →  TIMEOUT
  500.000 blok  →  TIMEOUT
2.000.000 blok  →  TIMEOUT
```

⚠️ **Filter alamat tidak menolong.** Yang membunuh adalah biaya pemindaian node, bukan
jumlah hasil — query 100.000 blok yang mengembalikan **nol** log tetap timeout.

**Implikasi desain (sudah diadopsi, lihat `03-spesifikasi-produk.md` §9):**

| Data | Cara ambil | Alasan |
|---|---|---|
| Angka solvabilitas (`reserves`, `collateralRatioBps`, `totalSupply`, `isMintingFrozen`, `mintableHeadroom`) | **`eth_call`** — selalu, tanpa cache | Instan, tanpa batas range, langsung dari state. Ini bagian yang trust-critical. |
| Feed bukti | `eth_getLogs` **maks 10.000 blok** terakhir | Satu permintaan, ~3 detik, ~42 jam riwayat |
| Riwayat lebih dalam | Cache inkremental di sisi klien (`localStorage`) | Tetap data chain, cuma disimpan pengguna sendiri |

Opsi cadangan kalau feed terasa lambat: simpan **N ingest terakhir sebagai ring buffer
di state kontrak** (misal 32 slot) → feed jadi **satu `eth_call`**. Biaya tambahan
~5–20 ribu gas per ingest (< 0,00003 CTC). Belum diadopsi; simpan sebagai opsi.

### 1.5d Lag attestation — DIUKUR ULANG 9 Agustus, dan bentuknya PITA

**Kenapa diukur ulang:** Creditcoin naik ke **specVersion 131 ("Attestor V2")** —
testnet 4 Agustus, mainnet 6 Agustus. Pengukuran 2 Agustus dilakukan **sebelum** rilis
itu, dan release notes menyebut perubahan pallet + precompile attestation, penegakan
monotonisitas, caching merkle proof, dan penyimpanan block hash untuk rekonsiliasi reorg.

Dibaca dari precompile ChainInfo `0x0fd3` (`get_latest_attestation_height_and_hash`),
6 sampel berjarak 20 detik:

```
CC3 testnet ← Sepolia   (chainKey 1) :  32, 34, 36, 37, 38, 41    → pita 32–41 blok
CC3 testnet ← ETH main  (chainKey 3) :  33, 35, 37, 39, 40, 42    → pita 33–42 blok
CC mainnet  ← ETH main  (chainKey 1) :  65, 67, 69, 70, 72, 73    → pita 65–73 blok
```

📌 **Cara menyebut angka ini secara konsisten** (dipakai di seluruh dokumen):
per-chainKey pakai angka presisi di atas (**32–41** Sepolia, **33–42** ETH-mainnet);
untuk ringkasan testnet pakai **selubungnya: 32–42**. Dua-duanya benar — yang kedua
adalah gabungan yang pertama, bukan angka yang berbeda.

**Temuan yang mengubah keputusan: lag bukan konstanta, dia bergerak seperti gigi gergaji.**
Angka "44 blok" di versi lama adalah satu sampel dari pita, bukan nilai tetap.
Penyebabnya persis model di §1.5b, dan sekarang terkonfirmasi kuantitatif:

```
testnet   : EvmSafe      (~32 blok safe head)      + interval 10  → pita 32–42   ✓ terukur 32–42
CC mainnet: EvmFinalized (~64 blok, 2 epoch)       + interval 10  → pita 64–74   ✓ terukur 65–73
```

Attestation terjadi tiap 10 blok, jadi jarak ke kepala rantai berayun sepanjang 10 blok
antar attestation. Lebar pita = `chainAttestationInterval`.

**Konsekuensi langsung ke parameter kontrak yang `immutable` (menutup separuh G14):**

| Parameter | Nilai yang diturunkan | Alasan |
|---|---|---|
| `attestationWindowBlocks` | **42** (testnet) / **74** (mainnet) | **Batas ATAS pita**, bukan rata-rata. Ini panjang satu jendela attestation terburuk. |
| `maxStalenessBlocks` | **63** (testnet) / **111** (mainnet) | = batas atas pita **× 1,5**. Toleransi 50% menyerap satu attestation yang terlewat penuh tanpa menahan `mint()` yang sah. |

⚠️ **Jangan pakai rata-rata.** Kalau `maxStalenessBlocks` diset di sekitar 44, `mint()`
yang sah akan revert `ReserveViewStale` setiap kali lag menyentuh ujung atas pita — dan
itu terjadi **beberapa kali per jam**, termasuk saat demo.

⚠️ **Jalankan `tools/recon/attestation-lag.mjs` minimal 2 jam sebelum deploy final** dan
pastikan tidak ada sampel yang keluar dari pita di atas. Kontraknya `immutable` (RT9) —
angka ini hanya bisa diperbaiki dengan redeploy.

### 1.6 Kewajiban developer (sumber bug/celah paling umum)

1. **Precompile TIDAK mengecek apakah tx sukses.** Wajib `require(receipt.receiptStatus == 1)`.
   Tx yang revert sama "ter-include"-nya dengan yang sukses.
2. **Replay protection tanggung jawab kita.** `queryId = f(chainKey, blockHeight, txIndex)`.
3. **Wajib validasi alamat emitter log.** Tanpa ini siapa pun bisa deploy ERC-20 sampah
   yang emit `Transfer` dengan signature sama.
4. **Wajib validasi bentuk log** (`topics.length == 3`, `data.length == 32`) sebelum decode.
5. **Off-chain worker wajib**: persistence, catch-up setelah mati, dedup, retry, koneksi node redundan `[docs]`.

### 1.7 Apa yang SEBENARNYA di-commit oleh attestation — batas terdalam produk

*Baru 9 Agustus 2026. Dibaca dari sumber `@gluwa/usc-sdk` 0.18.0. **Tidak ada di
dokumentasi Creditcoin mana pun.** Ini temuan paling penting di dokumen ini.*

```
merkleRoot = KeccakMerkleTree( abiEncode(tx, receipt) untuk setiap tx di blok )
digest     = keccak256( blockNumber ‖ merkleRoot ‖ prevDigest )
```

Isi `abiEncode(tx, receipt)` — lengkap, tidak ada yang dihilangkan:

```
nonce · gasLimit · from · toIsNull · to · value · data(calldata)
· field per tipe tx (chainId, gasPrice/maxFee, accessList, authorizationList, v/r/s)
· receiptStatus · receiptGasUsed · logs · logsBloom
```

**Tidak ada `blockHash`. Tidak ada block header. Tidak ada `stateRoot`.**

Merkle root-nya adalah **pohon kustom atas pasangan (transaksi, receipt)** — *bukan*
`transactionsRoot` Ethereum — dan digest-nya dirantai lewat `prevDigest`, *bukan* lewat
block hash Ethereum.

#### Tiga konsekuensi yang mengunci desain

1. **Membuktikan saldo sebuah alamat di Ethereum MUSTAHIL — permanen.** Tidak ada trik.
   State root Ethereum tidak pernah masuk ke dalam apa yang di-attest, jadi tidak ada
   yang bisa diverifikasi MPT proof terhadapnya. Attestcoin adalah oracle **kejadian**,
   bukan oracle **keadaan**.
2. **Karena itu `ReserveLedger` wajib merekonstruksi cadangan dari aliran, dan wajib
   mulai dari nol.** Ini bukan penyederhanaan dan bukan pilihan gaya — ini satu-satunya
   akuntansi yang mungkin. Dan RT11 (observatory tidak boleh memakai kata *solvency*)
   turun langsung dari sini, bukan dari kehati-hatian.
3. **Satu-satunya keadaan yang bisa dibuktikan adalah keadaan yang DITERBITKAN sebagai
   kejadian.** Tepat satu kelas sistem melakukan itu sebagai pekerjaan utamanya:
   **rollup**. Base menerbitkan state root L2-nya ke Ethereum L1 — sebagai calldata
   *dan* sebagai log, dan **dua-duanya ada di dalam `abiEncode` di atas.**

   → Ini dasar teknis **Babak 5** (`03-spesifikasi-produk.md` §14), dan kalimat deck
   yang tidak bisa ditiru siapa pun:

   > **Corolary tidak bisa membuktikan saldo di Ethereum. Corolary bisa membuktikan
   > saldo di Base.** Bukan karena kami menambah chain — tapi karena Base menerbitkan
   > keadaannya ke Ethereum, dan Ethereum adalah yang kami baca.

#### Cara memakainya di deck

Jangan sembunyikan batas ini — **buka dengannya.** Menyebutkan batas protokol yang tidak
tertulis di dokumentasi resminya sendiri adalah bukti kedalaman yang paling sulit
dibantah, dan menutup RT6 tanpa juri perlu paham satu baris kode pun.

### 1.8 Konflik dengan panduan resmi — harus dijawab di deck

Docs `dapp-design-patterns-readability` secara eksplisit menyarankan:

> "**Avoid common events**: Don't repurpose standard events like `Transfer`;
> create specific alternatives."

Desain kita **sengaja melanggar ini.** Alasannya sah dan harus dinyatakan lugas:
panduan itu mengasumsikan **kamu memiliki kontrak sumber**. Seluruh nilai produk kita
justru ada pada membaca kontrak yang **bukan milik kita** dan yang **tidak pernah
setuju diaudit**. Circle tidak akan menambahkan event khusus untuk kita.

Risiko ambiguitas yang jadi alasan panduan itu, kita tutup dengan tiga lapis
validasi: alamat emitter, bentuk topics/data, dan status receipt. Ini justru bahan
bagus untuk deck — bukti kita membaca docs sampai dalam dan tahu kapan menyimpang.

Catatan: halaman `source-chain-smart-contracts` **tidak membahas sama sekali** replay
protection, validasi emitter, atau membaca kontrak yang tidak dipercaya. Celah
keamanan ini kita isi sendiri.

---

## 2. Ketersediaan data — apa yang benar-benar hidup

Ini yang menentukan ide mana yang bisa **didemokan jujur**, dan tidak ada di docs
mana pun.

### 2.1 Sepolia — kebun stablecoin, kuburan lending

Jendela 12 blok (~30 menit), 8.421 log total. Emitter teratas:

```
USDZ  "Stabilizer USD"          2305 log / 310 tx   ← protokol stablecoin pihak ketiga, hidup
USDC  0x77ef…                    715 log / 143 tx
USDT  0xee04…                    615 log / 127 tx
PYUSD 0xF11C…                    489 log / 102 tx
USDS  0xF859…                    474 log / 100 tx
stUSDC-LP / stUSDT-LP / stUSDS-LP / stPYUSD-LP     ← "Stabilizer USDC Pool" dkk
WETH  0x7b79…                    223 log / 109 tx
USDC  (Circle) 0x1c7D…           107 log /  49 tx   ← dipakai spike
EURC  (Circle)                    23 log /  23 tx
```

Protokol lending di Sepolia, jendela 4.000 blok (~13 jam):

```
Aave V3 Pool         terdeploy, 76 log / 13 jam    ← ~6 log/jam, terlalu tipis
Compound V3 cUSDCv3  terdeploy, 0 log / 13 jam     ← MATI
Morpho Blue          terdeploy, 0 log / 13 jam     ← MATI
```

**Konsekuensi:** ide apa pun yang demonya bergantung pada perilaku lending live di
Sepolia tidak bisa dibuat jujur. Satu-satunya jalan adalah kita sendiri yang
bertransaksi di Aave — dan itu menghancurkan klaim "data pihak ketiga yang tidak
bisa dipalsukan", satu-satunya hal yang membuat ide itu kuat.

### 2.2 Ethereum mainnet — semuanya hidup

Jendela 100 blok (~20 menit):

| Aset | log | tx | totalSupply |
|---|---|---|---|
| Tether USDT | 8.634 | 2.864 | $92,06 M |
| Circle USDC | 5.920 | 1.704 | $49,59 M |
| Ethena USDe | 125 | 29 | $3,88 M |
| **Aave V3 Pool** | **73** | **30** | — (hidup) |
| Sky USDS | 63 | 21 | $6,57 M |
| Lido stETH | 30 | 8 | 9,4 jt stETH |
| Paxos PAXG | 27 | 12 | 441.935 oz emas |
| Maple syrupUSDC | 6 | 2 | $906 jt |
| Circle EURC | 9 | 8 | $292 jt |
| **BlackRock BUIDL** | **0** | **0** | $224,87 jt |
| **Ondo USDY** | **0** | **0** | $974,08 jt |
| **Ondo OUSG** | **0** | **0** | 1,43 jt |
| **Superstate USTB** | **0** | **0** | $66,36 jt |
| **Backed bIB01** | **0** | **0** | 45.327 |

*(satuan supply mengikuti `decimals()` masing-masing token)*

Dua pelajaran:

- **Token RWA institusional itu nyata tapi lambat.** Nol event dalam 20 menit. Bagus
  untuk bobot naratif dan angka di deck; **berbahaya kalau jadi tulang punggung demo
  live** — kita tidak bisa menyuruh BlackRock bergerak saat juri menonton.
- **USDC/USDT adalah selang pemadam kebakaran.** 1.704 dan 2.864 tx per 20 menit.
  Ini bahan bakar demo yang selalu bergerak.

→ **Keputusan yang sudah dikunci:** mainnet sebagai sumber kebenaran utama, treasury
milik kita di Sepolia sebagai panggung yang bisa kita picu sesuai kemauan.

---

## 3. Lanskap pasar & kompetitor nyata

### 3.1 Ukuran pasar `[web]`

- Tokenized RWA: **~$22–33,5 miliar** (2026), naik ~3× dari ~$11,8 M (2025)
- Tokenized US Treasuries: **~$10–12,9 miliar**
- Private credit on-chain: **~$8 miliar**
- Lapisan stablecoin: **$299,3 miliar**, **241,3 juta pemegang**
- Konsentrasi: USDT + USDC > 80% aset industri

### 3.2 Kegagalan yang membuat produk ini perlu ada `[web]`

**Resolv (USR) — 22 Maret 2026.** Satu private key bocor. Penyerang mencetak USR
tanpa backing. Depeg.

**StablR (USDR & EURR) — 24 Mei 2026.** Issuer berlisensi **Malta, patuh MiCA,
didukung Tether**. Kelemahan multisig 1-of-3: penyerang menguasai satu kunci,
**mengangkat dirinya sendiri jadi admin, menghapus penanda tangan sah**, lalu
mencetak **8,35 juta USDR + 4,5 juta EURR = $13,5 juta tanpa backing**. EURR jatuh
ke **$0,548 (−45%)**. Minting dan redemption dibekukan.

Total nilai hancur akibat keruntuhan stablecoin 2022–2026: **~$2,5 miliar**.

**Ini poin paling tajam yang kita punya:** StablR itu **berlisensi dan patuh regulasi**.
Regulasi tidak mencegahnya, karena kegagalannya terjadi **di level otoritas mint,
secara real-time**, di antara dua laporan bulanan.

#### Dua kasus baru (riset 9 Agustus) — satu memperkuat, satu WAJIB diakui

**A. Zondacrypto — April 2026. Memperkuat: buktinya ada di rantai, 15 bulan, tak ada yang lihat.** `[web]`

Bursa kripto terbesar Polandia. Firma forensik on-chain **Recoveris** menerbitkan
analisisnya 6 April 2026: cadangan BTC hot wallet turun **99,7%** (~55,7 BTC Agu 2024 →
~0,18 BTC Mar 2026 → ~0,07 BTC per 1 Apr). **511 transaksi** antara 18 Des 2025 – 2 Apr
2026 memindahkan **>$21 juta lintas 30 kripto**. Kerugian ditaksir **>$95 juta** (350 jt
PLN), 700+ korban terdaftar, seluruh dewan pengawas mundur, lisensi Estonia dicabut.
Disebut kegagalan bursa terbesar Eropa sejak FTX.

> Datanya ada di rantai selama 15 bulan. Butuh sebuah firma forensik, secara manual,
> untuk menemukannya. Observatory permissionless akan berteriak dalam ~9 menit.

⚠️ **Batas yang WAJIB disebut bersamaan:** Zonda itu bursa — kewajibannya off-chain, dan
asetnya BTC-berat, di luar chain sumber kita. Kita **tidak** membuktikan solvabilitasnya.
Ini **cerita**, bukan target hidup (lihat `09-narasi-dan-deck.md` §2 soal risiko menuduh
perusahaan yang masih beroperasi).

**B. Balance Coin (BLC) — 22 Juli 2026. WAJIB diakui: Corolary TIDAK mencegah ini.** `[web]`

Oracle harga BTCB dimanipulasi → likuidasi vault yang seharusnya tidak terjadi →
penyerang menguras **~$912.000** dari 42DAO dalam satu transaksi. BLC jatuh **99,75%**
ke $0,0014, ~$3,5 juta kapitalisasi hilang. Dikonfirmasi SlowMist & PeckShield.

Ini **risiko nilai kolateral**, bukan risiko otoritas penerbitan. Menutupnya butuh price
oracle, dan price oracle membatalkan seluruh klaim kita. **Masuk slide "yang TIDAK kami
cegah"** bersama apxUSD — lihat `07-red-team.md` RT8 dan `09-narasi-dan-deck.md` §5.

### 3.3 Regulasi `[web]`

**GENIUS Act** (AS, Juli 2025): issuer stablecoin pembayaran wajib memegang cadangan
100% aset likuid dan **mengungkap komposisinya bulanan**.

→ Standar emas kepatuhan hari ini adalah **laporan bulanan**. Ada 30 hari kegelapan
di antaranya. Resolv dan StablR keduanya runtuh **dalam hitungan jam**.

### 3.4 Kompetitor langsung `[web]`

| | Sumber data | Izin issuer | Frekuensi |
|---|---|---|---|
| **Chainlink PoR** | Kustodian & auditor off-chain | **Wajib opt-in** | Periodik |
| **Chronicle Proof of Asset** (BlackRock BUIDL, Mar 2026, $1,7 M AUM) | Kustodian & fund administrator | **Wajib opt-in** | Kontinu |
| **Kita** | **Rantai itu sendiri, via bukti inklusi** | **Tidak perlu** | **Per event** |

Perbedaan yang bisa dipertahankan: keduanya adalah **pipa terpercaya dari pihak yang
sedang kita curigai**. Chainlink dan Chronicle menanyakan kabar cadangan kepada
kustodian issuer. Kita **tidak bertanya kepada siapa pun** — kita membuktikan inklusi
transaksi di blok Ethereum yang sudah final. Issuer tidak bisa menolak, tidak bisa
menunda, tidak bisa memilih apa yang dilaporkan.

**Batas jujur yang WAJIB dinyatakan:** kita hanya bisa membuktikan **cadangan
on-chain**. Kalau backing-nya T-bill di kustodian tradisional, kita buta — di sana
Chainlink/Chronicle unggul. Kita **melengkapi**, bukan menggantikan.

Kabar baiknya: **Resolv dan StablR keduanya berada di dalam cakupan kita.** Segmen
yang kita layani persis segmen yang meledak tahun ini.

---

### 3.5 Target observatory — TERVERIFIKASI ON-CHAIN 9 Agustus 2026

Menutup **G10**. Semua saldo dibaca langsung lewat `eth_call balanceOf` ke USDC mainnet.
Blok referensi: **25.712.250**.

#### ⭐ Target utama: Sky (USDS/DAI) — LitePSM "Pocket"

```
alamat       : 0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341
saldo        : 4.251.196.990 USDC          ← $4,25 MILIAR
eth_getCode  : 0x                          ← ini EOA, bukan smart contract
```

**Kenapa ini target sempurna:** USDC **mentah** (tidak dibungkus → tidak butuh harga →
tidak melanggar prinsip "tanpa oracle"), **satu alamat** yang bisa dijelaskan dalam satu
kalimat, menopang peg stablecoin nyata, dan alirannya event `Transfer` biasa.

**Dan ada bahan naratifnya** `[web]`: Desember 2024 seorang peneliti keamanan
mempersoalkan persis alamat ini — sebuah EOA dengan akses penarikan tak terbatas atas
(waktu itu) **$756 juta**. Jawaban Rune Christensen: kuncinya dihancurkan saat setup MPC
dengan Coinbase Custody. Kritiknya: itu tidak menjawab siapa yang mengendalikan dompetnya.
Sekarang isinya **$4,25 miliar**, dan jaminan publik terbaiknya masih **sebuah pernyataan**.

⚠️ **Bingkai wajib — jangan menuduh:**

> Kami tidak menuduh Sky. Sky termasuk protokol paling transparan yang ada. Tapi jawaban
> terbaik hari ini untuk *"siapa yang bisa memindahkan $4,25 miliar ini?"* adalah sebuah
> janji. Corolary tidak menawarkan janji yang lebih baik — Corolary membuat pemindahannya
> terlihat oleh siapa pun dalam ~9 menit, tanpa izin Sky, dan tanpa Sky bisa menghentikannya.

#### Target kedua: Resolv (USR) — korban yang pemulihannya MASIH BERJALAN

Detail baru `[web]` yang mempertajam cerita di §3.2:

- 22 Mar 2026: infrastruktur signing dibobol → **~80 juta USR dicetak tanpa backing** →
  ~$25 juta ditarik sebagai ETH.
- **Kolateralnya TIDAK PERNAH tersentuh.** Yang jebol hanya otoritas mint.
  ← ini tesis Corolary, diucapkan oleh korbannya sendiri.
- ~46 dari 80 juta USR ilegal dinetralkan lewat burn + blacklist setelah timelock.
- **Jendela klaim pemulihan: 26 Mei – 26 Agustus 2026 → masih terbuka selama lomba ini.**

#### Target ketiga: Reserve (eUSD) — bukti kategori pelanggan, dengan catatan

```
eUSD token       : 0xa0d69e286b938e21cbf7e51d71f6a4c8918f482f   supply 23.273.566
Backing Manager  : 0xF014FEF41cCB703975827C8569a3f0940cFD80A4
```

Paling mirip **persona pelanggan** kita: eUSD dipakai **RPay**, aplikasi pembayaran
LatAm ($5,7 miliar volume kumulatif, pengguna di Argentina/Venezuela/Kolombia).

⚠️ **Tiga catatan sebelum dipakai:**
- Kolateralnya **dibungkus** (posisi Aave/Compound). USDC mentah di Backing Manager =
  **0**, diverifikasi. Enumerasi dulu token pembungkusnya. `aUSDC` aman (1:1),
  **`cUSDC` butuh exchange rate → itu oracle → tolak.**
- Data pengguna RPay terakhir 2023 (~600 rb, turun setelah kehilangan mitra bank).
  Status 2026 tidak terverifikasi.
- Supply $23 juta — kecil.

→ Pakai sebagai **bukti bahwa kategorinya ada**, bukan sebagai pelanggan hidup.

#### ❌ Ethena — DICABUT dari daftar sah

`03-spesifikasi-produk.md` §4.2 menandainya ✅. **Coret sampai diverifikasi.** Sebagian
besar backing Ethena duduk di *off-exchange custody* (posisi delta-netral lewat kustodian
pihak ketiga), bukan kolateral yang bisa dilihat penuh di Ethereum. Ini RT1 versi kedua
yang kita pasang sendiri.

#### Tes kelayakan target — jalankan untuk setiap kandidat baru

1. **USDC mentah**, bukan dibungkus (kalau dibungkus: apakah 1:1 tanpa harga?)
2. **Satu alamat**, bisa dijelaskan dalam satu kalimat ke juri
3. **Model kustodi 1:1** — lolos tes §3.6

### 3.6 Anti-contoh WAJIB: Aave — kenapa "mengawasi alamat" ≠ "membuktikan backing"

Diukur 9 Agustus:

```
aEthUSDC totalSupply                     : 2.160.575.880
USDC yang benar-benar ada di kontraknya  :   174.604.028    ← 8%
```

`aUSDC` adalah token tanda terima. Cadangannya cuma 8% dari suplai — **dan itu memang
desainnya**, sisanya dipinjamkan. Bukan penipuan.

**Pelajarannya, dan ini masuk deck:** *proven collateral* hanya berarti sesuatu kalau
model issuer-nya memang kustodi 1:1. Kalau kita mengarahkan observatory ke Aave dan
menampilkan "8% backed", kita berbohong tentang protokol yang sehat — dan itu RT1
dengan arah terbalik.

---

## 4. Intel kompetitif — BUIDL CTC musim 1

76 BUIDL, 189 hacker, 4 track, **USC belum wajib**.

| Peringkat | Proyek | Isi | Kenapa menang |
|---|---|---|---|
| Grand $10k | **CrediKye** | ROSCA/arisan on-chain, digamifikasi | Cerita paling "real world" + produk paling matang & menyenangkan |
| 2nd $3k | **HashCredit** | Payout mining BTC → credit line USDT via USC | Paling dekat dengan tesis Creditcoin: bukti pendapatan eksternal → kredit |
| 3rd $2k | **SnowBall** | Stack DeFi lengkap (CDP, lending, DEX, vault) | Argumen "mengisi kekosongan infrastruktur ekosistem" — sangat CEIP-minded |

**Grand prize bukan yang paling canggih.** Ini penting dan tidak boleh dilupakan.

**Lahan jenuh — hindari:**
- ROSCA / arisan: ≥5 tim (CrediKye, TrustCircle, CrediQuest, Moigye, e-Equb). Pemenangnya sudah ada.
- Credit score / reputation lending: ≥6 tim (CreditX, CredGate, BorrowIQ, CrediX, FlowCredit, AWRA). **Tidak ada yang menang.**
- Invoice tokenization: CreditFlow dkk.
- AI credit: BorrowIQ, AWRA — **keduanya kalah**.

**Perubahan aturan musim ini:**
1. Integrasi Attestcoin **WAJIB**, dan **kedalamannya kriteria penilaian utama**.
   Musim 1 banyak peserta nyaris tidak pakai USC (Moigye malah pakai Chainlink).
   **Formula musim 1 saja tidak cukup.**
2. **Track AI ditambahkan** — paling sepi, dan deskripsinya ditulis persis mengikuti
   primitive USC.

**Jebakan tutorial:** tutorial resmi #4 adalah "Cross Chain Loan dApp" dan satu-satunya
folder use case di `USC-Builder-Examples` adalah `SourceDestinationLoanRecording`.
Cross-chain lending = jalur paling ramai dan paling terbaca "nyontek tutorial".

---

## 5. Siapa Creditcoin — penentu apa yang mereka danai

Bukan L1 generik. Ini **chain riwayat kredit** dengan traksi nyata:

- Dibangun Gluwa. Misi: infrastruktur keuangan lintas batas untuk **emerging markets**.
- **Aella** (lender fintech Nigeria): 28.000+ pinjaman dalam hitungan minggu →
  **$100 juta+ pinjaman on-chain**, **5 juta+ transaksi**, **337.000+ user**.
- **MoU dengan Central Bank of Nigeria** sebagai Partner Agent untuk CBDC eNaira.
- Positioning: *"The Layer 1 Built for Cross-Chain Builders — Deploy once. Read every chain."*
- Aktif sejak 2017, 60.000+ anggota ekosistem.

**CEIP** `[web]`: $10 juta dikelola Credit Labs, **investasi ekuitas $25.000–$250.000**.
Prioritas resmi: platform kredit & pembayaran terdesentralisasi, inklusi keuangan
untuk komunitas kurang terlayani, memakai infrastruktur Creditcoin untuk masalah
nyata, mendorong adopsi Web3. **Top 3 hackathon → langsung tahap due diligence.**

**Implikasi:** juri menilai lewat dua lensa sekaligus —
(a) apakah ini memakai USC secara mendalam, dan
(b) **apakah ini layak diinvestasikan sebagai perusahaan.**
Proyek yang hanya "keren secara teknis" kalah dari yang punya jalur pengguna nyata.

Perhatikan juga: posisi resmi mereka adalah **"read every chain"**. Membaca mainnet
sungguhan bukan cuma trik demo — itu **membuktikan slogan mereka sendiri**.

---

## 6. Formula juara musim ini

```
MENANG = cerita real-world yang selaras tesis kredit Creditcoin
       × kedalaman USC yang MUSTAHIL ditiru tanpa USC
       × track/sudut yang belum jenuh
       × produk yang terlihat matang (demo + deck)
       × [BARU] bukti di uang sungguhan, bukan token mainan
```

Dua diferensiator termurah yang bisa kita menangkan:

> **1. Baca event dari kontrak Ethereum yang BUKAN milikmu.**
> Musim 1 hampir semua hanya membaca kontrak sendiri (pola tutorial).
>
> **2. Baca MAINNET.** Belum ada yang melakukannya, dan hari ini kita
> membuktikan itu bisa.

---

## 7. Daftar klaim TERLARANG

Sekali juri menangkap satu klaim palsu, seluruh deck kehilangan kredibilitas.

| Jangan bilang | Karena | Katakan ini |
|---|---|---|
| "omnichain" / "any chain" | Sumber cuma Ethereum — dicek ulang 9 Agt dari precompile | "Ethereum mainnet + Sepolia, hari ini" |
| "verifikasi 15 detik" | Itu cuma langkah verify | "**~9 menit** end-to-end, tanpa campur tangan manusia" |
| "lag-nya 44 blok" | **Lag itu PITA, bukan titik** (§1.5d): 32–42 testnet, 65–73 mainnet | "32–42 blok di testnet — berayun karena attestation tiap 10 blok" |
| "kami membuktikan saldo treasury" | **§1.7** — attestation tidak menyentuh state root Ethereum | "kami membuktikan **setiap pergerakan** sejak ledger dipasang" |
| "Corolary mencegah semua keruntuhan stablecoin" | Balance Coin (Jul 2026) & apxUSD di luar cakupan | "kami menutup risiko **penerbitan**, bukan risiko **nilai kolateral**" |
| "kami mengaudit Ethena" | Backing-nya di off-exchange custody (§3.5) | Jangan sebut sampai diverifikasi |
| "Attestcoin bisa menulis balik ke Ethereum" | Writability **masih audit, belum rilis** | "writability ada di roadmap mereka; hari ini protokolnya satu arah" |
| "fully decentralized" | **7 attestor terdaftar, sampel VRF 5, `AuthorizedOnly`** (§1.5b) | "trust terdistribusi ke kuorum attestor independen, bukan satu operator" |
| "economically secured" / "slashing" | **`minBondRequirement = 0`**, `invulnerables` kosong (§1.5b) | "keamanan bersandar pada otorisasi + agregasi BLS, bukan modal dipertaruhkan" |
| "5 attestor, quorum 3" | Angka lama yang **salah**. Berbeda per chain & lingkungan. | Sebut angka §1.5b, dan sebut lingkungannya |
| "proof of reserves lengkap" | Kita buta pada cadangan off-chain | "bukti cadangan **on-chain**; melengkapi PoR kustodian" |
| **"kami mengaudit Circle / BUIDL / Ondo / PAXG"** | **Backing mereka T-bill & emas OFF-chain. Kita tidak membuktikan apa pun tentang mereka.** | "kami mengaudit issuer yang kolateralnya hidup on-chain — **Sky, Liquity, Resolv**" (§3.5). ⛔ Ethena dicabut · ⛔ Aave anti-contoh |
| "tanpa trust" | Kita percaya attestor set | "tanpa oracle terpusat dan tanpa izin issuer" |
| "real-time" | Ada lag attestation | "hampir real-time, ~9 menit" |

---

## 8. Lingkungan terverifikasi

*Diperbarui 9 Agustus 2026 — semua baris di bawah diverifikasi ulang hari itu.*

```
── CREDITCOIN CC3 TESTNET (lingkungan kerja lomba) ──────────────────────────
RPC                        : https://rpc.cc3-testnet.creditcoin.network
chainId                    : 102031 (0x18e8f)      runtime specVersion: 131
gas price                  : 0,5 gwei              block gas limit: 75.000.000
Explorer                   : https://creditcoin-testnet.blockscout.com
Proof Builder API          : https://proof-gen-api.cc3-testnet.creditcoin.network
  endpoint                 : /api/v1/proof-by-tx/{chainKey}/{txHash}      ✅ 200, ~0,9 dtk
USC Dashboard              : https://dashboard.cc3-testnet.creditcoin.network
EvmV1Decoder (terdeploy)   : 0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f
chainKey 1 = Sepolia (11155111)      chainKey 3 = Ethereum mainnet (1)

── CREDITCOIN MAINNET (jalur produksi — kini bebas hambatan) ────────────────
RPC                        : https://mainnet3.creditcoin.network
chainId                    : 102030                runtime specVersion: 131
Proof Builder API          : https://proofbuilder.cc3-mainnet-usc.creditcoin.network
                             ✅ 200, ~1,05 dtk, TLS valid   ← URL BARU, yang lama mati
Dashboard                  : https://dashboard.cc3-mainnet-usc.creditcoin.network
EvmV1Decoder (terdeploy)   : 0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C   ← SUDAH ADA
chainKey 1 = Ethereum mainnet (1)

── SAMA DI KEDUA LINGKUNGAN ─────────────────────────────────────────────────
BlockProver precompile     : 0x0000000000000000000000000000000000000FD2
ChainInfo precompile       : 0x0000000000000000000000000000000000000fd3
SDK                        : @gluwa/usc-sdk 0.18.0   (rilis 22 Juni 2026)
  ⚠️ eth_getCode pada 0x0FD2/0x0fd3 mengembalikan 0x — NORMAL untuk precompile native

selector ChainInfo (dihitung sendiri, dipakai tools/recon):
  get_supported_chains()                           0x69e18c3c
  get_chain_by_key(uint64)                         0x2d256bfa
  get_latest_attestation_height_and_hash(uint64)   0x809112da
  get_latest_checkpoint_height_and_hash(uint64)    0xd773a786
  get_attestation_genesis_height(uint64)           0x0b0bbc8c
  is_height_attested(uint64,uint64)                0x9c68eccf

── AKUN (digenerate fresh 9 Agt 2026 — akun lama hilang kuncinya) ───────────
Deployer                         : 0x825003EdbE16AedfC63f99836553a15B1299f35e
                                   ⏳ 0 tCTC — menunggu faucet Discord
Operator worker                  : 0x7C1195c7e31ED2Dd4cE207D926d2fA3bA2e15Ff3
                                   diisi ~100 tCTC dari deployer
Issuer demo (kunci DIPUBLIKASIKAN): 0x2d27Da63Bbe23633c82ff553CfF009D974294e08
                                   diisi ≤20 tCTC (06 §3, RT12)
⚰️ AKUN LAMA (JANGAN DIPAKAI)    : 0x4e83Fa344E529f4c03948691BDD5A9A83384ED05
                                   10.000 tCTC utuh, tapi private key-nya hilang

── RPC CHAIN SUMBER (diuji ulang 9 Agt) ─────────────────────────────────────
Ethereum mainnet ✅ : ethereum-rpc.publicnode.com · eth.llamarpc.com · 1rpc.io/eth
                      eth.drpc.org · rpc.ankr.com/eth
  ⚠️ publicnode kadang balas 403 saat dipakai beruntun → WAJIB punya pool + retry
Sepolia          ✅ : ethereum-sepolia-rpc.publicnode.com · 1rpc.io/sepolia
Sepolia          ❌ : sepolia.drpc.org  → HTTP 400. DICORET dari daftar 2 Agt.
  ⚠️ urllib/fetch tanpa header User-Agent ditolak sebagian RPC → selalu set UA
  ⚠️ banyak RPC publik menolak eth_getLogs rentang besar — pakai rentang ≤20 blok

── ALAMAT ETHEREUM MAINNET ──────────────────────────────────────────────────
USDC (Circle)             : 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
USDT                      : 0xdAC17F958D2ee523a2206206994597C13D831ec7
USDC Sepolia (Circle)     : 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
Transfer topic0           : 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef

TARGET OBSERVATORY (terverifikasi 9 Agt — §3.5):
Sky LitePSM "Pocket"      : 0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341
Reserve eUSD BackingMgr   : 0xF014FEF41cCB703975827C8569a3f0940cFD80A4
Reserve eUSD token        : 0xa0d69e286b938e21cbf7e51d71f6a4c8918f482f

HANYA UNTUK BOBOT NARATIF — HARAM jadi target observatory (RT1):
BlackRock BUIDL           : 0x7712c34205737192402172409a8F7ccef8aA2AEc
Ondo USDY                 : 0x96F6eF951840721AdBF46Ac996b59E0235CB985C
PAXG                      : 0x45804880De22913dAFE09f4980848ECE6EcbAf78
Aave V3 Pool              : 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2   ← lihat §3.6

── FIXTURE PERTAMA (siap dipakai di Fase 1) ─────────────────────────────────
tx     : 0x9dd3e53b0207d90ac01e02997148a4b9fc8f96ad1db4272935f53b60edc5ed70
blok   : 25.712.180 (Ethereum mainnet)   txIndex 0   txBytes 10.849 B
proof  : merkleProof.siblings 8 · continuityProof.roots 1 (CC mainnet) / 21 (CC3 testnet)
status : terbukti bisa di-proof di KEDUA lingkungan, 9 Agt 2026
```

### Catatan API yang berbeda dari dokumentasi

- `ProofBuilder.getProof()` → `{ success, data, error }`; proof ada di `.data`.
- `getBatchProof()` → `continuityProof` bersama benar, tapi **`merkleProofs` kosong**.
- Fungsi batch on-chain adalah **overload `verifyAndEmit`**, bukan `verifyAndEmitBatch`.
- `ContinuityProofBuilder` **tidak diekspor** dari SDK.
- Decoder ada di `sdk.utils.decoder.decodeEvmV1Transaction`.
- ABI decoder ter-bundle: `@gluwa/usc-sdk/dist/utils/evmV1DecoderAbi.json`.
- `sdk.utils.gas.MAX_GAS_CAP` = 75.000.000, dan ada `computeGasLimit()` yang punya
  fallback heuristik karena `pallet-evm` **tidak meneruskan revert reason saat
  estimasi gas pada precompile**. Penting: `estimateGas` bisa gagal secara misterius.

---

## 9. Skrip pengukuran — dibangun ulang di repo baru

Repo lama (`contracts/`, `spike/`, `worker/`) dihapus 2 Agustus 2026 untuk mulai dari
nol. Semua **temuannya sudah terekam di dokumen ini**; yang hilang hanya kodenya.

Skrip berikut harus dibangun ulang di repo baru sebagai `tools/recon/`. Fungsinya
bukan sekadar riset — ini **alat regresi**: kalau salah satu berhenti lolos, ada
asumsi produk yang baru saja patah.

| Skrip | Menjawab | Ekspektasi lolos |
|---|---|---|
| `attestation-lag.mjs` | Lag attestation tiap chainKey, testnet & mainnet | **Pita** 32–42 blok (testnet, kedua chainKey); 65–73 (CC-mainnet). ⚠️ Jalankan **≥2 jam** sebelum deploy final — outputnya menentukan `maxStalenessBlocks` yang `immutable`. §1.5d |
| `supported-chains.mjs` | Chain sumber apa saja yang benar-benar ada? | Testnet: hanya key 1 (Sepolia) & 3 (ETH). Mainnet: hanya key 1 (ETH). **Kalau muncul yang baru, itu temuan besar.** Selector di §8 |
| `third-party-read.mjs` | Bisakah kita verifikasi event kontrak pihak ketiga? | `verifySingle → true` atas tx USDC Circle |
| `mainnet-proof.mjs` | Bisakah tx Ethereum mainnet dibuktikan & diverifikasi? | `true`, proof ~1 dtk, verify ~1,4 dtk |
| `cc-mainnet-proof.mjs` | Apakah produk ini mainnet-able? | Proof API mainnet → **HTTP 200 ~1,05 dtk**; `verifySingle` di CC mainnet → `true` |
| `gas.mjs` | Gas & biaya nyata `verifyAndEmit` | ~15,6 gas/byte txBytes |
| `batch.mjs` | Hemat gas batch vs single | ~21%. ⚠️ **Pakai jalur baru §1.4**: `getProof()` per tx → `mergeProofs()` → `verifyAndEmitBatch`. Cek dulu apakah `getBatchProof().merkleProofs` benar-benar kosong atau cuma `Map` |
| `emitter-activity.mjs` | Emitter mana yang hidup di Sepolia & mainnet | USDC/USDT firehose; Aave hidup hanya di mainnet |
| `observatory-targets.mjs` | Saldo & aliran target observatory | Sky Pocket > $4 M USDC & `eth_getCode == 0x`; **tes kelayakan §3.5 lolos untuk tiap target** |
| `rwa-activity.mjs` | Aktivitas & supply issuer RWA di mainnet | BUIDL/USDY/USTB ~0 event/20 mnt |
| `attestor-set.mjs` | Model kepercayaan: ukuran set, sampel VRF, bond, interval | Sesuai §1.5b. **Butuh `@polkadot/api`**, bukan ethers. ⚠️ **Ukur ulang** — §1.5b dari spec ≤130, sekarang 131 |
| `make-fixture.mjs` | Generator fixture tx nyata untuk test kontrak | Fixture pertama sudah tersedia di §8 |

**Aturan yang mengikat semua skrip di atas** (pelajaran 9 Agt):
- **Pool RPC + retry wajib**, bukan satu URL. `publicnode` membalas **403** saat dipanggil
  beruntun; `sepolia.drpc.org` membalas **400** dan sudah dicoret.
- **Selalu set header `User-Agent`.** Sebagian RPC menolak klien tanpa UA.
- Skrip ini **alat regresi**, bukan riset sekali pakai. Kalau salah satu berhenti lolos,
  ada asumsi produk yang baru saja patah — jalankan sebelum tiap rilis.

⚠️ **Arsip kode lama sudah DIHAPUS permanen (9 Agustus 2026).** Tidak ada salinan di mana
pun. Seluruh skrip di tabel atas **wajib ditulis dari nol** — dan itu memang yang
diinginkan: aturan lomba menuntut *"original work created during the hackathon"*.

Semua **temuannya** sudah terekam di dokumen ini; yang hilang cuma kodenya.
