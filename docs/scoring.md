# Corolary — Spesifikasi Algoritma Credit Scoring

> Dokumen ini menurunkan detail dari `docs/architecture.md` §8 (model data Fact,
> tipe `ScoreComponent`/`CreditScore`, tabel tier). Kalau ada konflik soal bentuk
> data, `docs/architecture.md` yang menang. Dokumen ini mengunci **cara skor
> itu sendiri dihitung** — sesuatu yang architecture.md sengaja menyerahkan ke sini.
>
> Pemilik: Dev A. Prasyarat baca: `docs/architecture.md` §8, `docs/attestcoin-research.md` §2.1
> (fakta yang bisa dibuktikan adalah **transaksi**, bukan **state** — ini membentuk
> hampir semua kompromi desain di dokumen ini).

---

## 0. Asumsi eksplisit yang dikunci di sini

`docs/architecture.md` mengunci struct `Fact` tapi tidak mengunci semantik persis
field `amount` untuk setiap `FactKind` di setiap protokol. Karena scoring bergantung
mutlak pada semantik ini, asumsi berikut **dikunci di dokumen ini** dan harus
dipatuhi oleh `docs/contracts.md` (adapter) agar konsisten:

| FactKind | `amount` berarti |
|---|---|
| `LoanOriginated` (0) | Jumlah pokok yang dipinjam (native units `asset`) — `Borrow.amount` (Aave), setara di Morpho/Compound |
| `LoanRepaid` (1) | Jumlah yang dilunasi (native units `asset`) — `Repay.amount` (Aave) |
| `Liquidated` (2) | **`debtToCover`** — jumlah utang yang dilunasi paksa oleh likuidator (native units `asset` = token utang), **bukan** `liquidatedCollateralAmount`. Dipilih karena ini representasi paling langsung dari "seberapa besar kegagalan finansial" subjek. |
| `CollateralSupplied` (3) | Jumlah kolateral yang disetor |
| `CollateralWithdrawn` (4) | Jumlah kolateral yang ditarik |

Jika `docs/contracts.md` mengunci konvensi adapter yang berbeda untuk `Liquidated`,
dokumen itu harus diperbarui bersamaan dengan dokumen ini — jangan biarkan keduanya
diam-diam berbeda, karena itu meracuni `liquidationPenalty` secara diam-diam.

---

## 1. Unit dan representasi fixed-point

Solidity `^0.8.28`, **tanpa floating point** sama sekali. Tiga unit dipakai,
masing-masing dengan alasan berbeda — jangan dicampur tanpa konversi eksplisit lewat
`Math.mulDiv` (OpenZeppelin v5):

| Unit | Basis | Dipakai untuk | Kenapa |
|---|---|---|---|
| **WAD** | `1e18` | Nilai USD, faktor pembobotan (0..1e18 = 0%..100%), harga | Konsisten dengan konvensi desimal-18 ERC-20 dan library fixed-point Solidity umum (Solmate/PRBMath). Presisi lebih dari cukup untuk nilai finansial. |
| **Poin polos (integer biasa)** | tanpa basis | `ScoreComponent.points`, skor total 0..1000 | `ScoreComponent.points` di `packages/shared/src/types.ts` bertipe `number` polos — bukan nilai fixed-point yang diekspos ke luar. Poin selalu bilangan bulat kecil, presisi pecahan tidak berguna di lapisan ini. |
| **bps (basis point)** | `1e4` | `collateralRatioBps` | Sudah dikunci di `docs/architecture.md` §8.3 (`15000 = 150%`). Dipertahankan apa adanya. |

Aturan konversi: semua perhitungan **internal** (volume USD, faktor durasi, faktor
severity, faktor diversity) berjalan di WAD. Hasil akhir tiap komponen di-*round down*
(floor, lewat pembagian integer) menjadi poin polos sebelum disimpan/ditampilkan.
Tidak pernah ada pembagian dengan pembilang lebih kecil dari penyebut sebelum
perkalian — selalu kalikan dulu, baru bagi (`Math.mulDiv`), untuk menghindari
kehilangan presisi dan overflow diam-diam.

```solidity
// packages/contracts/src/libraries/ScoreMath.sol
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

library ScoreMath {
    uint256 internal constant WAD = 1e18;

    /// @notice Kurva saturasi rasional: points = maxPoints * value / (value + half).
    /// @dev `value` dan `half` harus dalam basis yang sama (keduanya WAD, atau
    ///      keduanya unit polos seperti "jumlah fakta") — rasio membatalkan basis,
    ///      jadi hasil selalu benar selama keduanya konsisten.
    ///      Solidity 0.8 mengecek overflow otomatis pada `value + half`; untuk
    ///      input sebesar apa pun yang realistis (uint256, dibatasi supply token
    ///      nyata) ini tidak pernah overflow dalam praktik.
    function saturating(uint256 value, uint256 half, uint256 maxPoints)
        internal
        pure
        returns (uint256)
    {
        if (value == 0) return 0;
        return Math.mulDiv(maxPoints, value, value + half);
    }

    function clampInt(int256 x, int256 lo, int256 hi) internal pure returns (int256) {
        if (x < lo) return lo;
        if (x > hi) return hi;
        return x;
    }

    function minU(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function maxU(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
}
```

**Kenapa kurva saturasi rasional `M·x/(x+K)`, bukan logaritma literal?**
Semua enam komponen butuh "diminishing returns" (peminjam ke-2 tidak boleh
menggandakan skor peminjam ke-1) — pola ini biasanya didekati dengan `log(x)`.
Tapi `log2` presisi-tetap di Solidity butuh aproksimasi bit-shift + interpolasi
pecahan yang sulit diaudit dan rawan galat lepas-batas di tepi rentang. Kurva
`M·x/(x+K)` memberi bentuk kualitatif yang sama (naik cepat di awal, melandai,
mendekati batas atas tanpa pernah benar-benar menyentuhnya kecuali di-`clamp`)
dengan aritmetika **eksak** — hanya perkalian dan pembagian bulat, tidak ada
aproksimasi, gampang diverifikasi manual, dan satu primitif (`saturating`) dipakai
ulang di 4 dari 6 komponen sehingga auditor hanya perlu memahami satu fungsi.
`K` ("titik separuh-maksimum": skor = `maxPoints/2` saat `value == K`) adalah
parameter yang bisa dikalibrasi ulang oleh governance tanpa mengubah bentuk kurva.

---

## 2. Normalisasi nilai USD (PriceRegistry)

Semua jumlah pinjaman datang dalam token asli (`asset`) dengan desimal berbeda-beda
(USDC=6, WBTC=8, DAI=18, dst). `PriceRegistry.sol` menyimpan harga yang **dibuktikan**
dari event Chainlink `AnswerUpdated` di Ethereum mainnet (lihat `architecture.md` §11
— tanpa oracle terpusat), diproses oleh `ChainlinkAdapter`.

```solidity
struct PriceInfo {
    int256  answer;         // raw Chainlink answer, > 0 (feed yang dipakai selalu positif)
    uint8   answerDecimals; // 8 untuk semua feed yang terdaftar saat ini
    uint8   assetDecimals;  // disimpan saat registrasi asset, TIDAK dipanggil live via decimals()
    uint64  updatedAt;      // observedAt (waktu Ethereum) dari fakta AnswerUpdated sumber
    bytes32 factId;         // penelusuran ke bukti
}

mapping(address => PriceInfo) public prices; // asset => harga terbukti terakhir

uint256 public constant MAX_PRICE_AGE = 24 hours;
```

`assetDecimals` **disimpan saat registrasi**, bukan dipanggil live lewat
`IERC20Metadata.decimals()` — memanggil kontrak eksternal di jalur baca skor
membuka permukaan risiko (token nakal yang revert atau mengembalikan nilai aneh
bisa merusak seluruh perhitungan skor). `MAX_PRICE_AGE = 24 jam` dipilih selaras
dengan heartbeat umum feed Chainlink yang dipakai (deviation-triggered dengan
heartbeat pengaman ~24 jam), dengan margin untuk lag attestation Attestcoin (~8 menit).

```solidity
interface IPriceRegistry {
    /// @return amountUsd1e18 nilai USD dalam WAD; 0 bila priceAvailable == false
    /// @return priceAvailable false bila belum pernah ada harga terbukti untuk
    ///         asset ini, ATAU harga terakhir lebih tua dari MAX_PRICE_AGE
    function toUsd1e18(address asset, uint256 amount)
        external view returns (uint256 amountUsd1e18, bool priceAvailable);
}

function toUsd1e18(address asset, uint256 amount)
    external view returns (uint256 amountUsd1e18, bool priceAvailable)
{
    PriceInfo storage p = prices[asset];
    if (p.updatedAt == 0) return (0, false);
    if (block.timestamp - p.updatedAt > MAX_PRICE_AGE) return (0, false);

    // dua langkah mulDiv agar tidak overflow: (amount * answer) bisa > 2^256
    // kalau dikalikan sekaligus dengan 1e18 dalam satu langkah untuk token bernilai besar.
    uint256 interim = Math.mulDiv(amount, uint256(p.answer), 10 ** p.assetDecimals);
    amountUsd1e18 = Math.mulDiv(interim, 1e18, 10 ** p.answerDecimals);
    priceAvailable = true;
}
```

**Contoh perhitungan nyata:** 1,5 WBTC (8 desimal → `amount = 150_000_000`),
harga BTC/USD terbukti `7726182000000` (8 desimal, dari tabel `architecture.md` §11
→ $77.261,82):

```
interim        = 150_000_000 * 7_726_182_000_000 / 10^8
              = 11_589_273_000_000_000  (dalam satuan "answer", masih 8 desimal harga)
amountUsd1e18  = interim * 1e18 / 10^8
              = 115_892_730_000_000_000_000_000  (WAD)
              = $115.892,73
```
(1,5 × 77.261,82 = 115.892,73 — cocok, tanpa kehilangan presisi berarti.)

**Penanganan harga tidak tersedia — aturan asimetris, disengaja:**

> **Data yang hilang tidak boleh pernah MENGUNTUNGKAN subjek, boleh MERUGIKAN.**

- Komponen yang **menambah** skor (`repaymentVolume`, faktor severity di
  `liquidationPenalty` yang justru **mengurangi** — lihat di bawah, ini kasus
  terbalik yang disengaja) memakai `amountUsd = 0` saat harga tidak tersedia.
  Efeknya: fakta tetap tercatat (mempengaruhi `factCount`, `historyDuration`,
  `activeStanding`), tapi tidak menyumbang volume USD yang tak terverifikasi.
- Komponen `liquidationPenalty` melakukan **kebalikannya**: saat harga tidak
  tersedia, `severityFactor` diasumsikan **maksimum (1e18)** — kasus terburuk,
  bukan nol. Alasannya sama persis: jangan biarkan data yang hilang mengurangi
  hukuman. Lihat §3.4.
- `repaymentCount`, `historyDuration`, `protocolDiversity` tidak bergantung pada
  harga sama sekali — sengaja dirancang begitu (lihat §3.2, §3.3, §3.5) sehingga
  kegagalan `PriceRegistry` hanya membatasi blast-radius ke 2 dari 6 komponen.

---

## 3. Enam komponen skor

Ringkasan cepat:

| Komponen | Poin | Input FactKind | Bentuk kurva |
|---|---|---|---|
| `repaymentVolume` | 0..300 | `LoanRepaid` (+ `LoanOriginated` untuk faktor durasi) | Saturasi rasional atas volume USD **terbobot** |
| `repaymentCount` | 0..200 | `LoanRepaid` | Saturasi rasional atas hitungan pelunasan bermateri |
| `historyDuration` | 0..200 | fakta apa pun (dipakai `firstFactAt`) | Saturasi rasional atas usia riwayat (hari) |
| `liquidationPenalty` | -300..0 | `Liquidated` | Jumlah konveks per kejadian × severity |
| `protocolDiversity` | 0..100 | fakta apa pun (protokol sumber) | Linear dengan batas atas |
| `activeStanding` | 0..200 | fakta apa pun (recency) + `Liquidated` (standing) | Ramp linear dua bagian |

Total maksimum lima komponen positif = `300+200+200+100+200 = 1000` — sengaja
persis 1000, sehingga `liquidationPenalty` murni mengurangi dari kondisi "sempurna",
tidak pernah butuh renormalisasi.

### 3.1 `repaymentVolume` (0..300)

**Fakta input:** semua `LoanRepaid` milik subjek (lintas semua protokol terdaftar).

**Masalah yang harus diselesaikan sebelum sekadar menjumlah USD:** menjumlah
`amountUsd` mentah bisa digembungkan lewat *wash-history* — pinjam-lunas cepat
berulang untuk mendaur-ulang modal yang sama tanpa risiko nyata (lihat §6 untuk
analisis kuantitatif penuh). Karena itu `repaymentVolume` **tidak** memakai
`amountUsd` mentah, melainkan **volume terbobot**:

```
w_i = amountUsd_i × durationFactor_i × counterpartyDiversityFactor(subject)
V   = Σ w_i   (akumulasi seumur hidup, monoton naik)

repaymentVolume = saturating(V, K_VOLUME, 300)
```

di mana:
- `amountUsd_i` — modal-berisiko riil pada pelunasan ke-`i` (dari §2).
- `durationFactor_i ∈ [0, 1e18]` — seberapa lama posisi pinjaman itu benar-benar
  terbuka, dihitung dari `LoanOriginated` yang berpasangan (§6.1, §8).
- `counterpartyDiversityFactor(subject) ∈ [0.5e18, 1e18]` — seberapa beragam jejak
  protokol+aset subjek (§6.1), dihitung ulang di setiap pelunasan dari state
  *saat itu*.
- `K_VOLUME = 50.000 USD` (WAD) — dipilih agar borrower ritel DeFi (puluhan
  ribu dolar kumulatif) sudah mendapat kenaikan poin berarti, sementara whale
  institusional (jutaan dolar) tidak otomatis memonopoli skor.

**Kenapa saturasi, bukan linear murni:** linear murni berarti satu pinjaman
$10 juta memberi skor 200x lebih tinggi dari pinjaman $50rb — tidak mencerminkan
"seberapa terbukti" seseorang, hanya "seberapa kaya". Saturasi memastikan bukti
berulang dalam jumlah wajar lebih berharga daripada satu transaksi raksasa.

**Implementasi Solidity** (dipanggil dari `applyFact`, lihat §8 untuk konteks state penuh):

```solidity
uint256 constant K_VOLUME_USD_1E18 = 50_000 * 1e18;
uint256 constant MIN_MATERIAL_USD_1E18 = 10 * 1e18;

function _applyLoanRepaid(SubjectState storage s, Fact calldata f, IPriceRegistry priceRegistry)
    internal
{
    (uint256 amountUsd, ) = priceRegistry.toUsd1e18(f.asset, f.amount); // 0 bila harga tak tersedia

    bytes32 key = keccak256(abi.encodePacked(f.protocol, f.asset));
    uint64 openedAt = s.openLoanOriginatedAt[key];
    uint256 durationFactor = openedAt == 0
        ? 1e18 // posisi dibuka sebelum Corolary mulai mengindeks — beri keuntungan keraguan
        : ScoreMath.minU(1e18, (uint256(f.observedAt - openedAt) * 1e18) / (MIN_MEANINGFUL_DAYS * 1 days));

    uint256 diversityFactor = _counterpartyDiversityFactor(s);
    uint256 w = Math.mulDiv(Math.mulDiv(amountUsd, durationFactor, 1e18), diversityFactor, 1e18);

    s.weightedRepaidUsd1e18 += w;
    if (amountUsd >= MIN_MATERIAL_USD_1E18) {
        s.qualifyingRepaymentCount += 1;
    }
    s.lastPositiveFactAt = f.observedAt;
}
```

**TypeScript pendamping** (untuk mirroring off-chain di indexer/API — lihat §8 untuk
alasan kenapa API perlu mereplikasi ini):

```typescript
// packages/shared/src/scoring/repaymentVolume.ts
export const K_VOLUME_USD_WAD = 50_000n * 10n ** 18n;

export function saturating(valueWad: bigint, halfWad: bigint, maxPoints: number): number {
  if (valueWad === 0n) return 0;
  return Number((BigInt(maxPoints) * valueWad) / (valueWad + halfWad));
}

export function repaymentVolumePoints(weightedRepaidUsdWad: bigint): number {
  return saturating(weightedRepaidUsdWad, K_VOLUME_USD_WAD, 300);
}
```

**Contoh perhitungan konkret:**

| V (volume terbobot, USD) | `300·V/(V+50.000)` | Poin |
|---|---|---|
| 5.000 | 300×5.000/55.000 = 27,27 | 27 |
| 50.000 | 300×50.000/100.000 = 150,00 | 150 |
| 180.000 | 300×180.000/230.000 = 234,78 | 234 |
| 500.000 | 300×500.000/550.000 = 272,73 | 272 |
| 1.000.000 | 300×1.000.000/1.050.000 = 285,71 | 285 |

### 3.2 `repaymentCount` (0..200)

**Fakta input:** `LoanRepaid` yang "bermateri" — `amountUsd_i ≥ MIN_MATERIAL_USD (10 USD)`.
Ambang ini murni untuk mencegah *spam* hitungan lewat ribuan pelunasan receh
(bukan pertahanan wash utama — pertahanan wash utama ada di §3.1/§6 lewat pembobotan
volume; ambang ini hanya menjaga `repaymentCount` sendiri tidak trivial digembungkan
tanpa modal berarti sama sekali).

```
N = jumlah LoanRepaid bermateri (kumulatif, seumur hidup)
repaymentCount = saturating(N, K_COUNT, 200),   K_COUNT = 12
```

**Kenapa saturasi juga di sini:** frekuensi pelunasan yang genap adalah sinyal
kuat perilaku baik berulang, tapi manfaat marjinal pelunasan ke-500 dibanding
ke-499 seharusnya nyaris nol — orang dengan 12 pelunasan bersih sudah menunjukkan
pola yang jelas.

```solidity
uint256 constant K_COUNT = 12;

function repaymentCountPoints(uint32 qualifyingCount) internal pure returns (uint256) {
    return ScoreMath.saturating(uint256(qualifyingCount) * 1e18, K_COUNT * 1e18, 200);
}
```

```typescript
export function repaymentCountPoints(qualifyingCount: number): number {
  return saturating(BigInt(qualifyingCount) * 10n ** 18n, 12n * 10n ** 18n, 200);
}
```

**Contoh perhitungan konkret:**

| N (pelunasan bermateri) | Poin |
|---|---|
| 5 | 200×5/17 = 58,8 → 58 |
| 12 | 200×12/24 = 100,0 → 100 |
| 30 | 200×30/42 = 142,8 → 142 |
| 100 | 200×100/112 = 178,5 → 178 |

### 3.3 `historyDuration` (0..200)

**Fakta input:** `firstFactAt` — `observedAt` (waktu blok Ethereum, **bukan**
`recordedAt` di Creditcoin) dari fakta paling awal milik subjek, jenis apa pun.
Memakai `observedAt` penting: ini merefleksikan kedalaman riwayat ekonomi nyata,
bukan seberapa cepat indexer kebetulan mengejarnya.

```
durationDays    = (block.timestamp - firstFactAt) / 1 days
historyDuration = saturating(durationDays, K_DURATION_DAYS, 200),   K_DURATION_DAYS = 365
```

**Kenapa 365 hari sebagai titik separuh:** DeFi lending matang baru sejak ±2020
(Aave V2 Januari 2020) — riwayat realistis terpanjang saat ini ±6 tahun. `K=365`
membuat satu tahun penuh sudah bernilai 100 poin (separuh maksimum), sementara
enam tahun (2190 hari) hanya mencapai ~171 poin — tidak pernah benar-benar "penuh",
mencerminkan bahwa riwayat selalu bisa "lebih panjang lagi", bukan target yang
bisa dituntaskan.

```solidity
uint256 constant K_DURATION_DAYS = 365;

function historyDurationPoints(uint64 firstFactAt) internal view returns (uint256) {
    if (firstFactAt == 0) return 0;
    uint256 durationDays = (block.timestamp - firstFactAt) / 1 days;
    return ScoreMath.saturating(durationDays * 1e18, K_DURATION_DAYS * 1e18, 200);
}
```

```typescript
export function historyDurationPoints(firstFactAtUnix: number, nowUnix: number): number {
  if (firstFactAtUnix === 0) return 0;
  const durationDays = BigInt(Math.floor((nowUnix - firstFactAtUnix) / 86_400));
  return saturating(durationDays * 10n ** 18n, 365n * 10n ** 18n, 200);
}
```

**Contoh perhitungan konkret:**

| Usia riwayat | Poin |
|---|---|
| 180 hari | 200×180/545 = 66,05 → 66 |
| 365 hari (1 tahun) | 200×365/730 = 100,00 → 100 |
| 730 hari (2 tahun) | 200×730/1095 = 133,33 → 133 |
| 1.825 hari (5 tahun) | 200×1.825/2.190 = 166,66 → 166 |

### 3.4 `liquidationPenalty` (-300..0)

**Fakta input:** `Liquidated`. Ini satu-satunya komponen yang **mengurangi** skor.

Dua prinsip desain:
1. **Konveks terhadap frekuensi** — likuidasi ke-2 harus jauh lebih menyakitkan
   dari sekadar 2× likuidasi ke-1. Pemberi pinjaman nyata memandang peminjam
   yang berulang kali dilikuidasi sebagai risiko struktural, bukan kesialan sekali.
2. **Diskalakan oleh severity** — likuidasi parsial kecil (mis. akibat gejolak
   pasar sesaat) tidak boleh sehancur likuidasi besar yang melumat seluruh posisi.

```
severityFactor_i = amountUsd_i / (amountUsd_i + K_SEV)     jika harga tersedia
                  = 1e18 (maksimum)                          jika harga TIDAK tersedia — lihat §2

penalty_i = BASE_PENALTY_PTS × i × severityFactor_i     (i = urutan likuidasi ke-1,2,3,...
                                                           milik subjek ini, kumulatif seumur hidup)

liquidationPenalty = -min(300, Σ penalty_i)
```

`BASE_PENALTY_PTS = 40`, `K_SEV = 5.000 USD` (WAD).

**Kenapa dikalikan `i` (indeks urutan), bukan konstan:** ini yang membuat kurva
konveks murni lewat aritmetika bulat sederhana — tidak butuh pangkat atau `log`.
Likuidasi pertama yang parah (severityFactor≈1) hanya -40 poin (masih bisa
dipulihkan lewat riwayat baik lain); likuidasi keempat yang sama parahnya
menyumbang -160 poin sendiri, cukup untuk mendekati batas bawah -300 begitu
diakumulasi dengan tiga sebelumnya. Batas `min(300, ...)` memastikan tidak ada
underflow atau "skor negatif tak berujung" — setelah cukup banyak likuidasi
parah, komponen ini secara efektif habis dan likuidasi tambahan tidak lagi
menurunkan angka (kerusakan sudah maksimal, konsisten dengan realita bahwa
reputasi tidak bisa "lebih rusak dari nol").

```solidity
uint256 constant BASE_PENALTY_PTS = 40;
uint256 constant K_SEV_USD_1E18 = 5_000 * 1e18;

function _applyLiquidated(SubjectState storage s, Fact calldata f, IPriceRegistry priceRegistry) internal {
    (uint256 amountUsd, bool priceOk) = priceRegistry.toUsd1e18(f.asset, f.amount);

    s.liquidationCount += 1;
    uint256 severityFactor = priceOk
        ? Math.mulDiv(amountUsd, 1e18, amountUsd + K_SEV_USD_1E18)
        : 1e18; // harga tak tersedia -> asumsikan kasus terburuk, JANGAN kurangi hukuman

    uint256 penalty = (BASE_PENALTY_PTS * uint256(s.liquidationCount) * severityFactor) / 1e18;
    s.liquidationPenaltyPts += penalty; // akumulasi mentah, di-clamp saat dibaca (computeScore)
    s.lastLiquidationAt = f.observedAt;
}

function liquidationPenaltyPoints(uint256 cumulativePenaltyPts) internal pure returns (uint256) {
    return ScoreMath.minU(300, cumulativePenaltyPts);
}
```

```typescript
export function liquidationPenaltyPoints(cumulativePenaltyPts: number): number {
  return Math.min(300, cumulativePenaltyPts);
}
```

**Contoh perhitungan konkret** (satu subjek, empat likuidasi berurutan sepanjang riwayatnya):

| Likuidasi ke-`i` | amountUsd | severityFactor | `penalty_i = 40·i·severityFactor` | Kumulatif |
|---|---|---|---|---|
| 1 | $10.000 | 10.000/15.000 = 0,667 | 40×1×0,667 = 26,7 → 27 | -27 |
| 2 | $3.000 | 3.000/8.000 = 0,375 | 40×2×0,375 = 30,0 → 30 | -57 |
| 3 | $20.000 | 20.000/25.000 = 0,800 | 40×3×0,800 = 96,0 → 96 | -153 |
| 4 | $50.000 | 50.000/55.000 = 0,909 | 40×4×0,909 = 145,5 → 145 | -298 |
| 5+ (apa pun) | — | — | — | -300 (di-clamp) |

### 3.5 `protocolDiversity` (0..100)

**Fakta input:** alamat `protocol` (sumber) dari **semua** fakta milik subjek,
jenis apa pun.

```
D = jumlah alamat protokol berbeda yang pernah muncul di fakta subjek
protocolDiversity = min(100, D × 100 / TARGET_DIVERSITY_PROTOCOLS),   TARGET_DIVERSITY_PROTOCOLS = 4
```

**Kenapa linear, bukan saturasi/log seperti komponen lain:** domain di sini kecil
dan diskret — saat ini maksimal realistis 3–5 protokol terdaftar (`AaveV3Adapter`,
`MorphoBlueAdapter`, `CompoundV3Adapter`, berpotensi bertambah). Pada domain
sekecil ini, tidak ada "diminishing returns" yang berarti untuk didekati dengan
kurva cekung — pembeda 1-lawan-2 protokol sama pentingnya secara kualitatif
dengan 3-lawan-4. Kurva log/saturasi hanya akan menambah kerumitan tanpa
manfaat nyata di rentang nilai ini.

```solidity
uint256 constant TARGET_DIVERSITY_PROTOCOLS = 4;

function _popcount8(uint8 x) internal pure returns (uint256 c) {
    for (; x != 0; x &= x - 1) { c++; }
}

function protocolDiversityPoints(uint8 protocolBitmap) internal pure returns (uint256) {
    uint256 d = _popcount8(protocolBitmap);
    uint256 pts = (d * 100) / TARGET_DIVERSITY_PROTOCOLS;
    return ScoreMath.minU(100, pts);
}
```

```typescript
export function protocolDiversityPoints(distinctProtocolCount: number): number {
  return Math.min(100, Math.floor((distinctProtocolCount * 100) / 4));
}
```

**Contoh perhitungan konkret:**

| D (protokol berbeda) | Poin |
|---|---|
| 1 | 25 |
| 2 | 50 |
| 3 | 75 |
| 4 | 100 |
| 5 | 100 (di-clamp) |

### 3.6 `activeStanding` (0..200)

**Fakta input:** `lastPositiveFactAt` (waktu `LoanOriginated`/`LoanRepaid`/
`CollateralSupplied` paling baru — **bukan** `Liquidated`, karena itu bukan
sinyal keterlibatan positif) dan `lastLiquidationAt`.

Komponen ini dipecah menjadi dua sub-bagian 100 poin, menjawab dua pertanyaan
berbeda:

**(a) Recency — "apakah subjek masih aktif di pasar kredit nyata sekarang?"**
```
recencyDays = (now - lastPositiveFactAt) / 1 days
recencyPts  = 100                                            jika recencyDays ≤ 90
            = 0                                              jika recencyDays ≥ 720
            = 100 × (720 - recencyDays) / (720 - 90)          selainnya (interpolasi linear)
```

**(b) Standing — "apakah subjek sedang tidak dalam masa pemulihan pasca-likuidasi?"**
```
daysSinceLastLiquidation = tak berhingga jika belum pernah dilikuidasi, else (now - lastLiquidationAt)/1 days
standingPts = 100                                             jika tak pernah dilikuidasi ATAU daysSince ≥ 365
            = 100 × daysSinceLastLiquidation / 365             selainnya

activeStanding = recencyPts + standingPts
```

**Kenapa dua ramp linear, bukan biner atau saturasi:** ini **satu-satunya**
komponen yang sengaja sensitif terhadap waktu berjalan (lihat §7 untuk keputusan
peluruhan skor secara keseluruhan) — perannya memang mengukur "kondisi terkini",
bukan akumulasi historis seperti lima komponen lain. Linear dipilih (bukan
saturasi) karena kita ingin transisi yang bisa diprediksi dan simetris:
"90 hari absen belum masalah, 720 hari absen dianggap tidak aktif lagi" adalah
ambang yang mudah dijelaskan ke pengguna di UI, dan `standingPts` memberi jalan
pulih yang jelas — bukan pemutihan instan pasca-likuidasi (butuh 365 hari penuh
tanpa likuidasi baru untuk pulih 100%), tapi juga bukan hukuman permanen (beda
dengan `liquidationPenalty` yang memang permanen — lihat §7).

```solidity
uint256 constant RECENCY_FULL_DAYS = 90;
uint256 constant RECENCY_ZERO_DAYS = 720;
uint256 constant STANDING_LOOKBACK_DAYS = 365;

function activeStandingPoints(
    uint64 lastPositiveFactAt,
    uint64 lastLiquidationAt,
    uint256 nowTs
) internal pure returns (uint256) {
    if (lastPositiveFactAt == 0) return 0;

    uint256 recencyDays = (nowTs - lastPositiveFactAt) / 1 days;
    uint256 recencyPts;
    if (recencyDays <= RECENCY_FULL_DAYS) {
        recencyPts = 100;
    } else if (recencyDays >= RECENCY_ZERO_DAYS) {
        recencyPts = 0;
    } else {
        recencyPts = (100 * (RECENCY_ZERO_DAYS - recencyDays)) / (RECENCY_ZERO_DAYS - RECENCY_FULL_DAYS);
    }

    uint256 standingPts;
    if (lastLiquidationAt == 0) {
        standingPts = 100;
    } else {
        uint256 daysSince = (nowTs - lastLiquidationAt) / 1 days;
        standingPts = daysSince >= STANDING_LOOKBACK_DAYS
            ? 100
            : (100 * daysSince) / STANDING_LOOKBACK_DAYS;
    }

    return recencyPts + standingPts;
}
```

```typescript
export function activeStandingPoints(
  lastPositiveFactAtUnix: number,
  lastLiquidationAtUnix: number | null,
  nowUnix: number,
): number {
  if (lastPositiveFactAtUnix === 0) return 0;

  const recencyDays = Math.floor((nowUnix - lastPositiveFactAtUnix) / 86_400);
  let recencyPts: number;
  if (recencyDays <= 90) recencyPts = 100;
  else if (recencyDays >= 720) recencyPts = 0;
  else recencyPts = Math.floor((100 * (720 - recencyDays)) / (720 - 90));

  let standingPts: number;
  if (lastLiquidationAtUnix === null) {
    standingPts = 100;
  } else {
    const daysSince = Math.floor((nowUnix - lastLiquidationAtUnix) / 86_400);
    standingPts = daysSince >= 365 ? 100 : Math.floor((100 * daysSince) / 365);
  }

  return recencyPts + standingPts;
}
```

**Contoh perhitungan konkret:**

| Skenario | recencyPts | standingPts | activeStanding |
|---|---|---|---|
| Aktif 10 hari lalu, tak pernah dilikuidasi | 100 | 100 | 200 |
| Absen 200 hari, tak pernah dilikuidasi | 100×520/630=82,5→82 | 100 | 182 |
| Absen 400 hari, likuidasi 100 hari lalu | 100×320/630=50,8→50 | 100×100/365=27,4→27 | 77 |
| Absen 800 hari (>720), likuidasi 2 tahun lalu | 0 | 100 (>365 hari) | 0 |

---

## 4. Agregasi total dan clamping

```
raw   = repaymentVolume + repaymentCount + historyDuration
      + protocolDiversity + activeStanding
      - liquidationPenaltyAbs        // liquidationPenaltyAbs = |liquidationPenalty| ∈ [0,300]

score = clamp(raw, 0, 1000)
```

Karena lima komponen positif berjumlah maksimum tepat `1000`
(`300+200+200+100+200`), `clamp` atas praktis tidak pernah aktif kecuali suatu
saat konstanta diubah governance — tetap di-clamp secara eksplisit untuk
mengamankan masa depan, bukan diasumsikan diam-diam.

```solidity
function computeScore(uint256 sumPositive, uint256 liquidationPenaltyAbs)
    internal
    pure
    returns (uint256 score)
{
    int256 raw = int256(sumPositive) - int256(liquidationPenaltyAbs);
    score = uint256(ScoreMath.clampInt(raw, 0, 1000));
}
```

---

## 5. Ketahanan Sybil (kuantitatif)

**Argumen inti:** dompet baru gratis dibuat, tapi dompet baru **selalu mulai di
skor 0 / Tier 0** (§9 — cold start jujur, tanpa skor rekaan). Tidak ada jalan
pintas dari "dompet kosong" ke "skor tinggi" selain benar-benar melakukan
pinjam-meminjam nyata di Aave V3/Morpho/Compound di Ethereum mainnet — yang
mensyaratkan kolateral riil terkunci (Aave mewajibkan posisi over-kolateral
untuk meminjam sama sekali) dan bunga riil yang benar-benar dibayar ke
liquidity provider sungguhan. **Biaya memalsukan riwayat ≈ biaya memiliki
riwayat asli**, karena keduanya sama-sama mengharuskan modal terkunci dan bunga
dibayar — tidak ada cara mendapatkan fakta `LoanRepaid` tanpa benar-benar
menjadi peminjam yang membayar.

**Kuantifikasi — biaya mencapai Tier 4 (skor ≥800, kolateral 110%) dari nol:**

Untuk mendekati Tier 4 dibutuhkan kira-kira: `repaymentVolume` ≈ 250/300 poin
(butuh `V ≈ $250.000` volume **terbobot**, dari §3.1: `300×250.000/300.000=250`),
`repaymentCount` ≈ 140+/200 (butuh N≈30 pelunasan bermateri), `historyDuration`
≈ 130+/200 (butuh ≈2 tahun), `protocolDiversity` = 100 (4 protokol), dan
`activeStanding` mendekati 200 (aktif & bersih).

Ambil rute paling murah yang masih memenuhi bobot durasi minimum (§6.1,
`MIN_MEANINGFUL_DAYS=7`) untuk tidak kena diskon flash-wash: siklus pinjam
$50.000, tahan selama rata-rata 3 bulan (jauh di atas ambang 7 hari sehingga
`durationFactor≈1`), lunasi, ulangi 5 kali untuk mencapai `V≈$250.000` terbobot
(dengan asumsi `counterpartyDiversityFactor≈1` karena memang dipakai lintas
beberapa protokol/aset untuk sekaligus memenuhi target `protocolDiversity`):

| Item biaya | Perhitungan | Nilai |
|---|---|---|
| Kolateral yang harus dikunci per siklus (LTV maks ~80%) | $50.000/0,8 | $62.500 |
| Bunga pinjam riil per siklus (APR variabel Aave ~4,5%, 3 bulan) | $50.000×4,5%×(3/12) | $562,50 |
| Total bunga riil, 5 siklus | $562,50×5 | **$2.812,50** (dibayar ke LP asli, tak bisa ditarik kembali) |
| Modal-berisiko terkunci per siklus, terpapar risiko likuidasi | — | **$62.500** (berulang tiap siklus, ±15 bulan total) |
| Waktu minimum (5×3 bulan berurutan, atau paralel dengan modal 5× lipat) | — | **±15 bulan** (berurutan) atau **±$312.500 modal simultan** (paralel) |

Bandingkan dengan **alternatif "murah"**: membuat 1.000 dompet baru gratis.
Setiap dompet baru tetap dimulai dari skor 0/Tier 0/150% kolateral (§9) — **tidak
ada keuntungan sama sekali** sampai dompet itu sendiri melalui proses di atas.
Menyebar ke banyak dompet **melipatgandakan** biaya total secara linear (100
dompet Tier-4 palsu ≈ 100× biaya di atas ≈ $6,25 juta modal-berisiko + $280.000+
bunga riil), bukan mengamortisasinya — karena skor Corolary murni **per-alamat**,
tidak ada mekanisme "warisan reputasi" antar dompet.

**Kesimpulan kuantitatif:** manfaat maksimum memalsukan Tier 4 adalah selisih
kolateral 150%→110% = **26,7% pengurangan modal terkunci** pada pinjaman **masa
depan** di `EfficiencyMarket`. Untuk posisi apa pun di mana biaya membangun
riwayat (bunga riil + risiko likuidasi selama bulanan penuh) melebihi 26,7% dari
nilai pinjaman yang ingin diambil nanti — yaitu hampir semua kasus realistis,
karena bunga+risiko terkunci berbulan-bulan biasanya jauh melebihi 26,7% dari
satu pinjaman — serangan sybil murni tidak rasional secara ekonomi.

---

## 6. Serangan wash-history (kuantitatif)

Dua pola serangan berbeda tergantung arsitektur protokol sumber:

- **Protokol pooled (Aave V3, Compound V3):** tidak ada lawan-transaksi
  langsung — peminjam berhutang ke *pool*, bukan ke individu. "Wash" di sini
  berarti **flash-cycle**: pinjam lalu langsung lunasi dalam waktu sangat
  singkat (idealnya dalam blok yang sama atau dalam hitungan jam) untuk
  mengumpulkan hitungan/volume `LoanRepaid` tanpa benar-benar menanggung risiko
  harga/likuidasi dalam jangka waktu berarti.
- **Protokol P2P (Morpho Blue):** secara teori ada pasangan
  lender/borrower per pasar — penyerang bisa mengontrol dua dompet dan
  saling mencocokkan diri sendiri.

### 6.1 Mekanisme mitigasi: bobot = modal-berisiko × durasi × keragaman lawan-transaksi

Ini persis mekanisme `w_i` di §3.1, dirinci di sini:

**Modal-berisiko** = `amountUsd_i` — jumlah nyata yang dipinjam, dinormalisasi USD.
Ini adalah faktor dasar; tidak bisa dipalsukan tanpa benar-benar meminjam
(pool mensyaratkan kolateral riil di muka).

**Durasi** = `durationFactor_i`, dihitung dari **jarak waktu** antara
`LoanOriginated` yang membuka posisi dan `LoanRepaid` yang menutupnya
(dilacak per `(protocol, asset)` di §8):

```
durationFactor_i = min(1e18, (observedAt(Repaid_i) - observedAt(Originated_i)) × 1e18 / (MIN_MEANINGFUL_DAYS × 1 days))
MIN_MEANINGFUL_DAYS = 7
```

Posisi yang dibuka dan ditutup dalam hitungan jam mendapat `durationFactor`
mendekati nol — **secara langsung melumpuhkan insentif flash-cycle**, karena
berapa pun besar `amountUsd_i`, kontribusinya ke `V` nyaris nol jika durasinya
nyaris nol.

**Keragaman lawan-transaksi** = `counterpartyDiversityFactor(subject)`. Catatan
jujur: struct `Fact` (`architecture.md` §8.1) **tidak menyimpan alamat
lawan-transaksi per pinjaman** — Aave/Compound/Morpho di model data ini semua
tercatat sebagai interaksi dengan `protocol` (alamat pool/kontrak), bukan
peer individual. Karena keragaman lawan-transaksi sejati tidak bisa dihitung
dari data yang tersedia (batasan mendasar Attestcoin, `attestcoin-research.md`
§2.1 — hanya event, bukan state, dan event ini tidak mengekspos peer),
**proksi praktis** yang dipakai adalah keragaman **protokol + aset**:

```
counterpartyDiversityFactor(subject) = max(0.5e18, min(1e18,
    (D_protocols + D_assets) × 1e18 / TARGET_PAIR_DIVERSITY))
TARGET_PAIR_DIVERSITY = 6   // ekspektasi kasar: 3 protokol + 3 aset untuk pengguna beragam wajar
```

Lantai `0.5e18` (bukan 0) disengaja: pengguna niche yang sah (mis. hanya pernah
memakai satu pasar Aave USDC) tidak boleh dihukum habis — mereka hanya
didiskon 50%, bukan dinolkan. Wash yang tipikal (satu penyerang, satu
protokol, satu aset, dua dompet sendiri) akan berada tepat di lantai ini —
sinyal lemah, bukan sinyal nol, karena kita tidak bisa 100% yakin itu wash
tanpa data peer sejati.

```solidity
function _counterpartyDiversityFactor(SubjectState storage s) internal view returns (uint256) {
    uint256 d = _popcount8(s.protocolBitmap) + s.assetDiversityCount;
    uint256 raw = Math.mulDiv(d, 1e18, TARGET_PAIR_DIVERSITY);
    return ScoreMath.maxU(5e17, ScoreMath.minU(1e18, raw));
}
```

### 6.2 Contoh kuantitatif — flash-cycle wash di satu pasar

Penyerang mencoba membangun `repaymentVolume≈250` poin lewat siklus pinjam-lunas
1 jam berulang, $100.000 per siklus, satu protokol satu aset (diversityFactor
di lantai 0,5):

```
durationFactor_i = 3.600 detik × 1e18 / (7×86.400 detik) = 3.600×1e18/604.800 ≈ 0,00595e18 (0,595%)
w_i              = $100.000 × 0,00595 × 0,5 ≈ $297,60 per siklus
```

Untuk mencapai `V=$250.000` (setara 250 poin) butuh `250.000/297,60 ≈ 840 siklus`.
Setiap siklus butuh minimal 3-4 transaksi Ethereum mainnet nyata (supply/borrow,
repay, mungkin withdraw) dengan gas nyata (~$5–30/tx di kondisi jaringan wajar
→ ~$20–120/siklus). Total biaya:

| Item | Perhitungan | Nilai |
|---|---|---|
| Gas 840 siklus × ~$50 rata-rata | 840×50 | **≈$42.000** (dibakar, tidak bisa ditarik kembali) |
| Modal yang harus di-*round-trip* tiap siklus | — | $100.000+ likuiditas tersedia, berulang 840× |
| Waktu minimum jika 1 siklus/jam terus-menerus | 840 jam | **≈35 hari** nonstop |

Selama 35 hari itu berjalan, `historyDuration` dan `activeStanding` milik
penyerang juga ikut terakumulasi secara nyata — pada titik itu, penyerang
sudah membayar biaya (gas + waktu) yang sebanding dengan hanya menjadi
peminjam sungguhan yang menahan posisi wajar selama beberapa bulan (§5),
dengan hasil skor yang jauh **lebih rendah** ($42.000 gas untuk 250 poin
terbobot vs. beberapa ribu dolar bunga riil untuk hasil yang sama lewat
posisi yang ditahan wajar). Serangan ini secara struktural lebih mahal dan
lebih lambat daripada sekadar menjadi peminjam asli — itulah bukti mekanisme
bobot bekerja sesuai tujuan.

---

## 7. Peluruhan waktu — keputusan dan alasan

**Keputusan:** fakta itu sendiri **tidak pernah** meluruh, dihapus, atau
dihitung ulang dengan bobot berkurang seiring waktu — lima dari enam komponen
(`repaymentVolume`, `repaymentCount`, `historyDuration`, `liquidationPenalty`,
`protocolDiversity`) murni **akumulatif dan monoton** terhadap waktu. Satu
komponen (`activeStanding`, §3.6) **sengaja** sensitif terhadap waktu berjalan.

**Kenapa tidak decay untuk lima komponen lain:**
1. **Konsisten dengan prinsip desain #3 di `architecture.md`**: "setiap angka
   dapat ditelusuri ke satu proof" — fakta yang diprove permanen secara
   kriptografis; memberinya bobot yang menyusut lewat waktu akan membuat
   angka yang sama menghasilkan skor berbeda di waktu berbeda tanpa fakta baru
   apa pun masuk, yang membingungkan dan sulit diaudit ("kenapa skor saya turun
   padahal saya tidak melakukan apa-apa?").
2. **Permukaan serangan baru:** decay membuka strategi "tunggu sampai catatan
   buruk meluruh" — persis kebalikan dari apa yang ingin dicegah `liquidationPenalty`.
   Tanpa decay, satu-satunya cara memperbaiki skor adalah **menambah fakta baik
   baru**, bukan menunggu waktu berlalu secara pasif.
3. **Dilusi, bukan peluruhan, adalah mekanisme "pemulihan" yang dipakai:**
   kurva saturasi di §3.1–§3.3 secara alami membuat kontribusi relatif satu
   fakta lama mengecil begitu fakta-fakta baru menumpuk di atasnya (lihat
   Contoh gabungan di §11) — tapi fakta lama itu sendiri tidak pernah dihapus
   dari agregat. Ini beda mendasar: decay mengurangi bobot fakta lama secara
   eksplisit berdasarkan usianya; dilusi hanya membuat fakta baru menambah
   penyebut relatif, tanpa pernah mengurangi apa pun.

**Kenapa `activeStanding` justru sengaja time-sensitive:** perannya secara
definisi berbeda — bukan "seberapa banyak/lama riwayat", tapi "apakah subjek
masih terlibat aktif *sekarang*". Kedua pertanyaan itu sah-sah saja dijawab
berbeda; memisahkannya ke satu komponen 200-poin yang jelas dan terdokumentasi
lebih transparan daripada menyelipkan decay diam-diam ke seluruh skor.

---

## 8. Pembaruan inkremental

**Prinsip inti:** setiap komponen skor dirancang sebagai **agregat yang bisa
diperbarui secara inkremental** dari satu fakta baru — bukan fungsi yang
men-scan seluruh riwayat. `applyFact` menyentuh state dalam **O(1)**;
`computeScore` membaca state dalam **O(1)**. Tidak pernah ada loop di atas
seluruh `factId` historis di on-chain.

### 8.1 State per-subjek (on-chain, `CreditGraph.sol`)

```solidity
struct SubjectState {
    // repaymentVolume
    uint256 weightedRepaidUsd1e18;        // Σ w_i, WAD, monoton naik

    // repaymentCount
    uint32  qualifyingRepaymentCount;

    // historyDuration
    uint64  firstFactAt;                  // observedAt fakta pertama, 0 = belum ada fakta

    // liquidationPenalty
    uint32  liquidationCount;
    uint256 liquidationPenaltyPts;        // akumulasi mentah (poin polos), di-clamp saat dibaca

    // protocolDiversity
    uint8   protocolBitmap;               // bit ke-i = protokol ke-i (dari ProtocolRegistry) pernah muncul

    // wash-mitigation / counterpartyDiversityFactor
    uint8   assetDiversityCount;
    mapping(address => bool) seenAsset;   // per subjek

    // activeStanding
    uint64  lastPositiveFactAt;           // observedAt LoanOriginated/LoanRepaid/CollateralSupplied terbaru
    uint64  lastLiquidationAt;            // 0 = belum pernah

    // wash-mitigation / durationFactor — posisi terbuka per (protocol, asset)
    mapping(bytes32 => uint64) openLoanOriginatedAt;

    // bookkeeping umum
    uint32  factCount;
    uint64  lastFactAt;
    uint64  lastUpdatedBlock;
}

mapping(address => SubjectState) internal _subjects;
```

> **Catatan Solidity praktis:** struct yang mengandung `mapping` tidak bisa
> dikembalikan utuh oleh fungsi `view` eksternal. `CreditGraph` harus
> menyediakan fungsi getter terpisah yang mengembalikan salinan "flat" (tanpa
> field mapping) untuk dibaca `services/api` — lihat `docs/contracts.md` /
> `docs/api.md` untuk bentuk persisnya. Ini bukan detail scoring, tapi harus
> diperhitungkan siapa pun yang mengimplementasikan struct di atas.

**Catatan jujur soal `openLoanOriginatedAt`:** karena Attestcoin hanya
membuktikan **event**, bukan **state** (`attestcoin-research.md` §2.1),
`CreditGraph` tidak pernah benar-benar tahu berapa sisa utang suatu posisi —
hanya tahu "ada `LoanOriginated`" dan "ada `LoanRepaid`". Aave/Compound
mendukung pelunasan parsial dan penambahan pinjaman di atas posisi yang sudah
ada, jadi pemetaan 1:1 `Originated↔Repaid` tidak selalu benar secara literal.
Pendekatan yang diambil (disengaja, disederhanakan secara eksplisit — bukan
disembunyikan):
- `LoanOriginated` menyalakan timer `openLoanOriginatedAt[key]` **hanya jika**
  belum menyala (`== 0`) — pinjaman tambahan di atas posisi yang sudah terbuka
  tidak me-reset jam.
- Setelah `LoanRepaid` diproses, jam **tidak otomatis dinolkan** (kita tidak
  tahu apakah pelunasan itu menutup penuh posisi). Sebagai gantinya dipakai
  `CLOSE_GAP = 30 hari`: jika `LoanOriginated` baru muncul pada `(protocol, asset)`
  yang sama lebih dari 30 hari setelah `lastPositiveFactAt` sebelumnya, itu
  dianggap posisi baru dan jam di-reset ke waktu `LoanOriginated` itu.

```solidity
uint64 constant CLOSE_GAP = 30 days;
uint64 constant MIN_MEANINGFUL_DAYS = 7;
```

### 8.2 Algoritma `applyFact`

```solidity
function applyFact(address subject, Fact calldata f) external onlyFactRegistry {
    SubjectState storage s = _subjects[subject];

    if (s.firstFactAt == 0) s.firstFactAt = f.observedAt;
    s.factCount += 1;
    s.lastFactAt = f.observedAt;

    uint8 protoId = protocolRegistry.idOf(f.protocol); // FactRegistry sudah memvalidasi protokol terdaftar
    s.protocolBitmap |= uint8(1 << protoId);

    if (!s.seenAsset[f.asset]) {
        s.seenAsset[f.asset] = true;
        s.assetDiversityCount += 1;
    }

    if (f.kind == FactKind.LoanOriginated) {
        bytes32 key = keccak256(abi.encodePacked(f.protocol, f.asset));
        uint64 existing = s.openLoanOriginatedAt[key];
        if (existing == 0 || (f.observedAt - s.lastPositiveFactAt) > CLOSE_GAP) {
            s.openLoanOriginatedAt[key] = f.observedAt;
        }
        s.lastPositiveFactAt = f.observedAt;

    } else if (f.kind == FactKind.LoanRepaid) {
        _applyLoanRepaid(s, f, priceRegistry);           // §3.1

    } else if (f.kind == FactKind.Liquidated) {
        _applyLiquidated(s, f, priceRegistry);            // §3.4

    } else if (f.kind == FactKind.CollateralSupplied) {
        s.lastPositiveFactAt = f.observedAt;
        // Tidak menyumbang poin langsung hari ini (tidak ada komponen khusus
        // kolateral di enam komponen yang dikunci) — tetap dicatat untuk
        // factCount/historyDuration/activeStanding, dan sengaja disediakan
        // sebagai titik ekstensi masa depan bila komponen ketujuh ditambahkan.

    } else if (f.kind == FactKind.CollateralWithdrawn) {
        // Sinyal netral — hanya memperbarui bookkeeping umum di atas.
    }

    s.lastUpdatedBlock = uint64(block.number);
    emit ScoreComponentsUpdated(subject, f.factId, f.kind);
}
```

**Biaya gas:** setiap `applyFact` melakukan ~5–9 `SSTORE` (tergantung `FactKind`)
dan nol loop atas data historis — biaya konstan per fakta, tidak tumbuh seiring
riwayat subjek makin panjang. Ini properti yang wajib dijaga (lihat kasus uji #14, §11).

### 8.3 Algoritma `computeScore` (view, O(1))

```solidity
function computeScore(address subject) public view returns (uint256 score, uint8 tier) {
    SubjectState storage s = _subjects[subject];
    if (s.factCount == 0) return (0, 0); // cold start, §9 — tanpa perkecualian

    uint256 repaymentVolume    = ScoreMath.saturating(s.weightedRepaidUsd1e18, K_VOLUME_USD_1E18, 300);
    uint256 repaymentCount     = ScoreMath.saturating(uint256(s.qualifyingRepaymentCount) * 1e18, K_COUNT * 1e18, 200);
    uint256 historyDuration    = _historyDurationPoints(s.firstFactAt);
    uint256 liquidationPenalty = ScoreMath.minU(300, s.liquidationPenaltyPts);
    uint256 protocolDiversity  = protocolDiversityPoints(s.protocolBitmap);
    uint256 activeStanding     = activeStandingPoints(s.lastPositiveFactAt, s.lastLiquidationAt, block.timestamp);

    int256 raw = int256(repaymentVolume + repaymentCount + historyDuration
                       + protocolDiversity + activeStanding)
               - int256(liquidationPenalty);

    score = uint256(ScoreMath.clampInt(raw, 0, 1000));
    tier  = _tierOf(score);
}
```

### 8.4 Penelusuran bukti (`ScoreComponent.factIds`)

`ScoreComponent.factIds: Hex[]` (`architecture.md` §8.3) **tidak** disimpan
sebagai array on-chain di `SubjectState` — array tak terbatas yang tumbuh
seumur hidup subjek akan merusak properti O(1) di atas (setiap fakta baru
butuh 1 `SSTORE` tambahan yang tidak pernah bisa dihapus, dan array besar mahal
dibaca). Sebagai gantinya: `services/api` merekonstruksi `factIds` per komponen
dengan query `GET /v1/facts?subject=&kind=` (didukung tabel `facts` di Postgres,
lihat `architecture.md` §10) — filter berdasarkan `kind` yang relevan untuk tiap
komponen (mis. `repaymentVolume`/`repaymentCount` ← `kind=LoanRepaid`,
`liquidationPenalty` ← `kind=Liquidated`, dll). Ini menjaga rantai bukti utuh
("skor 720 bisa diklik sampai transaksi Ethereum yang membentuknya" —
prinsip desain #3 `architecture.md`) tanpa mengorbankan biaya update inkremental
on-chain.

---

## 9. Cold start

Alamat tanpa fakta apa pun (`factCount == 0`) mendapat:

```
score = 0
tier  = 0
collateralRatioBps = 15000   (150%)
```

**Ini bukan lubang, ini kejujuran yang disengaja.** Tidak ada skor rata-rata
rekaan, tidak ada interpolasi "asumsikan pengguna baru itu netral", tidak ada
"cold start bonus". Skor 0 secara literal berarti "belum ada bukti apa pun".

Poin penting untuk positioning produk: subjek cold-start **tidak pernah lebih
buruk** dari pasar pinjaman over-kolateral biasa tanpa lapisan reputasi sama
sekali — mereka mendapat baseline 150% yang identik dengan apa yang akan
mereka dapat di pasar mana pun tanpa Corolary. Corolary hanya menambah jalan
untuk menjadi **lebih baik** dari baseline lewat bukti nyata; ia tidak pernah
membuat siapa pun mulai dari posisi yang lebih buruk.

```solidity
function _coldStart() internal pure returns (uint256 score, uint8 tier, uint16 bps) {
    return (0, 0, 15000);
}
```

```typescript
export const COLD_START_SCORE: CreditScore = {
  score: 0,
  tier: 0,
  collateralRatioBps: 15000,
  components: [
    { key: 'repaymentVolume', label: 'Repayment Volume', points: 0, maxPoints: 300, factCount: 0, factIds: [] },
    { key: 'repaymentCount', label: 'Repayment Count', points: 0, maxPoints: 200, factCount: 0, factIds: [] },
    { key: 'historyDuration', label: 'History Duration', points: 0, maxPoints: 200, factCount: 0, factIds: [] },
    { key: 'liquidationPenalty', label: 'Liquidation Penalty', points: 0, maxPoints: 0, factCount: 0, factIds: [] },
    { key: 'protocolDiversity', label: 'Protocol Diversity', points: 0, maxPoints: 100, factCount: 0, factIds: [] },
    { key: 'activeStanding', label: 'Active Standing', points: 0, maxPoints: 200, factCount: 0, factIds: [] },
  ],
  factCount: 0,
  firstFactAt: null,
  lastFactAt: null,
} as const; // subject/computedAt/onChainBlock diisi caller
```

---

## 10. Pemetaan tier (dikunci)

| Tier | Rentang skor | Rasio kolateral | bps |
|---|---|---|---|
| T0 | 0–199 | 150% | 15000 |
| T1 | 200–399 | 140% | 14000 |
| T2 | 400–599 | 130% | 13000 |
| T3 | 600–799 | 120% | 12000 |
| T4 | 800–1000 | 110% | 11000 |

```solidity
uint16[5] internal constant TIER_BPS = [15000, 14000, 13000, 12000, 11000];

function _tierOf(uint256 score) internal pure returns (uint8) {
    if (score < 200) return 0;
    if (score < 400) return 1;
    if (score < 600) return 2;
    if (score < 800) return 3;
    return 4;
}

function tierToBps(uint8 tier) internal pure returns (uint16) {
    return TIER_BPS[tier];
}
```

```typescript
export const TIER_BPS = [15000, 14000, 13000, 12000, 11000] as const;

export function tierOf(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score < 200) return 0;
  if (score < 400) return 1;
  if (score < 600) return 2;
  if (score < 800) return 3;
  return 4;
}
```

---

## 11. Contoh gabungan — perhitungan skor penuh end-to-end

Subjek X: menggunakan Aave V3 dan Morpho Blue (2 protokol) selama 1.095 hari
(3 tahun). Volume pelunasan **terbobot** kumulatif $180.000 (semua posisi
ditahan >7 hari, `durationFactor≈1`; `counterpartyDiversityFactor≈0,667`
karena 2 protokol + 2 aset dari target 6, di atas lantai 0,5). 18 pelunasan
bermateri. Satu likuidasi 730 hari lalu senilai $15.000. Aktif 10 hari lalu.

| Komponen | Perhitungan | Poin |
|---|---|---|
| `repaymentVolume` | `300×180.000/230.000` | 234 |
| `repaymentCount` | `200×18/30` | 120 |
| `historyDuration` | `200×1.095/1.460` | 150 |
| `protocolDiversity` (D=2) | `2×100/4` | 50 |
| `activeStanding` | recency (10 hari) 100 + standing (730 hari sejak likuidasi ≥365) 100 | 200 |
| `liquidationPenalty` | 1 likuidasi, severityFactor=15.000/20.000=0,75; `40×1×0,75=30` | -30 |

```
raw   = 234 + 120 + 150 + 50 + 200 - 30 = 724
score = clamp(724, 0, 1000) = 724
tier  = 3   (600–799)
collateralRatioBps = 12000   (120%)
```

Perhatikan: likuidasi 2 tahun lalu masih tercatat penuh (-30, tidak meluruh —
§7), tapi kontribusinya kini kecil relatif terhadap 754 poin akumulasi positif
dari riwayat yang jauh lebih besar sejak saat itu — persis mekanisme **dilusi,
bukan peluruhan** yang dijelaskan di §7.

---

## 12. Kasus uji

Properti yang wajib dijaga oleh test suite (`packages/contracts/test/CreditGraph.t.sol`
dan padanannya di TypeScript):

1. **Monotonisitas positif** — untuk `LoanOriginated`/`LoanRepaid`/`CollateralSupplied`,
   `score(S ∪ {fakta baru})` ≥ `score(S)`. Tidak pernah ada fakta positif yang
   menurunkan skor.
2. **Anti-monotonisitas likuidasi** — `score(S ∪ {Liquidated})` ≤ `score(S)`.
3. **Batas tiap komponen** — tiap komponen individual tidak pernah keluar dari
   rentang dokumennya (`repaymentVolume∈[0,300]`, dst) untuk input sebesar apa
   pun, termasuk uji adversarial dengan `amount = type(uint256).max` (harus
   saturasi rapi, bukan revert karena overflow atau underflow diam-diam).
4. **Batas skor total** — skor akhir selalu `∈[0,1000]` untuk kombinasi fakta
   apa pun, termasuk kasus ekstrem semua komponen positif maksimum + semua
   likuidasi maksimum sekaligus.
5. **Anti-replay** — `FactRegistry` (pemanggil tunggal `applyFact` lewat
   `onlyFactRegistry`) menolak `factId` yang sama dua kali (`queryId` di
   `USCBase`); uji integrasi harus memverifikasi `applyFact` tidak pernah
   dipanggil dua kali untuk `factId` identik.
6. **Batas tier eksak** — skor 199→Tier0/15000bps, 200→Tier1/14000bps,
   399→Tier1, 400→Tier2/13000bps, 599→Tier2, 600→Tier3/12000bps, 799→Tier3,
   800→Tier4/11000bps, 1000→Tier4. Uji tepat di setiap batas, bukan hanya
   nilai tengah rentang.
7. **Cold start eksak** — alamat tanpa fakta: `score=0`, `tier=0`,
   `collateralRatioBps=15000` persis, bukan `null`/error/revert.
8. **Lantai likuidasi** — 100 likuidasi parah berturut-turut menghasilkan
   `liquidationPenalty` tepat `-300`, tidak pernah lebih negatif, tidak ada
   overflow/wrap pada akumulator `uint256 liquidationPenaltyPts`.
9. **Harga tak tersedia — sisi menguntungkan** — `LoanRepaid` dengan aset tanpa
   harga terbukti (atau harga kedaluwarsa >24 jam) menyumbang `amountUsd=0` ke
   `weightedRepaidUsd1e18` DAN tidak dihitung sebagai `qualifyingRepaymentCount`
   (karena `0 < MIN_MATERIAL_USD`), tapi tetap menaikkan `factCount` dan
   memperbarui `lastPositiveFactAt`/`firstFactAt`.
10. **Harga tak tersedia — sisi merugikan** — `Liquidated` dengan aset tanpa
    harga terbukti memakai `severityFactor=1e18` (maksimum), bukan 0.
11. **Pembobotan durasi wash** — `LoanOriginated`+`LoanRepaid` pada
    `(protocol, asset)` yang sama dalam satu blok (`durationFactor≈0`)
    menghasilkan `w_i` mendekati nol meski `amountUsd_i` besar; posisi yang
    ditahan ≥7 hari mendapat `durationFactor=1e18` penuh. Uji nilai numerik
    eksak sesuai rumus, bukan hanya arah perubahan.
12. **Saturasi diversitas protokol** — menyentuh satu protokol berkali-kali
    tidak pernah melewati 25/100; menyentuh 4 protokol berbeda mencapai
    tepat 100/100 berapa pun jumlah fakta per protokol.
13. **Determinisme / tanpa look-ahead** — `weightedRepaidUsd1e18` yang sudah
    tercatat untuk fakta lampau **tidak berubah** saat `PriceRegistry`
    diperbarui belakangan (harga di-snapshot saat `applyFact`, bukan dibaca
    ulang saat `computeScore`). Uji eksplisit: perbarui harga setelah fakta
    diproses, verifikasi state subjek yang sudah tercatat tetap sama persis.
14. **Biaya O(1)** — gas yang dipakai `applyFact` untuk fakta ke-N tidak
    boleh tumbuh seiring N (uji dengan mengukur gas fakta ke-1 vs fakta ke-1000
    milik subjek yang sama, harus dalam rentang varians wajar, bukan tumbuh
    linear/lebih).
15. **Presisi normalisasi USD** — pasangan harga+jumlah yang diketahui
    (mis. 1,5 WBTC @ $77.261,82) menghasilkan `amountUsd1e18` sesuai
    perhitungan tangan di §2, dengan toleransi pembulatan integer yang
    didokumentasikan (≤1 unit WAD-terkecil akibat pembagian bulat).

---

## 13. Batasan yang diakui jujur

Skor ini **tidak bisa** dan **tidak berpura-pura bisa** mengukur:

1. **Kelayakan kredit tradisional/off-chain** — pendapatan, pekerjaan, utang
   di sistem keuangan konvensional sama sekali tidak terlihat. Corolary hanya
   melihat aktivitas DeFi di protokol yang terdaftar di Ethereum mainnet.
2. **Aktivitas di luar Ethereum** — chain sumber dibatasi `chainKey=3`
   (`architecture.md` §3); riwayat di Solana, L2 lain, bursa tersentralisasi,
   atau biro kredit konvensional sepenuhnya invisible terhadap skor ini.
3. **Solvabilitas ke depan** — skor murni **melihat ke belakang** (fakta yang
   sudah terbukti terjadi). Ia tidak dan tidak berusaha memprediksi keruntuhan
   finansial mendadak di masa depan — hanya mengatribusi bukti masa lalu.
4. **Niat/kecanggihan penipuan di luar apa yang sudah dihargai secara
   struktural** — penyerang yang cukup sabar dan cukup bermodal secara teori
   bisa membangun riwayat asli selama bertahun-tahun lalu "kabur" begitu
   mencapai Tier 4. §5 menunjukkan ini secara ekonomi tidak rasional untuk
   sebagian besar ukuran posisi, tapi tidak *mustahil* — skor tidak menjamin
   nol risiko, hanya membuatnya mahal.
5. **Korelasi identitas antar-dompet** — Corolary tidak bisa dan tidak
   mencoba membuktikan dua alamat dikendalikan orang yang sama. Setiap alamat
   dinilai murni dari fakta miliknya sendiri. Ini bisa diterima justru karena
   argumen §5: memecah modal ke banyak dompet tidak mengurangi biaya total
   membangun riwayat — jadi korelasi identitas tidak menjadi beban keamanan
   yang harus ditanggung skor.
6. **Risiko makro/korelasi lintas-protokol** — subjek dengan perilaku sempurna
   selama bertahun-tahun tetap bisa gagal total dalam peristiwa pasar ekstrem
   (crash serentak lintas aset). Skor mencerminkan perilaku masa lalu, bukan
   ketahanan portofolio terhadap skenario tail-risk masa depan.
7. **Status posisi pinjaman yang presisi** — karena Attestcoin hanya
   membuktikan event, bukan state (`attestcoin-research.md` §2.1), penutupan
   posisi (`CLOSE_GAP` di §8.1) adalah **heuristik**, bukan kebenaran pasti.

**Kenapa ini tetap dapat diterima:** Corolary **tidak pernah** menjual
pinjaman tanpa jaminan (`architecture.md` §1–2). Skor ini hanya pernah
mengatur **seberapa besar** kolateral yang dibutuhkan (150%→110%) — ia tidak
pernah menghapus kebutuhan kolateral itu sendiri. Bahkan pada skenario
terburuk di mana seluruh daftar batasan di atas gagal sekaligus (identitas
tersamar sempurna, waktu ditunggu selama bertahun-tahun, niat buruk yang
sabar), `EfficiencyMarket` tetap memegang kolateral minimal **110%** terhadap
setiap pinjaman di Tier tertinggi — protokol tetap solven selama harga
kolateral tidak jatuh >10% sebelum bot likuidasi bereaksi, persis asumsi
keamanan dasar yang sudah dipakai setiap protokol lending over-kolateral
(termasuk Aave sendiri, yang menjadi salah satu sumber fakta kita). Skor
Corolary adalah **dial efisiensi modal**, bukan **gerbang solvabilitas** —
karena itu, batas-batas pengukurannya di atas berdampak terbatas by design,
tidak peduli seberapa baik atau buruk skor memodelkan niat manusia yang
sesungguhnya.

---

## 14. Tabel konstanta (referensi cepat implementasi)

| Konstanta | Nilai | Dipakai di |
|---|---|---|
| `WAD` | `1e18` | Basis fixed-point umum |
| `K_VOLUME_USD_1E18` | `50.000 × 1e18` | §3.1 `repaymentVolume` |
| `MIN_MATERIAL_USD_1E18` | `10 × 1e18` | §3.1/§3.2 ambang pelunasan bermateri |
| `K_COUNT` | `12` | §3.2 `repaymentCount` |
| `K_DURATION_DAYS` | `365` | §3.3 `historyDuration` |
| `BASE_PENALTY_PTS` | `40` | §3.4 `liquidationPenalty` |
| `K_SEV_USD_1E18` | `5.000 × 1e18` | §3.4 severity likuidasi |
| `TARGET_DIVERSITY_PROTOCOLS` | `4` | §3.5 `protocolDiversity` |
| `RECENCY_FULL_DAYS` | `90` | §3.6 `activeStanding` |
| `RECENCY_ZERO_DAYS` | `720` | §3.6 `activeStanding` |
| `STANDING_LOOKBACK_DAYS` | `365` | §3.6 `activeStanding` |
| `MIN_MEANINGFUL_DAYS` | `7` | §6.1 `durationFactor` (wash mitigation) |
| `TARGET_PAIR_DIVERSITY` | `6` | §6.1 `counterpartyDiversityFactor` |
| `COUNTERPARTY_DIVERSITY_FLOOR` | `0.5e18` | §6.1 `counterpartyDiversityFactor` |
| `CLOSE_GAP` | `30 days` | §8.1 pelacakan posisi terbuka |
| `MAX_PRICE_AGE` | `24 hours` | §2 `PriceRegistry` |

Semua konstanta di atas adalah kandidat parameter governance di masa depan
(bukan dikunci selamanya di bytecode) — tapi nilai di tabel ini adalah nilai
**awal yang wajib dipakai** untuk implementasi pertama, agar seluruh contoh
perhitungan di dokumen ini tetap valid dan bisa dipakai sebagai kasus uji acuan.
