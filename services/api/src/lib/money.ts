/**
 * Aritmetika uang, tanpa satu pun dependensi pada RPC, database, atau env.
 *
 * Dipisahkan dari `chain.ts` dan `mappers.ts` supaya bisa diuji: `chain.ts`
 * membangun provider dan memuat SDK Attestcoin saat diimpor, jadi apa pun yang
 * mengimpornya untuk satu fungsi murni ikut menyeret seluruh konfigurasi
 * jaringan — dan tes yang butuh `.env` adalah tes yang tidak akan jalan di CI.
 *
 * Semua nilai uang di sini `bigint`. `number` kehilangan presisi di atas
 * 2^53, dan uint256 melewatinya jauh sebelum jumlah yang tidak masuk akal.
 */

/** Indeks bunga diskalakan WAD (1e18), sama seperti EfficiencyMarket. */
export const WAD = 10n ** 18n;

export function scaledToActual(scaled: bigint, index: bigint): bigint {
  return index === 0n ? 0n : (scaled * index) / WAD;
}

/** Nilai WAD → string desimal USD dengan 2 angka di belakang koma. */
export function wadToUsd(wad: bigint): string {
  const cents = (wad * 100n) / WAD;
  return centsToString(cents);
}

/**
 * Presisi untuk HARGA, bukan untuk jumlah uang.
 *
 * Dua desimal cukup untuk menyatakan berapa dolar sesuatu bernilai, tapi tidak
 * cukup untuk menyatakan berapa harga satu unitnya. Harga USDC mainnet yang
 * dibuktikan adalah $0,99994916; dipotong ke dua desimal ia menjadi `"0.99"` —
 * tidak bisa dibedakan dari $0,99000000, yaitu selisih 1% pada aset yang
 * seluruh gunanya adalah menempel di $1.
 *
 * Enam desimal memisahkan keduanya dengan jelas dan masih terbaca wajar untuk
 * aset mahal (`2469.250000`). Nilai persisnya selalu tersedia sebagai `answer`
 * + `decimals` di `/v1/prices`; ini bentuk untuk dibaca manusia.
 */
const PRICE_DECIMALS = 6n;

/**
 * Nilai WAD → string harga USD dengan enam desimal.
 *
 * Memotong, tidak membulatkan — sama seperti seluruh formatter di file ini.
 * Pada enam desimal galatnya 1e-6 dolar, dan satu mode pembulatan untuk semua
 * jalur lebih mudah dipercaya daripada dua mode yang berbeda tipis.
 */
export function wadToUsdPrice(wad: bigint): string {
  const scale = 10n ** PRICE_DECIMALS;
  const units = (wad * scale) / WAD;
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const body = `${abs / scale}.${(abs % scale).toString().padStart(Number(PRICE_DECIMALS), '0')}`;
  return negative ? `-${body}` : body;
}

/**
 * Nilai USD dalam WAD dari sejumlah token dan harga Chainlink.
 *
 * Mengembalikan `0n` kalau tidak ada harga terbukti — bukan tebakan, bukan
 * fallback ke oracle lain. Nol yang jujur bisa ditelusuri; angka yang dikarang
 * tidak, dan tidak ada gejalanya di UI.
 */
export function usdOf(
  amount: bigint,
  decimals: number,
  price: { answer: string | null; priceDecimals: number | null } | undefined,
): bigint {
  if (!price?.answer || price.priceDecimals === null) return 0n;
  return (
    (amount * BigInt(price.answer) * WAD) /
    (10n ** BigInt(decimals) * 10n ** BigInt(price.priceDecimals))
  );
}

/**
 * Jumlah token → string USD, atau `null` kalau harganya belum terbukti.
 *
 * `null`, bukan `"0.00"`. Keduanya terlihat mirip di UI tapi artinya berlawanan:
 * yang satu "belum ada harga terbukti untuk aset ini", yang lain "aset ini
 * bernilai nol dolar".
 */
export function toUsd(
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
    return centsToString(cents);
  } catch {
    return null;
  }
}

/**
 * Sen → "123.45". Ditulis manual, bukan lewat pembagian float: nilai USD di
 * sini bisa melewati 2^53 (satu whale Aave saja sudah cukup), dan `Number`
 * akan membulatkannya diam-diam.
 */
function centsToString(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const body = `${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
  return negative ? `-${body}` : body;
}
