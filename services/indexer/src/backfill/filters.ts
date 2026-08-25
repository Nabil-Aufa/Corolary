import { PROTOCOLS, type ProtocolWatchConfig } from '../watcher/protocols.js';

/**
 * Di mana SUBJEK sebuah event berada di dalam `topics`.
 *
 * Ini yang membuat backfill per-dompet mungkin. Karena subjek adalah parameter
 * ber-`indexed` di keempat protokol, RPC bisa menyaringnya di sisi server:
 * riwayat enam bulan satu dompet jadi beberapa puluh log, bukan ratusan ribu.
 * Tanpa ini, backfill berarti memanen SELURUH log protokol lalu membuang 99,99%
 * di sisi klien — dan membayar proof untuk apa pun yang lolos.
 *
 * PERINGATAN: peta ini WAJIB cocok dengan adapter Solidity
 * (packages/contracts/src/adapters/*). Kalau posisinya salah, filter akan
 * memanen log milik dompet LAIN — orang yang kebetulan ada di posisi topic itu,
 * mis. `repayer` alih-alih `user` — lalu membayar proof untuk riwayat yang bukan
 * milik subjek. Adapter tetap mencatat subjek yang benar, jadi gejalanya bukan
 * data salah melainkan **tagihan untuk fakta orang lain**.
 *
 * Diturunkan langsung dari adapter, diverifikasi baris per baris 2026-08-25.
 */
export interface SubjectFilter {
  /** Posisi subjek di `topics` (1..3). */
  position: 1 | 2 | 3;
  /** topic0 event yang menaruh subjeknya di posisi itu. */
  topics: string[];
}

export interface BackfillTarget {
  protocol: ProtocolWatchConfig;
  filters: SubjectFilter[];
}

// ── Aave V3 style (AaveV3StyleAdapter.sol) ──
// Borrow    topics[2] = onBehalfOf   (PEMIKUL utang, bukan eksekutor)
// Repay     topics[2] = user         (PEMILIK utang, bukan repayer)
// Supply    topics[2] = onBehalfOf
// Withdraw  topics[2] = user
// LiquidationCall topics[3] = user   ← posisi BERBEDA dari empat lainnya
const AAVE_BORROW = '0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0';
const AAVE_REPAY = '0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051';
const AAVE_LIQUIDATION = '0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286';
const AAVE_SUPPLY = '0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61';
const AAVE_WITHDRAW = '0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7';

const AAVE_STYLE_FILTERS: SubjectFilter[] = [
  { position: 2, topics: [AAVE_BORROW, AAVE_REPAY, AAVE_SUPPLY, AAVE_WITHDRAW] },
  { position: 3, topics: [AAVE_LIQUIDATION] },
];

// ── Morpho Blue (MorphoBlueAdapter.sol) ──
// Borrow             topics[2] = onBehalf
// WithdrawCollateral topics[2] = onBehalf  (topics[3] = receiver — BUKAN subjek)
// Repay              topics[3] = onBehalf  (topics[2] = caller — BUKAN subjek)
// Liquidate          topics[3] = borrower  (topics[2] = caller/likuidator)
// SupplyCollateral   topics[3] = onBehalf
const MORPHO_BORROW = '0x570954540bed6b1304a87dfe815a5eda4a648f7097a16240dcd85c9b5fd42a43';
const MORPHO_REPAY = '0x52acb05cebbd3cd39715469f22afbf5a17496295ef3bc9bb5944056c63ccaa09';
const MORPHO_LIQUIDATE = '0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41';
const MORPHO_SUPPLY_COLLATERAL =
  '0xa3b9472a1399e17e123f3c2e6586c23e504184d504de59cdaa2b375e880c6184';
const MORPHO_WITHDRAW_COLLATERAL =
  '0xe80ebd7cc9223d7382aab2e0d1d6155c65651f83d53c8b9b06901d167e321142';

const MORPHO_FILTERS: SubjectFilter[] = [
  { position: 2, topics: [MORPHO_BORROW, MORPHO_WITHDRAW_COLLATERAL] },
  { position: 3, topics: [MORPHO_REPAY, MORPHO_LIQUIDATE, MORPHO_SUPPLY_COLLATERAL] },
];

// ── Compound V3 / Comet (CompoundV3Adapter.sol) ──
// SupplyCollateral   topics[2] = dst  (penerima kolateral, bukan pengirim)
// WithdrawCollateral topics[1] = src  (yang kolateralnya berkurang)
// AbsorbDebt         topics[2] = borrower
const COMET_SUPPLY_COLLATERAL =
  '0xfa56f7b24f17183d81894d3ac2ee654e3c26388d17a28dbd9549b8114304e1f4';
const COMET_WITHDRAW_COLLATERAL =
  '0xd6d480d5b3068db003533b170d67561494d72e3bf9fa40a266471351ebba9e16';
const COMET_ABSORB_DEBT = '0x1547a878dc89ad3c367b6338b4be6a65a5dd74fb77ae044da1e8747ef1f4f62f';

const COMPOUND_FILTERS: SubjectFilter[] = [
  { position: 1, topics: [COMET_WITHDRAW_COLLATERAL] },
  { position: 2, topics: [COMET_SUPPLY_COLLATERAL, COMET_ABSORB_DEBT] },
];

const BY_NAME: Record<string, SubjectFilter[]> = {
  'aave-v3': AAVE_STYLE_FILTERS,
  spark: AAVE_STYLE_FILTERS,
  'morpho-blue': MORPHO_FILTERS,
  'compound-v3': COMPOUND_FILTERS,
};

export function targetsFor(names: string[] | null): BackfillTarget[] {
  const wanted = names === null ? PROTOCOLS : PROTOCOLS.filter((p) => names.includes(p.name));
  const unknown = names?.filter((n) => !PROTOCOLS.some((p) => p.name === n)) ?? [];
  if (unknown.length > 0) {
    throw new Error(
      `protokol tidak dikenal: ${unknown.join(', ')} — pilihan: ${PROTOCOLS.map((p) => p.name).join(', ')}`,
    );
  }
  return wanted.map((protocol) => {
    const filters = BY_NAME[protocol.name];
    if (!filters) throw new Error(`tidak ada filter subjek untuk ${protocol.name}`);
    return { protocol, filters };
  });
}
