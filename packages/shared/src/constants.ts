// packages/shared/src/constants.ts
// Konstanta yang dibagi antara API (Dev A) dan web (Dev B).
// Diturunkan dari docs/shared-types.md §3 dan docs/scoring.md §10.

import type { ScoreComponentKey, Tier } from './types.js';

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
  liquidationPenalty: 0, // hanya negatif, hingga -300
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

/**
 * Ambang bawah setiap tier (docs/scoring.md §10). Dipisahkan dari
 * TIER_COLLATERAL_RATIO_BPS supaya batas skor dan rasio kolateral tidak
 * pernah didefinisikan ulang di dua tempat dengan angka berbeda.
 */
export const TIER_MIN_SCORE: Record<Tier, number> = {
  0: 0,
  1: 200,
  2: 400,
  3: 600,
  4: 800,
};

/**
 * Padanan off-chain dari `_tierOf` di CreditGraph.
 *
 * Ini kenyamanan tampilan, BUKAN sumber kebenaran. Rasio kolateral yang
 * mengikat selalu `CreditScore.collateralRatioBps` yang datang dari kontrak —
 * jangan pernah menghitungnya sendiri dari tier di jalur transaksi.
 */
export function tierOf(score: number): Tier {
  if (score < TIER_MIN_SCORE[1]) return 0;
  if (score < TIER_MIN_SCORE[2]) return 1;
  if (score < TIER_MIN_SCORE[3]) return 2;
  if (score < TIER_MIN_SCORE[4]) return 3;
  return 4;
}

export const TIER_LABEL: Record<Tier, string> = {
  0: 'Unproven',
  1: 'Emerging',
  2: 'Established',
  3: 'Strong',
  4: 'Prime',
};
