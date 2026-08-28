import { formatUnits } from 'viem';
import type { Address, Hex, UsdAmount, UsdPrice } from '@/types';

/**
 * Sisipkan pemisah ribuan ke string integer — TANPA melewati Number().
 *
 * `Number(whole).toLocaleString()` terlihat aman karena bagian integer sudah
 * "kecil" setelah formatUnits, tapi saldo ekstrem tetap bisa melewati 2^53 dan
 * hasilnya rusak diam-diam (dibulatkan, lalu ditampilkan dengan percaya diri).
 * Operasi ini murni tekstual, jadi tidak punya batas atas sama sekali.
 */
export function groupThousands(digits: string): string {
  const neg = digits.startsWith('-');
  const body = neg ? digits.slice(1) : digits;
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return neg ? `-${grouped}` : grouped;
}

/**
 * uint256 string → tampilan token, mis. "1,200.00" atau "0.008092".
 *
 * Presisinya ADAPTIF, dan itu bukan kenyamanan. Dua desimal tetap membuat
 * likuidasi 0,008092 USDT yang benar-benar terjadi terbaca `0.00` — tak
 * terbedakan dari nol, di produk yang seluruh klaimnya adalah setiap angka
 * bisa ditelusuri ke bukti. Nilai bukan-nol TIDAK PERNAH boleh dirender nol.
 *
 * Aturannya: nilai >= 1 memakai `maxFractionDigits`; nilai di bawah 1 diperluas
 * sampai `significantDigits` angka berarti pertama tertangkap, dibatasi oleh
 * presisi aset itu sendiri.
 */
export function formatTokenAmount(
  amount: string,
  decimals: number,
  opts: { maxFractionDigits?: number; significantDigits?: number } = {},
): string {
  const { maxFractionDigits = 2, significantDigits = 4 } = opts;
  let raw: string;
  try {
    raw = formatUnits(BigInt(amount), decimals);
  } catch {
    return '—';
  }

  const negative = raw.startsWith('-');
  const body = negative ? raw.slice(1) : raw;
  const [whole = '0', frac = ''] = body.split('.');
  const sign = negative ? '-' : '';

  // Dipotong, bukan dibulatkan: menampilkan lebih dari yang benar-benar dimiliki
  // seseorang adalah kesalahan yang lebih buruk daripada menampilkan kurang.
  if (whole !== '0') {
    const cut = frac.slice(0, maxFractionDigits);
    return cut.length > 0 ? `${sign}${groupThousands(whole)}.${cut}` : `${sign}${groupThousands(whole)}`;
  }

  const firstSignificant = frac.search(/[1-9]/);
  if (firstSignificant === -1) return '0'; // benar-benar nol

  const keep = Math.min(frac.length, firstSignificant + significantDigits);
  const cut = frac.slice(0, Math.max(keep, maxFractionDigits)).replace(/0+$/, '');
  return cut.length > 0 ? `${sign}0.${cut}` : '0';
}

/** UsdAmount (2 desimal, sudah didesimalkan API) → "$1,199.94". */
export function formatUsd(amountUsd: UsdAmount | null, fallback = '—'): string {
  if (amountUsd === null || amountUsd === undefined) return fallback;
  const [whole = '0', frac = '00'] = amountUsd.split('.');
  const neg = whole.startsWith('-');
  const body = groupThousands(neg ? whole.slice(1) : whole);
  return `${neg ? '-' : ''}$${body}.${frac.padEnd(2, '0').slice(0, 2)}`;
}

/**
 * UsdPrice (6 desimal) → "$0.999949" / "$2,469.25".
 *
 * Formatter TERPISAH dari formatUsd, dan itu bukan kerapian: dua desimal
 * membuat USDC $0,99994916 terbaca "$0.99" — tak terbedakan dari $0,99,
 * selisih 1% pada aset yang seluruh gunanya menempel di $1.
 */
export function formatUsdPrice(price: UsdPrice | null, fallback = '—'): string {
  if (price === null || price === undefined) return fallback;
  const [whole = '0', frac = ''] = price.split('.');
  const grouped = groupThousands(whole);
  // Harga besar tidak butuh presisi mikro; harga di bawah $10 justru hidup di sana.
  const digits = BigInt(whole) >= 10n ? 2 : 6;
  const cut = frac.slice(0, digits).replace(/0+$/, '');
  return cut.length > 0 ? `$${grouped}.${cut}` : `$${grouped}`;
}

/** bps integer → "150.00%". Sumber kebenaran rasio selalu bps, bukan pecahan. */
export function formatBps(bps: number, fractionDigits = 2): string {
  return `${(bps / 100).toFixed(fractionDigits)}%`;
}

/** bps → "150%" tanpa desimal, untuk rasio kolateral yang selalu bulat. */
export function formatRatio(bps: number): string {
  return `${Math.round(bps / 100)}%`;
}

/**
 * healthFactorBps → "1.83". `null` berarti tidak punya utang, dan itu BUKAN
 * kesehatan tak terhingga yang perlu ditampilkan sebagai angka raksasa.
 */
export function formatHealthFactor(bps: number | null, fallback = '—'): string {
  if (bps === null) return fallback;
  return (bps / 10_000).toFixed(2);
}

export function shortenAddress(address: Address | string, chars = 4): string {
  if (address.length < 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function shortenHex(hex: Hex | string, chars = 6): string {
  if (hex.length < 2 + chars * 2) return hex;
  return `${hex.slice(0, 2 + chars)}…${hex.slice(-chars)}`;
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/** unix detik → "3 minutes ago". */
export function formatRelativeTime(unixSeconds: number, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = unixSeconds - Math.floor(now / 1000);
  for (const [unit, secs] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= secs || unit === 'second') {
      return rtf.format(Math.round(diff / secs), unit);
    }
  }
  return rtf.format(0, 'second');
}

/** Durasi detik → "8m 12s" / "2h 5m". Untuk lag dan umur bukti. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Bilangan bulat biasa (jumlah fakta, tinggi blok) → "25,837,270". */
export function formatCount(n: number): string {
  return groupThousands(String(Math.trunc(n)));
}
