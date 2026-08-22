# Corolary — Arsitektur Sistem

> **Dokumen tulang punggung.** Semua dokumen lain menurunkan detail dari sini.
> Kalau ada konflik, dokumen ini yang menang.
>
> Prasyarat baca: `docs/attestcoin-research.md` (batasan protokol, sudah diverifikasi live).

---

## 1. Ringkasan Produk

**Corolary** — *reputasi yang mengikuti dari bukti.*

Riwayat kredit on-chain yang portabel dan terbukti secara kriptografis, diturunkan dari
aktivitas pinjam-meminjam **nyata di Ethereum mainnet**, dipakai untuk membuka
**efisiensi kolateral** di pasar pinjaman Creditcoin.

**Yang kami jual bukan pinjaman tanpa jaminan.** Semua pinjaman tetap over-kolateral.
Peminjam dengan riwayat terbukti hanya perlu mengunci modal jauh lebih sedikit:
**150% → 110%**. Protokol tetap solven tanpa perlu identitas atau jalur hukum.
Ini pembeda utama dari Spectral/Cred/ARCx yang gagal.

---

## 2. Prinsip Desain (tidak bisa dinegosiasikan)

1. **Nol mock data.** Setiap fakta berasal dari transaksi Ethereum mainnet nyata,
   dibuktikan lewat Attestcoin. Tidak ada seed data, tidak ada angka karangan,
   tidak ada fitur bohongan di produk akhir.
2. **Nol oracle terpusat.** Termasuk harga — harga pun dibuktikan lewat Attestcoin
   dari event Chainlink `AnswerUpdated` di Ethereum. Tidak ada satu pun API harga terpusat.
3. **Setiap angka dapat ditelusuri ke satu proof.** Tidak ada kotak hitam. Kalau UI
   menampilkan skor 720, user bisa klik sampai ke transaksi Ethereum yang membentuknya.
4. **Eager proving.** Buktikan saat murah (< 24 jam), simpan permanen. Jangan pernah
   prove on-demand untuk data lama.
5. **Searah saja.** Writability belum rilis. Ethereum → Creditcoin. Titik.

---

## 3. Batasan Protokol yang Membentuk Arsitektur

Diringkas dari `attestcoin-research.md` — baca lengkapnya di sana.

| Batasan | Konsekuensi arsitektur |
|---|---|
| Writability belum rilis | Tidak ada tulis balik ke Ethereum. Semua state hidup di Creditcoin. |
| Hanya event/transaksi yang bisa dibuktikan, **bukan state** | Saldo & posisi direkonstruksi lewat **event sourcing** |
| Precompile **tidak** cek sukses/gagal tx | **WAJIB** `require(receiptStatus == 1)` di setiap jalur |
| Proof 10x lebih mahal setelah 24 jam | Indexer harus **eager**, bukan lazy |
| Batch maks 10 tx / rentang 1000 blok | Batching wajib untuk import riwayat |
| Lag attestation ~8 menit | Tidak ada fitur yang butuh sub-menit |
| Source chain: **hanya Ethereum** | Jangan janjikan multi-chain di deck |

**Source chain yang dipakai:** `chainKey = 3` (Ethereum **Mainnet**) di CC3 **Testnet**.
Ini yang membuat "deploy di testnet" dan "nol mock data" bisa berjalan bersamaan.

---

## 4. Arsitektur Tiga Lapis

```
┌──────────────────────────────────────────────────────────────┐
│  Lapis 3 — EfficiencyMarket                                  │
│  Pasar pinjam-meminjam. Rasio kolateral = f(skor terbukti)   │
└──────────────────────────────────────────────────────────────┘
                            ▲
┌──────────────────────────────────────────────────────────────┐
│  Lapis 2 — CreditGraph                                       │
│  Skor 0..1000 + tier. Tiap komponen menunjuk ke factId       │
└──────────────────────────────────────────────────────────────┘
                            ▲
┌──────────────────────────────────────────────────────────────┐
│  Lapis 1 — FactRegistry  ← kontribusi teknis inti            │
│  Fakta terverifikasi, permanen, dapat dibaca siapa pun       │
│  + PriceRegistry (harga terbukti dari Chainlink)             │
└──────────────────────────────────────────────────────────────┘
                            ▲
        Attestcoin Block Prover Precompile (0x0FD2)
                            ▲
   Event Ethereum MAINNET nyata: Aave V3 · Morpho Blue ·
   Compound V3 · Spark · Chainlink AnswerUpdated
```

**Kenapa FactRegistry adalah produk sesungguhnya:** ia mengubah Attestcoin dari
oracle per-query menjadi **lapisan data terbukti yang persisten**. dApp Creditcoin lain
membaca fakta yang sudah terverifikasi nyaris gratis, tanpa membayar proof historis.
Inilah bagian yang membuat Corolary infrastruktur, bukan aplikasi — dan itu tepat
sasaran dengan mandat CEIP.

---

## 5. Alur Data End-to-End

```
1. Peminjam melunasi pinjaman di Aave V3, Ethereum mainnet
        │  emit Repay(reserve, user, repayer, amount, useATokens)
        ▼
2. Indexer Corolary mendeteksi log (RPC Ethereum, archive-capable)
        ▼
3. Indexer menunggu blok ter-attest di Creditcoin (~8 menit)
        │  ChainInfo precompile 0x0fd3 / prover API
        ▼
4. Indexer minta proof — SELAGI MURAH (< 24 jam)
        │  GET /api/v1/proof-by-tx/3/{txHash}   (batch: 10 tx)
        ▼
5. Indexer panggil FactRegistry.recordFact(proof, encodedTx, adapter)
        ▼
6. FactRegistry → precompile 0x0FD2 verifyAndEmit()   [sinkron, ~15 dtk]
        │  cek receiptStatus == 1     ← WAJIB
        │  cek alamat emitter == protokol terdaftar
        │  cek replay via queryId
        ▼
7. Adapter protokol men-decode log → struct Fact
        ▼
8. Fact disimpan permanen. emit FactRecorded
        ▼
9. CreditGraph memperbarui skor subjek secara inkremental
        ▼
10. EfficiencyMarket membaca skor → menentukan rasio kolateral
        ▼
11. API membaca (mirror DB + chain) → Frontend menampilkan + link ke bukti
```

---

## 6. Tech Stack (dikunci)

### On-chain — Creditcoin CC3 Testnet
| Item | Pilihan |
|---|---|
| Bahasa | Solidity **`^0.8.28`** (dipaksa `@gluwa/usc-contracts` v0.2.0) |
| Toolchain | **Foundry** (forge/cast/anvil) |
| Library | OpenZeppelin Contracts v5, `@gluwa/usc-contracts` **v0.2.0** |
| Jaringan | CC3 Testnet · chainId **102031** (`0x18e8f`) |
| RPC | `https://rpc.cc3-testnet.creditcoin.network` |

### Off-chain
| Item | Pilihan |
|---|---|
| Runtime | Node.js 24 LTS, TypeScript strict |
| Package manager | **pnpm** workspaces + Turborepo |
| Attestcoin SDK | `@gluwa/usc-sdk` **v0.18.0** |
| Chain lib | ethers v6 (peer dep SDK) — di backend |
| API | **Hono** di Node |
| DB | **PostgreSQL** + **Drizzle ORM** |
| Queue/retry | in-process + tabel `jobs` di Postgres (jangan tambah Redis) |

### Frontend
| Item | Pilihan |
|---|---|
| Framework | **Next.js 16** App Router, TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Wallet | **wagmi v2 + viem** (Creditcoin EVM) |
| Data fetching | TanStack Query |
| Chart | Recharts |

> **Catatan:** backend memakai **ethers v6** (dipaksa oleh SDK Attestcoin), frontend
> memakai **viem/wagmi**. Ini disengaja dan tidak perlu diseragamkan — keduanya tidak
> pernah bertemu di file yang sama. `packages/shared` hanya mengekspor tipe & ABI polos.

---

## 7. Layout Repo & Kepemilikan File

**Aturan mutlak: dua orang TIDAK PERNAH mengedit file yang sama.**

```
corolary/
├── CLAUDE.md                    [bersama — ubah lewat kesepakatan]
├── README.md                    [A]
├── package.json                 [A]  pnpm workspace root
├── pnpm-workspace.yaml          [A]
├── turbo.json                   [A]
├── docker-compose.yml           [A]  postgres lokal
├── .env.example                 [A]
├── docs/                        [bersama — lihat aturan di §12]
│
├── packages/
│   ├── contracts/               ██ DEV A ██  Foundry
│   │   ├── foundry.toml
│   │   ├── src/
│   │   │   ├── AttestcoinReader.sol
│   │   │   ├── FactRegistry.sol
│   │   │   ├── PriceRegistry.sol
│   │   │   ├── CreditGraph.sol
│   │   │   ├── EfficiencyMarket.sol
│   │   │   ├── adapters/
│   │   │   │   ├── AaveV3Adapter.sol
│   │   │   │   ├── MorphoBlueAdapter.sol
│   │   │   │   ├── CompoundV3Adapter.sol
│   │   │   │   └── ChainlinkAdapter.sol
│   │   │   ├── interfaces/
│   │   │   └── libraries/
│   │   ├── test/
│   │   └── script/Deploy.s.sol
│   │
│   └── shared/                  ██ DEV A tulis · DEV B baca ██
│       ├── src/types.ts         ← KONTRAK ANTAR-DEV
│       ├── src/constants.ts
│       ├── src/chains.ts
│       └── src/abis/*.json      ← di-generate dari forge build
│
├── services/
│   ├── indexer/                 ██ DEV A ██
│   │   └── src/{watcher,prover,submitter,adapters,db}
│   └── api/                     ██ DEV A ██
│       └── src/{routes,services,db}
│
└── apps/
    └── web/                     ██ DEV B ██  (B tidak menyentuh apa pun di luar sini)
        └── src/{app,components,hooks,lib}
```

---

## 8. Model Data — Fact (KONTRAK INTI)

### 8.1 Solidity

```solidity
enum FactKind {
    LoanOriginated,      // 0 — Aave Borrow, Morpho Borrow, Compound Withdraw
    LoanRepaid,          // 1 — Aave Repay, Morpho Repay
    Liquidated,          // 2 — Aave LiquidationCall, Morpho Liquidate
    CollateralSupplied,  // 3 — Aave Supply
    CollateralWithdrawn  // 4 — Aave Withdraw
}

struct Fact {
    bytes32  factId;      // keccak256(chainKey, blockHeight, txIndex, txLogIndex)
    uint64   chainKey;    // 3 = Ethereum mainnet
    uint64   blockHeight;
    uint32   txIndex;
    uint32   txLogIndex;  // posisi di receipt.receiptLogs (INTRA-transaksi)
    FactKind kind;
    address  subject;     // dompet yang direputasikan (onBehalfOf / user)
    address  protocol;    // alamat kontrak sumber, WAJIB terdaftar
    address  asset;       // token
    uint256  amount;      // satuan native token
    uint64   observedAt;  // timestamp blok Ethereum
    uint64   recordedAt;  // timestamp blok Creditcoin
}

event FactRecorded(
    bytes32 indexed factId,
    address indexed subject,
    FactKind indexed kind,
    address protocol,
    address asset,
    uint256 amount,
    uint64  blockHeight
);
```

**Semantik `amount` per `FactKind` (dikunci — adapter WAJIB mengikuti):**

| FactKind | `amount` berarti |
|---|---|
| `LoanOriginated` (0) | Pokok yang dipinjam, native units `asset` — Aave `Borrow.amount` |
| `LoanRepaid` (1) | Jumlah yang dilunasi, native units `asset` — Aave `Repay.amount` |
| `Liquidated` (2) | **`debtToCover`** — utang yang dilunasi paksa likuidator, native units token utang. **BUKAN** `liquidatedCollateralAmount`. |
| `CollateralSupplied` (3) | Kolateral yang disetor |
| `CollateralWithdrawn` (4) | Kolateral yang ditarik |

Untuk `Liquidated`, `asset` adalah **token utang** (`debtAsset`), bukan token kolateral.
Salah memilih di sini akan meracuni `liquidationPenalty` secara diam-diam — kesalahan
yang tidak akan terlihat sampai skor sudah salah selama berminggu-minggu.
Spesifikasi turunannya ada di `docs/scoring.md` §0 dan `docs/contracts.md`.

> ### ⚠️ `txLogIndex` bukan `logIndex` Ethereum
> `EvmV1Decoder.LogEntry` hanya berisi `{address_, topics, data}` — **tidak ada
> `logIndex`**. Kontrak mustahil mengetahui log index block-wide milik Ethereum.
> Karena itu on-chain memakai **`txLogIndex`**: posisi log di dalam
> `receipt.receiptLogs` transaksi itu sendiri. Itu deterministik dan sudah cukup untuk
> keunikan dalam `(chainKey, blockHeight, txIndex)`.
>
> `logIndex` Ethereum yang sebenarnya (untuk menaut ke Etherscan) hanya diketahui
> indexer lewat `eth_getLogs`, jadi ia disimpan **off-chain saja** di DB dan API.
> Keduanya hidup berdampingan — jangan tertukar.
>
> **Konsekuensi implementasi:** adapter/registry **tidak boleh** memakai
> `EvmV1Decoder.getLogsByEventSignature()` di jalur pencatatan, karena ia
> mengembalikan array terfilter dan posisi asli log hilang. Iterasi
> `receipt.receiptLogs` secara langsung dengan indeks loop.

`factId` sengaja **tidak** memasukkan `txHash` — turunan `(chainKey, blockHeight,
txIndex, logIndex)` sudah unik secara global dan langsung sejalan dengan replay
protection `queryId` milik `USCBase`.

### 8.2 TypeScript — `packages/shared/src/types.ts`

```typescript
export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export enum FactKind {
  LoanOriginated = 0,
  LoanRepaid = 1,
  Liquidated = 2,
  CollateralSupplied = 3,
  CollateralWithdrawn = 4,
}

export interface Fact {
  factId: Hex;
  chainKey: number;
  blockHeight: number;
  txHash: Hex;
  txIndex: number;
  txLogIndex: number;   // posisi intra-transaksi — cocok dengan on-chain
  logIndex: number;     // logIndex block-wide Ethereum — off-chain saja, utk Etherscan
  kind: FactKind;
  subject: Address;
  protocol: Address;
  protocolName: string;      // "Aave V3" — hasil resolve di API
  asset: Address;
  assetSymbol: string;
  assetDecimals: number;
  amount: string;            // uint256 sebagai string desimal
  amountUsd: string | null;  // dari PriceRegistry, null bila tak ada harga terbukti
  observedAt: number;        // unix detik
  recordedAt: number;        // unix detik
  creditcoinTxHash: Hex;     // tx Creditcoin yang mencatatnya
  etherscanUrl: string;      // tautan bukti untuk UI
}
```

> **`amount` SELALU string.** Jangan pernah `number` — uint256 melebihi
> `Number.MAX_SAFE_INTEGER`. Ini penyebab bug paling umum di proyek seperti ini.

### 8.3 Skor — bentuk dikunci, bobot dirinci di `docs/scoring.md`

```typescript
export type ScoreComponentKey =
  | 'repaymentVolume' | 'repaymentCount' | 'historyDuration'
  | 'liquidationPenalty' | 'protocolDiversity' | 'activeStanding';

export interface ScoreComponent {
  key: ScoreComponentKey;
  label: string;
  points: number;        // boleh negatif (liquidationPenalty)
  maxPoints: number;
  factCount: number;
  factIds: Hex[];        // penelusuran ke bukti
}

export interface CreditScore {
  subject: Address;
  score: number;              // 0..1000
  tier: 0 | 1 | 2 | 3 | 4;
  collateralRatioBps: number; // 15000 = 150%
  components: ScoreComponent[];
  factCount: number;
  firstFactAt: number | null;
  lastFactAt: number | null;
  computedAt: number;
  onChainBlock: number;
}
```

**Tier → rasio kolateral (dikunci):**

| Tier | Rentang skor | Rasio kolateral | bps |
|---|---|---|---|
| 0 | 0–199 | 150% | 15000 |
| 1 | 200–399 | 140% | 14000 |
| 2 | 400–599 | 130% | 13000 |
| 3 | 600–799 | 120% | 12000 |
| 4 | 800–1000 | 110% | 11000 |

---

## 9. Kontrak API (SEAM ANTARA DEV A DAN DEV B)

Base URL: `/v1` · JSON · semua uint256 sebagai **string**.

```
GET  /v1/health                        → { ok, version, uptime }
GET  /v1/chains                        → source chain + status attestation
GET  /v1/indexer/status                → cursor, lag, tinggi ter-attest, antrean
GET  /v1/facts                         → daftar fakta (query: subject, kind,
                                          protocol, cursor, limit≤100)
GET  /v1/facts/:factId                 → satu fakta + referensi proof
GET  /v1/score/:address                → CreditScore lengkap
GET  /v1/score/:address/history        → riwayat skor (query: from, to)
GET  /v1/market/summary                → TVL, utilisasi, suku bunga
GET  /v1/market/reserves               → daftar aset pasar
GET  /v1/market/positions/:address     → posisi user
GET  /v1/prices                        → harga terbukti + umur bukti
POST /v1/prove                         → { txHash, chainKey } antre eager proof
GET  /v1/prove/:jobId                  → status job
```

**Amplop respons — seragam:**
```typescript
type ApiResponse<T> =
  | { ok: true;  data: T; meta?: { cursor?: string; total?: number } }
  | { ok: false; error: { code: string; message: string } };
```

**Kode error:** `NOT_FOUND` · `INVALID_ADDRESS` · `INVALID_PARAM` ·
`RATE_LIMITED` · `UPSTREAM_UNAVAILABLE` · `INTERNAL`

> Referensi lengkap tiap endpoint (contoh request/response) ada di `docs/api.md`.
> **Dev A tidak boleh mengubah bentuk respons tanpa memperbarui `docs/api.md`
> dan `packages/shared/src/types.ts` di commit yang sama.**

---

## 10. Skema Database (Postgres, milik Dev A)

Mirror baca-cepat + pembukuan indexer. **Chain tetap sumber kebenaran.**

```
source_cursors    (chain_key, protocol, last_scanned_block, updated_at)
observed_events   (id, chain_key, block_height, tx_hash, tx_index, log_index,
                   topic0, protocol, raw_log, status, attempts, last_error,
                   observed_at, created_at)
                   status: pending | awaiting_attestation | proving |
                           submitting | recorded | failed | skipped
facts             (fact_id PK, chain_key, block_height, tx_hash, tx_index,
                   tx_log_index, log_index, kind, subject, protocol, asset, amount NUMERIC(78,0),
                   observed_at, recorded_at, creditcoin_tx_hash)
scores            (subject PK, score, tier, components JSONB, fact_count,
                   first_fact_at, last_fact_at, computed_at, onchain_block)
score_history     (id, subject, score, tier, at_block, at_time)
prices            (asset PK, aggregator, answer NUMERIC(78,0), decimals,
                   round_id, updated_at, source_block, fact_id)
jobs              (id, kind, payload JSONB, status, attempts, run_after, last_error)
```

`amount` memakai `NUMERIC(78,0)` — cukup menampung uint256 penuh. Jangan `BIGINT`.

---

## 11. Sumber Data Ethereum Mainnet (TERVERIFIKASI LIVE 2026-08-22)

Semua alamat di bawah sudah dicek punya bytecode di Ethereum mainnet.

### Protokol kredit
| Protokol | Alamat | Bytecode |
|---|---|---|
| Aave V3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | 2400 B |
| Morpho Blue | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | 15623 B |
| Compound V3 (cUSDCv3) | `0xc3d688B66703497DAA19211EEdff47f25384cdc3` | 1878 B |
| Spark Pool | `0xC13e21B648A5Ee794902342038FF3aDAB66BE987` | 2400 B |
| Aave V2 LendingPool | `0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9` | 1779 B |

### Signature event Aave V3 (topic0 dihitung via keccak)
| Event | topic0 |
|---|---|
| `Borrow(address,address,address,uint256,uint8,uint256,uint16)` | `0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0` |
| `Repay(address,address,address,uint256,bool)` | `0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051` |
| `LiquidationCall(address,address,address,uint256,uint256,address,bool)` | `0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286` |
| `Supply(address,address,address,uint256,uint16)` | `0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61` |
| `Withdraw(address,address,address,uint256)` | `0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7` |

> **Penting soal `subject`:** untuk Aave `Borrow`, dompet yang direputasikan adalah
> **`onBehalfOf`** (topic ke-3), bukan `user`. Untuk `Repay`, subjek adalah **`user`**
> (yang berutang), bukan `repayer`. Salah memilih di sini akan meracuni seluruh skor.

### Harga — Chainlink (nol oracle terpusat)
`AnswerUpdated(int256,uint256,uint256)` topic0 =
`0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f`

| Pasangan | Proxy | Aggregator (emitter) | latestAnswer saat cek |
|---|---|---|---|
| ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | `0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5` | 242933000000 ($2.429,33) |
| BTC/USD | `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c` | `0x4a3411ac2948B33c69666B35cc6d055B27Ea84f1` | 7726182000000 ($77.261,82) |
| USDC/USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | `0xc9E1a09622afdB659913fefE800fEaE5DBbFe9d7` | 99994251 ($0,99994) |

Semua feed berdesimal **8**.

> ⚠️ **Aggregator bisa berganti.** Chainlink mengganti aggregator di balik proxy saat
> upgrade feed. `ChainlinkAdapter` harus me-resolve `aggregator()` dari proxy secara
> berkala dan menyimpan **himpunan aggregator tepercaya**, bukan satu alamat hardcoded.
> Kalau tidak, feed akan diam-diam mati saat Chainlink upgrade.

---

## 12. Aturan Kolaborasi Dua Orang

1. **Batas file mutlak.** Dev B hanya menyentuh `apps/web/**`. Dev A memiliki
   sisanya. Tidak ada pengecualian.
2. **`packages/shared` searah.** Dev A menulis, Dev B membaca. Kalau Dev B butuh
   field baru, ia **minta**, bukan mengedit.
3. **`docs/`** — satu file satu pemilik. Lihat tabel di `docs/workstreams.md`.
4. **Perubahan kontrak API** butuh commit yang menyentuh `docs/api.md` +
   `packages/shared/src/types.ts` **bersamaan**, plus kabar ke Dev B.
5. **Branch:** `feat/a-*` untuk Dev A, `feat/b-*` untuk Dev B. Merge lewat PR.

---

## 13. Aturan "Nol Mock" (WAJIB DITEGAKKAN)

Ini permintaan eksplisit dan menjadi bagian dari kriteria penilaian.

**Boleh selama pengembangan:**
- Fixture lokal di `apps/web/src/lib/dev-fixtures.ts`, dijaga
  `process.env.NEXT_PUBLIC_USE_FIXTURES === 'true'`, **default mati**
- `anvil` fork untuk uji kontrak
- Kontrak Sepolia untuk latihan alur (bukan untuk produk akhir)

**DILARANG di produk akhir:**
- Fixture apa pun yang aktif di build produksi
- Angka hardcoded di UI (TVL, jumlah user, skor contoh)
- Tombol/menu yang tidak berfungsi ("Coming soon")
- Grafik yang digambar dari data karangan

**Gerbang sebelum submit:**
```bash
pnpm check:no-mocks   # gagal bila fixture ter-bundle di build produksi
```
Dev A membuat skrip ini. Ia harus benar-benar gagal, bukan sekadar memperingatkan.

---

## 14. Yang Di-deploy

> Rincian lengkap — host, urutan, env per service, pemantauan, biaya — ada di
> **`docs/deployment.md`**. Tabel di bawah hanya ringkasan.

| Komponen | Target |
|---|---|
| Kontrak | Creditcoin CC3 Testnet (chainId 102031) |
| Indexer | Proses long-running (VPS / Railway / Fly.io) — **bukan** serverless |
| API | Node (Railway / Fly.io) — bisa serverless, tapi satu tempat dengan indexer lebih sederhana |
| Frontend | Vercel |
| Postgres | Neon / Supabase / Postgres terkelola |

> Indexer **tidak boleh** serverless: ia proses berkelanjutan dengan cursor dan
> penantian attestation.

---

## 15. Variabel Lingkungan

```bash
# --- Ethereum (source chain) ---
ETHEREUM_RPC_URL=            # WAJIB archive-capable (Alchemy/Infura/QuickNode).
                             # RPC publik MENOLAK query log historis — sudah diuji.
ETHEREUM_CHAIN_KEY=3         # 3 = Ethereum mainnet di CC3 Testnet

# --- Creditcoin ---
CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
CREDITCOIN_CHAIN_ID=102031
PROOF_BUILDER_URL=https://prover.cc3-testnet.creditcoin.network
SUBMITTER_PRIVATE_KEY=       # dompet yang mengirim recordFact

# --- Alamat kontrak (diisi setelah deploy) ---
FACT_REGISTRY_ADDRESS=
PRICE_REGISTRY_ADDRESS=
CREDIT_GRAPH_ADDRESS=
EFFICIENCY_MARKET_ADDRESS=

# --- Infrastruktur ---
DATABASE_URL=postgres://...
API_PORT=8080

# --- Frontend ---
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_CREDITCOIN_RPC_URL=
NEXT_PUBLIC_USE_FIXTURES=false   # HARUS false di produksi
```

---

## 16. Peta Dokumen

| Dokumen | Isi | Pemilik |
|---|---|---|
| `docs/hackathon.md` | Aturan & checklist submission | bersama |
| `docs/attestcoin-research.md` | Riset protokol terverifikasi | bersama |
| `docs/ideas.md` | Catatan keputusan — kenapa ide ini dipilih | bersama |
| **`docs/architecture.md`** | **Dokumen ini — tulang punggung** | bersama |
| `docs/workstreams.md` | Pembagian kerja 2 orang | bersama |
| `docs/open-issues.md` | **Gap, blocker, keputusan tertunda** | bersama |
| `docs/contracts.md` | Spesifikasi Solidity | Dev A |
| `docs/indexer.md` | Desain worker eager prover | Dev A |
| `docs/api.md` | Referensi REST lengkap | Dev A |
| `docs/shared-types.md` | **Kontrak tipe seam A↔B** | Dev A |
| `docs/scoring.md` | Algoritma credit graph | Dev A |
| `docs/frontend.md` | Halaman, komponen, wallet, desain | Dev B |
| `docs/setup.md` | Setup lingkungan dev | Dev A |
| `docs/deployment.md` | **Deployment: apa & di mana** | Dev A |
| `docs/business.md` | Model bisnis & materi pitch | bersama |
