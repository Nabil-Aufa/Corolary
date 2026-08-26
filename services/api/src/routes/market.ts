import { Hono } from 'hono';
import { sql } from '../lib/db.js';
import { ok } from '../lib/envelope.js';
import { parseAddress } from '../lib/validate.js';
import { market, creditGraph, creditcoin, priceRegistry, scaledToActual, wadToUsd, usdOf, ensureCreditcoinAsset } from '../lib/chain.js';
import { resolveAliasPrices, createAliasCache } from '../lib/alias.js';
import type {
  AccountPositions, Address, Hex, MarketSummary, PositionEntry, Reserve, Tier,
} from '@corolary/shared';

export const marketRoutes = new Hono();

interface ReserveData {
  totalSuppliedScaled: bigint;
  totalBorrowedScaled: bigint;
  liquidityIndex: bigint;
  borrowIndex: bigint;
  reserveFactorBps: bigint;
  active: boolean;
  borrowEnabled: boolean;
}

/** Semua angka pasar dibaca dari kontrak; DB hanya melengkapi simbol dan harga. */
async function listReserves(): Promise<
  { asset: string; data: ReserveData; borrowRate: bigint }[]
> {
  const count = Number(await market.getFunction('reserveCount')());
  const out: { asset: string; data: ReserveData; borrowRate: bigint }[] = [];
  for (let i = 0; i < count; i++) {
    const asset = (await market.getFunction('reserveList')(i)) as string;
    const data = (await market.getFunction('reserveData')(asset)) as unknown as ReserveData;
    const borrowRate = (await market.getFunction('currentBorrowRate')(asset)) as bigint;
    out.push({ asset, data, borrowRate });
  }
  return out;
}

interface AssetMeta { symbol: string; decimals: number; answer: string | null; priceDecimals: number | null; sourceTxHash: string | null }

async function assetMeta(addresses: string[]): Promise<Map<string, AssetMeta>> {
  if (addresses.length === 0) return new Map();

  // Token yang belum dikenal di-resolve dari Creditcoin lalu di-cache. Sekali
  // per token seumur hidup proses, bukan per permintaan.
  const known = await sql<{ address: string }[]>`
    SELECT address FROM assets WHERE address = ANY(${addresses})
  `;
  const have = new Set(known.map((k) => k.address.toLowerCase()));
  for (const a of addresses) {
    if (have.has(a.toLowerCase())) continue;
    await ensureCreditcoinAsset(a, async (meta) => {
      await sql`
        INSERT INTO assets ${sql(meta)}
        ON CONFLICT (address) DO UPDATE SET symbol = EXCLUDED.symbol, decimals = EXCLUDED.decimals
      `;
    });
  }

  const rows = await sql<
    { address: string; symbol: string; decimals: number;
      answer: string | null; price_decimals: number | null; source_tx_hash: string | null }[]
  >`
    SELECT a.address, a.symbol, a.decimals,
           p.answer, p.decimals AS price_decimals, p.source_tx_hash
    FROM assets a LEFT JOIN prices p ON p.asset = a.address
    WHERE a.address = ANY(${addresses})
  `;
  const meta = new Map(
    rows.map((r) => [
      r.address.toLowerCase(),
      { symbol: r.symbol, decimals: r.decimals, answer: r.answer,
        priceDecimals: r.price_decimals, sourceTxHash: r.source_tx_hash },
    ]),
  );

  await resolveAliasPrices(
    meta,
    {
      aliasOf: async (a) => (await priceRegistry.getFunction('priceAliasOf')(a)) as string,
      priceOf: async (canonical) => {
        const rows = await sql<
          { answer: string; price_decimals: number; source_tx_hash: string | null }[]
        >`
          SELECT answer, decimals AS price_decimals, source_tx_hash
          FROM prices WHERE asset = ${canonical}
        `;
        const p = rows[0];
        return p
          ? { answer: p.answer, priceDecimals: p.price_decimals, sourceTxHash: p.source_tx_hash }
          : null;
      },
    },
    aliasCache,
  );
  return meta;
}

const aliasCache = createAliasCache();

marketRoutes.get('/market/summary', async (c) => {
  const reserves = await listReserves();
  const meta = await assetMeta(reserves.map((r) => r.asset));

  let suppliedUsd = 0n;
  let borrowedUsd = 0n;
  for (const r of reserves) {
    const m = meta.get(r.asset.toLowerCase());
    const dec = m?.decimals ?? 18;
    suppliedUsd += usdOf(scaledToActual(r.data.totalSuppliedScaled, r.data.liquidityIndex), dec, m);
    borrowedUsd += usdOf(scaledToActual(r.data.totalBorrowedScaled, r.data.borrowIndex), dec, m);
  }

  const baseline = Number(await market.getFunction('BASELINE_RATIO_BPS')());
  const rows = await sql<{ avg: string | null }[]>`SELECT avg(ratio_bps) AS avg FROM scores`;

  const data: MarketSummary = {
    tvlUsd: wadToUsd(suppliedUsd),
    totalSuppliedUsd: wadToUsd(suppliedUsd),
    totalBorrowedUsd: wadToUsd(borrowedUsd),
    utilizationBps:
      suppliedUsd === 0n ? 0 : Number((borrowedUsd * 10_000n) / suppliedUsd),
    reserveCount: reserves.length,
    // Rata-rata rasio yang BENAR-BENAR dinikmati subjek yang punya skor. Kalau
    // belum ada satu pun, baseline-lah jawabannya yang jujur — bukan 0.
    avgCollateralRatioBps: rows[0]?.avg ? Math.round(Number(rows[0].avg)) : baseline,
    updatedAt: Math.floor(Date.now() / 1000),
    onChainBlock: await creditcoin.getBlockNumber(),
  };
  return ok(c, data);
});

marketRoutes.get('/market/reserves', async (c) => {
  const reserves = await listReserves();
  const meta = await assetMeta(reserves.map((r) => r.asset));

  const data: Reserve[] = reserves.map((r) => {
    const m = meta.get(r.asset.toLowerCase());
    const supplied = scaledToActual(r.data.totalSuppliedScaled, r.data.liquidityIndex);
    const borrowed = scaledToActual(r.data.totalBorrowedScaled, r.data.borrowIndex);
    const utilization = supplied === 0n ? 0n : (borrowed * 10_000n) / supplied;
    // borrowRate adalah per-tahun berskala WAD; bps = rate * 10000 / 1e18.
    const borrowBps = Number((r.borrowRate * 10_000n) / 10n ** 18n);
    const reserveFactor = Number(r.data.reserveFactorBps);
    return {
      asset: r.asset as Address,
      symbol: m?.symbol ?? '',
      decimals: m?.decimals ?? 18,
      totalSupplied: supplied.toString(),
      totalBorrowed: borrowed.toString(),
      // Bunga pemasok = bunga peminjam x utilisasi, dikurangi porsi cadangan.
      supplyApyBps: Math.round(
        (borrowBps * Number(utilization) * (10_000 - reserveFactor)) / (10_000 * 10_000),
      ),
      borrowApyBps: borrowBps,
      utilizationBps: Number(utilization),
      priceUsd: m?.answer && m.priceDecimals !== null
        ? wadToUsd((BigInt(m.answer) * 10n ** 18n) / 10n ** BigInt(m.priceDecimals))
        : null,
      priceSourceTxHash: (m?.sourceTxHash ?? null) as Hex | null,
    };
  });

  return ok(c, data, { total: data.length });
});

marketRoutes.get('/market/positions/:address', async (c) => {
  const subject = parseAddress(c.req.param('address'));
  const reserves = await listReserves();
  const meta = await assetMeta(reserves.map((r) => r.asset));

  const positions: PositionEntry[] = [];
  for (const r of reserves) {
    const m = meta.get(r.asset.toLowerCase());
    const supplied = (await market.getFunction('supplyBalanceOf')(subject, r.asset)) as bigint;
    const borrowed = (await market.getFunction('debtBalanceOf')(subject, r.asset)) as bigint;
    const collateral = (await market.getFunction('collateralBalanceOf')(subject, r.asset)) as bigint;
    if (supplied === 0n && borrowed === 0n && collateral === 0n) continue;
    positions.push({
      asset: r.asset as Address,
      symbol: m?.symbol ?? '',
      decimals: m?.decimals ?? 18,
      supplied: (supplied + collateral).toString(),
      borrowed: borrowed.toString(),
      collateralEnabled: collateral > 0n,
    });
  }

  const acct = (await market.getFunction('accountData')(subject)) as [bigint, bigint, bigint, bigint];
  const [score, tier] = (await creditGraph.getFunction('scoreOf')(subject)) as [bigint, bigint];
  void score;

  const data: AccountPositions = {
    subject: subject as Address,
    tier: Number(tier) as Tier,
    collateralRatioBps: Number(await market.getFunction('effectiveRatioBps')(subject)),
    totalCollateralUsd: wadToUsd(acct[0]),
    totalDebtUsd: wadToUsd(acct[1]),
    // healthFactor berskala WAD di kontrak; kontrak API memakai bps (10000 = 1.0).
    // Tanpa utang, kontrak mengembalikan nilai maksimum — dipotong supaya tidak
    // meluap saat dijadikan number.
    // null, BUKAN MAX_SAFE_INTEGER. Kontrak mengembalikan type(uint256).max
    // saat tidak ada utang; meneruskannya sebagai angka membuat UI menampilkan
    // health factor 900.719.925.474.099.100%. docs/api.md sudah menjanjikan
    // null sejak awal — kodenya yang menyimpang.
    healthFactorBps:
      acct[3] >= 2n ** 200n ? null : Number((acct[3] * 10_000n) / 10n ** 18n),
    capitalSavedUsd: wadToUsd(
      (await market.getFunction('capitalSavedUsdWad')(subject)) as bigint,
    ),
    positions,
    updatedAt: Math.floor(Date.now() / 1000),
    onChainBlock: await creditcoin.getBlockNumber(),
  };
  return ok(c, data);
});
