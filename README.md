# Corolary

**Reputasi yang mengikuti dari bukti.**

Riwayat kredit on-chain yang portabel dan terbukti secara kriptografis — diturunkan dari
aktivitas pinjam-meminjam **nyata di Ethereum mainnet** melalui **Attestcoin Protocol** —
dipakai untuk membuka **efisiensi kolateral** di pasar pinjaman **Creditcoin**.

> Dibangun untuk **BUIDL CTC 2026 Fall** · Track: DeFi / RWA

---

## Masalah

DeFi hari ini menuntut over-kolateralisasi 150–200% untuk *semua orang*. Peminjam yang
sudah melunasi 40 pinjaman Aave selama dua tahun diperlakukan persis sama dengan dompet
yang dibuat lima menit lalu.

**Reputasi tidak punya nilai ekonomi** — bukan karena tidak ada, tapi karena riwayat itu
terkunci di chain lain dan tidak bisa dibuktikan di tempat kita berdiri.

## Solusi

Corolary membuktikan riwayat itu secara kriptografis, lalu memberinya harga.

```
Peminjam melunasi pinjaman di Aave V3 (Ethereum mainnet)
        ↓  event nyata, transaksi nyata
Attestcoin Protocol — jaringan attestor terdesentralisasi mencapai konsensus
        ↓  Merkle proof + continuity proof
FactRegistry di Creditcoin — verifikasi sinkron via precompile 0x0FD2
        ↓  fakta permanen, dapat diaudit siapa pun
CreditGraph — skor 0..1000, tiap komponen menunjuk ke bukti spesifik
        ↓
EfficiencyMarket — rasio kolateral 150% → 110%
```

**Yang kami jual bukan pinjaman tanpa jaminan.** Semua pinjaman tetap over-kolateral.
Peminjam dengan reputasi terbukti hanya perlu mengunci modal jauh lebih sedikit.
Protokol tetap solven tanpa perlu identitas maupun jalur hukum — dan itulah yang
membedakan Corolary dari upaya credit-scoring on-chain sebelumnya yang gagal.

---

## Integrasi Attestcoin Protocol

Attestcoin bukan tempelan di proyek ini — **ia adalah produknya**.

| Pemakaian | Detail |
|---|---|
| **Sumber data inti** | Setiap fakta kredit berasal dari transaksi Ethereum mainnet yang dibuktikan lewat Block Prover Precompile `0x0FD2` |
| **Oracle harga** | Harga kolateral dibuktikan dari event Chainlink `AnswerUpdated` di Ethereum — **nol oracle terpusat di seluruh sistem** |
| **Eager proving** | Proof dibuat dalam jendela < 24 jam (**10x lebih murah**), fakta disimpan permanen → mengubah Attestcoin dari oracle per-query menjadi lapisan data terbukti yang persisten |
| **Batch proving** | 10 transaksi per batch berbagi satu continuity proof |
| **Ekstraksi selektif** | `QueryBuilder` dari SDK untuk decoding parsial hemat gas |
| **Registry ChainInfo** | Precompile `0x0fd3` untuk pelacakan status attestation |

### Nol mock data

Hackathon mewajibkan deploy di **testnet**. Kami tidak mau memakai data palsu.
Keduanya terlihat bertentangan — ternyata tidak.

Creditcoin CC3 **Testnet** mendukung **Ethereum Mainnet** sebagai source chain
(`chainKey = 3`, terverifikasi langsung dari precompile). Corolary berjalan di testnet
sesuai aturan, sambil mengonsumsi event Aave V3, Spark, Morpho Blue, Compound V3, dan Chainlink
yang **sungguhan** dari Ethereum mainnet.

Tidak ada satu pun angka di produk ini yang dikarang.

#### Yang nyata, dan satu hal yang testnet

Ada satu pengecualian, dan kami menyatakannya lebih dulu alih-alih menunggu
ditanya: di CC3 Testnet tidak ada USDC atau WETH sungguhan untuk dipinjamkan, jadi
pasar demo memakai ERC20 testnet.

| Lapisan | Sumber | Nyata? |
|---|---|---|
| Fakta kredit (Aave V3, Spark, Morpho Blue, Compound V3) | Ethereum **mainnet**, dibuktikan kriptografis lewat Attestcoin | **Ya** |
| Harga (Chainlink `AnswerUpdated`) | Ethereum **mainnet**, dibuktikan kriptografis | **Ya** |
| Skor & tier kolateral | Diturunkan on-chain dari fakta di atas | **Ya** |
| Token yang dipinjamkan di `EfficiencyMarket` | ERC20 testnet (`tUSDC`, `tWETH`) | **Tidak** — tak terhindarkan |

> **Token pasar adalah token testnet. Riwayat kredit, harga, dan skor berasal dari
> Ethereum mainnet sungguhan.**

Perbedaannya penting: token testnet adalah **wadah**, bukan **data**. `tUSDC`
bahkan dinilai memakai harga USDC mainnet yang benar-benar dibuktikan, lewat
`PriceRegistry.setPriceAlias` — tokennya stand-in, harganya tidak. Yang dilarang
di proyek ini adalah angka karangan, dan tidak ada satu pun di sini.

---

## Arsitektur

```
packages/contracts/    Solidity — FactRegistry, CreditGraph, EfficiencyMarket, adapter
packages/shared/       Tipe TypeScript + ABI (kontrak antar-developer)
services/indexer/      Worker eager-proving (watcher → prover → submitter)
services/api/          REST API (Hono)
apps/web/              Frontend (Next.js 16)
```

Tiga lapis: **FactRegistry** (infrastruktur — dapat dipakai dApp Creditcoin lain)
→ **CreditGraph** (skor) → **EfficiencyMarket** (pasar).

---

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | **Tulang punggung** — desain sistem, kontrak antar-bagian |
| [`docs/attestcoin-research.md`](docs/attestcoin-research.md) | Riset protokol Attestcoin, terverifikasi live |
| [`docs/contracts.md`](docs/contracts.md) | Spesifikasi smart contract |
| [`docs/scoring.md`](docs/scoring.md) | Algoritma credit graph |
| [`docs/indexer.md`](docs/indexer.md) | Desain worker eager-proving |
| [`docs/api.md`](docs/api.md) | Referensi REST API |
| [`docs/shared-types.md`](docs/shared-types.md) | **Kontrak tipe Dev A ↔ Dev B** |
| [`docs/frontend.md`](docs/frontend.md) | Spesifikasi frontend |
| [`docs/setup.md`](docs/setup.md) | Setup lingkungan dev |
| [`docs/deployment.md`](docs/deployment.md) | **Apa yang di-deploy dan di mana** |
| [`docs/business.md`](docs/business.md) | Model bisnis & materi pitch |
| [`docs/workstreams.md`](docs/workstreams.md) | Pembagian kerja tim |
| [`docs/open-issues.md`](docs/open-issues.md) | **Gap, blocker, dan keputusan tertunda** |
| [`docs/hackathon.md`](docs/hackathon.md) | Aturan & checklist submission |
| [`docs/ideas.md`](docs/ideas.md) | Catatan keputusan — kenapa ide ini dipilih |

---

## Mulai cepat

```bash
pnpm install
docker compose up -d
cp .env.example .env      # isi ETHEREUM_RPC_URL (harus archive-capable)
pnpm db:migrate
pnpm dev
```

Panduan lengkap: [`docs/setup.md`](docs/setup.md)

---

## Deployment

| Komponen | Jaringan | Alamat |
|---|---|---|
| FactRegistry | Creditcoin CC3 Testnet (102031) | _diisi setelah deploy_ |
| PriceRegistry | Creditcoin CC3 Testnet | _diisi setelah deploy_ |
| CreditGraph | Creditcoin CC3 Testnet | _diisi setelah deploy_ |
| EfficiencyMarket | Creditcoin CC3 Testnet | _diisi setelah deploy_ |

---

## Tim

| Peran | Cakupan |
|---|---|
| Dev A | Smart contract, indexer, API, infrastruktur |
| Dev B | Frontend, desain, integrasi wallet |

---

## Lisensi

MIT
