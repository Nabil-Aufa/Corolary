import { TIER_MIN_SCORE } from '@corolary/shared';
import type { CreditScore, ScoreComponent, ScoreComponentKey, Tier } from '@/types';

/**
 * Berapa yang harus berubah agar skor naik — diturunkan dari rumus KONTRAK,
 * bukan dari tebakan.
 *
 * Konstanta di bawah menyalin `CreditGraph.sol`. Menyalin rumus skoring ke
 * TypeScript memang berarti dua implementasi yang harus tetap sepakat, dan
 * `ComponentBreakdown` sengaja MENOLAK melakukannya — ia hanya menampilkan
 * poin yang sudah dihitung on-chain. Perbedaannya: di sini yang dihitung bukan
 * skornya, melainkan MASUKAN yang dibutuhkan untuk poin berikutnya. Itu
 * pertanyaan yang tidak dijawab kontrak sama sekali, jadi tidak ada angka
 * on-chain yang bisa dipakai — dan hasilnya tidak pernah ditampilkan sebagai
 * skor, hanya sebagai "sebanyak ini lagi".
 *
 * Kalau konstanta di kontrak berubah, yang di sini ikut berubah. Tesnya ada di
 * kontrak; di sini yang menjaga cuma nama konstanta yang sengaja dibuat sama.
 */
const HALF: Partial<Record<ScoreComponentKey, number>> = {
  repaymentVolume: 50_000, // K_VOLUME_USD_1E18, dalam USD
  repaymentCount: 12, // K_COUNT
  historyDuration: 365, // K_DURATION_DAYS, dalam hari
};

/** `saturating(v, k, m) = m * v / (v + k)`, dibalik jadi v. */
function inputFor(points: number, half: number, max: number): number {
  if (points >= max) return Infinity;
  return (half * points) / (max - points);
}

export type LeverCertainty = 'exact' | 'formula' | 'none';

export interface Lever {
  key: ScoreComponentKey;
  /** Poin yang MASIH tersedia di komponen ini. */
  headroom: number;
  certainty: LeverCertainty;
  title: string;
  detail: string;
}

/**
 * `protocolDiversity` LINEAR, sisanya setengah-jenuh — dan itu satu-satunya
 * alasan urutan di sini bukan sekadar "yang headroom-nya terbesar".
 *
 * 25 poin per protokol adalah janji yang bisa ditepati sebelum dikerjakan.
 * Komponen lain butuh masukan yang tidak kita kendalikan (nilai pelunasan
 * baru) atau yang mungkin sudah ada tapi belum dipindai (kedalaman riwayat),
 * jadi keduanya tidak boleh berdiri di urutan pertama seolah sama pastinya.
 */
const ORDER: Record<LeverCertainty, number> = { exact: 0, formula: 1, none: 2 };

/**
 * Kapan sebuah komponen dianggap sudah mentok secara praktis.
 *
 * Bukan saat poinnya penuh — saat masukan yang dibutuhkan untuk poin
 * berikutnya melebihi DUA KALI apa yang sudah ada. Di ekor kurva
 * setengah-jenuh, "benar secara matematis" berhenti berarti "layak
 * dikerjakan": dompet demo butuh $10.000.000 pelunasan tambahan untuk 2 poin
 * `repaymentVolume`, dan 517 pelunasan tambahan untuk 25 poin
 * `repaymentCount`. Menyajikan keduanya sebagai saran berarti menyuruh orang
 * mengejar angka yang tidak akan pernah tercapai, sementara tuas yang
 * sebenarnya — 25 poin per protokol — berdiri di daftar yang sama seolah
 * sederajat.
 */
const SATURATION_RATIO = 2;

export interface Guidance {
  /** `null` kalau sudah di tier tertinggi. */
  nextTier: Tier | null;
  /** Poin yang kurang untuk mencapai `nextTier`. */
  pointsNeeded: number;
  levers: Lever[];
  /** Komponen yang secara teori masih punya sisa, tapi praktis tidak bergerak. */
  saturated: ScoreComponentKey[];
}

export function guidanceFor(score: CreditScore): Guidance {
  const nextTier = score.tier < 4 ? ((score.tier + 1) as Tier) : null;
  const pointsNeeded = nextTier === null ? 0 : Math.max(0, TIER_MIN_SCORE[nextTier] - score.score);

  const by = new Map(score.components.map((c) => [c.key, c]));
  const levers: Lever[] = [];
  const saturated: ScoreComponentKey[] = [];

  /**
   * Masukan tambahan untuk +25 poin (atau sisa headroom, mana yang lebih
   * kecil), plus vonis apakah komponen ini sudah lewat titik kegunaannya.
   */
  function step(c: ScoreComponent): { target: number; needed: number; worthwhile: boolean } {
    const half = HALF[c.key] as number;
    const now = inputFor(c.points, half, c.maxPoints);
    const target = Math.min(c.points + 25, c.maxPoints - 1);
    const needed = inputFor(target, half, c.maxPoints) - now;
    // `now === 0` berarti belum ada apa-apa di komponen ini — awal kurva, dan
    // di sana tiap masukan bernilai paling besar. Rasio tidak berlaku.
    const worthwhile = now === 0 || needed <= now * SATURATION_RATIO;
    return { target, needed, worthwhile };
  }

  const diversity = by.get('protocolDiversity');
  if (diversity !== undefined && diversity.points < diversity.maxPoints) {
    const missing = Math.round((diversity.maxPoints - diversity.points) / 25);
    levers.push({
      key: 'protocolDiversity',
      headroom: diversity.maxPoints - diversity.points,
      certainty: 'exact',
      title: `+${diversity.maxPoints - diversity.points} points from ${missing} more protocol${
        missing === 1 ? '' : 's'
      }`,
      detail:
        'Exactly 25 points per protocol, with no saturation. It is the only component whose gain is known before the work is done: borrowing and repaying once on a protocol this wallet has not used yet is enough.',
    });
  }

  const duration = by.get('historyDuration');
  if (duration !== undefined && duration.points < duration.maxPoints) {
    const { target, needed: daysNeeded, worthwhile } = step(duration);
    if (!worthwhile) saturated.push('historyDuration');
    else levers.push({
      key: 'historyDuration',
      headroom: duration.maxPoints - duration.points,
      certainty: 'formula',
      title: `+${target - duration.points} points from ${Math.round(
        daysNeeded,
      )} more days of proven history`,
      detail:
        'Half-saturating at one year, so each additional day is worth less than the last. This history may already exist on mainnet and simply not be scanned yet, and a deeper scan costs nothing but time.',
    });
  }

  const count = by.get('repaymentCount');
  if (count !== undefined && count.points < count.maxPoints) {
    const { target, needed: raw, worthwhile } = step(count);
    const needed = Math.ceil(raw);
    if (!worthwhile) saturated.push('repaymentCount');
    else levers.push({
      key: 'repaymentCount',
      headroom: count.maxPoints - count.points,
      certainty: 'formula',
      title: `+${target - count.points} points from ${needed} more repayment${
        needed === 1 ? '' : 's'
      }`,
      detail:
        'Half-saturating at 12 repayments. Only repayments on Ethereum mainnet that have been proven through Attestcoin count.',
    });
  }

  const volume = by.get('repaymentVolume');
  if (volume !== undefined && volume.points < volume.maxPoints) {
    const { target, needed, worthwhile } = step(volume);
    if (!worthwhile) saturated.push('repaymentVolume');
    else levers.push({
      key: 'repaymentVolume',
      headroom: volume.maxPoints - volume.points,
      certainty: 'formula',
      title: `+${target - volume.points} points from ${formatUsdRough(needed)} more repaid`,
      detail:
        'Half-saturating at $50,000, so the last points are far more expensive than the first. Volume is weighted, not a raw sum.',
    });
  }

  const standing = by.get('activeStanding');
  if (standing !== undefined && standing.points < standing.maxPoints) {
    levers.push({
      key: 'activeStanding',
      headroom: standing.maxPoints - standing.points,
      certainty: standingCertainty(standing, score),
      title: `${standing.maxPoints - standing.points} points lost to inactivity or a liquidation`,
      detail:
        'Half of this component is recency: full marks within 90 days of the last positive fact, decaying to zero at 720 days. The other half returns gradually after a liquidation.',
    });
  }

  const penalty = by.get('liquidationPenalty');
  if (penalty !== undefined && penalty.points < 0) {
    levers.push({
      key: 'liquidationPenalty',
      headroom: 0,
      certainty: 'none',
      title: `${penalty.points} points from past liquidations`,
      detail:
        'This one does not come back. The penalty accumulates and is never reduced, so the rest of the score has to outgrow it.',
    });
  }

  levers.sort((a, b) => ORDER[a.certainty] - ORDER[b.certainty] || b.headroom - a.headroom);
  return { nextTier, pointsNeeded, levers, saturated };
}

/** Pembulatan yang jujur soal ketepatannya sendiri: ~$1.2k, bukan $1,247.38. */
function formatUsdRough(usd: number): string {
  if (!Number.isFinite(usd)) return 'an unreachable amount';
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}k`;
  return `$${Math.ceil(usd)}`;
}

function standingCertainty(standing: ScoreComponent, score: CreditScore): LeverCertainty {
  // Kalau fakta positif terakhir masih di dalam jendela 90 hari, poin yang
  // hilang bukan soal kesegaran melainkan sisa likuidasi — dan itu tidak bisa
  // dipercepat dengan tindakan apa pun.
  if (score.lastFactAt === null) return 'none';
  const days = (Date.now() / 1000 - score.lastFactAt) / 86_400;
  return days > 90 ? 'formula' : 'none';
}
