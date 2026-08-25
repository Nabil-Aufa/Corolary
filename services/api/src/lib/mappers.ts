import type { Address, Fact, Hex, ScoreComponent, ScoreComponentKey } from '@corolary/shared';
import { FactKind } from '@corolary/shared';
import { protocolName } from './protocols.js';

export interface FactRow {
  fact_id: string;
  chain_key: string;
  block_height: string;
  tx_hash: string;
  tx_index: number;
  tx_log_index: number;
  log_index: number | null;
  kind: number;
  subject: string;
  protocol: string;
  asset: string;
  amount: string;
  observed_at: string;
  recorded_at: string;
  creditcoin_tx_hash: string;
  symbol: string | null;
  decimals: number | null;
  price_answer: string | null;
  price_decimals: number | null;
}

/**
 * `amountUsd` dihitung dari harga yang TERBUKTI di PriceRegistry, dan `null`
 * kalau belum ada harga terbukti untuk aset itu. Tidak ada fallback ke oracle
 * lain, tidak ada nilai tebakan: kolom kosong di UI lebih jujur daripada angka
 * yang tidak bisa ditelusuri ke sebuah proof.
 */
function toUsd(
  amount: string,
  decimals: number | null,
  answer: string | null,
  priceDecimals: number | null,
): string | null {
  if (answer === null || priceDecimals === null || decimals === null) return null;
  try {
    const scale = 10n ** BigInt(decimals);
    const priceScale = 10n ** BigInt(priceDecimals);
    // Dikali 100 dulu supaya pembagian integer tetap menyisakan sen.
    const cents = (BigInt(amount) * BigInt(answer) * 100n) / (scale * priceScale);
    return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
  } catch {
    return null;
  }
}

export function toFact(r: FactRow): Fact {
  return {
    factId: r.fact_id as Hex,
    chainKey: Number(r.chain_key),
    blockHeight: Number(r.block_height),
    txHash: r.tx_hash as Hex,
    txIndex: r.tx_index,
    txLogIndex: r.tx_log_index,
    logIndex: r.log_index ?? 0,
    kind: r.kind as FactKind,
    subject: r.subject as Address,
    protocol: r.protocol as Address,
    protocolName: protocolName(r.protocol),
    asset: r.asset as Address,
    assetSymbol: r.symbol ?? '',
    assetDecimals: r.decimals ?? 18,
    amount: r.amount,
    amountUsd: toUsd(r.amount, r.decimals, r.price_answer, r.price_decimals),
    observedAt: Number(r.observed_at),
    recordedAt: Number(r.recorded_at),
    creditcoinTxHash: r.creditcoin_tx_hash as Hex,
    etherscanUrl: `https://etherscan.io/tx/${r.tx_hash}`,
  };
}

const LABELS: Record<ScoreComponentKey, string> = {
  repaymentVolume: 'Volume pelunasan',
  repaymentCount: 'Jumlah pelunasan',
  historyDuration: 'Lama riwayat',
  liquidationPenalty: 'Penalti likuidasi',
  protocolDiversity: 'Diversitas protokol',
  activeStanding: 'Status aktif',
};

export interface StoredComponent {
  key: ScoreComponentKey;
  points: number;
  maxPoints: number;
}

export function toComponents(
  stored: StoredComponent[],
  factCounts: Map<ScoreComponentKey, { count: number; ids: Hex[] }>,
): ScoreComponent[] {
  return stored.map((c) => {
    const evidence = factCounts.get(c.key);
    return {
      key: c.key,
      label: LABELS[c.key],
      points: c.points,
      maxPoints: c.maxPoints,
      factCount: evidence?.count ?? 0,
      factIds: evidence?.ids ?? [],
    };
  });
}
