# Pembagian Kerja — 2 Orang

> **Dev A** — Backend + On-chain
> **Dev B** — Frontend
>
> Prinsip: batas file mutlak, seam kontrak-dulu, Dev B tidak pernah menunggu Dev A.

---

## 1. Kepemilikan File (mutlak)

| Path | Pemilik | Boleh disentuh yang lain? |
|---|---|---|
| `packages/contracts/**` | **A** | ❌ |
| `packages/shared/**` | **A** | ❌ B hanya **membaca** (import) |
| `services/indexer/**` | **A** | ❌ |
| `services/api/**` | **A** | ❌ |
| `apps/web/**` | **B** | ❌ |
| Root config (`package.json`, `turbo.json`, `docker-compose.yml`, `.env.example`) | **A** | ❌ |
| `docs/architecture.md`, `docs/hackathon.md`, `docs/attestcoin-research.md`, `docs/ideas.md`, `docs/business.md`, `CLAUDE.md` | bersama | ✅ lewat kesepakatan |
| `docs/contracts.md`, `docs/indexer.md`, `docs/api.md`, `docs/scoring.md`, `docs/setup.md` | **A** | ❌ |
| `docs/frontend.md` | **B** | ❌ |

**Kenapa seketat ini:** dua orang yang mengedit file sama akan saling menimpa. Batas
berdasarkan direktori menghilangkan seluruh kelas masalah itu tanpa perlu koordinasi
harian.

---

## 2. Seam: bagaimana B tidak pernah terblokir

Satu-satunya titik temu adalah **kontrak API** + **`packages/shared/src/types.ts`**.

Urutannya:

1. **A menulis kontrak dulu** (sebelum implementasi): `docs/api.md` lengkap dengan
   contoh request/response, dan `packages/shared/src/types.ts` terisi penuh.
   Ini **tugas pertama A**, sebelum menyentuh Solidity.
2. **B langsung mulai** dengan tipe itu. Selama endpoint belum hidup, B memakai
   `dev-fixtures.ts` di balik `NEXT_PUBLIC_USE_FIXTURES=true`.
3. **A menghidupkan endpoint satu per satu**, mengumumkan tiap kali satu siap.
   B mematikan fixture untuk endpoint tersebut.
4. **Sebelum submit** `NEXT_PUBLIC_USE_FIXTURES=false` dan `pnpm check:no-mocks`
   memastikan tak ada fixture yang ikut ter-bundle.

> Fixture adalah perancah pembangunan, **bukan** fitur produk. Ia mati secara default
> dan gagal di gerbang pra-submit kalau sampai lolos ke build produksi.

---

## 3. Dev A — Backend + On-chain

### A0 · Fondasi (blokir semua hal lain — kerjakan pertama)
- [ ] Monorepo pnpm + Turborepo, workspace `packages/*`, `services/*`, `apps/*`
- [ ] `docker-compose.yml` untuk Postgres
- [ ] `.env.example` lengkap (lihat `architecture.md` §15)
- [ ] **`packages/shared/src/types.ts`** — salin dari `docs/shared-types.md` §1 ← membuka pekerjaan B
- [ ] `packages/shared/src/constants.ts` — dari `docs/shared-types.md` §3
- [ ] **`docs/api.md` lengkap** ← membuka pekerjaan B
- [ ] `packages/shared/src/chains.ts` — dari `docs/shared-types.md` §4
- [ ] Skrip `check:no-mocks`

**Definition of done:** B bisa `import type { Fact, CreditScore } from '@corolary/shared'`
dan mulai membangun tanpa bertanya apa pun.

### A1 · Fondasi kontrak
- [ ] Setup Foundry, remapping OpenZeppelin + `@gluwa/usc-contracts`
- [ ] `interfaces/INativeQueryVerifier.sol`, `interfaces/IChainInfo.sol`
- [ ] `AttestcoinReader.sol` — abstract: verifikasi proof, replay protection,
      **cek `receiptStatus == 1`**, cek alamat emitter
- [ ] Uji: proof valid lolos; tx revert ditolak; replay ditolak; emitter palsu ditolak

### A2 · FactRegistry + adapter
- [ ] `interfaces/IProtocolAdapter.sol`
- [ ] `FactRegistry.sol` — `recordFact`, `recordFactBatch`, registri protokol,
      akses `RECORDER_ROLE`, event `FactRecorded`
- [ ] `adapters/AaveV3Adapter.sol` — decode Borrow/Repay/LiquidationCall/Supply/Withdraw
      (perhatikan: subjek `Borrow` = `onBehalfOf`, subjek `Repay` = `user`)
- [ ] `adapters/MorphoBlueAdapter.sol`, `adapters/CompoundV3Adapter.sol`
- [ ] Uji dengan transaksi Ethereum mainnet **nyata** (fork anvil + tx hash asli)

### A3 · PriceRegistry
- [ ] `adapters/ChainlinkAdapter.sol` — decode `AnswerUpdated`
- [ ] `PriceRegistry.sol` — himpunan aggregator tepercaya (bukan hardcode tunggal),
      resolve `aggregator()` dari proxy, penjagaan kesegaran harga
- [ ] Uji: harga basi ditolak; aggregator tak dikenal ditolak

### A4 · CreditGraph
- [ ] `CreditGraph.sol` — pembaruan skor inkremental saat `FactRecorded`
- [ ] Enam komponen skor sesuai `docs/scoring.md`
- [ ] Pemetaan tier → `collateralRatioBps`
- [ ] Uji: monotonisitas, batas atas/bawah, penalti likuidasi

### A5 · EfficiencyMarket
- [ ] `EfficiencyMarket.sol` — supply/withdraw/depositCollateral/borrow/repay/liquidate
- [ ] Rasio kolateral dibaca dari `CreditGraph`
- [ ] Health factor, jalur likuidasi, model bunga
- [ ] Uji: tak bisa pinjam melebihi tier; likuidasi jalan; reentrancy aman

### A6 · Indexer (eager prover)
- [ ] `watcher` — polling log Ethereum per protokol, simpan `observed_events`, cursor tahan restart
- [ ] `attestation-waiter` — pantau tinggi ter-attest via ChainInfo/prover API
- [ ] `prover` — `@gluwa/usc-sdk` ProofBuilder, **batching 10 tx / 1000 blok**
- [ ] `submitter` — panggil `recordFact`/`recordFactBatch`, nonce management, retry
      backoff eksponensial, deduplikasi
- [ ] Catch-up setelah shutdown; tanpa duplikat; observabilitas (log terstruktur + metrik)

### A7 · API
- [ ] Server Hono + skema Drizzle + migrasi
- [ ] Semua endpoint di `docs/api.md`
- [ ] Amplop respons seragam, kode error, pagination cursor, rate limit
- [ ] Resolusi `protocolName` / `assetSymbol` / `assetDecimals` / `etherscanUrl`

### A8 · Deploy & rilis
- [ ] Deploy kontrak ke CC3 Testnet, catat alamat di `.env` + README
- [ ] Verifikasi kontrak bila explorer mendukung
- [ ] Indexer & API jalan di host long-running
- [ ] Dokumentasi teknis untuk submission (syarat wajib hackathon)

---

## 4. Dev B — Frontend

### B0 · Fondasi (bisa mulai begitu A0 selesai)
- [ ] Next.js 16 App Router + TypeScript strict + Tailwind + shadcn/ui
- [ ] Identitas brand Corolary (lihat `docs/frontend.md`)
- [ ] wagmi v2 + viem, chain Creditcoin CC3 Testnet dari `@corolary/shared`
- [ ] Klien API bertipe + TanStack Query
- [ ] `dev-fixtures.ts` di balik `NEXT_PUBLIC_USE_FIXTURES`, **default mati**
- [ ] Layout, navigasi, tema gelap/terang, state loading & error

### B1 · Landing
- [ ] Proposisi nilai: reputasi terbukti → efisiensi kolateral
- [ ] Statistik langsung dari `/v1/market/summary` & `/v1/indexer/status`
      (**tidak ada angka hardcoded**)
- [ ] Penjelasan cara kerja, dengan penekanan bukti kriptografis

### B2 · Score Explorer ← **halaman pahlawan**
- [ ] Input alamat / connect wallet
- [ ] Tampilan skor + tier + rasio kolateral yang didapat
- [ ] Rincian enam komponen, masing-masing bisa dibuka
- [ ] **Setiap komponen bisa ditelusuri sampai daftar fakta pembentuknya**
- [ ] Keadaan kosong yang jujur untuk alamat tanpa riwayat (bukan skor palsu)

### B3 · Proof Viewer ← **pembeda utama di mata juri**
- [ ] Daftar fakta dengan filter (jenis, protokol, aset, rentang waktu)
- [ ] Detail fakta: transaksi Ethereum sumber, blok, log index, metadata proof
- [ ] Tautan keluar ke Etherscan (sisi Ethereum) dan explorer Creditcoin (sisi pencatatan)
- [ ] Visualisasi rantai bukti: `tx Ethereum → attestation → proof → fakta tercatat`

> Halaman ini yang membuat juri **melihat** kedalaman Attestcoin, bukan sekadar
> membacanya di deck. Perlakukan sebagai fitur produk utama, bukan halaman debug.

### B4 · Market
- [ ] Daftar reserve, suku bunga, utilisasi
- [ ] Alur supply / withdraw
- [ ] Alur borrow yang **menunjukkan rasio kolateral personal user** dan berapa modal
      yang ia hemat dibanding baseline 150%
- [ ] Health factor, peringatan likuidasi

### B5 · Portfolio
- [ ] Posisi user, riwayat, perkembangan skor sepanjang waktu
- [ ] Panduan konkret: fakta apa yang akan menaikkan tier berikutnya

### B6 · Poles
- [ ] Responsif, aksesibel
- [ ] Keadaan loading/kosong/error di semua tampilan
- [ ] Animasi masuk halaman
- [ ] **Cabut semua fixture**, jalankan `pnpm check:no-mocks`

---

## 5. Milestone Bersama

| M | Nama | Kondisi selesai |
|---|---|---|
| **M0** | Seam terkunci | `types.ts` + `docs/api.md` final. B bisa mulai. |
| **M1** | Fakta pertama nyata | Satu event Aave mainnet asli terbukti & tercatat di CC3 Testnet |
| **M2** | Skor hidup | CreditGraph memberi skor untuk alamat Ethereum nyata |
| **M3** | Pasar jalan | Pinjam dengan rasio kolateral berbasis skor berhasil end-to-end |
| **M4** | UI lengkap | Kelima halaman jalan dengan data nyata, fixture mati |
| **M5** | Siap submit | Deploy, dokumentasi teknis, video demo, deck, `check:no-mocks` lulus |

**M1 adalah momen paling penting.** Begitu satu fakta Ethereum mainnet nyata berhasil
dibuktikan dan tercatat di Creditcoin, seluruh tesis proyek sudah terbukti dan sisanya
adalah pekerjaan yang terukur. Kejar M1 sesegera mungkin — jangan bangun tiga lapis
kontrak dulu baru menguji jalur bukti.

---

## 6. Urutan Kritis

```
A0 ─┬─► B0 ─► B1..B6                    (B jalan paralel, tak pernah menunggu)
    │
    └─► A1 ─► A2 ─► A6(sebagian) ─► M1 ◄── kejar ini duluan
                 │
                 ├─► A3 ─► A5
                 ├─► A4 ─► A5 ─► M3
                 └─► A7 ─────────► M4 ─► A8 ─► M5
```

**Anti-pola yang harus dihindari:** membangun A1–A5 lengkap sebelum menyentuh indexer.
Kalau ada asumsi yang salah tentang format proof atau decoding, kamu baru menemukannya
setelah menulis lima kontrak. Tembus jalur tipis sampai M1 lebih dulu.

---

## 7. Protokol Komunikasi

- **B butuh field baru?** Minta ke A. Jangan edit `packages/shared`.
- **A mengubah bentuk API?** Perbarui `docs/api.md` + `types.ts` di commit yang sama,
  lalu beri tahu B.
- **Terblokir > 30 menit?** Bicara. Jangan menebak kontrak pihak lain.
- **Branch:** `feat/a-*` dan `feat/b-*`. Merge lewat PR.
