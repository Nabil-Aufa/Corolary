/**
 * Tipe domain TIDAK PERNAH dideklarasikan ulang di apps/web — semuanya berasal
 * dari @corolary/shared, yang ditulis Dev A bersamaan dengan API-nya
 * (docs/workstreams.md §2). File ini hanya meneruskan, plus menambahkan tipe
 * yang murni urusan UI dan tidak punya tempat di kontrak API.
 */
export type {
  Address,
  Hex,
  UnixSeconds,
  TokenAmount,
  UsdAmount,
  UsdPrice,
  ApiMeta,
  ApiError as ApiErrorShape,
  ApiErrorCode,
  ApiResponse,
  Fact,
  FactProofInfo,
  FactWithProof,
  ScoreComponent,
  ScoreComponentKey,
  Tier,
  CreditScore,
  ScoreHistoryPoint,
  ChainStatus,
  IndexerCursor,
  IndexerQueue,
  IndexerStatus,
  HealthStatus,
  MarketSummary,
  Reserve,
  PositionEntry,
  AccountPositions,
  PriceEntry,
  ProveJob,
  ProveJobStatus,
  ProveJobAccepted,
  BackfillJob,
  BackfillJobAccepted,
  BackfillJobStatus,
} from '@corolary/shared';

export { FactKind } from '@corolary/shared';

/** Filter halaman /proofs. Hidup di URL search params, bukan di kontrak API. */
export interface FactFilterState {
  subject?: string;
  kind?: number;
  protocol?: string;
}

export type ScoreRange = '30d' | '90d' | '1y' | 'all';
