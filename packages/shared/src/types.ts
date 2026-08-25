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
  /**
   * Bukti pendukung — **paling banyak 10**, yang terbaru lebih dulu.
   *
   * `factIds.length` BUKAN `factCount`. Untuk dompet demo, `factCount` 72
   * sementara `factIds` hanya 10; menganggap keduanya sama membuat UI mengaku
   * menampilkan seluruh bukti padahal tidak.
   *
   * Kosong untuk komponen turunan yang tidak ditopang fakta tertentu
   * (`historyDuration` dihitung dari `firstFactAt`, bukan dari satu fakta).
   */
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
  /**
   * Transaksi Ethereum yang membuktikan `priceUsd` — null bila harga tak
   * tersedia. Lihat PriceEntry.sourceTxHash: harga tidak punya factId.
   */
  priceSourceTxHash: Hex | null;
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
  /**
   * 10000 = 1.0. Di bawah 10000 berarti dapat dilikuidasi.
   *
   * `null` ketika tidak ada utang — rasionya memang tak terdefinisi, dan
   * `Infinity` bukan JSON yang sah. JANGAN diganti dengan bilangan raksasa:
   * kontrak mengembalikan `type(uint256).max` untuk kasus ini, dan meneruskannya
   * apa adanya membuat UI menampilkan health factor 900.719.925.474.099.100%.
   */
  healthFactorBps: number | null;
  /**
   * Modal yang TIDAK perlu dikunci berkat skor, dibanding baseline 150%.
   *
   * Ini angka utama produk — seluruh pipeline bukti ada untuk menghasilkan
   * satu bilangan ini. Rumusnya `debtUsd × (15000 − rasioEfektif) / 10000`,
   * dibaca dari `EfficiencyMarket.capitalSavedUsdWad`.
   *
   * Bernilai `"0.00"` untuk dompet tanpa riwayat terbukti (rasionya masih
   * baseline) DAN untuk dompet berskor tinggi yang belum meminjam apa pun —
   * penghematan dihitung terhadap utang yang benar-benar ada, bukan terhadap
   * utang yang mungkin diambil. Nol di sini normal, bukan tanda kerusakan.
   */
  capitalSavedUsd: UsdAmount;
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
  /**
   * Transaksi Ethereum yang memuat log `AnswerUpdated` ini — artefak yang
   * dibuktikan. Harga bukan Fact: PriceRegistry menyimpan ronde terbaru per
   * aset, bukan catatan permanen ber-ID, jadi tidak ada factId untuk ditunjuk.
   */
  sourceTxHash: Hex;
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
