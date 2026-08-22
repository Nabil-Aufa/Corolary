# `packages/shared/src/types.ts` — Kontrak Dev A ↔ Dev B

> **Ini seam-nya.** Dev A menulis file ini, Dev B mengimpornya. Tidak ada tipe API yang
> boleh diturunkan sendiri oleh Dev B dari contoh JSON.
>
> Diturunkan langsung dari contoh respons di `docs/api.md` dan model data di
> `docs/architecture.md` §8. Kalau `api.md` berubah, file ini berubah **di commit yang sama**.

Salin isi §1 apa adanya menjadi `packages/shared/src/types.ts`.

---

## 1. `types.ts` lengkap

```typescript
// packages/shared/src/types.ts
// Kontrak tunggal antara API (Dev A) dan web (Dev B).
// ATURAN: setiap uint256 adalah `string`. Tidak pernah `number`.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** Unix timestamp dalam DETIK (bukan milidetik). */
export type UnixSeconds = number;

/** Nilai uint256 sebagai string desimal, satuan native token. */
export type TokenAmount = string;

/** Nilai USD sebagai string desimal, mis. "2499.85". */
export type UsdAmount = string;

// ─────────────────────────────────────────────────────────────
// Amplop respons
// ─────────────────────────────────────────────────────────────

export interface ApiMeta {
  cursor?: string;
  total?: number;
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_ADDRESS'
  | 'INVALID_PARAM'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL';

export type ApiResponse<T> =
  | { ok: true; data: T; meta?: ApiMeta }
  | { ok: false; error: ApiError };

// ─────────────────────────────────────────────────────────────
// Fakta
// ─────────────────────────────────────────────────────────────

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
  /** Posisi log di receipt.receiptLogs — cocok dengan on-chain. */
  txLogIndex: number;
  /** logIndex block-wide Ethereum — off-chain saja, untuk tautan Etherscan. */
  logIndex: number;
  kind: FactKind;
  subject: Address;
  protocol: Address;
  protocolName: string;
  asset: Address;
  assetSymbol: string;
  assetDecimals: number;
  amount: TokenAmount;
  /** null bila tidak ada harga terbukti pada saat itu. */
  amountUsd: UsdAmount | null;
  observedAt: UnixSeconds;
  recordedAt: UnixSeconds;
  creditcoinTxHash: Hex;
  etherscanUrl: string;
}

/** Metadata proof — hanya dikembalikan GET /v1/facts/:factId. */
export interface FactProofInfo {
  provedWithinHours: number;
  continuityProofRootsCount: number;
  merkleProofSiblingsCount: number;
  batchId: string | null;
  batchSize: number;
  verifiedAtBlock: number;
  creditcoinExplorerUrl: string;
}

export type FactWithProof = Fact & { proof: FactProofInfo };

// ─────────────────────────────────────────────────────────────
// Skor
// ─────────────────────────────────────────────────────────────

export type ScoreComponentKey =
  | 'repaymentVolume'
  | 'repaymentCount'
  | 'historyDuration'
  | 'liquidationPenalty'
  | 'protocolDiversity'
  | 'activeStanding';

export interface ScoreComponent {
  key: ScoreComponentKey;
  label: string;
  /** Boleh negatif — hanya untuk liquidationPenalty. */
  points: number;
  maxPoints: number;
  factCount: number;
  /** Bukti pendukung. Bisa kosong untuk komponen turunan (mis. historyDuration). */
  factIds: Hex[];
}

export type Tier = 0 | 1 | 2 | 3 | 4;

export interface CreditScore {
  subject: Address;
  /** 0..1000 */
  score: number;
  tier: Tier;
  /** 15000 = 150%. Sumber kebenaran rasio — jangan hitung sendiri dari tier. */
  collateralRatioBps: number;
  components: ScoreComponent[];
  factCount: number;
  firstFactAt: UnixSeconds | null;
  lastFactAt: UnixSeconds | null;
  computedAt: UnixSeconds;
  onChainBlock: number;
}

export interface ScoreHistoryPoint {
  subject: Address;
  score: number;
  tier: Tier;
  atBlock: number;
  atTime: UnixSeconds;
}

// ─────────────────────────────────────────────────────────────
// Chain & indexer
// ─────────────────────────────────────────────────────────────

export interface ChainStatus {
  chainKey: number;
  chainId: number;
  name: string;
  encoding: number;
  isSourceForFacts: boolean;
  latestHeight: number;
  attestedHeight: number;
  checkpointHeight: number;
  lagBlocks: number;
  lagSeconds: number;
  genesisHeight: number;
}

export interface IndexerCursor {
  protocol: Address;
  protocolName: string;
  lastScannedBlock: number;
  updatedAt: UnixSeconds;
}

export interface IndexerQueue {
  pending: number;
  awaitingAttestation: number;
  proving: number;
  submitting: number;
  recorded24h: number;
  failed: number;
  skipped24h: number;
}

export interface IndexerStatus {
  chainKey: number;
  latestEthereumBlock: number;
  attestedHeight: number;
  lagBlocks: number;
  cursors: IndexerCursor[];
  queue: IndexerQueue;
  /**
   * Umur event terlama yang belum dibuktikan, dalam detik.
   * Melewati 86400 berarti biaya proof melonjak ~12x — ini metrik operasional
   * paling penting di sistem. Lihat docs/indexer.md.
   */
  oldestUnprovenAgeSeconds: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  version: string;
  uptime: number;
  timestamp: UnixSeconds;
}

// ─────────────────────────────────────────────────────────────
// Pasar
// ─────────────────────────────────────────────────────────────

export interface MarketSummary {
  tvlUsd: UsdAmount;
  totalSuppliedUsd: UsdAmount;
  totalBorrowedUsd: UsdAmount;
  utilizationBps: number;
  reserveCount: number;
  avgCollateralRatioBps: number;
  updatedAt: UnixSeconds;
  onChainBlock: number;
}

export interface Reserve {
  asset: Address;
  symbol: string;
  decimals: number;
  totalSupplied: TokenAmount;
  totalBorrowed: TokenAmount;
  supplyApyBps: number;
  borrowApyBps: number;
  utilizationBps: number;
  priceUsd: UsdAmount | null;
  /** Fakta harga yang menjadi dasar priceUsd — null bila harga tak tersedia. */
  priceFactId: Hex | null;
}

export interface PositionEntry {
  asset: Address;
  symbol: string;
  decimals: number;
  supplied: TokenAmount;
  borrowed: TokenAmount;
  collateralEnabled: boolean;
}

export interface AccountPositions {
  subject: Address;
  tier: Tier;
  collateralRatioBps: number;
  totalCollateralUsd: UsdAmount;
  totalDebtUsd: UsdAmount;
  /** 10000 = 1.0. Di bawah 10000 berarti dapat dilikuidasi. */
  healthFactorBps: number;
  positions: PositionEntry[];
  updatedAt: UnixSeconds;
  onChainBlock: number;
}

// ─────────────────────────────────────────────────────────────
// Harga
// ─────────────────────────────────────────────────────────────

export interface PriceEntry {
  asset: Address;
  assetSymbol: string;
  pair: string;
  aggregator: Address;
  /** uint256 pada skala native feed (Chainlink = 8 desimal). */
  answer: TokenAmount;
  decimals: number;
  roundId: TokenAmount;
  sourceBlock: number;
  factId: Hex;
  updatedAt: UnixSeconds;
  /** Melewati maxPriceAge (24 jam) → pasar membeku. */
  ageSeconds: number;
}

// ─────────────────────────────────────────────────────────────
// Job proving
// ─────────────────────────────────────────────────────────────

export type ProveJobKind = 'eager_prove' | 'backfill';

export type ProveJobStatus =
  | 'pending'
  | 'awaiting_attestation'
  | 'proving'
  | 'submitting'
  | 'recorded'
  | 'failed'
  | 'skipped';

export interface ProveJob {
  jobId: string;
  kind: ProveJobKind;
  status: ProveJobStatus;
  txHash: Hex;
  chainKey: number;
  attempts: number;
  lastError: string | null;
  createdAt: UnixSeconds;
  updatedAt: UnixSeconds;
}

/** Respons POST /v1/prove (202 Accepted) — subset ProveJob. */
export interface ProveJobAccepted {
  jobId: string;
  status: ProveJobStatus;
  txHash: Hex;
  chainKey: number;
  createdAt: UnixSeconds;
}
```

---

## 2. Peta endpoint → tipe

Dipakai untuk mengetikkan klien API. Setiap nilai dibungkus `ApiResponse<T>`.

| Endpoint | `T` |
|---|---|
| `GET /v1/health` | `HealthStatus` |
| `GET /v1/chains` | `ChainStatus[]` |
| `GET /v1/indexer/status` | `IndexerStatus` |
| `GET /v1/facts` | `Fact[]` (dengan `meta.cursor`) |
| `GET /v1/facts/:factId` | `FactWithProof` |
| `GET /v1/score/:address` | `CreditScore` |
| `GET /v1/score/:address/history` | `ScoreHistoryPoint[]` |
| `GET /v1/market/summary` | `MarketSummary` |
| `GET /v1/market/reserves` | `Reserve[]` |
| `GET /v1/market/positions/:address` | `AccountPositions` |
| `GET /v1/prices` | `PriceEntry[]` |
| `POST /v1/prove` | `ProveJobAccepted` (HTTP 202) |
| `GET /v1/prove/:jobId` | `ProveJob` |

---

## 3. Konstanta — `packages/shared/src/constants.ts`

```typescript
export const TIER_COLLATERAL_RATIO_BPS: Record<Tier, number> = {
  0: 15000, // 150%
  1: 14000, // 140%
  2: 13000, // 130%
  3: 12000, // 120%
  4: 11000, // 110%
};

export const BASELINE_COLLATERAL_RATIO_BPS = 15000;

/** Alokasi poin maksimum per komponen. Jumlah komponen positif = 1000. */
export const SCORE_COMPONENT_MAX: Record<ScoreComponentKey, number> = {
  repaymentVolume: 300,
  repaymentCount: 200,
  historyDuration: 200,
  liquidationPenalty: 0,   // hanya negatif, hingga -300
  protocolDiversity: 100,
  activeStanding: 200,
};

export const LIQUIDATION_PENALTY_MIN = -300;
export const MAX_SCORE = 1000;

export const ETHEREUM_MAINNET_CHAIN_KEY = 3;
export const SEPOLIA_CHAIN_KEY = 1;

export const MAX_PRICE_AGE_SECONDS = 86_400;
export const PROOF_CHEAP_WINDOW_SECONDS = 86_400;
export const MAX_BATCH_SIZE = 10;
export const MAX_BATCH_BLOCK_RANGE = 1000;
```

---

## 4. Konfigurasi chain — `packages/shared/src/chains.ts`

```typescript
import { defineChain } from 'viem';

export const creditcoinTestnet = defineChain({
  id: 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.cc3-testnet.creditcoin.network'] } },
  blockExplorers: {
    default: {
      name: 'Creditcoin Explorer',
      url: 'https://creditcoin-testnet.blockscout.com',
    },
  },
  testnet: true,
});
```

> `viem` dipakai **hanya** di sini dan di `apps/web`. Backend memakai ethers v6 karena
> dipaksa `@gluwa/usc-sdk`. Keduanya tidak pernah bertemu di satu file — lihat
> `architecture.md` §6.

---

## 5. Aturan perubahan

1. Mengubah bentuk apa pun di sini = perbarui `docs/api.md` **di commit yang sama**.
2. Dev B **tidak pernah** mengedit file ini. Kalau butuh field baru → minta Dev A.
3. Menambah field opsional aman. Mengganti nama atau menghapus field adalah
   *breaking change* — beri tahu Dev B sebelum merge.
4. Jangan pernah melonggarkan `TokenAmount` menjadi `number`. Kalau ada yang tergoda
   melakukannya untuk "sekadar menampilkan angka", jawabannya adalah `formatUnits`,
   bukan `Number()`.
