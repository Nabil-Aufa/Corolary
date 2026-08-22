# CLAUDE.md — Corolary

> *Solvency isn't claimed. It follows.*

Instruksi proyek. Baca ini sebelum menyentuh apa pun.

## ⚠️ EJAAN NAMA — SATU L

Nama produk adalah **`Corolary`**, ditulis dengan **satu huruf L**.

Ini **disengaja** dan sudah dikunci 2 Agustus 2026 — bukan salah ketik.
**Jangan pernah "mengoreksi"-nya menjadi `Corollary`** di file, kode, komentar,
commit message, domain, atau materi apa pun. Kalau linter atau autocorrect
mengubahnya, kembalikan.

---

## ⚠️ PRODUK FINAL: NOL MOCK

**Aturan keras, dikunci 2 Agustus 2026.** Apa pun yang dilihat juri — dashboard yang
di-deploy, video demo, screenshot di deck — **tidak boleh** menampilkan satu angka, satu
baris feed, atau satu tombol pun yang tidak berasal dari chain sungguhan.

User pernah gagal lolos final karena ini. Ini bukan preferensi gaya; ini gerbang rilis.

**Mock hanya boleh hidup sebagai perancah pembangunan**, dengan tiga syarat mutlak:

1. Semua mock terkurung di `packages/web/src/mocks/**`. Tidak ada literal angka
   solvabilitas, tidak ada array feed hardcoded, di mana pun di luar folder itu.
2. Hanya ada **satu** titik masuk data (`packages/web/src/data/source.ts`). Mock dipilih
   lewat satu flag build-time (`NEXT_PUBLIC_DATA_SOURCE=mock`), dan build produksi
   **gagal keras** kalau flag itu bernilai `mock`. Bukan warning — `throw` saat build.
3. Mock **dihapus** dari bundle produksi di Fase 6c, bukan sekadar dinonaktifkan.

**Dilarang mutlak — ini yang membunuh submission, bukan folder mock-nya:**

- ❌ **Fallback diam-diam ke mock** saat RPC gagal. RPC mati harus tampil sebagai
  *"RPC unreachable"*, bukan sebagai angka lama yang terlihat sehat. Angka palsu yang
  terlihat benar jauh lebih buruk daripada error yang jujur.
- ❌ **Panel serangan yang disimulasikan.** Tombol "mint melebihi cadangan" wajib
  memanggil `mint()` sungguhan dan menampilkan `WouldBreachCollateralFloor` yang
  benar-benar dikembalikan node. Animasi revert yang di-hardcode = fitur mock.
- ❌ **Keadaan `MEMBEKU` yang dipentaskan.** Kalau mau menunjukkannya di demo, picu
  penarikan sungguhan di Sepolia (itulah gunanya "panggung kendali").
- ❌ **Tombol / tab / panel yang tidak berfungsi** — "coming soon", chart hiasan,
  observatory yang isinya belum ada. Kalau belum nyata: **hapus dari UI**, jangan
  disembunyikan di balik label.
- ❌ **Tautan yang tidak bisa dibuka.** Tiap baris feed punya dua tautan (Etherscan +
  Blockscout); dua-duanya wajib menuju transaksi yang benar-benar ada.
- ❌ Screenshot atau rekaman demo yang diambil saat `NEXT_PUBLIC_DATA_SOURCE=mock`.

**Yang TETAP boleh, dan bukan pelanggaran:**

- `vm.etch` mock precompile di unit test Foundry (§5 no. 6) — test-only, tidak pernah
  ikut ke produksi. Fork test tetap wajib sebelum rilis.
- Fixture dari transaksi Ethereum sungguhan — itu data nyata yang dibekukan, bukan mock.
- Sepolia sebagai panggung kendali — chain sungguhan, event sungguhan.

**Gerbang rilis:** `bash tools/verify-no-mock.sh` wajib lolos sebelum merekam video,
sebelum deploy dashboard, dan sebelum submission. Lihat Fase 6c di
`docs/05-rencana-build.md`.

---

## 0. Kamu pegang bagian mana?

Proyek ini dikerjakan **2 orang**. Kepemilikan file dipisah tegas — tidak ada satu file
pun yang dimiliki berdua. **Baca `docs/08-kerja-paralel.md` sebelum menulis baris pertama.**

### 🎨 Kalau kamu FRONTEND

**Milikmu:** `packages/web/**` — dan hanya itu.
**Jangan sentuh:** `packages/contracts/`, `packages/worker/`, `tools/recon/`, `deployments/`.

Mulai dari **Fase 6a** di `docs/05-rencana-build.md`. Kamu **tidak perlu menunggu**
kontrak selesai — sekitar 60–70% pekerjaanmu jalan di atas mock data.

Baca berurutan:
1. `docs/08-kerja-paralel.md` — kepemilikan file + bentuk mock data (§5)
2. `docs/03-spesifikasi-produk.md` **§9** — isi dashboard + **§9.0 sumber data**
3. `docs/03-spesifikasi-produk.md` **Lampiran A & B** — katalog event & error.
   Ini **janji API**. Kalau ada yang janggal, protes SEKARANG, jangan setelah disambungkan.
4. `docs/01-riset-mendalam.md` **§7** — klaim terlarang. Berlaku untuk copy di UI juga.

Tiga hal yang paling sering bikin bongkar ulang:
- **`uint256` itu string/BigInt, bukan `number`.** JavaScript `number` tidak muat. Tentukan sejak baris pertama.
- **Angka solvabilitas dilarang di-cache.** Selalu `eth_call` segar. Itu inti kepercayaan produk.
- **Alamat kontrak dibaca dari `deployments/<network>.json`**, tidak pernah di-hardcode.
- **Mock punya tanggal mati: Fase 6c.** Rancang lapisan data sejak baris pertama supaya
  mock bisa dicabut dengan satu flag — bukan ditambal belakangan. Baca bagian
  "⚠️ PRODUK FINAL: NOL MOCK" di atas sebelum menulis komponen pertama.

### ⚙️ Kalau kamu BACKEND

**Milikmu:** `packages/contracts/**`, `packages/worker/**`, `tools/recon/**`, `deployments/*.json`.
**Jangan sentuh:** `packages/web/**`.

Mulai dari **Fase 0** di `docs/05-rencana-build.md`, jalan berurutan sampai **Titik Beku**
di akhir Fase 3, lalu serahkan ABI + `deployments/*.json` ke frontend.

Kamu **tidak perlu membangun API HTTP apa pun.** Frontend baca langsung dari chain —
lihat `03-spesifikasi-produk.md` §9.0.

### 🤝 Berdua

`docs/**`, `CLAUDE.md`, `PROGRESS.md`, `README.md` boleh disentuh berdua — tapi
**katalog event & error (Lampiran A & B) tidak boleh diubah sepihak.** Kalau perlu
berubah, bicarakan dulu, perbarui dokumen, baru kirim ABI baru.

---

## 1. Apa proyek ini

Entri **BUIDL CTC 2026 Fall** (Creditcoin & Credit Labs), track **RWA**.
Deadline submission: **6 September 2026, 23:59 ET**. Submission dibuka 13 Agustus.

**Produk (`Corolary`):**

> Token yang **tidak bisa dicetak melebihi cadangan yang terbukti** — bahkan oleh
> pemegang kunci admin yang sudah dibajak sepenuhnya.

Kontrak di Creditcoin memelihara saldo cadangan sebuah treasury di Ethereum. Saldo itu
**hanya** bergerak lewat event `Transfer` ERC-20 nyata yang dibuktikan kriptografis
ter-include di blok Ethereum final, lewat **Attestcoin Protocol** (precompile `0x0FD2`).
`mint()` revert kalau melanggar lantai kolateral. `redeem()` selalu terbuka.
Kontraknya **tidak bisa di-upgrade**, dan **kunci issuer-nya diterbitkan publik**.

Dua kalimat untuk manusia (`docs/09-narasi-dan-deck.md` §1):

> Token dolar yang **tidak bisa dicetak melebihi uang yang benar-benar ada** —
> dan **pintu keluarnya tidak punya kunci.**

**Status per 9 Agustus 2026: dokumentasi FINAL, kode nol, 0 blocker.**
Semua parameter `immutable` sudah punya angka; semua prasyarat Fase 1 terpenuhi.
Repo sengaja direset 2 Agustus 2026. **Mulai dari Fase 0.**

---

## 2. Keputusan yang SUDAH DIKUNCI — jangan dibuka ulang

| Keputusan | Nilai | Kalau tergoda mengubah |
|---|---|---|
| Ide | **#1 Solvency-Locked Issuance** (`Corolary`) | Baca `docs/02-keputusan-ide.md`. 7 ide sudah diskor 6 sumbu. Jangan ulangi debatnya. |
| Track | **RWA** | Pilihan track ada di form submission, tidak bisa dibalik. |
| Sumber demo | **Mainnet utama, Sepolia panggung kendali** | Mainnet = kredibilitas; Sepolia = kita bisa memicu event sesuai kemauan saat demo. |
| Aset v1 | **Hanya stablecoin USD** | Menambah aset berharga = menambah price oracle = **membatalkan klaim "tanpa oracle"**. Ini prinsip, bukan penyederhanaan. |
| Nama | **`Corolary`** — satu L | Dikunci 2 Agt setelah beberapa putaran. Satu-L disengaja; risikonya sudah ditimbang dan diterima. Jangan diangkat lagi. |
| Sumber data frontend | **Langsung dari chain** | Tanpa API server. Ini konsekuensi tesis produk, bukan pilihan teknis — lihat spek §9.0. |
| Deadline | **Bukan kendala** | User sudah menyatakan yakin bisa menyelesaikan. Jangan mengecilkan ambisi demi jadwal. |
| **Kunci issuer** | **DITERBITKAN PUBLIK di README** (RT12) | Aman **hanya karena** RT9 + A3. Akun ketiga terpisah, ≤20 tCTC, terbit di Fase 3 setelah test RT9/A3 hijau. `06` §3. |
| **Parameter RT10** | `maxStalenessBlocks` 63/111 · `maxMintPerWindowBps` 500 | Diukur & diputuskan 9 Agt (G14/G15). `immutable` — mengubah = redeploy. |
| **Target observatory** | Sky LitePSM Pocket + Resolv (+ Reserve eUSD bersyarat) | Terverifikasi on-chain 9 Agt. **Ethena dicabut.** `01` §3.5. |
| **Babak 5 (Base)** | **Opsional, Fase 9, di luar jalur kritis** | Demo tidak boleh bergantung padanya. Kalau ragu: versi 80/20. Spek §14. |
| **Positioning** | Kredibilitas untuk issuer **tanpa merek**, bukan "keamanan" | Circle tidak butuh ini karena punya merek. Fintech emerging-market tidak punya. `09` §4. |
| **Pasar** | **DUA segmen.** B = issuer berkolateral on-chain (nyata, untuk **demo**) · A = fintech emerging-market penerbit token dolar (hipotesis, untuk **slide bisnis**) | ⛔ Jangan gabung jadi satu kalimat. ⛔ Jangan sebut Aella sebagai pelanggan — mereka *lender*, bukan penerbit token. `09` §4. |

Kalau user minta mengubah salah satu, kerjakan — tapi sebutkan konsekuensinya sekali,
jangan berdebat berulang.

---

## 3. Dokumen — urutan baca

| File | Kapan dibuka |
|---|---|
| `PROGRESS.md` | **Selalu pertama.** Status + environment terverifikasi. |
| `docs/03-spesifikasi-produk.md` | **Rujukan utama saat ngoding.** PRD, arsitektur, desain kontrak, katalog event/error, skema persistensi worker, format fixture. |
| `docs/05-rencana-build.md` | Urutan kerja + definition-of-done tiap fase |
| `docs/04-gap-dan-blocker.md` | Sebelum membangun bagian apa pun — cek gap yang relevan |
| `docs/01-riset-mendalam.md` | Semua angka terukur + **§7 klaim terlarang** |
| `docs/06-akun-dan-dana.md` | Sebelum menyentuh wallet atau deploy |
| `docs/02-keputusan-ide.md` | Saat menulis deck, atau saat arah dipertanyakan |
| `docs/07-red-team.md` | **Sebelum menulis deck, demo, atau materi apa pun yang dilihat juri.** |
| `docs/08-kerja-paralel.md` | **Sebelum baris pertama.** Kepemilikan file, serah-terima, mock data, aturan. |
| `docs/09-narasi-dan-deck.md` | **Sebelum menulis deck, video, atau copy UI apa pun.** Urutan cerita, protagonis, jawaban hafalan, argumen pasar. |
| `docs/00-hackathon.md` | Saat menyiapkan submission |

**Jangan menulis angka teknis dari ingatan.** Semua ada di `docs/01-riset-mendalam.md`,
diukur sendiri. Kalau butuh angka yang tidak ada di sana, **ukur dulu**, jangan tebak.

---

## 4. Fakta yang HARAM disalahsebutkan

Semua diukur sendiri 1–2 Agustus 2026.

Diukur ulang **9 Agustus 2026** di bawah Attestor V2 (runtime specVersion **131**).

```
YANG DIBUKTIKAN      : KEJADIAN (tx + receipt + log). BUKAN KEADAAN.
                       Attestation commit ke keccak-merkle atas abiEncode(tx, receipt),
                       digest = keccak(blockNumber ‖ merkleRoot ‖ prevDigest).
                       TIDAK ADA block header. TIDAK ADA stateRoot.
                       → Membuktikan SALDO di Ethereum MUSTAHIL, permanen.
                       → Ini alasan ledger mulai dari nol, dan alasan RT11 ada.
                       Detail: 01-riset-mendalam.md §1.7

Lag attestation      : PITA, bukan titik — berayun sepanjang interval 10 blok
                       CC3 testnet  ← Sepolia   : 32–41 blok
                       CC3 testnet  ← ETH main  : 33–42 blok  (~6,9–9,0 mnt)
                       CC mainnet   ← ETH main  : 65–73 blok  (~13,0–14,6 mnt)
                       Angka "44 blok" di dokumen lama = satu sampel dari pita.
                       DESAIN PROTOKOL — tidak akan membaik.
                       Ke publik: bulatkan "~9 menit".

Parameter immutable  : attestationWindowBlocks = 42 (testnet) / 74 (mainnet)
                       maxStalenessBlocks      = 63 (testnet) / 111 (mainnet)
                       maxMintPerWindowBps     = 500  (5%)
                       Diturunkan dari BATAS ATAS pita, bukan rata-rata. Nilai di
                       sekitar 44 akan me-revert mint() yang sah beberapa kali per jam.

Biaya ingest         : ~15,6 gas/byte txBytes
                       tx kecil ~46.400 gas = 0,0000232 CTC
                       batch 5 tx: 21% lebih murah (37.079 gas/tx)

Biaya vs umur tx     : ADA TEBING, LALU DATAR — bukan naik terus (docs SALAH)
                       ≤100 blok di belakang tinggi ter-attest →  1 root  ← target
                        150 blok                               → 11 root
                       ≥200 blok … 30 HARI                     → ~61 root, DATAR
                       → ingest cepat = ~61× lebih murah pada variabel dominan
                       → jendela murah ~60 blok ≈ 12 menit; polling 1–2 mnt aman
                       → JANGAN buang tx lama karena "mahal" — biayanya berhenti naik
                       → plateau bergeser 61–81 antar sesi; pakai RENTANG di deck

Margin proof API     : beri ~10 BLOK di bawah tinggi ter-attest sebelum minta proof.
                       −0 dan −5 gagal BlockNotReady; −10 berhasil. Terukur.
                       Panggil is_height_attested() dulu — eth_call gratis.
Block gas limit CC   : 75.000.000 · gas price 0,5 gwei

chainKey             : CC3 testnet  → 1 = Sepolia, 3 = Ethereum mainnet
                       CC mainnet   → 1 = Ethereum mainnet
                       BERBEDA. Wajib konfigurasi, JANGAN hardcode.
                       Tidak ada chain sumber lain — dicek ulang 9 Agt dari precompile.

EvmV1Decoder         : CC3 testnet  0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f
                       CC mainnet   0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C
                       ⚠️ SUDAH ADA di mainnet. Dokumen lama bilang "belum" — SALAH.

Proof Builder API    : testnet  proof-gen-api.cc3-testnet.creditcoin.network      200 ~0,9 dtk
                       mainnet  proofbuilder.cc3-mainnet-usc.creditcoin.network   200 ~1,05 dtk
                       ⚠️ TIDAK RUSAK. URL-nya yang berubah. Jangan laporkan sebagai bug.

Attestor set         : 7 terdaftar (mainnet), sampel VRF 5, AuthorizedOnly
                       minBondRequirement = 0 → TIDAK ADA slashing/jaminan ekonomi
                       ⚠️ diukur pada spec ≤130 — UKUR ULANG di 131 sebelum masuk deck
```

### Klaim terlarang — satu saja ketahuan, seluruh deck mati

| Jangan bilang | Katakan ini |
|---|---|
| "omnichain" / "any chain" | "Ethereum mainnet + Sepolia, hari ini" |
| "verifikasi 15 detik" | "**~9 menit** end-to-end, tanpa campur tangan manusia" |
| "fully decentralized" | "trust terdistribusi ke kuorum attestor independen, bukan satu operator" |
| "economically secured" / "slashing" | "keamanan bersandar pada otorisasi + agregasi BLS" |
| "5 attestor, quorum 3" | Angka lama yang **salah** — pakai §1.5b, sebut lingkungannya |
| "proof of reserves lengkap" | "bukti cadangan **on-chain**; melengkapi PoR kustodian" |
| **"kami mengaudit Circle / BUIDL / Ondo / PAXG"** | **HARAM.** Backing mereka off-chain. Target sah (terverifikasi 9 Agt): **Sky LitePSM Pocket, Liquity, Resolv** — dan **Reserve eUSD** bersyarat. ⛔ **Ethena dicabut.** ⛔ Aave anti-contoh. Daftar & tes kelayakan: `01` §3.5 |
| "real-time" | "hampir real-time, ~9 menit" |
| "tanpa trust" | "tanpa oracle terpusat dan tanpa izin issuer" |

Daftar lengkap: `docs/01-riset-mendalam.md` §7. **Saring semua materi yang dilihat juri
lewat daftar ini sebelum dikirim.**

---

## 5. Jebakan teknis yang memakan berjam-jam

1. **Fungsi batch on-chain adalah overload `verifyAndEmit`**, bukan `verifyAndEmitBatch`.
   Memanggil nama itu **sebagai fungsi kontrak** menghasilkan `execution reverted:
   "Unknown selector"`.
   ⚠️ **Diperjelas 9 Agt:** *method SDK* bernama `blockProver.verifyAndEmitBatch(...)`
   **ADA dan benar** — dia me-resolve overload-nya untukmu. Pakai method SDK-nya.
2. **Precompile `0x0FD2` TIDAK mengecek apakah tx sumber sukses.** Tx yang revert sama
   "ter-include"-nya. **Wajib** `require(receiptStatus == 1)`.
3. **Replay protection tanggung jawab kita.** `queryId = keccak(chainKey, blockHeight, txIndex)`.
4. **Wajib validasi alamat emitter log.** Tanpa itu siapa pun bisa deploy ERC-20 sampah
   yang emit `Transfer`, kirim satu miliar ke treasury, dan mencetak token tanpa nilai.
5. **`eth_getCode` pada `0x0FD2`/`0x0fd3` mengembalikan `0x`** di testnet maupun mainnet.
   Itu **normal** untuk precompile native. Cek yang benar: panggil fungsinya.
6. **Precompile tidak ada di EVM lokal Foundry.** Pakai mock `vm.etch` + bytecode
   `EvmV1Decoder` asli untuk test harian; fork test untuk pra-rilis. Spek Lampiran E.
7. **`estimateGas` pada precompile bisa gagal misterius** — `pallet-evm` tidak meneruskan
   revert reason saat estimasi. Pakai `sdk.utils.gas.computeGasLimit()`.
8. **`getBatchProof()` "mengembalikan `merkleProofs` kosong" — ⚠️ KEMUNGKINAN BESAR SALAH.**
   Tipenya `Map<number, Map<...>>` dan SDK mengisinya dari `Object.entries(...)`.
   **`JSON.stringify(new Map(...))` menghasilkan `{}`** — itu kemungkinan besar yang
   dulu terlihat. **Uji ulang dengan `[...map.entries()]` sebelum membangun jalur manual.**
9. **`ContinuityProofBuilder` tidak di-reexport dari root SDK — tapi kamu tidak
   membutuhkannya.** `mergeProofs` **diekspor publik**:
   `sdk.proofProvider.mergeProofs([[height, proof], …])`.
   Jalur batching yang benar: `getProof()` per tx → `mergeProofs()` → `verifyAndEmitBatch`.
10. **`ProofBuilder.getProof()` mengembalikan `{ success, data, error }`** — proof ada
    di `.data`, bukan di root.
11. **`via_ir = true` wajib** di `foundry.toml` — `ingest` bawa 7 parameter + struct hasil
    decode, codegen lama kehabisan slot stack.
12. **`EvmV1Decoder` adalah library EKSTERNAL** (fungsi `public`), wajib di-link.
    CC3 testnet: `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f`.
    ⚠️ **Creditcoin mainnet: `0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C` — SUDAH ADA.**
    Catatan lama "belum ada, deploy sendiri" **salah** (dikoreksi 9 Agt 2026).
13. **RPC publik menolak `eth_getLogs` rentang besar.** Pindai maks **20 blok** per
    permintaan di mainnet. RPC yang bekerja: `ethereum-rpc.publicnode.com`.
14. **Biaya naik >10× per hari umur tx.** Ingest segera. Jangan backfill riwayat dalam.
15. **Substrate RPC ada di endpoint yang sama** dengan EVM RPC — pakai `@polkadot/api`
    untuk membaca pallet `attestation` dan `supportedChains`.
16. **RPC Creditcoin: `eth_getLogs` maks 10.000 blok / timeout 10 detik.** Filter alamat
    **tidak menolong** — query 100.000 blok yang mengembalikan nol log tetap timeout.
    Block time 15 detik, jadi 10.000 blok ≈ 42 jam riwayat. Paginasi wajib.
17. **`uint256` tidak muat di JavaScript `number`.** Pakai `BigInt`/string di seluruh
    frontend dan worker sejak awal.
18. **Worker WAJIB di-deploy di VPS** (dikunci — GitHub Actions ditolak, alasannya di
    spek §8.5), bukan jalan di laptop. Juri membuka dashboard
    berhari-hari setelah video direkam; submission 6 Sept, pengumuman 18 Sept → harus
    hidup ~2 minggu tanpa disentuh. Spek: `03-spesifikasi-produk.md` §8.5, gap: G13.
19. **JANGAN pakai `onlyIssuer` sebagai modifier di `mint()`.** Modifier berjalan sebelum
    badan fungsi, jadi penyerang dari wallet lain akan dapat `NotIssuer` — bukan
    `WouldBreachCollateralFloor`. Itu error yang **salah**, dan membuat klaim inti produk
    hanya bisa dibuktikan oleh pemegang kunci issuer. Urutan sudah dikunci 7 Agt 2026:
    **lantai kolateral → kesegaran → batas jendela → otorisasi.** Kode + alasan:
    `03-spesifikasi-produk.md` §7.4, keputusan: `07-red-team.md` A3.
20. **Kontrak tidak boleh bisa di-upgrade.** Tanpa proxy, tanpa setter, tanpa
    `selfdestruct`. Tombol upgrade adalah kunci mint yang menyamar — Zoth dan UPCX jatuh
    persis begitu. Konsekuensinya diterima: **bug = redeploy, bukan patch.**
    Alasan lengkap: `07-red-team.md` RT9.
21. **Worker dibuat hampir-stateless** — posisi dibangun ulang dari `lastIngestedHeight`
    dan `processedQueries` di kontrak. DB lokal cuma optimasi, bukan syarat kebenaran.
    Jangan bikin worker yang tidak bisa dipindah mesin.

*Baru 9 Agustus 2026:*

22. **RPC publik butuh POOL + RETRY + header `User-Agent`.** Terukur hari ini:
    `ethereum-rpc.publicnode.com` membalas **403** saat dipanggil beruntun,
    `sepolia.drpc.org` membalas **400** (dicoret dari daftar), dan sebagian RPC menolak
    klien tanpa UA. Satu URL tunggal **akan** mati di tengah worker berjalan berminggu-minggu.
23. **`BlockNotReady` bukan error — itu jadwal.** Proof API membalas `422` dengan
    `{retriable: true, last_attested_block: N}`. Worker harus **menunggu tinggi ter-attest
    dari ChainInfo `0x0fd3` SEBELUM memanggil proof API**, bukan memanggil lalu menangani
    errornya. Dan pakai `last_attested_block` untuk menghitung jeda, jangan backoff buta.
24. **JANGAN hapus `mint()` biasa saat menambahkan `mintWithProof()`.** Panel serangan
    A3 bergantung pada `mint()` yang bisa dipanggil siapa pun tanpa proof. Kalau `mint()`
    hilang, klaim *"siapa pun bisa mengujinya sendiri"* ikut mati — dan itu klaim terkuat
    yang kita punya setelah RT12.
25. **Kunci issuer diterbitkan publik (RT12) — pastikan itu akun KETIGA.** Bukan deployer
    `0x825003Ed…`, bukan operator worker `0x7C1195c7…`. Checklist lengkap sebelum
    menerbitkan: `06-akun-dan-dana.md` §3. Ini kesalahan copy-paste yang paling mahal
    yang mungkin terjadi di proyek ini.
26. **Slot storage `balanceOf` yang salah tidak menghasilkan error** (Babak 5, G16).
    Dia mengembalikan angka yang salah dan meyakinkan. Ukur dengan `eth_getProof` di 3
    alamat & 2 blok, cocokkan dengan `balanceOf`, kunci `immutable`, buat fixture.

27. 🔴 **`cast send` GAGAL di Creditcoin — dan transaksinya tetap terkirim.**
    Terukur 9 Agt di testnet **dan** mainnet: `eth_getBlockByNumber` Creditcoin
    **tidak punya field `mixHash`** — satu-satunya field yang hilang. Alloy (mesin
    Foundry) mewajibkannya, jadi **loop tunggu-receipt** di `cast send` meledak dengan
    `deserialization error: missing field 'mixHash'` dan mengulang selamanya.

    ⚠️ **Bahaya utamanya bukan errornya — tapi transaksinya SUDAH terkirim.** Kalau
    kamu ulangi karena mengira gagal, kamu mengirim dua kali. Kami mengalaminya:
    error bertubi-tubi, tapi 100 tCTC sudah pindah dan nonce sudah naik.

    ```bash
    ❌ cast send <to> --value 1ether --private-key $K --rpc-url $RPC
    ✅ cast send <to> --value 1ether --private-key $K --rpc-url $RPC --legacy --async
       cast receipt <txhash> --rpc-url $RPC     # konfirmasi terpisah — INI BEKERJA
    ```

    **Yang BEKERJA normal:** `cast call` · `cast receipt` · `cast tx` ·
    `cast block-number` · `cast chain-id`. Yang patah hanya jalur tunggu-receptnya.

    ⚠️ **`forge script --broadcast` memakai loop yang sama → kemungkinan besar ikut
    patah.** Itu seluruh rencana deploy Fase 2. **Uji di Fase 0** dengan kontrak sepele
    sebelum menulis `Deploy.s.sol` (G22). Selalu **verifikasi lewat RPC mentah**, jangan
    percaya pada berhasil/gagalnya perintah Foundry.

---

## 6. Wallet — aturan keras

**Tiga akun, digenerate fresh 9 Agustus 2026** (akun lama hilang kuncinya):

```
DEPLOYER : 0x825003EdbE16AedfC63f99836553a15B1299f35e   ⏳ menunggu faucet
OPERATOR : 0x7C1195c7e31ED2Dd4cE207D926d2fA3bA2e15Ff3   diisi dari deployer ~100 tCTC
ISSUER   : 0x2d27Da63Bbe23633c82ff553CfF009D974294e08   ≤20 tCTC · KUNCI DIPUBLIKASIKAN (RT12)

⚰️ 0x4e83Fa344E529f4c03948691BDD5A9A83384ED05 — akun LAMA, kunci hilang, JANGAN DIPAKAI
```

- **JANGAN generate wallet baru lagi.** Tiga sudah cukup untuk seluruh proyek.
- **Faucet hanya untuk deployer** (Discord `/faucet`), lalu deployer mengisi dua lainnya.
  Faucet ini sempat jadi blocker tunggal yang menghentikan proyek sehari penuh.
- **Aturan keras: setiap kunci masuk password manager pada JAM YANG SAMA saat dibuat.**
  Satu salinan di disk bukan cadangan — akun lama hilang persis karena aturan ini
  ditunda. Jangan diulang.
- ⚠️ **Cocokkan alamat issuer sebelum menerbitkan kuncinya.** Salah salin = menyerahkan
  kendali deployment ke internet.
- **Testnet-only burner.** Jangan pernah kirim CTC mainnet atau aset bernilai apa pun.
- **Jangan pernah menaruh private key di file yang ter-commit** — termasuk dokumen,
  `foundry.toml`, script deploy, atau README.
- Pastikan `.env*` ada di `.gitignore` sebelum commit pertama.

---

## 7. Konvensi

- **Dokumen internal (`docs/`, `PROGRESS.md`, `CLAUDE.md`): bahasa Indonesia.**
  Ini ruang kerja user.
- **Kode, komentar kode, dan semua materi yang dilihat juri: bahasa Inggris.**
  README repo, ringkasan integrasi Attestcoin, deck, dan video ditujukan ke juri
  Creditcoin/internasional. ⚠️ `README.md` saat ini masih Indonesia — **ganti ke Inggris
  sebelum submission.**
- **Komentar kode menjelaskan *kenapa*, bukan *apa*.** Kontrak ini penuh keputusan yang
  terlihat aneh tanpa alasannya (akuntansi order-independent, clamp di nol, urutan cek
  di `ingest`). Tulis alasannya di kode.
- Struktur repo: `packages/{contracts,worker,web}` + `tools/recon`.
  Detail di `docs/03-spesifikasi-produk.md` §11.
- Simpan tiap deployment ke `deployments/<network>.json` — jangan menempel alamat kontrak
  di banyak tempat.

---

## 8. Cara kerja yang diharapkan

1. **Ukur, jangan asumsikan.** Proyek ini menang karena angkanya nyata. Kalau butuh fakta
   teknis yang belum ada di `docs/01-riset-mendalam.md`, tulis skrip dan ukur.
2. **`tools/recon/` adalah alat regresi, bukan sekadar riset.** Kalau salah satu berhenti
   lolos, ada asumsi produk yang baru saja patah. Jalankan sebelum rilis.
3. **Test di atas data nyata.** Fixture dari transaksi Ethereum sungguhan, bukan mock.
   Ini juga bahan bicara yang kuat di deck.
4. **Setelah Fase 2, selalu ada yang bisa didemokan.** Kematangan produk yang memenangkan
   grand prize musim lalu, bukan kecanggihan.
5. **Temuan baru langsung dicatat.** Gap baru → `docs/04-gap-dan-blocker.md`.
   Angka baru → `docs/01-riset-mendalam.md`. Status berubah → `PROGRESS.md`.
6. **Kejujuran adalah fitur.** Tiap batas cakupan yang ditemukan dinyatakan sendiri di
   deck. Itu menaikkan kredibilitas, bukan menurunkan.

---

## 9. Jangan lakukan ini

- ❌ Menulis kode di atas asumsi yang belum diukur
- ❌ Menyebut angka teknis dari ingatan — buka `docs/01-riset-mendalam.md`
- ❌ Hardcode `chainKey` (berbeda antar lingkungan)
- ❌ Generate wallet deployer baru
- ❌ Commit private key, `.env`, atau file arsip
- ❌ Menambah aset yang butuh price oracle di v1
- ❌ Menjanjikan likuidasi di Ethereum — **protokolnya satu arah, tidak ada callback**
- ❌ Membangun ide #2 (credit market) sebelum Fase 1–6 rapi. **Dua produk setengah jadi
  kalah dari satu produk utuh** — pelajaran paling jelas dari musim 1.
- ❌ Menyentuh file milik orang lain (lihat §0). Kalau perlu, itu percakapan, bukan commit.
- ❌ Mengubah katalog event/error sepihak setelah Titik Beku
- ❌ Membangun API server untuk frontend — sumber datanya chain, sudah dikunci
- ❌ Meng-cache angka solvabilitas di frontend
- ❌ **Mengirim mock apa pun ke produk final** — angka, feed, revert yang disimulasikan,
  keadaan MEMBEKU yang dipentaskan, tombol yang tidak berfungsi. Lihat bagian
  "⚠️ PRODUK FINAL: NOL MOCK" di atas. Pernah menggagalkan submission sebelumnya.
- ❌ Fallback ke mock saat RPC gagal — tampilkan errornya, jangan tutupi
- ❌ Menaruh private key operator di image Docker, repo, atau file ter-commit
- ❌ Menganggap worker selesai sebelum terbukti hidup 48 jam di VPS tanpa disentuh
- ❌ Deploy worker tanpa dead-man's switch — VPS tunggal, tidak ada yang menambal kalau mati
- ❌ Menyentuh lahan jenuh: ROSCA/arisan, credit score generik, invoice tokenization,
  demo bridge/mint polos. Lihat `docs/02-keputusan-ide.md`.

*Baru 9 Agustus 2026:*

- ❌ **Menghapus `mint()` biasa** saat menambahkan `mintWithProof()` — panel serangan A3
  bergantung padanya
- ❌ **Menerbitkan kunci issuer sebelum test RT9 & A3 hijau**, atau memakai akun deployer/
  operator untuk itu. Checklist: `docs/06-akun-dan-dana.md` §3
- ❌ **Menyebut Ethena** sebagai target observatory sampai diverifikasi ulang
- ❌ **Mengarahkan observatory ke dompet exchange yang masih beroperasi** dengan label
  alarm — itu tuduhan, bukan pengukuran. Zonda dipakai sebagai *cerita*
- ❌ **Menulis "44 blok"** — lag itu pita (32–42 / 65–73)
- ❌ **Mengklaim membuktikan saldo di Ethereum** — mustahil secara protokol (§1.7)
- ❌ **Menyebut Attestcoin writability sebagai kemampuan** — masih audit, belum rilis
- ❌ **Melaporkan "proof API mainnet rusak"** ke tim Creditcoin — tidak rusak, dan itu
  own-goal ke juri sendiri
- ❌ **Mengerjakan Babak 5 sebelum Fase 1–6 rapi**, atau membiarkan demo bergantung padanya
- ❌ Memakai satu URL RPC tanpa pool/retry/User-Agent — akan mati di tengah jalan
- ❌ **Meng-commit kode sebelum 13 Agustus 2026** — aturan lomba: *"original work created
  during the hackathon"*. Riwayat git publik adalah buktinya. Jangan squash, jangan
  rewrite history
- ❌ Menyalin kode dari arsip lama — ✅ **sudah dihapus 9 Agt**, jadi tidak ada yang bisa
  disalin. Jangan memulihkannya dari mana pun.
- ❌ Memakai implementasi MPT pihak ketiga (Babak 5) tanpa mengecek lisensi & atribusi

---

## 10. Yang masih kosong (jangan mengira sudah ada)

*Diperbarui 9 Agustus 2026 — empat butir di daftar lama sudah tertutup.*

- ✅ ~~Dokumen deck & strategi juri~~ → **`docs/09-narasi-dan-deck.md` ada sekarang.**
- ✅ ~~Dua angka parameter kontrak~~ → **G14 diukur, G15 diputuskan.** Nilainya di §4.
- ✅ ~~Alamat treasury observatory~~ → **terverifikasi on-chain**, `01` §3.5.
- ✅ ~~Proof API mainnet rusak~~ → **tidak rusak**, URL-nya berubah.

Yang **masih** kosong:

- **Spesifikasi frontend detail** — `03` §9 menyebut *apa* yang tampil (termasuk lapisan
  manusia §9.2 dan audit nol-mock §9.3), tapi belum komponen/state/data-fetching.
- **Threat model formal kontrak** — tabel test Fase 1 menutup celah yang kita tahu, tapi
  belum ada review keamanan terstruktur. Kontrak ini memegang otoritas mint **dan
  kuncinya akan diterbitkan publik**, jadi taruhannya naik.
  ⚠️ Sudah tertutup: RT9 (immutability), RT10 (jendela latensi), RT11 (batas kata
  "solvency"), RT12 (kunci publik), RT13 (lubang `redeem()`).
- **Angka attestor set di spec 131** — `01` §1.5b diukur pada spec ≤130. **Ukur ulang
  sebelum angkanya masuk deck.**
- **Belum ada satu baris pun yang pernah dikompilasi.** Dokumen ini desain, bukan bukti.
  Bukti pertama datang di Fase 1–2, dan kemungkinan besar ada satu-dua hal di spek yang
  harus direvisi di sana. Itu normal.

**Status gerbang (9 Agustus 2026):** **25** pertanyaan tertutup dengan pengukuran ·
**12** gap ditutup · **10** terbuka · **0 blocker** · dana terdistribusi
(deployer 9.880 · operator 100 · issuer 20 tCTC).

**Tujuh dari sepuluh gap tersisa BUTUH KODE** — G1, G2, G7, G11 (kontrak kita),
G4 (`RawProofBuilder`), G6 (worker), G22 (deploy pertama). Plus G12 (prinsip desain,
sudah diputuskan isinya).

**Dua sisanya butuh akun + pembayaran, bukan kode** — dan runbook-nya sudah lengkap:
**G13** (VPS → spek `03` §8.5) dan **G21** (host dashboard → `03` §9.4). G21 gap yang
baru ditemukan 9 Agt: seluruh spek membahas VPS untuk *worker*, tapi tidak pernah
membahas di mana *dashboard* hidup — padahal juri membukanya berminggu-minggu setelah
video, dengan mode kegagalan yang identik.

⛔ **Tapi kode belum boleh di-commit sebelum 13 Agustus** (aturan lomba). Jendela
9–13 Agt: salin kunci ke password manager, transfer dana ke operator & issuer, tanya
rubrik di Discord, kumpulkan data tim.
