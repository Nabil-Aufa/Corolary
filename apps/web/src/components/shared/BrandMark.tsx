import { cn } from '@/lib/utils';

/**
 * Penanda visual untuk protokol dan aset.
 *
 * Warnanya diambil dari palet merek masing-masing, tapi BENTUKNYA bukan logo
 * resmi — menggambar ulang logo Aave atau Morpho dari ingatan menghasilkan
 * logo yang salah, dan logo yang salah lebih buruk daripada tidak ada logo.
 * Kalau file SVG resminya tersedia, taruh di `public/logos/` dan komponen ini
 * yang menggantinya; sampai saat itu, inisial berwarna merek sudah memberi
 * pembeda yang sama cepatnya untuk dipindai mata.
 */
const BRAND_COLORS: Record<string, string> = {
  // Protokol
  'aave v3': '#B6509E',
  'morpho blue': '#2E5CF5',
  'compound v3': '#00D395',
  sparklend: '#F5A623',
  spark: '#F5A623',
  // Aset
  usdc: '#2775CA',
  usdt: '#26A17B',
  weth: '#627EEA',
  eth: '#627EEA',
  weeth: '#4C6FE8',
  wsteth: '#00A3FF',
  wbtc: '#F7931A',
  cbbtc: '#F7931A',
  dai: '#F5AC37',
  gho: '#9E8FD8',
  usde: '#4C4C4C',
  susde: '#6B6B6B',
  usds: '#1AAB9B',
};

/** Warna cadangan yang stabil untuk aset yang belum terdaftar. */
function fallbackColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 48%)`;
}

export function BrandMark({
  name,
  size = 22,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const key = name.toLowerCase().trim();
  const color = BRAND_COLORS[key] ?? fallbackColor(key);
  // Dua huruf untuk simbol pendek (BTC), satu untuk nama panjang (Aave V3).
  const initials = key.length <= 4 ? name.slice(0, 2).toUpperCase() : name.slice(0, 1).toUpperCase();

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        color: '#fff',
        fontSize: size * (initials.length > 1 ? 0.38 : 0.46),
        fontWeight: 600,
        letterSpacing: '-0.02em',
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
