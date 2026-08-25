/**
 * Konfigurasi protokol yang dipantau di Ethereum mainnet.
 *
 * Alamat dan topic0 di sini WAJIB cocok dengan konstanta di adapter Solidity
 * (packages/contracts/src/adapters/*). Kalau berbeda, watcher akan memanen log
 * yang adapter-nya tolak — biaya proof terbuang tanpa satu fakta pun tercatat,
 * dan tidak ada error yang muncul karena adapter cuma mengembalikan ok == false.
 *
 * Diverifikasi terhadap log mainnet nyata 2026-08-25 (blok 25827585-25829585):
 * Aave 315 Borrow, Spark 22 Borrow, Compound 4 SupplyCollateral, Morpho 16
 * Borrow. Spark memang memancarkan event ber-signature identik Aave V3.
 */
export interface ProtocolWatchConfig {
  /** Nama pendek, dipakai sebagai kunci di source_cursors dan di log. */
  name: string;
  /** Alamat emitter. Adapter memvalidasi ulang on-chain (Gerbang 3). */
  address: string;
  /** topic0 event yang dipetakan adapter. Log lain diabaikan sejak RPC. */
  topics: string[];
  /**
   * Rentang blok maksimum per eth_getLogs. drpc menolak rentang lebar pada
   * kontrak sibuk dengan "Request timeout on the free plan" — diukur, bukan
   * ditebak: Morpho gagal di 2000 blok tapi lolos di 464.
   */
  chunkSize: number;
}

// ── Aave V3 style (Aave V3 & Spark memakai layout event yang sama) ──
const AAVE_BORROW = '0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0';
const AAVE_REPAY = '0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051';
const AAVE_LIQUIDATION = '0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286';
const AAVE_SUPPLY = '0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61';
const AAVE_WITHDRAW = '0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7';

const AAVE_STYLE_TOPICS = [
  AAVE_BORROW,
  AAVE_REPAY,
  AAVE_LIQUIDATION,
  AAVE_SUPPLY,
  AAVE_WITHDRAW,
];

// ── Morpho Blue ──
const MORPHO_BORROW = '0x570954540bed6b1304a87dfe815a5eda4a648f7097a16240dcd85c9b5fd42a43';
const MORPHO_REPAY = '0x52acb05cebbd3cd39715469f22afbf5a17496295ef3bc9bb5944056c63ccaa09';
const MORPHO_LIQUIDATE = '0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41';
const MORPHO_SUPPLY_COLLATERAL =
  '0xa3b9472a1399e17e123f3c2e6586c23e504184d504de59cdaa2b375e880c6184';
const MORPHO_WITHDRAW_COLLATERAL =
  '0xe80ebd7cc9223d7382aab2e0d1d6155c65651f83d53c8b9b06901d167e321142';

// ── Compound V3 (Comet USDC) ──
// Supply/Withdraw aset DASAR sengaja TIDAK dipantau: saldo aset dasar Comet
// bertanda, dan event-nya hanya memancarkan total, sehingga menyetor sebagai
// pemberi pinjaman tidak bisa dibedakan dari melunasi utang. Memetakannya
// berarti siapa pun bisa menyetor USDC lalu menariknya lagi untuk reputasi
// gratis. Hanya tiga event di bawah yang tidak ambigu.
const COMET_SUPPLY_COLLATERAL =
  '0xfa56f7b24f17183d81894d3ac2ee654e3c26388d17a28dbd9549b8114304e1f4';
const COMET_WITHDRAW_COLLATERAL =
  '0xd6d480d5b3068db003533b170d67561494d72e3bf9fa40a266471351ebba9e16';
const COMET_ABSORB_DEBT = '0x1547a878dc89ad3c367b6338b4be6a65a5dd74fb77ae044da1e8747ef1f4f62f';

export const PROTOCOLS: ProtocolWatchConfig[] = [
  {
    name: 'aave-v3',
    address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    topics: AAVE_STYLE_TOPICS,
    chunkSize: 500,
  },
  {
    name: 'spark',
    address: '0xC13e21B648A5Ee794902342038FF3aDAB66BE987',
    topics: AAVE_STYLE_TOPICS,
    chunkSize: 2000,
  },
  {
    name: 'morpho-blue',
    address: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    topics: [
      MORPHO_BORROW,
      MORPHO_REPAY,
      MORPHO_LIQUIDATE,
      MORPHO_SUPPLY_COLLATERAL,
      MORPHO_WITHDRAW_COLLATERAL,
    ],
    chunkSize: 400,
  },
  {
    name: 'compound-v3',
    address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
    topics: [COMET_SUPPLY_COLLATERAL, COMET_WITHDRAW_COLLATERAL, COMET_ABSORB_DEBT],
    chunkSize: 2000,
  },
];
