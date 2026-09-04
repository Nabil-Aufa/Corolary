import { cn } from '@/lib/utils';

/**
 * Penanda visual untuk protokol dan aset.
 *
 * Keduanya memakai logo RESMI yang disalin ke `public/logos/` — menggambar
 * ulang logo dari ingatan menghasilkan logo yang salah, dan logo yang salah
 * lebih buruk daripada tidak ada logo. Nama yang belum punya berkas (token
 * Pendle PT, aset ekor panjang) jatuh ke inisial berwarna, yang memberi
 * pembeda sama cepatnya untuk dipindai mata.
 *
 * Berkas protokol diambil dari situs masing-masing:
 *   aave.svg      https://app.aave.com/icons/tokens/aave.svg
 *   morpho.svg    https://cdn.morpho.org/assets/logos/morpho.svg
 *   spark.svg     https://app.spark.fi/favicon.svg
 *   compound.png  https://compound.finance/images/compound-512.png
 *
 * Berkas token diambil dari tiga sumber, urut prioritas: set ikon Aave
 * (SVG, per-simbol), TrustWallet dan CoinGecko (PNG, per-ALAMAT-kontrak).
 * Yang per-alamat lebih dipercaya karena simbol bisa bertabrakan; set Aave
 * juga menyajikan ikon PLACEHOLDER "$ dalam lingkaran" untuk token yang tidak
 * ia punya artnya — bukan 404 — jadi status 200 saja tidak cukup, tiap ikon
 * harus dilihat. sUSDe dan USDtb sempat kena placeholder itu.
 *
 * WETH dan ETH sengaja dibedakan. Logo WETH resmi adalah wordmark (cincin
 * hitam-pink bertuliskan "WETH"), disepakati set Aave maupun CoinGecko lewat
 * alamat kontrak; TrustWallet yang menyimpang dengan memakai wajik ETH.
 * Wordmark itu padat di 22px, tapi WETH memang token yang berbeda dari ETH —
 * memberi keduanya wajik yang sama membuat perbedaan itu hilang dari mata.
 */
const PROTOCOL_LOGOS: Record<string, string> = {
  'aave v3': '/logos/aave.svg',
  'morpho blue': '/logos/morpho.svg',
  'compound v3': '/logos/compound.png',
  sparklend: '/logos/spark.svg',
  spark: '/logos/spark.svg',
};

/** Logo protokol yang berupa glif transparan, bukan lingkaran penuh. */
const GLYPH_PROTOCOLS = new Set(['compound v3', 'sparklend', 'spark']);

const TOKEN_LOGOS: Record<string, string> = {
  aave: '/logos/tokens/aave.svg',
  ausd: '/logos/tokens/ausd.svg',
  carrytradeusdtryleverage: '/logos/tokens/carrytradeusdtryleverage.png',
  cbbtc: '/logos/tokens/cbbtc.svg',
  dai: '/logos/tokens/dai.svg',
  ebtc: '/logos/tokens/ebtc.svg',
  eth: '/logos/tokens/eth.svg',
  eurc: '/logos/tokens/eurc.svg',
  gho: '/logos/tokens/gho.svg',
  kbtc: '/logos/tokens/kbtc.svg',
  lbtc: '/logos/tokens/lbtc.svg',
  ldo: '/logos/tokens/ldo.svg',
  link: '/logos/tokens/link.svg',
  morpho: '/logos/tokens/morpho.png',
  musd: '/logos/tokens/musd.svg',
  oseth: '/logos/tokens/oseth.svg',
  pyusd: '/logos/tokens/pyusd.svg',
  reth: '/logos/tokens/reth.svg',
  rlusd: '/logos/tokens/rlusd.svg',
  rseth: '/logos/tokens/rseth.svg',
  spx: '/logos/tokens/spx.png',
  spyon: '/logos/tokens/spyon.png',
  susdat: '/logos/tokens/susdat.png',
  susde: '/logos/tokens/susde.png',
  susds: '/logos/tokens/susds.png',
  syrupusdt: '/logos/tokens/syrupusdt.svg',
  tbtc: '/logos/tokens/tbtc.svg',
  uni: '/logos/tokens/uni.svg',
  usdc: '/logos/tokens/usdc.svg',
  usde: '/logos/tokens/usde.svg',
  usdg: '/logos/tokens/usdg.svg',
  usds: '/logos/tokens/usds.svg',
  usdt: '/logos/tokens/usdt.svg',
  usdtb: '/logos/tokens/usdtb.png',
  wbtc: '/logos/tokens/wbtc.svg',
  weeth: '/logos/tokens/weeth.svg',
  weth: '/logos/tokens/weth.svg',
  wsteth: '/logos/tokens/wsteth.svg',
  xaut: '/logos/tokens/xaut.svg',
};

/** Warna cadangan yang stabil untuk nama yang belum punya berkas logo. */
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
  const src = PROTOCOL_LOGOS[key] ?? TOKEN_LOGOS[key];

  if (src) {
    // Glif transparan diberi cakram latar dan sedikit jarak supaya sebaris
    // dengan logo yang bentuk aslinya memang sudah lingkaran penuh.
    const glyph = GLYPH_PROTOCOLS.has(key);
    const inner = glyph ? Math.round(size * 0.64) : size;
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
          glyph && 'bg-surface-raised ring-1 ring-border ring-inset',
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- aset statis
            berukuran tetap; next/image tidak menambah apa pun di 24px dan SVG
            butuh `dangerouslyAllowSVG`. */}
        <img src={src} alt="" width={inner} height={inner} aria-hidden="true" />
      </span>
    );
  }

  const color = fallbackColor(key);
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
