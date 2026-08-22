# Rencana Build & Build Order

Disusun **2 Agustus 2026** · diperbarui **7 Agustus 2026** (RT9–RT11, A1–A4).
Repo dimulai dari nol.

> **Yang berubah 7 Agustus.** Empat keputusan desain masuk sebelum baris pertama:
> kontrak **immutable** (RT9), **gerbang kesegaran + batas mint per jendela** (RT10),
> **urutan cek `mint()` dibalik** (A3), dan **istilah per mode dikunci** (RT11).
> Dua tindakan bernilai tinggi ditambahkan: **A1** replay serangan nyata sebagai test,
> **A2** kontrak konsumen. Plus **A4** di dashboard. Semuanya sudah tertanam di fase
> yang relevan di bawah — alasannya di `07-red-team.md`.

**Catatan:** deadline bukan kendala. Dokumen ini disusun berdasarkan **urutan
ketergantungan**, bukan kalender. Tanggal hanya muncul di §6 sebagai batas luar.

**Tim 2 orang** — pembagian kepemilikan file, artefak serah-terima, dan aturan yang
tidak boleh dilanggar sepihak ada di **`08-kerja-paralel.md`**. Baca itu dulu.

Ringkas jalurnya:

```
TAHAP 1   BACKEND  Fase 0–3  kontrak → test → deploy → ingest pertama
          FRONTEND Fase 6a   desain + shell + seluruh UI di atas MOCK DATA

          ⬇ TITIK BEKU: ABI JSON + deployments/<network>.json

TAHAP 2   BACKEND  Fase 4    worker      ║  FRONTEND Fase 6b  sambungkan data nyata
TAHAP 3   Fase 5 observatory · Fase 7 multi-aset

          ⬇ GERBANG DE-MOCK: Fase 6c — nol mock di bundle produksi (WAJIB)

TAHAP 4   Fase 8 submission — video & screenshot direkam SETELAH gerbang ini
```

---

## 0. Prinsip yang mengatur seluruh urutan

1. **Jangan pernah menulis kode di atas asumsi yang belum diukur.** Tiap fase dibuka
   dengan verifikasi gap yang relevan (`04-gap-dan-blocker.md`).
2. **Selalu punya versi yang bisa didemokan.** Setelah Fase 2, harus selalu ada sesuatu
   yang bisa ditunjukkan ke orang lain. Ini yang memenangkan musim 1.
3. **Uji di atas data nyata sejak awal.** Test kontrak berjalan di atas fixture
   transaksi Ethereum **sungguhan** dan bytecode `EvmV1Decoder` **sungguhan** yang
   ditarik dari chain — bukan mock. Ini juga bahan bicara yang kuat di deck.
4. **Kejujuran adalah fitur.** Tiap batas cakupan yang ditemukan langsung dicatat di
   `04-gap-dan-blocker.md` dan masuk deck sebagai batas yang dinyatakan sendiri.

---

## Fase 0 — Fondasi & verifikasi awal · **BACKEND**

**Tujuan:** repo berdiri, dan dua asumsi yang mempengaruhi desain sudah dipastikan.

- [ ] Scaffold repo sesuai struktur di `03-spesifikasi-produk.md` §11
- [ ] `tools/recon/` — bangun ulang skrip pengukuran (`01-riset-mendalam.md` §9).
      Ini **alat regresi**, bukan sekadar riset: kalau salah satu berhenti lolos,
      ada asumsi produk yang baru saja patah.
- [x] ~~**Verifikasi G9** — ukuran attestor set & quorum~~ **DITUTUP 2 Agt.**
      7 attestor, sampel VRF 5, `AuthorizedOnly`, `minBondRequirement = 0`.
      Angka & kalimat aman ada di `01-riset-mendalam.md` §1.5b.
- [ ] Kunci keputusan G12 (tanpa price oracle) secara tertulis beserta alasannya

**Keputusan yang harus dikunci di sini — semuanya mahal kalau ditunda:**

- [x] ~~**`maxMintPerWindowBps`**~~ **DIPUTUSKAN 9 Agt: `500` (5%).** Alasan lengkap di
      `04-gap-dan-blocker.md` G15. Masuk `deployments/<network>.json`, bukan hardcode.
- [x] ~~**`maxStalenessBlocks`**~~ **DIUKUR 9 Agt: `63` (testnet) / `111` (mainnet)**,
      dengan `attestationWindowBlocks` `42` / `74`. Lag ternyata **pita**, bukan titik —
      `01-riset-mendalam.md` §1.5d. ⚠️ **Tetap wajib**: jalankan `attestation-lag.mjs`
      **≥2 jam** sebelum deploy final untuk memastikan pitanya belum bergeser.
- [ ] **RT11 — istilah per mode.** Vault = *solvency*; observatory = *proven collateral*.
      ⚠️ **Frontend mulai Fase 6a di hari pertama**, jadi ini harus final SEKARANG, bukan
      sebelum 6b. Tabel lengkap: `08-kerja-paralel.md` §6.
- [ ] Konfirmasi tertulis: **kontrak immutable** (RT9) — tanpa proxy, tanpa setter,
      tanpa fungsi admin selain `mint()`. Konsekuensinya diterima: **bug = redeploy.**
- [x] ✅ **Tiga akun sudah dibuat 9 Agt** (`06-akun-dan-dana.md`), fresh dari nol:
      deployer `0x825003Ed…`, operator `0x7C1195c7…`, issuer `0x2d27Da63…`.
      Akun lama `0x4e83Fa…` **mati** — kuncinya hilang, jangan dipakai.
- [x] ✅ **G20 ditutup — faucet masuk.** Deployer `0x825003Ed…` = **10.000 tCTC**.
- [x] ✅ **Dana terdistribusi 9 Agt**: deployer 9.880 · operator 100 · issuer 20 tCTC
- [ ] 🔴 **G22 — uji `forge script --broadcast` SEBELUM menulis `Deploy.s.sol`.**
      `cast send` **terbukti patah** di Creditcoin (`mixHash` hilang dari blok) — dan
      **transaksinya tetap terkirim**, jadi mengulang = kirim dua kali. Deploy kontrak
      sepele dulu, uji `forge create` vs `forge script --broadcast`, lalu jalan keluarnya
      (`--skip-simulation`, `--slow`, `--async`, `cast publish`). Detail: `CLAUDE.md` #27.

**Infrastruktur — butuh manusia (pembuatan akun & pembayaran):**

- [ ] **Sewa VPS** (G13) — Hetzner CX22 / DO Basic, Ubuntu 24.04, **sampai 30 September**.
      ✅ Runbook lengkap sudah ada di `03-spesifikasi-produk.md` §8.5: hardening, unit
      systemd, penempatan kunci, rotasi log. Setelah server ada, tinggal salin-tempel.
- [ ] **Akun host statis** (G21) — Cloudflare Pages / Vercel / Netlify / GitHub Pages.
      ✅ Keputusan, empat aturan mengikat, dan uji akhir sudah ada di §9.4.
- [ ] **Akun healthchecks.io** — period 10 mnt, grace 20 mnt, alert email + Telegram
- [ ] **Repo GitHub publik**, dibuat **≥13 Agustus**
- [ ] 🔑 **Salin ketiga private key ke password manager.** Langkah inilah yang dilewatkan
      2 Agustus, dan itulah kenapa akun lama hilang. **Satu salinan di disk bukan cadangan.**

**⚠️ Kepatuhan aturan lomba — baru 9 Agt, jangan ditunda (`00-hackathon.md`):**

- [ ] 🔴 **Commit kode pertama pada atau setelah 13 Agustus** — *"must be original work
      created during the hackathon"*. Repo publik, riwayat utuh, **jangan squash**.
      Kode kita masih nol, jadi ini gratis — tapi cuma kalau disengaja.
- [x] ✅ **Arsip kode lama sudah dihapus (9 Agt).** Tidak ada kode lama tersisa di mana
      pun — tidak ada yang bisa disalin. Kepatuhan jadi fakta, bukan janji.
- [x] ✅ **`.gitignore` sudah dibuat SEBELUM `.env`** — memuat `.env`, `.env.*`,
      `*.tar.gz`, `*.key`, `secrets/`.
- [ ] **Kumpulkan data tim kedua orang sekarang**: nama lengkap, email, bio, peran,
      negara domisili, negara kewarganegaraan. Jangan tanggal 6 September.
- [ ] **Kirim pertanyaan ke Discord `#buidl-ctc-qna`**: bagaimana "depth of Attestcoin
      utilization" dinilai? Jangan menunggu AMA 18 Agt — tanya sekarang, konfirmasi di AMA.

**Selesai bila:** `tools/recon` lolos semua, klaim model kepercayaan sudah punya kalimat
final yang bisa dipertahankan, dan seluruh keputusan di atas tertulis — bukan di kepala.

---

## Fase 1 — Kontrak inti · **BACKEND**

**Tujuan:** `ReserveLedger` benar, dan terbukti benar di atas data nyata.

Urutan wajib berurutan — tiap langkah bergantung sebelumnya:

- [ ] `interfaces/INativeQueryVerifier.sol` — **keempat** varian, termasuk overload batch
- [ ] `libraries/TransferLogParser.sol` — tiga validasi (emitter, bentuk, relevansi)
- [ ] `ReserveLedger.sol` — akuntansi order-independent, replay protection, cek receiptStatus.
      **RT9:** tanpa proxy, tanpa `selfdestruct`, semua parameter `immutable`, tanpa setter.
      **RT10:** simpan `lastIngestedHeight` dan baca tinggi attestation dari ChainInfo
      `0x0fd3` — dua angka ini dipakai gerbang kesegaran **dan** indikator kesegaran
      di dashboard.
- [ ] `tools/recon/make-fixture.mjs` — generator fixture dari tx Ethereum nyata
- [ ] Test suite di atas fixture nyata

**Test yang wajib ada** (tiap baris adalah celah keamanan kalau hilang):

| Test | Membuktikan |
|---|---|
| Transfer masuk & keluar menggerakkan cadangan | Jalur bahagia |
| Ingest sama dua kali → revert `QueryAlreadyProcessed` | Replay protection |
| Tx dengan `receiptStatus != 1` → revert | Precompile tidak mengecek sukses |
| Log dari ERC-20 tak terdaftar → diabaikan | **Celah token sampah** |
| `topics.length != 3` atau `data.length != 32` → diabaikan | Event non-standar |
| Self-transfer treasury→treasury → diabaikan | Tidak menggelembungkan penghitung |
| `value == 0` → diabaikan | Noise |
| Satu tx menyentuh treasury beberapa kali | Batch disbursement, hop router |
| Ingest **urutan terbalik** → cadangan konvergen sama | Order-independence |
| Outflow > inflow → `reserves()` clamp di 0, **tidak revert** | Tidak bisa dimacetkan |
| chainKey salah → revert | Isolasi chain sumber |
| **Tidak ada fungsi yang bisa mengubah parameter setelah deploy** | **RT9** — cari setter, `upgradeTo`, `delegatecall` ke alamat variabel. Nol temuan. |

- [ ] **Verifikasi G1** — `estimateGas` `ingestBatch` (5 tx) vs 5× `ingest`
- [ ] **Verifikasi G2** — tabrak batas batch 2→5→10→11 dan rentang >1000 blok
- [ ] **Verifikasi G11** — eksekusi `ingest` sungguhan atas tx >100 KB

**Selesai bila:** semua test hijau di atas fixture nyata, dan angka batch/batas sudah
terukur (bukan dari docs).

---

## Fase 2 — Deploy & ingest pertama yang sungguhan · **BACKEND**

**Tujuan:** momen "ini nyata" — kontrak kita bereaksi pada uang sungguhan di mainnet.

- [ ] `script/Deploy.s.sol`, link `EvmV1Decoder` ke `0x731c…` (CC3 testnet)
- [ ] Deploy `ReserveLedger` ke CC3 Testnet, konfigurasi `SOURCE_CHAIN_KEY = 3`
      (Ethereum mainnet) — **jangan hardcode**
- [ ] Pilih treasury demo: alamat kita sendiri di Sepolia **dan** satu alamat mainnet nyata
- [ ] Jalankan `ingest()` on-chain pertama atas **tx USDC Ethereum mainnet sungguhan**
- [ ] Catat gas nyata (bukan estimasi) dan simpan tautan Blockscout-nya

**Selesai bila:** ada satu transaksi Creditcoin yang bisa dibuka di explorer, yang
membuktikan kontrak kita membaca transfer USDC mainnet. **Ini artefak deck paling
berharga yang bisa didapat semurah ini.** Simpan link-nya.

---

## Fase 3 — Token & kunci minting · **BACKEND**

**Tujuan:** adegan pembunuh di demo sudah bisa diperagakan.

- [ ] `SolvencyLockedToken.sol` — mint terkunci, redeem selalu terbuka.
      **Urutan cek `mint()` sudah dikunci (A3)** — salin apa adanya dari spek §7.4:
      lantai kolateral → kesegaran → batas jendela → otorisasi.
      ⚠️ Jangan mengubahnya jadi `onlyIssuer` modifier; itu membalik urutannya.
- [ ] Test: `mint()` melebihi cadangan → revert `WouldBreachCollateralFloor`
- [ ] **Test A3 — dipanggil wallet ACAK (bukan issuer), melebihi cadangan →
      `WouldBreachCollateralFloor`, BUKAN `NotIssuer`.** Ini test yang menjaga sifat
      "siapa pun bisa membuktikan sendiri". Kalau test ini merah, panel serangan di
      dashboard kehilangan seluruh maknanya.
- [ ] Test: dipanggil wallet acak, jumlah **di dalam** batas → `NotIssuer`
- [ ] Test RT10: `lastIngestedHeight` sengaja dibuat basi → `ReserveViewStale`
- [ ] Test RT10: mint melebihi `maxMintPerWindowBps` dalam satu jendela →
      `WindowMintCapExceeded`; jendela berikutnya → lolos lagi
- [ ] Test: `redeem()` tetap jalan walau rasio di bawah lantai
- [ ] Test: tidak ada jalan mengubah `minCollateralRatioBps` sama sekali (RT9) —
      menggantikan test lama `setMinCollateralRatioBps(0) → revert`, karena setter-nya
      sekarang **tidak ada**
- [ ] **A1 — replay serangan sungguhan sebagai test**, di atas fixture tx Ethereum
      mainnet nyata dari Resolv (22 Mar 2026) dan StablR (24 Mei 2026):
      `test_Resolv_UnbackedMint_WouldHaveReverted()` dan
      `test_StablR_UnbackedMint_WouldHaveReverted()` → `WouldBreachCollateralFloor`.
      Ini artefak deck terkuat yang bisa dibuat semurah ini — juri bisa menjalankannya
      sendiri dengan `forge test`, tanpa perlu paham Attestcoin.
- [ ] Deploy, lalu **peragakan serangan StablR** di testnet: kunci owner penuh,
      cetak melebihi cadangan → revert. Simpan tx hash-nya.

**Baru 9 Agustus — dua tindakan yang mengubah klaim jadi bukti:**

- [ ] **A5 — `mintWithProof()`** (spek §7.4): ingest + mint dalam satu transaksi atomik.
      ⚠️ **`mint()` biasa TIDAK BOLEH dihapus** — panel serangan A3 bergantung padanya.
      Test: `mintWithProof` dengan proof valid → sukses · dengan proof gagal → seluruh
      transaksi revert, tidak ada token tercetak.

- [ ] **RT12 — TERBITKAN PRIVATE KEY ISSUER DI README.** Ini gerbang, bukan opsi.

      **Urutannya wajib begini, jangan dibalik:**
      1. Test RT9 hijau — nol setter, nol proxy, nol `delegatecall` ke alamat variabel,
         nol fungsi admin selain `mint()`. **Grep manual, jangan percaya test saja.**
      2. Test A3 hijau — wallet acak melebihi cadangan → `WouldBreachCollateralFloor`,
         **bukan** `NotIssuer`.
      3. Konfirmasi akun issuer adalah **akun ketiga terpisah**, terisi seadanya,
         testnet-only.
      4. **Baru** terbitkan kuncinya, **beserta alasannya** — kunci tanpa penjelasan
         terbaca sebagai kecerobohan.

      Alasan lengkap & kalimat decknya: `07-red-team.md` RT12.

**Selesai bila:** kamu bisa menunjukkan bukti on-chain bahwa pemegang kunci admin
mencoba mencetak tanpa backing dan **gagal**, `forge test` memperlihatkan dua serangan
sungguhan tahun ini ditolak, **dan kunci issuer-nya sudah publik sementara cadangannya
tetap utuh.**

---

## ⬇ TITIK BEKU — akhir Tahap 1, serah terima ke Frontend

Ini batas yang tegas. Sebelum ini frontend jalan di atas mock; sesudah ini di atas
data nyata. Yang diserahkan (detail di `08-kerja-paralel.md` §3):

- [ ] **ABI** hasil `forge build` → `packages/web/src/abi/*.json`
- [ ] **`deployments/cc3-testnet.json`** — alamat kontrak, chainId, RPC, explorer,
      `sourceChainKey`, treasury, daftar aset
- [ ] **Satu tx hash ingest sungguhan** atas transfer USDC Ethereum mainnet
- [ ] Konfirmasi terakhir: katalog event di Lampiran A **cocok dengan ABI yang nyata**.
      Kalau ada yang berubah selama Fase 1, **beri tahu frontend sekarang**, jangan nanti.
- [ ] Sebutkan eksplisit **tiga error baru** dari RT10/A3 di Lampiran B —
      `ReserveViewStale`, `WindowMintCapExceeded`, `NotIssuer`. Frontend perlu
      `ReserveViewStale` untuk peringatan kesegaran, dan perlu tahu bahwa penyerang
      dari wallet acak akan menerima `WouldBreachCollateralFloor` (bukan `NotIssuer`).

Setelah titik ini, Lampiran A & B jadi **janji API** — tidak boleh diubah sepihak.

---

## Fase 4 — Off-chain worker · **BACKEND** *(paralel dengan Fase 6b)*

**Tujuan:** sistem berjalan sendiri, tanpa manusia.

Buka fase dengan verifikasi — jangan menulis worker di atas asumsi:
- [ ] **G3** — rate limit Proof API (200 panggilan berturut-turut)
- [ ] **G7** — perilaku `estimateGas` pada precompile; pakai `computeGasLimit()`
- [x] ~~**G8**~~ ✅ **DITUTUP 9 Agt.** Biaya **tidak** naik terus — ada tebing lalu datar.
      Terapkan tiga aturannya: (a) ingest ≤100 blok di belakang tinggi ter-attest → 1 root
      bukan ~61; (b) **jangan** menandai tx lama `SKIPPED` karena biaya — biayanya berhenti
      naik; (c) **margin 10 blok** di bawah tinggi ter-attest sebelum minta proof
- [ ] **G6** — perilaku reorg; tentukan kedalaman aman

Lalu bangun, berurutan:
- [ ] `config` + `store` (persistence atomik: tmp + rename)
- [ ] `scanner` — `eth_getLogs` maks **20 blok** per permintaan, cursor persisten.
      **Pool RPC + retry + header User-Agent** — satu URL tunggal akan mati (jebakan #22)
- [ ] `attest` — polling ChainInfo sampai blok ter-attest.
      **Pakai `is_height_attested` SEBELUM memanggil proof API** — ini menghapus hampir
      semua `BlockNotReady` tanpa satu pun HTTP terbuang (spek §8.2c)
- [ ] `proof` — **DUA jalur** (spek §8.2b): `ProofBuilder` hosted sebagai utama,
      **`RawProofBuilder` sebagai fallback otomatis** setelah 3× gagal / 429 / 5xx.
      ⚠️ **G4 naik jadi 🔴** — ini satu-satunya ketergantungan server yang tersisa di
      seluruh sistem, dan menghapusnya memberi kalimat deck terkuat yang bisa didapat
      dari satu perubahan
- [ ] **G19 — perpendek continuity proof**: pilih rentang blok pakai
      `find_highest_attested_before` / `get_attestation_bounds`, bukan menerima apa
      adanya dari API. **Ukur selisih jumlah root dan gas-nya** — angkanya masuk deck
- [ ] `submit` — cek `processedQueries` on-chain sebelum kirim (dedup yang selamat
      walau DB hilang), nonce berurutan
- [ ] `pipeline` — state machine `DISCOVERED → ATTESTED → PROVEN → SUBMITTED → CONFIRMED`
- [ ] **Mode dry-run** — seluruh pipeline sampai `staticCall`, tanpa gas
- [ ] Batching (hanya kalau G1 & G2 membenarkannya)

**Uji ketahanan yang wajib:**
- [ ] Bunuh worker di tengah jalan → restart → tidak ada event yang hilang, tidak ada dobel
- [ ] Hapus database → restart → **posisi dibangun ulang dari kontrak**, tidak ada ingest ganda
- [ ] Matikan RPC → worker jatuh ke fallback, tidak mati

**Deploy ke VPS** (spek lengkap: `03-spesifikasi-produk.md` §8.5):
- [ ] Akun operator **terpisah dari deployer**, diisi secukupnya (~100 tCTC)
- [ ] Kunci lewat `EnvironmentFile` permission `600` — **jangan** di image atau repo
- [ ] systemd `Restart=always`, polling 1–2 menit
- [ ] Rotasi log aktif — jangan sampai disk penuh setelah 2 minggu
- [ ] **Dead-man's switch** — ping healthchecks.io tiap loop sukses, alert ke email/Telegram.
      **Wajib**, karena VPS tunggal = satu titik kegagalan tanpa cadangan.
- [ ] Dockerfile + README sekali jalan (aset submission: juri bisa menjalankannya sendiri)
- [ ] Indikator kesegaran tampil di dashboard (`lastIngestedHeight` vs tinggi attestation)

**Selesai bila:** worker berjalan **≥48 jam tanpa disentuh** di VPS terhadap treasury
mainnet sungguhan, angka cadangan di kontrak cocok dengan hitungan manual dari Etherscan,
dan indikator kesegaran di dashboard tetap hijau sepanjang itu.

⚠️ **Syarat sesungguhnya: hidup sampai 18 September** (pengumuman pemenang). Uji 48 jam
cuma gerbang pertama — lihat G13.

---

## Fase 5 — Observatory · **BACKEND + FRONTEND**

**Tujuan:** pembeda naratif utama jadi nyata.

- [ ] `Observatory.sol` — ledger tanpa token, tanpa owner
- [x] ~~**Verifikasi G10**~~ **DITUTUP 9 Agt.** Target final terverifikasi on-chain:
      ⭐ **Sky LitePSM Pocket** `0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341`
      (4.251.196.990 USDC mentah, **EOA**), plus Resolv dan Reserve eUSD.
      ⛔ **Ethena DICABUT** — off-exchange custody. ⛔ Bukan Circle/BUIDL/Ondo/PAXG (RT1).
      ⛔ Bukan Aave — 8% backed by design (`01` §3.6). Daftar & tes kelayakan: `01` §3.5.
- [ ] **RT6** — jalankan chainKey 1 (Sepolia) **dan** 3 (ETH mainnet) serentak dalam satu
      sistem. Ini sinyal kedalaman USC paling kasat mata yang kita punya.
- [ ] **A6 — `IProvenReserve` sebagai standar publik** (spek §7.6), diimplementasikan
      vault **dan** observatory. Ini yang mengubah RT7 dari janji jadi infrastruktur.
- [ ] **A6 — DUA konsumen nyata, bukan satu.** Satu contoh tidak membuktikan sebuah standar:
      - `examples/CollateralGatedVault.sol` — menolak kolateral saat penerbitan terkunci
      - `examples/FreshnessGuard.sol` — menolak **angka basi**, dengan membandingkan
        `lastProvenHeight()` ke ChainInfo `0x0fd3`. ~20 baris, dan mengajarkan kewajiban
        yang benar ke integrator berikutnya. **Jangan digabung jadi satu.**
- [ ] ⚠️ **RT11** — instance observatory dilabeli **proven collateral**, bukan
      *solvency*. Kewajiban issuer eksternal ada di Ethereum dan tidak kita buktikan.
- [ ] Deploy instance terhadap ≥2 issuer sungguhan yang tidak pernah minta diaudit
- [ ] Worker melayani banyak instance sekaligus

**Selesai bila:** ada **feed proven-collateral** publik yang berjalan atas issuer nyata,
ada satu kontrak lain yang benar-benar membacanya, dan kamu bisa mengatakan dengan jujur:
*"mereka tidak tahu kita melakukan ini, dan tidak bisa menghentikannya."*

---

## Fase 6a — Dashboard di atas mock · **FRONTEND** *(mulai hari pertama, paralel dengan Fase 0–3)*

Tidak menyentuh chain sama sekali. Mock data + kasus yang wajib ditangani ada di
`08-kerja-paralel.md` §5.

> ⚠️ **Mock di fase ini punya tanggal mati: Fase 6c.** Ikuti bentuk lapisan data di
> `08-kerja-paralel.md` §5.0 sejak commit pertama — komponen tidak pernah mengimpor
> `src/mocks/`, semua lewat `src/data/source.ts`. Kalau mock menyebar ke dalam komponen,
> mencabutnya nanti berarti membongkar UI di minggu paling sibuk.

- [ ] Arah desain & brand (`Corolary` · *Solvency isn't claimed. It follows.*)
- [ ] Layout, sistem komponen, tipografi
- [ ] **Format angka** — `uint256` sebagai string/BigInt sejak awal, jangan `number`
- [ ] Rasio raksasa + status `TERKUNCI` / `MEMBEKU`
- [ ] Cadangan vs suplai, headroom minting
- [ ] Feed bukti — tiap baris **dua tautan**: Etherscan (sumber) + Blockscout (ingest)
- [ ] Panel serangan — tombol "cetak melebihi cadangan" → tampilkan revert.
      **Rancang untuk wallet pengunjung sejak awal (A3)**, bukan untuk wallet kita.
      Siapa pun akan menerima `WouldBreachCollateralFloor` sungguhan.
- [ ] Panel "verify yourself" — alamat kontrak + endpoint RPC terbuka
- [ ] **A4 — blok "jalankan worker-nya sendiri"**: perintah `docker run` sekali-jalan,
      bisa disalin. `ingest()` permissionless, jadi ini klaim yang bisa diuji pengunjung
      dalam 60 detik — bukan kalimat di deck.
- [ ] Peringatan kesegaran dari `ReserveViewStale` / selisih `lastIngestedHeight`
- [ ] ⚠️ **RT11 — istilah per mode.** Vault = *solvency*; observatory = *proven
      collateral*. Berlaku untuk nama komponen, label, tooltip, seluruh copy.
      Tabel: `08-kerja-paralel.md` §6. **Murah sekarang, mahal setelah komponen jadi.**
- [ ] State kosong / loading / error / RPC mati
- [ ] Dibaca dari jarak 3 meter

**Lapisan manusia — baru 9 Agustus (spek §9.2). Ini yang menaikkan sumbu terlemah kita.**

- [ ] **A7 — Holder view**, halaman untuk manusia bukan untuk auditor. Tiga pertanyaan,
      tiga jawaban: *uangku masih ada? · bisa aku ambil? · dikasih tahu kalau ada apa-apa?*
      **Dua lapis:** kalimat manusia di atas, angka teknis satu klik di bawahnya.
- [ ] **A7 — Tombol Tebus yang benar-benar berfungsi** dari wallet pengunjung.
      Ini satu-satunya aksi pengguna nyata di produk, dan kontraknya sudah mendukungnya.
      Copy-nya: *"Pintu keluar ini tidak bisa dikunci siapa pun. Termasuk penerbitnya.
      Termasuk kami."*
- [ ] **A8 — Papan skor pembobolan.** `Percobaan: N · Berhasil: 0`, dihitung dari revert
      `WouldBreachCollateralFloor` yang nyata di log Creditcoin. Tumbuh sendiri sampai
      hari penjurian.
- [ ] ⛔ **DILARANG:** aplikasi fintech palsu dengan akun/saldo karangan · menyembunyikan
      lapisan teknis · onboarding wallet yang ribet (spek §9.2 no. 12).

**Selesai bila:** seluruh dashboard bisa dijalankan di atas mock, termasuk keadaan
membeku — **untuk konsumsi internal saja.** Jangan direkam, jangan di-screenshot untuk
deck, jangan ditunjukkan ke orang luar. Materi juri lahir setelah Fase 6c.

---

## Fase 6b — Sambungkan data nyata · **FRONTEND** *(setelah titik beku, paralel dengan Fase 4)*

- [ ] Baca `deployments/<network>.json` — **jangan hardcode alamat**
- [ ] Angka solvabilitas via **`eth_call`**, selalu segar, **dilarang di-cache**
- [ ] Feed via `eth_getLogs`, **maks 10.000 blok** per permintaan (~3 dtk, ≈42 jam)
- [ ] Cache inkremental `localStorage` untuk riwayat lebih dalam
- [ ] Fallback RPC + penanganan timeout (batas 10 detik itu nyata)
- [ ] Panel serangan memanggil `mint()` sungguhan → tangkap & tampilkan
      `WouldBreachCollateralFloor`. **Uji dari wallet yang BUKAN issuer (A3)** — kalau
      yang keluar `NotIssuer`, urutan cek di kontrak salah, lapor ke backend
- [ ] `ReserveViewStale` ditampilkan sebagai peringatan kesegaran, bukan error mentah
- [ ] **A7 — tombol Tebus memanggil `redeem()` sungguhan** dan menampilkan tx hash-nya
      dengan tautan Blockscout. Uji dari wallet yang bukan issuer dan bukan deployer.
- [ ] **A8 — papan skor pembobolan** membaca revert nyata dari log Creditcoin
      (bukan penghitung lokal, bukan angka yang disimpan di frontend)

**Selesai bila:** angka di dashboard cocok dengan hasil `cast call` ke kontrak,
feed-nya menampilkan ingest sungguhan dengan dua tautan yang benar-benar bisa dibuka,
panel serangan menghasilkan revert sungguhan dari wallet siapa pun, **dan seorang
pengunjung asing bisa menebus token dari wallet-nya sendiri tanpa bantuan kita.**

---

## Fase 6c — Gerbang de-mock · **FRONTEND** *(wajib, sebelum video/deploy/submission)*

Fase terpendek di dokumen ini dan satu-satunya yang **tidak boleh dilewati**. Submission
sebelumnya (proyek lain) gagal lolos final karena mock ikut terkirim. Aturan penuh:
`CLAUDE.md` bagian "⚠️ PRODUK FINAL: NOL MOCK".

- [ ] `bash tools/verify-no-mock.sh` lolos tanpa temuan
- [ ] `packages/web/src/mocks/**` **dihapus** dari repo (atau dipindah ke fixture test
      yang tidak pernah masuk bundle) — bukan sekadar tidak dipakai
- [ ] `NEXT_PUBLIC_DATA_SOURCE` tidak lagi punya nilai `mock` yang valid; build produksi throw
- [ ] Nol impor dari `src/mocks/` di luar `src/data/source.ts`
- [ ] Nol literal angka solvabilitas / baris feed di dalam komponen
- [ ] **Matikan RPC dan buka dashboard** — yang muncul harus error jujur, bukan angka
- [ ] Tiap tombol, tab, dan panel yang terlihat benar-benar berfungsi. Yang belum nyata
      **dihapus**, bukan dilabeli "coming soon"
- [ ] Klik acak 5 tautan feed (Etherscan + Blockscout) — semuanya membuka tx nyata
- [ ] **Panel serangan diuji dari wallet pihak ketiga** (bukan issuer, bukan deployer) —
      revert-nya sungguhan dan errornya `WouldBreachCollateralFloor`. Berkat A3 panel ini
      tidak bisa jadi mock walaupun mau; pastikan tidak ada sisa animasi hardcoded
- [ ] **A4** — perintah `docker run` di dashboard benar-benar jalan kalau disalin
- [ ] Copy observatory tidak memakai kata *solvency* / *solvent* / rasio apa pun (RT11)
- [ ] Tiap keadaan di `08-kerja-paralel.md` §5.9 pernah terlihat dari chain sungguhan,
      termasuk **MEMBEKU** yang dipicu lewat penarikan Sepolia
- [ ] Bundle produksi di-grep: nol string `mock`, nol `feed.json`, nol `state.json`

**Selesai bila:** dashboard di-deploy ulang dari bundle bersih, lalu diperiksa dengan
DevTools terbuka — setiap angka di layar bisa ditelusuri ke satu `eth_call` atau
`eth_getLogs` di tab Network. Kalau ada satu angka yang tidak punya asal-usul di sana,
fase ini belum selesai.

**Video demo direkam SETELAH fase ini, bukan sebelumnya.**

---

## Fase 7 — Multi-aset · **BACKEND** *(opsional, hanya bila Fase 1–6 rapi)*

- [ ] `AssetConfig` + `haircutBps`, keranjang stablecoin USD (USDC/USDT/PYUSD/USDS)
- [ ] Test: aset dengan `decimals` berbeda dinormalisasi benar
- [ ] **Jangan** menambahkan aset yang butuh harga

---

## Fase 9 — Babak 5: membuktikan SALDO lewat state root Base · **BACKEND** *(opsional)*

**Spek lengkap: `03-spesifikasi-produk.md` §14.** Baca itu dulu, jangan mulai dari sini.

⚠️ **PAGAR — jangan dilanggar walau waktunya terasa cukup:**
1. **Tidak boleh dimulai sebelum Fase 1–6 rapi dan worker terbukti hidup 48 jam.**
2. **Demo tidak boleh bergantung padanya.** Kalau jadi, dia 45 detik terakhir video.
   Kalau tidak jadi, tidak ada bagian lain yang goyah.
3. **Kalau ragu, kerjakan versi 80/20 saja** (`BaseStateRootRegistry`, §14.6) — 1/5
   pekerjaan, dan sudah cukup untuk klaim decknya.

Urutan wajib, dan **G16 duluan** karena dia yang paling berbahaya:

- [ ] **G16 — ukur slot storage `balanceOf` USDC di Base.** `eth_getProof` di 3 alamat
      dan 2 blok berbeda, cocokkan dengan `balanceOf`. **Slot salah tidak error — dia
      mengembalikan angka salah yang meyakinkan.** Kunci sebagai `immutable`, buat fixture.
- [ ] **G17 — pindai event `DisputeGameFactory` di Ethereum mainnet 24 jam.** Catat nama
      & signature event, letak `rootClaim` (calldata atau topic), event/kondisi resolusi,
      dan jeda nyata usulan → resolusi. **Hard-code hasil ukur, bukan angka docs.**
- [ ] `BaseStateRootRegistry.sol` — versi 80/20. Berhenti di sini kalau waktu menipis.
- [ ] `MerklePatriciaProof.sol` + `ingestAnchor()` — versi penuh
- [ ] **Aturan arah aman asimetris (§14.4)** — turun diterima seketika, naik hanya setelah
      dispute game selesai. **Ini bagian yang paling penting benar**; test-nya wajib ada:
      anchor yang menaikkan cadangan dari root belum-final → `AnchorNotFinalized`
- [ ] Test: `ingest()` dengan `height <= anchorHeight` → `StaleAnchor`
- [ ] **G18** — `estimateGas` nyata pada `ingestAnchor` dengan proof MPT sungguhan
- [ ] ⚠️ Copy UI tetap **proven collateral**, bukan *solvency* (RT11 tidak batal)

**Selesai bila:** ada satu transaksi Creditcoin yang bisa dibuka di Blockscout, yang
membuktikan saldo sebuah alamat **di Base** — lewat state root yang di-post ke Ethereum.

---

## Fase 8 — Submission · **BERDUA**

⚠️ **Baca `09-narasi-dan-deck.md` lebih dulu.** Seluruh isi fase ini — urutan cerita,
protagonis, argumen pasar, jawaban hafalan, dan checklist kirim — sudah ditulis di sana.

- [ ] README repo **dalam bahasa Inggris** — syarat wajib lomba.

      ⚠️ **README bukan dokumen yang ditulis sekali di akhir — dia MENUMPUK sepanjang
      fase, dan Fase 8 hanya menerjemahkan + merapikan.** Kalau ditulis ulang dari nol,
      hal-hal yang ditambahkan di fase sebelumnya akan hilang diam-diam.

      Isi yang wajib ada saat submission, beserta fase asalnya:

      | Isi | Ditambahkan di |
      |---|---|
      | Pitch + tagline manusia (*"pintu keluarnya tidak punya kunci"*) | Fase 8 |
      | **Kunci issuer + ALASANNYA** (RT12) | **Fase 3** ← paling mudah hilang |
      | Setup & cara menjalankan | Fase 1–4 |
      | Penjelasan pemakaian Attestcoin (`09` §7) | Fase 8 |
      | Perintah `docker run` worker (A4) | Fase 4 |
      | URL dashboard (G21) + alamat kontrak | Fase 6c |
      | Kalimat kepatuhan *"seluruh kode ditulis selama periode lomba"* | Fase 8 |
      | `ATTRIBUTION.md` (atau bagiannya) | Fase 8 |

      ✅ **Cek terakhir sebelum kirim:** alamat issuer di README **cocok** dengan issuer
      di kontrak yang benar-benar ter-deploy. Kunci yang salah alamat = klaim kosong.
- [ ] Ringkasan integrasi Attestcoin — pakai tabel permukaan protokol di `09` §7
- [ ] **Baca `07-red-team.md`** — adopsi protagonis penabung (RT2), hafalkan jawaban
      satu kalimat untuk RT4/RT5/RT8/RT9/RT10/RT11/RT12/RT13 (`09` §6)
- [ ] Deck / whitepaper PDF
- [ ] Video demo — ikuti alur di `03-spesifikasi-produk.md` §10
- [ ] **`ATTRIBUTION.md`** — OpenZeppelin (MIT), `@gluwa/usc-sdk`, interface precompile.
      ⚠️ Kalau Babak 5 dikerjakan dan memakai implementasi MPT yang sudah ada:
      **cek lisensinya dan atribusikan**, atau tulis sendiri
- [ ] **Logo proyek** (URL PNG/SVG) — opsional di form, tapi submission tanpa logo
      terlihat belum selesai
- [ ] **Nyatakan eksplisit di deskripsi**: kontrak di **CC3 testnet** (memenuhi syarat
      "deployed on a testnet"), **sumber datanya Ethereum mainnet**. Jangan biarkan ada
      yang salah baca
- [ ] **Kalimat kepatuhan di README**: riset & desain selesai sebelum submission dibuka,
      **seluruh kode ditulis selama periode lomba — riwayat git publik dan bisa diperiksa**
- [ ] Isi data tim kedua orang (sudah dikumpulkan di Fase 0)
- [ ] Audit klaim: seluruh materi disaring lewat daftar klaim terlarang
      (`01-riset-mendalam.md` §7). **Satu klaim palsu membunuh seluruh deck.**
- [ ] **Audit mock: Fase 6c lolos**, dan tiap screenshot di deck berasal dari bundle
      produksi — bukan dari dev server. Cek tanggal file screenshot.
- [ ] **A9 — slide "yang TIDAK kami cegah"** (Balance Coin 22 Jul 2026 + apxUSD).
      Tabel finalnya di `07-red-team.md` RT8.
- [ ] **RT13** — jawaban satu kalimat untuk *"saya redeem, lalu uang saya keluar dari
      mana?"*. Hafalkan. Ini pertanyaan yang paling mungkin muncul dari juri produk.
- [ ] **Verifikasi ulang semua temuan negatif** (*"infrastruktur mereka bermasalah"*)
      tepat sebelum mengirim. Pelajaran G5: kesimpulan negatif tidak pernah dicek ulang
      oleh siapa pun, jadi dia bertahan paling lama dan paling memalukan.

~~- [ ] Laporkan bug TLS proof API mainnet (G5) ke tim Creditcoin~~
⛔ **DIBATALKAN 9 Agustus 2026.** Bug-nya tidak ada — URL-nya yang berubah, dan API
mainnet-nya hidup (HTTP 200, 1,05 dtk, TLS valid). Melaporkan bug yang tidak ada kepada
tim yang menjurikan kita adalah own-goal. Lihat `04-gap-dan-blocker.md` G5.

---

## 6. Batas luar yang tidak bisa ditawar

| Item | Tanggal |
|---|---|
| Submission dibuka | 13 Agustus 2026 |
| **Online AMA** | **18 Agustus 2026**, 20:00 KST / 07:00 ET — ⚠️ dikoreksi 9 Agt, bukan 13 Agt. Daftar: `luma.com/buidlctc-fall26-ama` |
| **Deadline submission** | **6 September 2026, 23:59 ET** |
| Pengumuman pemenang | 18 September 2026 |
| CTC Ignition (Seoul) | 28 September 2026 |

⚠️ **Hadiri AMA-nya.** Rubrik penilaian resmi edisi Fall belum pernah berhasil kita
verifikasi (DoraHacks menolak fetch otomatis), dan AMA adalah satu-satunya kesempatan
menanyakannya langsung. Siapkan satu pertanyaan: *bagaimana "depth of Attestcoin
utilization" dinilai — jumlah permukaan protokol yang dipakai, atau ketergantungan
produk padanya?*

**Satu-satunya fase yang benar-benar tidak boleh dikompres: Fase 8.** Semua fase lain
bisa dipersingkat cakupannya; deck dan video yang buru-buru terlihat jelas, dan musim
lalu kematangan produk yang memenangkan grand prize.

Saran: perlakukan **30 Agustus** sebagai deadline internal, sisakan seminggu penuh
untuk Fase 8.

---

## 7. Titik henti — kapan berhenti menambah fitur

Produk ini **sudah utuh dan bisa menang** di akhir Fase 6.

**Urutan prioritas kalau waktu menipis** — potong dari bawah, jangan dari tengah:

```
WAJIB    Fase 0–3   kontrak · mintWithProof · RT12 kunci publik
WAJIB    Fase 4     worker di VPS, terbukti hidup 48 jam        ← G13, risiko tertinggi
WAJIB    Fase 6a–6c dashboard + holder view + gerbang nol-mock
WAJIB    Fase 8     deck & video                                 ← TIDAK BOLEH dikompres
─────────── di atas garis ini sudah cukup untuk menang ───────────
KUAT     Fase 5     observatory + IProvenReserve + 2 konsumen
BAGUS    Fase 7     multi-aset
PLAFON   Fase 9     Babak 5 — versi 80/20 dulu, penuh belakangan
JANGAN   ide #2     credit market — lubangnya arsitektur, bukan waktu
```

Fase 7, Fase 9, dan babak kredit hanya boleh disentuh kalau Fase 1–6 sudah benar-benar
rapi, worker sudah terbukti tahan, dan deck sudah jadi.

Dua produk setengah jadi kalah dari satu produk utuh. Ini pelajaran paling jelas dari
musim 1 — dan alasan Fase 9 punya pagar eksplisit.
