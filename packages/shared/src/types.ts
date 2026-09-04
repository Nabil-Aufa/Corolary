// packages/shared/src/types.ts
// Kontrak tunggal antara API (Dev A) dan web (Dev B).
// ATURAN: setiap uint256 adalah `string`. Tidak pernah `number`.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** Unix timestamp dalam DETIK (bukan milidetik). */
export type UnixSeconds = number;

/** Nilai uint256 sebagai string desimal, satuan native token. */
export type TokenAmount = string;

/** Nilai USD sebagai string desimal dengan DUA desimal, mis. "2499.85". */
export type UsdAmount = string;

/**
 * HARGA USD per unit sebagai string desimal dengan ENAM desimal,
 * mis. "0.999949" atau "2469.250000".
 *
 * Tipe terpisah dari `UsdAmount` karena presisinya berbeda, dan bedanya
 * penting: dua desimal tidak bisa membedakan USDC $0,99994916 dari $0,99 —
 * selisih 1% pada aset yang seluruh gunanya adalah menempel di $1.
 */
export type UsdPrice = string;

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

/**
 * Satu komponen skor beserta buktinya.
 *
 * Lima komponen bersifat MENAMBAH (`points` 0..`maxPoints`). Satu tidak:
 * `liquidationPenalty` berkisar **-300 sampai 0**, dengan `maxPoints: 0` —
 * nilai terbaik yang mungkin adalah nol. Merendernya sebagai bilah kemajuan
 * membuat dompet bersih tampil "0 dari 300", yang terbaca persis kebalikan dari
 * artinya. Batas bawahnya `LIQUIDATION_PENALTY_MIN`.
 */
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
  /**
   * Fakta yang KITA catat dalam 24 jam terakhir, dari `facts.recorded_at`
   * (stempel blok Creditcoin saat fakta ditulis).
   *
   * BUKAN disaring dari `observed_at`, yang merupakan stempel blok Ethereum
   * sumber. Keduanya sama hanya ketika pipeline sedang mengejar head; saat
   * mengejar backlog, versi `observed_at` jatuh ke nol sementara submitter
   * mencatat puluhan fakta per menit.
   */
  recorded24h: number;
  failed: number;
  /** Event yang PERTAMA TERLIHAT dalam 24 jam terakhir dan berakhir `skipped`. */
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
  /** Jumlah baris `facts` kumulatif — seluruh riwayat, bukan 24 jam terakhir. */
  totalFacts: number;
  /** Jumlah subjek (dompet) berbeda yang punya minimal satu fakta. */
  distinctSubjects: number;
  /**
   * Umur harga terbesar di antara aset kanonik (WETH/WBTC/USDC), dibaca
   * LANGSUNG dari `PriceRegistry.priceDataOf` on-chain — bukan dari mirror
   * Postgres `prices`. `null` berarti registry masih benar-benar kosong untuk
   * SELURUH aset kanonik (`roundId == 0`) atau panggilan RPC gagal untuk
   * semuanya; lihat komentar `maxOnChainPriceAgeSeconds` di `status.ts`.
   */
  onChainPriceAgeSeconds: number | null;
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
  /**
   * Apakah aset ini boleh DIPINJAM. Menyetornya sebagai kolateral tetap boleh
   * walau ini `false`.
   *
   * Dipisah dari `active` karena keduanya berbeda: reserve yang tidak aktif
   * menolak segalanya, sedangkan reserve kolateral-saja menerima setoran tapi
   * menolak `borrow` dengan `BorrowDisabled`. tWETH di CC3 Testnet adalah yang
   * kedua — dan tanpa field ini, klien tidak punya cara mengetahuinya selain
   * mencoba lalu gagal.
   */
  borrowEnabled: boolean;
  priceUsd: UsdPrice | null;
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
  /**
   * Saldo di sisi PEMBERI PINJAMAN (`supplyBalanceOf`).
   *
   * Berbunga lewat `liquidityIndex` dan menyediakan likuiditas pasar, tapi
   * TIDAK menopang pinjaman. Ember yang terpisah dari `collateral` di kontrak,
   * dengan aturan yang berbeda — dan menggabungkan keduanya jadi satu angka
   * membuat "tarik semua" maupun "lunasi semua" mustahil dijawab dengan benar.
   */
  supplied: TokenAmount;
  borrowed: TokenAmount;
  /**
   * Saldo di sisi PEMINJAM (`collateralBalanceOf`).
   *
   * Menopang pinjaman, tidak berbunga. Menarik ini saat masih punya utang
   * diperiksa terhadap health factor; menarik `supplied` tidak.
   */
  collateral: TokenAmount;
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
  /**
   * Umur ronde ini. Bandingkan dengan `maxAgeSeconds`, JANGAN dengan angka
   * tetap — anggarannya berbeda per aset.
   */
  ageSeconds: number;
  /**
   * Anggaran kesegaran yang BERLAKU untuk aset ini, dibaca dari kontrak.
   *
   * `PriceRegistry` punya `maxPriceAge()` global dan override per aset lewat
   * `maxPriceAgeOf(asset)`; yang kedua menang bila bukan nol. Di CC3 Testnet
   * globalnya **10.800 detik (3 jam)** dan satu-satunya override adalah USDC
   * pada 100.800 detik (28 jam) — satu-satunya feed berheartbeat 24 jam.
   *
   * Angka 24 jam yang dulu tertulis di sini SALAH dan berbahaya secara khusus:
   * ia delapan kali lebih longgar dari kenyataan, jadi peringatan apa pun yang
   * diturunkan darinya tidak akan pernah menyala sebelum pasar sudah membeku.
   */
  maxAgeSeconds: number;
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
  /**
   * `null` ketika transaksinya sudah tercatat sebagai Fact tanpa pernah lewat
   * antrean job — jalur biasa untuk apa pun yang ditemukan watcher live.
   * Tidak ada job untuk ditanyakan; `factId` yang membawa jawabannya.
   */
  jobId: string | null;
  status: ProveJobStatus;
  txHash: Hex;
  chainKey: number;
  createdAt: UnixSeconds;
  /** Terisi begitu faktanya ada, entah lewat job ini atau lewat watcher. */
  factId?: Hex;
}

// ─────────────────────────────────────────────────────────────
// Job backfill riwayat
// ─────────────────────────────────────────────────────────────

/**
 * `covered` dan `partial` ada karena keduanya BUKAN kegagalan, dan bukan pula
 * kesuksesan biasa.
 *
 * - `covered`  — riwayat sedalam ini sudah pernah dipindai; tidak ada job baru,
 *                tidak ada CTC yang keluar. UI harus menampilkan skor yang ada,
 *                bukan spinner.
 * - `partial`  — pemindaian selesai tapi sebagian rentang tidak terbaca. Ini
 *                satu-satunya sinyal bahwa riwayatnya BERLUBANG: skornya tetap
 *                sah, hanya lebih rendah dari seharusnya, dan tidak ada gejala
 *                lain yang bisa dilihat pengguna. Menampilkannya sebagai
 *                "selesai" berarti berbohong tentang angka yang ditampilkan.
 */
export type BackfillJobStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'partial'
  | 'covered'
  | 'failed';

/** Respons POST /v1/backfill (202 Accepted). */
export interface BackfillJobAccepted {
  /** `null` ketika `status = 'covered'` — tidak ada job untuk ditanyakan. */
  jobId: string | null;
  status: BackfillJobStatus;
  subject: Address;
  /** Kedalaman riwayat yang diminta, dalam bulan ke belakang. */
  months: number;
  createdAt: UnixSeconds;
}

export interface BackfillJob {
  jobId: string;
  status: BackfillJobStatus;
  subject: Address;
  months: number;
  attempts: number;
  lastError: string | null;
  /** Terisi setelah selesai. `> 0` berarti riwayatnya berlubang. */
  failedRanges: number | null;
  /**
   * Log yang cocok subjek, SEBELUM dedup terhadap yang sudah tercatat. Bukan
   * jumlah fakta baru: sebagian besar bisa saja sudah ada di registry.
   */
  logsFound: number | null;
  /**
   * Kenapa job ini masih `pending` padahal indexer hidup.
   *
   * Backfill ditunda ketika pipeline sedang tertekan — misalnya backlog proving
   * sudah menua melewati ambang kritis. Job-nya tetap `pending` dan dicoba lagi
   * tiap beberapa menit, jadi tanpa field ini "menunggu antrean" dan "ditahan
   * karena pipeline penuh" terlihat persis sama dari luar: sama-sama diam.
   *
   * `null` berarti tidak sedang ditunda.
   */
  postponedReason: string | null;
  createdAt: UnixSeconds;
  updatedAt: UnixSeconds;
}
