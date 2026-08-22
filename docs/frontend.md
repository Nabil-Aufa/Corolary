# Spesifikasi Frontend — Corolary (`apps/web`)

> Pemilik: **Dev B**. Cakupan file: **hanya `apps/web/**`**. Dokumen ini adalah kontrak
> kerja Dev B — semua yang tidak eksplisit ditulis di sini harus diputuskan konsisten
> dengan prinsip di bawah, bukan ditebak sembarangan.
>
> Kalau ada konflik dengan `docs/architecture.md`, **architecture.md menang** (tipe
> data, bentuk API, tier→rasio dikunci di sana; dokumen ini menurunkannya ke UI).

---

## 0. Cara membaca dokumen ini

Corolary menjual satu klaim: *setiap angka yang ditampilkan bisa ditelusuri sampai
transaksi Ethereum mainnet yang membuktikannya.* Frontend bukan sekadar menampilkan
data — frontend adalah **alat bukti**. Setiap keputusan desain di bawah tunduk pada
satu pertanyaan: *apakah ini membuat kedalaman kriptografis TERLIHAT, atau apakah ini
menyembunyikannya di balik UI generik?*

Dua halaman diberi status khusus dan tidak boleh diperlakukan sebagai halaman biasa:

- **`/score`** — halaman pahlawan produk. Ini yang dibuka juri pertama kali setelah
  landing.
- **`/proofs`** — pembeda kompetitif. Ini yang membuktikan Attestcoin bukan cuma
  disebut di deck.

---

## 1. Stack & struktur proyek

### 1.1 Stack (dikunci, lihat `architecture.md` §6)

| Lapisan | Pilihan |
|---|---|
| Framework | Next.js **16**, App Router, TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui (primitif Radix di bawahnya) |
| Wallet | wagmi **v2** + viem — **tanpa** RainbowKit/ConnectKit (tidak ada di stack yang dikunci; UI connect dibangun manual di atas hooks wagmi + `Dialog` shadcn) |
| Data fetching | TanStack Query v5 |
| Chart | Recharts |
| Font loading | `next/font/google` (self-hosted, zero layout shift) |
| Ikon | `lucide-react` (paket resmi yang dipakai shadcn/ui — gaya line, sejalan §2) |

Tidak ada dependency baru di luar daftar ini tanpa alasan kuat yang dicatat di PR
description. Jangan menambah state manager global (Zustand/Redux) — TanStack Query
(server state) + `useState`/`useReducer` lokal + URL search params (filter halaman
`/proofs`) sudah cukup untuk cakupan produk ini.

### 1.2 Pohon direktori `apps/web/`

```
apps/web/
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── components.json                 # config shadcn/ui
├── package.json
├── .env.local.example
└── src/
    ├── app/
    │   ├── layout.tsx               # <html>, ThemeProvider, font vars
    │   ├── providers.tsx            # WagmiProvider + QueryClientProvider (client component)
    │   ├── globals.css              # @import tokens.css, Tailwind layers
    │   ├── page.tsx                 # "/" Landing
    │   ├── loading.tsx
    │   ├── error.tsx
    │   ├── not-found.tsx
    │   ├── score/
    │   │   ├── page.tsx             # "/score" — input alamat / connect wallet
    │   │   └── [address]/
    │   │       ├── page.tsx         # "/score/[address]" — halaman pahlawan
    │   │       ├── loading.tsx
    │   │       └── error.tsx
    │   ├── proofs/
    │   │   ├── page.tsx             # "/proofs" — daftar + filter
    │   │   ├── loading.tsx
    │   │   └── [factId]/
    │   │       ├── page.tsx         # "/proofs/[factId]" — detail + rantai bukti
    │   │       ├── loading.tsx
    │   │       └── error.tsx
    │   ├── market/
    │   │   ├── page.tsx             # "/market" — reserve + alur supply/borrow
    │   │   └── loading.tsx
    │   └── portfolio/
    │       ├── page.tsx             # "/portfolio"
    │       └── loading.tsx
    │
    ├── components/
    │   ├── ui/                      # primitif shadcn: button, card, dialog, tabs,
    │   │                             # tooltip, badge, skeleton, input, select, sheet,
    │   │                             # table, accordion, alert, separator, progress
    │   ├── layout/
    │   │   ├── AppHeader.tsx
    │   │   ├── AppFooter.tsx
    │   │   ├── NavLink.tsx
    │   │   ├── ThemeToggle.tsx
    │   │   ├── WalletButton.tsx
    │   │   └── NetworkGuard.tsx     # banner jaringan salah, di-mount di layout
    │   ├── score/
    │   │   ├── ScoreDial.tsx
    │   │   ├── TierBadge.tsx
    │   │   ├── CollateralRatioCallout.tsx
    │   │   ├── ComponentBreakdown.tsx
    │   │   ├── ComponentRow.tsx
    │   │   ├── ScoreHistoryChart.tsx
    │   │   └── NextTierGuidance.tsx
    │   ├── proofs/
    │   │   ├── FactRow.tsx
    │   │   ├── FactTable.tsx
    │   │   ├── FactFilters.tsx
    │   │   ├── FactDetail.tsx
    │   │   └── ProofChain.tsx
    │   ├── market/
    │   │   ├── ReserveTable.tsx
    │   │   ├── ReserveRow.tsx
    │   │   ├── SupplyBorrowDialog.tsx
    │   │   ├── CollateralSavingsCallout.tsx
    │   │   └── HealthFactorBar.tsx
    │   ├── portfolio/
    │   │   ├── PositionTable.tsx
    │   │   ├── ActivityTimeline.tsx
    │   │   └── ScoreProgressCard.tsx
    │   └── shared/
    │       ├── AddressInput.tsx
    │       ├── AddressDisplay.tsx
    │       ├── ProtocolLogo.tsx
    │       ├── AmountDisplay.tsx
    │       ├── UsdDisplay.tsx
    │       ├── RelativeTime.tsx
    │       ├── FactKindBadge.tsx
    │       ├── EmptyState.tsx
    │       ├── ErrorState.tsx
    │       ├── PageSkeleton.tsx
    │       └── ExternalLinkButton.tsx
    │
    ├── hooks/
    │   ├── useScore.ts
    │   ├── useScoreHistory.ts
    │   ├── useFacts.ts
    │   ├── useFact.ts
    │   ├── useMarketSummary.ts
    │   ├── useMarketReserves.ts
    │   ├── usePositions.ts
    │   ├── usePrices.ts
    │   ├── useIndexerStatus.ts
    │   ├── useChains.ts
    │   └── useWrongNetwork.ts
    │
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts             # fetch wrapper bertipe, gerbang fixture
    │   │   ├── endpoints.ts          # satu fungsi per endpoint di architecture.md §9
    │   │   ├── query-keys.ts         # factory key TanStack Query
    │   │   └── errors.ts             # ApiError, pemetaan kode error
    │   ├── wagmi.ts                  # konfigurasi wagmi, chain dari @corolary/shared
    │   ├── query-client.ts           # QueryClient default options
    │   ├── format.ts                 # semua fungsi format §6
    │   ├── explorer.ts               # buildEtherscanUrl / buildCreditcoinExplorerUrl
    │   ├── dev-fixtures.ts           # §8 — fixture, mati secara default
    │   └── constants.ts              # TIER_COLLATERAL_BPS, TIER_LABELS, dll (UI-only)
    │
    ├── styles/
    │   └── tokens.css                # variabel CSS §2.3
    │
    └── types/
        └── index.ts                  # `export type { Fact, CreditScore, ... } from '@corolary/shared'`
                                       # tidak mendeklarasikan ulang — hanya re-export
                                       # + tipe UI-only (mis. FilterState) yang tidak
                                       # masuk kontrak API
```

**Aturan impor tipe:** `apps/web` tidak pernah mendefinisikan ulang `Fact`,
`CreditScore`, `ScoreComponent`, `FactKind`. Semua diimpor dari `@corolary/shared`.
Kalau field yang dibutuhkan UI belum ada di sana, itu permintaan ke Dev A (lihat
`workstreams.md` §7), bukan alasan untuk membuat tipe bayangan lokal.

---

## 2. Arahan desain & brand

### 2.1 Tesis desain

Corolary bukan "dashboard DeFi lain". Nama produk berarti *sesuatu yang mengikuti
secara niscaya dari hal yang sudah dibuktikan* — setiap elemen visual harus
memperkuat rasa **kepastian matematis**, bukan hype. Referensi kalibrasi yang tepat:
alat ukur presisi (jangka sorong, osiloskop, terminal Bloomberg), bukan mesin slot
atau dashboard trading meme-coin.

**Yang harus dihindari secara eksplisit** (daftar konkret, bukan kata sifat):
- Gradien ungu→pink→cyan di background hero.
- Efek glow/neon pada tombol utama.
- Font display membulat/rounded (misal Poppins, Quicksand) untuk angka skor.
- Confetti, animasi bounce berlebihan, ikon 3D glossy.
- Kartu dengan drop-shadow tebal berwarna (`shadow-purple-500/50` dsb).
- Ikon token generik crypto (koin emas 3D). Pakai logo protokol resmi (Aave, Morpho,
  Compound) dalam bentuk monokrom/line saat kecil, berwarna hanya saat jadi fokus.

**Yang harus dipakai:**
- Garis tipis (`1px` hairline border) sebagai pemisah elevasi, bukan shadow tebal.
- Angka besar dalam font monospace dengan `font-variant-numeric: tabular-nums`.
- Palet terbatas: satu warna aksen utama (biru presisi), satu warna "terverifikasi"
  (teal), amber untuk peringatan, merah untuk bahaya. Tidak ada warna kelima.
- Micro-interaction yang bermakna: transisi status proof (`observed → attested →
  proved → recorded`) dianimasikan sebagai progres linear/checklist, bukan sebagai
  perayaan.

### 2.2 Tipografi

| Peran | Font | Sumber | Berat dipakai |
|---|---|---|---|
| UI, heading, body | **IBM Plex Sans** | `next/font/google` | 400, 500, 600, 700 |
| Angka, hash, alamat, kode, tabel data | **IBM Plex Mono** | `next/font/google` | 400, 500, 600 |

Alasan pemilihan: IBM Plex dirancang IBM untuk dokumentasi teknis dan rekayasa —
karakter "presisi, bukan kasino" datang bawaan dari desain typeface-nya, bukan perlu
ditambal dengan trik CSS. Dua keluarga font saja, tidak lebih, agar hierarki tetap
tenang.

```ts
// apps/web/src/app/layout.tsx
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});
```

**Aturan pemakaian tanpa kecuali:** setiap nilai numerik yang tampil di UI (skor,
jumlah token, USD, persentase, alamat, hash, tinggi blok, timestamp mentah) memakai
`font-mono` + `tabular-nums`. Judul halaman, label, copy penjelas memakai `font-sans`.
Jangan mencampur — kalau ragu apakah sebuah string itu "data" atau "label", data
selalu menang ke `font-mono`.

Skala tipe (Tailwind `fontSize` custom, bukan default `text-9xl` dkk):

| Token | rem | Pemakaian |
|---|---|---|
| `text-display` | 3.5rem / 56px | Angka skor di `ScoreDial` besar |
| `text-h1` | 2.25rem / 36px | Judul halaman |
| `text-h2` | 1.5rem / 24px | Judul section |
| `text-h3` | 1.125rem / 18px | Judul kartu |
| `text-body` | 0.9375rem / 15px | Body copy |
| `text-small` | 0.8125rem / 13px | Label, meta, caption |
| `text-micro` | 0.6875rem / 11px | Tag status, uppercase letter-spacing |

### 2.3 Palet warna — token CSS (`apps/web/src/styles/tokens.css`)

Prinsip: latar netral hampir-hitam/hampir-putih (bukan hitam/putih murni), satu warna
aksen ("Proof Blue") untuk interaktif, satu warna "Verified" yang **berbeda** dari
aksen — dipakai khusus untuk elemen yang menandakan sesuatu telah dibuktikan secara
kriptografis (checkmark proof, garis `ProofChain`, badge "Recorded"). Memisahkan
kedua warna ini penting: kalau semuanya biru, "tombol biasa" dan "fakta terbukti"
jadi tak terbedakan secara visual, dan itu justru melemahkan pesan produk.

```css
/* apps/web/src/styles/tokens.css */
:root {
  /* permukaan */
  --color-bg: #F6F7FA;
  --color-surface: #FFFFFF;
  --color-surface-raised: #FFFFFF;
  --color-border: #E1E4EA;
  --color-border-strong: #C7CCD6;

  /* teks */
  --color-ink-900: #0B0E14;   /* judul, angka utama */
  --color-ink-700: #333A46;   /* body */
  --color-ink-500: #667085;   /* label, meta */
  --color-ink-400: #98A2B3;   /* placeholder, disabled */

  /* aksen interaktif — "Proof Blue" */
  --color-accent: #1D4FD8;
  --color-accent-hover: #1840B3;
  --color-accent-soft: #E8EDFF;

  /* semantik "terbukti secara kriptografis" — dipakai HANYA untuk elemen proof */
  --color-verified: #0E8F7D;
  --color-verified-soft: #E3F5F1;

  /* peringatan */
  --color-warning: #B45309;
  --color-warning-soft: #FDF0DC;

  /* bahaya / likuidasi / tier turun */
  --color-danger: #C0233D;
  --color-danger-soft: #FCE8EC;

  --color-focus-ring: #1D4FD8;
  --radius-base: 8px;
  --radius-sm: 6px;
  --radius-lg: 12px;
}

.dark {
  --color-bg: #0A0D13;
  --color-surface: #10141C;
  --color-surface-raised: #141924;
  --color-border: #232938;
  --color-border-strong: #323A4D;

  --color-ink-900: #F4F6F9;
  --color-ink-700: #C6CCD9;
  --color-ink-500: #8B93A7;
  --color-ink-400: #5C6577;

  --color-accent: #5B85FF;
  --color-accent-hover: #7B9DFF;
  --color-accent-soft: #182348;

  --color-verified: #35C9AE;
  --color-verified-soft: #0E2A26;

  --color-warning: #F2B84B;
  --color-warning-soft: #3A2A12;

  --color-danger: #F2607A;
  --color-danger-soft: #3A1620;

  --color-focus-ring: #5B85FF;
}
```

Tabel referensi cepat untuk pemetaan makna:

| Token | Dipakai untuk |
|---|---|
| `--color-accent` | Tombol primer, link aktif, tab terpilih, fokus input |
| `--color-verified` | Ikon centang proof, garis `ProofChain`, badge "Recorded on Creditcoin", state tier naik |
| `--color-warning` | Health factor mendekati ambang, lag attestation tinggi |
| `--color-danger` | Health factor di bawah 1, likuidasi, error fatal |
| `--color-ink-500` | Meta text: "12 fakta", "diperbarui 3 menit lalu" |

Tailwind memetakan token ini lewat `tailwind.config.ts`:

```ts
// tailwind.config.ts (potongan relevan)
export default {
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        ink: {
          900: 'var(--color-ink-900)',
          700: 'var(--color-ink-700)',
          500: 'var(--color-ink-500)',
          400: 'var(--color-ink-400)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          soft: 'var(--color-accent-soft)',
        },
        verified: {
          DEFAULT: 'var(--color-verified)',
          soft: 'var(--color-verified-soft)',
        },
        warning: { DEFAULT: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
        danger: { DEFAULT: 'var(--color-danger)', soft: 'var(--color-danger-soft)' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
};
```

### 2.4 Prinsip spasi

- Grid dasar **4px**. Semua padding/margin kelipatan 4 (Tailwind default `spacing`
  sudah kelipatan 4 — jangan pakai nilai arbitrer `p-[13px]`).
- Skala yang dipakai berulang: `4, 8, 12, 16, 24, 32, 48, 64`.
- Container halaman: `max-w-[1280px] mx-auto px-6 md:px-8`.
- Kartu data (`Card`): padding internal `p-6`, gap antar kartu dalam grid `gap-4`
  hingga `gap-6`.
- Elevasi lewat **border 1px + sedikit perbedaan `--color-surface-raised` vs
  `--color-bg`**, bukan `box-shadow` tebal. Satu-satunya shadow yang diizinkan:
  `shadow-sm` (Tailwind default) untuk dialog/popover mengambang di atas konten.
- Densitas tabel (`FactTable`, `ReserveTable`): baris `h-14`, padding sel horizontal
  `px-4`. Jangan tabel rapat — ini alat bukti yang harus nyaman dibaca lama, bukan
  feed media sosial.

### 2.5 Nada visual & komponen ikon

- Ikon: `lucide-react`, `stroke-width={1.5}`, ukuran default `20px`. Tidak ada ikon
  filled solid kecuali status aktif kecil (mis. dot indikator online indexer).
- Status "terbukti" memakai ikon `ShieldCheck` atau `CheckCircle2` dari lucide,
  **selalu** warna `--color-verified`, tidak pernah `--color-accent` — supaya mata
  juri belajar: warna teal = kriptografis terbukti, di mana pun muncul di produk.
  Konsistensi warna ini bukan estetika, ini bahasa produk.
- `ProtocolLogo` (Aave, Morpho, Compound): SVG monokrom `currentColor` pada ukuran
  ≤ 20px (daftar/tabel), logo berwarna resmi protokol saat ukuran ≥ 32px (detail
  fakta, header market).
- Grafik (`Recharts`): garis tipis `1.5px`, tanpa area-fill gradien mencolok — fill
  area di bawah garis skor memakai `--color-accent-soft` dengan opacity rendah
  (`fillOpacity={0.15}`), grid line `--color-border` putus-putus tipis.

---

## 3. Konfigurasi chain & wallet

### 3.1 Chain

Chain Creditcoin CC3 Testnet **didefinisikan oleh Dev A** di
`packages/shared/src/chains.ts` (lihat `architecture.md` §6/§7, task A0). Dev B
**mengimpor**, tidak mendefinisikan ulang objek chain viem. Nilai yang harus konsisten
dengan definisi tersebut:

| Field | Nilai |
|---|---|
| `id` | `102031` (`0x18e8f`) |
| `name` | `Creditcoin CC3 Testnet` |
| `nativeCurrency` | `{ name: 'Creditcoin Testnet Token', symbol: 'tCTC', decimals: 18 }` |
| RPC default | `https://rpc.cc3-testnet.creditcoin.network` |

```ts
// apps/web/src/lib/wagmi.ts
import { http, createConfig } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { creditcoinCC3Testnet } from '@corolary/shared/chains'; // ditulis Dev A

export const wagmiConfig = createConfig({
  chains: [creditcoinCC3Testnet],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
      showQrModal: true,
    }),
  ],
  transports: {
    [creditcoinCC3Testnet.id]: http(
      process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL ??
        'https://rpc.cc3-testnet.creditcoin.network',
    ),
  },
  ssr: true,
});
```

`Providers.tsx` membungkus `<WagmiProvider config={wagmiConfig}>` di dalam
`<QueryClientProvider>` — TanStack Query yang sama dipakai wagmi (`ssr: true`
mensyaratkan `QueryClientProvider` sudah aktif di atasnya) **dan** dipakai layer data
API di §7. Satu `QueryClient` untuk keduanya, key namespace dipisah lewat prefix
(`['wagmi', ...]` otomatis oleh wagmi, `['api', ...]` oleh kita — lihat §7.3).

### 3.2 Cakupan penggunaan wagmi/viem

Data pembacaan (skor, fakta, market, portfolio) **selalu** lewat REST API (`/v1/**`),
bukan lewat RPC langsung dari browser — API yang menggabungkan mirror Postgres +
resolusi nama protokol/aset. wagmi/viem dipakai untuk:

1. Connect/disconnect wallet, deteksi alamat aktif, deteksi chain aktif.
2. Transaksi tulis ke `EfficiencyMarket` (`supply`, `withdraw`, `depositCollateral`,
   `borrow`, `repay`) dan `approve` token ERC-20 — dipanggil dari `/market`.
3. `useWaitForTransactionReceipt` untuk UX konfirmasi setelah submit transaksi.

ABI kontrak diimpor dari `@corolary/shared/abis/*.json` (digenerate Dev A dari
`forge build`). Dev B tidak menyalin ABI manual.

### 3.3 Alur connect wallet

```
[WalletButton — belum connect]
  "Connect Wallet" ─click─▶ Dialog shadcn
                              ├─ Injected (MetaMask dll.) — muncul jika terdeteksi
                              └─ WalletConnect — QR / deep link
  sukses connect ──▶ WalletButton menampilkan AddressDisplay (dipendekkan) + avatar
                       identicon deterministik dari alamat (bukan gambar eksternal)
```

- `WalletButton` memakai `useAccount()`, `useConnect()`, `useDisconnect()` dari
  wagmi. Tidak ada auto-connect diam-diam ke connector yang butuh popup — hanya
  `injected` boleh auto-reconnect (`reconnectOnMount` bawaan wagmi), WalletConnect
  selalu perlu aksi eksplisit user.
- Setelah connect, jika user sedang di `/score` (tanpa `[address]`), redirect
  otomatis ke `/score/[address]` dengan alamat wallet — tapi **tidak** dipaksa;
  ada tombol "Lihat alamat lain" untuk override manual lewat `AddressInput`.
- Disconnect mengembalikan state lokal (filter, alamat yang sedang dilihat)
  **tidak** ikut hilang — melihat skor/proof address orang lain tidak memerlukan
  wallet ter-connect sama sekali (produk ini publicly readable, sesuai prinsip
  "fakta dapat dibaca siapa pun").

### 3.4 Penanganan salah jaringan

`NetworkGuard` (di-mount sekali di `app/layout.tsx`, di dalam `Providers`):

```
┌──────────────────────────────────────────────────────────────┐
│ ⚠ Wallet kamu terhubung ke jaringan lain.                     │
│   Corolary berjalan di Creditcoin CC3 Testnet (chainId 102031)│
│   [ Ganti Jaringan ]                                          │
└──────────────────────────────────────────────────────────────┘
```

Logika (`useWrongNetwork.ts`):

```ts
export function useWrongNetwork() {
  const { chain, isConnected } = useAccount();
  const isWrong = isConnected && chain?.id !== creditcoinCC3Testnet.id;
  return { isWrong };
}
```

- Banner hanya tampil bila wallet **connected** dan chain-nya salah — tidak tampil
  untuk visitor yang belum connect (mereka masih bisa membaca `/score`, `/proofs`,
  `/market` tanpa wallet).
- Tombol "Ganti Jaringan" memanggil `useSwitchChain().switchChain({ chainId:
  creditcoinCC3Testnet.id })`. Jika wallet tidak mendukung `wallet_switchEthereumChain`
  (jarang), fallback ke `wallet_addEthereumChain` dengan payload chain lengkap, lalu
  tampilkan instruksi manual (RPC URL, chainId) sebagai teks yang bisa disalin.
- Semua aksi tulis (`SupplyBorrowDialog`, tombol approve/borrow) **disabled** dan
  diberi tooltip "Ganti ke Creditcoin CC3 Testnet dulu" selama `isWrong === true`.
  Data baca dari REST API tetap jalan normal — tidak bergantung chain wallet.

---

## 4. Spesifikasi halaman

Konvensi endpoint: semua path di bawah adalah relatif ke `NEXT_PUBLIC_API_URL` +
`/v1` sesuai `architecture.md` §9. Amplop respons selalu
`{ ok: true, data, meta? } | { ok: false, error }`.

### 4.1 `/` — Landing

**Tujuan:** menyampaikan proposisi nilai (reputasi terbukti → efisiensi kolateral)
dan membuktikan sejak detik pertama bahwa angka yang ditampilkan itu hidup, bukan
mockup — dengan menampilkan statistik langsung dari API dan tautan masuk ke bukti.

**Wireframe:**

```
┌─────────────────────────────────────────────────────────────────┐
│ [Corolary]              Score  Proofs  Market  Portfolio  [🌙][Connect] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Reputasi kredit yang mengikuti secara niscaya dari bukti.     │
│   Riwayat Aave, Morpho, dan Compound di Ethereum — dibuktikan   │
│   secara kriptografis lewat Attestcoin, dipakai untuk membuka   │
│   kolateral 150% → 110%.                                         │
│                                                                   │
│   [ Cek Skor Saya ]   [ Jelajahi Bukti → ]                       │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  FAKTA TERBUKTI     PEMINJAM TERINDEKS     LAG ATTESTATION      │
│     12.480               1.204                 ~8 menit         │
│  (indexer/status)    (facts, subject distinct)  (chains)        │
├─────────────────────────────────────────────────────────────────┤
│  Cara kerja                                                      │
│  1  Event Ethereum mainnet nyata (Aave/Morpho/Compound)          │
│  2  Attestcoin membuktikan inklusi tx secara kriptografis        │
│  3  Fakta tercatat permanen di FactRegistry Creditcoin           │
│  4  Skor 0..1000 diturunkan — setiap komponen menunjuk ke bukti  │
│  5  Rasio kolateral turun mengikuti skor terbukti                │
│      [lihat rantai bukti sungguhan →]  (link ke /proofs)         │
├─────────────────────────────────────────────────────────────────┤
│  Fakta terbaru yang tercatat                    [lihat semua →] │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ FactRow  FactRow  FactRow  FactRow  FactRow (5 terbaru)    │ │
│  └───────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  150% → 110%   Efisiensi kolateral berjenjang, bukan pinjaman   │
│                 tanpa jaminan. Protokol tetap solven.            │
│  [tabel tier T0..T4 ringkas]                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Komponen dipakai:** `AppHeader`, `WalletButton`, statistik pakai kartu kecil custom
(`StatCard` — bagian dari `components/shared` bila reuse ≥ 2 tempat, cukup inline di
`page.tsx` bila hanya di sini), `FactRow` (mode ringkas, `compact` prop — lihat §5),
`TierBadge` × 5 di tabel ringkas.

**Endpoint API:**
- `GET /v1/market/summary` → TVL, jumlah peminjam aktif (jika field tersedia; kalau
  tidak, turunkan "peminjam terindeks" dari `GET /v1/facts?limit=1` memakai
  `meta.total` sebagai proxy jumlah fakta, **bukan** dikarang).
- `GET /v1/indexer/status` → lag attestation, tinggi ter-attest, status antrean.
- `GET /v1/facts?limit=5` → lima fakta terbaru untuk strip "Fakta terbaru".
- `GET /v1/chains` → status attestation chain sumber, dipakai untuk badge kecil
  "Ethereum mainnet · live" di dekat statistik.

**DILARANG KERAS:** angka apa pun di section statistik hardcode di JSX. Kalau API
belum siap, section ini menampilkan skeleton — bukan angka contoh — sampai fixture
dicabut/endpoint hidup (lihat §8).

**Loading:** tiga `StatCard` menampilkan `Skeleton` berbentuk angka (`h-9 w-24`)
sambil query berjalan. Strip fakta terbaru menampilkan 5 `FactRow` skeleton.

**Kosong:** jika `facts.length === 0` (indexer baru mulai / belum ada fakta
tercatat), strip fakta terbaru diganti `EmptyState` — *"Indexer sedang menunggu
fakta pertama. Attestation berjalan setiap ~8 menit."* — bukan disembunyikan diam-diam,
karena kejujuran soal keadaan sistem adalah bagian dari kredibilitas produk.

**Error:** jika `market/summary` atau `indexer/status` gagal (`UPSTREAM_UNAVAILABLE`
dll.), statistik yang gagal menampilkan `—` dengan tooltip pesan error dan tombol
retry kecil — **section lain tetap render** (tidak ada satu error API menjatuhkan
seluruh landing page ke `error.tsx`).

**Aksi user:** "Cek Skor Saya" → jika wallet connected, ke `/score/[address]`
langsung; jika tidak, ke `/score` (input manual). "Jelajahi Bukti" → `/proofs`.
Klik `FactRow` di strip → `/proofs/[factId]`.

---

### 4.2 `/score` dan `/score/[address]` — Score Explorer (halaman pahlawan)

**Tujuan:** ini halaman yang membuktikan tesis produk dalam satu layar: skor, tier,
rasio kolateral yang didapat, dan — krusial — setiap komponen skor bisa dibuka
sampai daftar fakta mentah yang membentuknya. Halaman ini harus terasa seperti
laporan audit, bukan papan skor game.

#### 4.2.1 `/score` (tanpa alamat)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Lihat skor kredit terbukti                  │
│                                                                   │
│   ┌─────────────────────────────────────────┐                   │
│   │  0x…                            [ Cek → ]│  AddressInput     │
│   └─────────────────────────────────────────┘                   │
│                         atau                                     │
│              [ Connect Wallet untuk skor saya ]                  │
│                                                                   │
│   Alamat yang baru saja dicek:  0x1a2…f9c   0x77b…203 …          │
└─────────────────────────────────────────────────────────────────┘
```

- `AddressInput` validasi format `0x` + 40 hex char secara lokal (viem
  `isAddress`) sebelum submit — kesalahan format ditampilkan inline, tidak
  memicu request API sia-sia.
- "Alamat yang baru saja dicek" dari `localStorage` (maks 5, sisi klien murni,
  bukan data produk — boleh, karena ini preferensi UI lokal, bukan fakta yang
  diklaim berasal dari chain).
- Submit → `router.push('/score/' + address)`.

#### 4.2.2 `/score/[address]`

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Score Explorer          0x1a2b…c9f9  [copy] [Etherscan ↗]     │
├───────────────────────────────┬───────────────────────────────┤
│                                │  RASIO KOLATERAL               │
│         ╭─────────╮            │  ┌───────────────────────────┐│
│        ╱   742     ╲           │  │  110%  (baseline 150%)    ││
│       │   / 1000    │  ScoreDial │  Kamu menghemat 40 poin    ││
│        ╲           ╱           │  persentase modal terkunci  ││
│         ╰─────────╯            │  dibanding peminjam baru     ││
│         [ TIER 4 ]  TierBadge  │  └───────────────────────────┘│
│                                │                                 │
│  12 fakta · sejak Feb 2025     │  [ Ajukan pinjaman di /market ]│
├───────────────────────────────┴───────────────────────────────┤
│  Rincian skor (6 komponen)                                     │
│  ┌───────────────────────────────────────────────────────────┐│
│  │ ▸ Volume pembayaran        210 / 250   ████████████░░  84% ││
│  │ ▸ Jumlah pembayaran        140 / 150   █████████████░  93% ││
│  │ ▾ Lama riwayat              95 / 150   ████████░░░░░░  63% ││
│  │     Dibuka: penjelasan singkat + 6 fakta pembentuk ↓        ││
│  │     ┌─────────────────────────────────────────────────┐    ││
│  │     │ FactRow  FactRow  FactRow  FactRow  FactRow …    │    ││
│  │     │                          [lihat semua di /proofs]│    ││
│  │     └─────────────────────────────────────────────────┘    ││
│  │ ▸ Penalti likuidasi          0 / 0     (tidak ada — bagus)  ││
│  │ ▸ Keragaman protokol       120 / 150   ████████████░░  80% ││
│  │ ▸ Standing aktif           177 / 200   █████████████░  88% ││
│  └───────────────────────────────────────────────────────────┘│
├───────────────────────────────────────────────────────────────┤
│  Perkembangan skor                        [30h][90h][1t][Semua]│
│  [ ScoreHistoryChart — garis skor vs waktu, marker tiap        │
│    perubahan tier ]                                             │
├───────────────────────────────────────────────────────────────┤
│  Menuju Tier 5? Tidak ada — T4 adalah tier tertinggi (110%).    │
│  atau (jika belum T4):                                          │
│  Untuk Tier 3 → 2, kamu butuh ~58 poin lagi di "Lama riwayat".  │
│  Estimasi: pertahankan standing aktif 4 bulan lagi.             │
└─────────────────────────────────────────────────────────────────┘
```

**Komponen:** `ScoreDial`, `TierBadge`, `CollateralRatioCallout`,
`ComponentBreakdown` (berisi 6× `ComponentRow`, tiap row expand → `FactRow[]`),
`ScoreHistoryChart`, `NextTierGuidance`, `AddressDisplay`.

**Endpoint API:**
- `GET /v1/score/:address` → `CreditScore` lengkap (skor, tier, `collateralRatioBps`,
  6 `components[]`, tiap komponen sudah membawa `factIds: Hex[]`).
- `GET /v1/score/:address/history?from&to` → deret waktu untuk `ScoreHistoryChart`
  (rentang dipilih lewat toggle 30h/90h/1t/Semua, di-refetch per rentang).
- Saat `ComponentRow` dibuka: **tidak** memanggil endpoint baru untuk daftar fakta
  singkatnya — `factIds` sudah ada di payload skor. Untuk menampilkan `Fact` penuh
  (bukan cuma id), panggil `GET /v1/facts?subject={address}&kind={mappedKind}`
  (filter berdasarkan komponen yang relevan) **atau**, bila API menyediakan
  `GET /v1/facts/:factId` secara batch-friendly, ambil per id dengan
  `useQueries`. **Kontrak persisnya menunggu konfirmasi Dev A** — default yang
  dipakai: filter `subject` + `kind` di `/v1/facts`, karena endpoint itu sudah
  dikunci di `architecture.md` §9 dan tidak butuh field API baru.

**Keadaan kosong (jujur, bukan skor palsu):** kalau `GET /v1/score/:address`
mengembalikan `factCount: 0` (atau `404 NOT_FOUND` — API boleh memilih salah satu,
UI menangani keduanya sama), halaman **tidak** menampilkan `ScoreDial` berisi 0
seolah itu skor sungguhan. Sebagai gantinya:

```
┌─────────────────────────────────────────────────────────────────┐
│   Belum ada riwayat terbukti untuk alamat ini.                  │
│                                                                   │
│   Corolary hanya menilai berdasarkan fakta pinjam-meminjam       │
│   nyata di Ethereum mainnet (Aave V3, Morpho Blue, Compound V3)  │
│   yang sudah dibuktikan lewat Attestcoin. Alamat ini belum       │
│   punya event yang terindeks.                                    │
│                                                                   │
│   [ Cek alamat lain ]     [ Lihat cara skor dihitung → ]         │
└─────────────────────────────────────────────────────────────────┘
```

**Loading:** `ScoreDial` skeleton berbentuk lingkaran (`Skeleton` bulat), 6 baris
`ComponentRow` skeleton, chart skeleton `h-64`.

**Error:** `INVALID_ADDRESS` → pesan inline di `AddressInput` sebelum request
terkirim (validasi lokal harusnya sudah menangkap ini, tapi API tetap sumber
kebenaran). `UPSTREAM_UNAVAILABLE`/`INTERNAL` → `ErrorState` full-section dengan
tombol retry; header alamat tetap tampil (kita tahu alamat mana yang gagal dicek).

**Aksi user:** buka/tutup tiap `ComponentRow` (state lokal `useState<Set<ScoreComponentKey>>`,
bukan URL — tidak perlu deep-link ke komponen terbuka). Klik `FactRow` di dalam
komponen → `/proofs/[factId]`. Klik "Ajukan pinjaman" → `/market` dengan
`?address=` di-carry agar `SupplyBorrowDialog` langsung tahu rasio personal user.
Toggle rentang waktu chart. Copy alamat. Klik ikon Etherscan → tab baru ke
`https://etherscan.io/address/{address}`.

---

### 4.3 `/proofs` dan `/proofs/[factId]` — Proof Viewer (pembeda utama)

**Tujuan:** ini halaman yang membuat juri **melihat** kedalaman Attestcoin, bukan
membacanya di deck. Diperlakukan sebagai fitur produk utama — desainnya harus terasa
seperti panel forensik/audit-trail, bukan halaman debug developer.

#### 4.3.1 `/proofs`

```
┌─────────────────────────────────────────────────────────────────┐
│  Proof Viewer                                                    │
│  Setiap baris di bawah adalah transaksi Ethereum mainnet nyata  │
│  yang dibuktikan secara kriptografis dan tercatat permanen.     │
├─────────────────────────────────────────────────────────────────┤
│ Filter:  [Jenis ▾] [Protokol ▾] [Aset ▾] [Rentang waktu ▾] [×]  │
├─────────────────────────────────────────────────────────────────┤
│ Waktu       Jenis        Protokol   Subjek         Jumlah   →   │
│ 2m lalu     LoanRepaid   Aave V3    0x1a2…c9f9     1,200 USDC ▸ │
│ 6m lalu     LoanOriginated Morpho   0x77b…2031     0.4 WETH  ▸  │
│ 11m lalu    Liquidated   Compound   0x9fe…88a1     500 USDC  ▸  │
│ …                                                                │
│                                          [ Muat lebih banyak ]   │
└─────────────────────────────────────────────────────────────────┘
```

- Filter disimpan di URL search params (`?kind=&protocol=&asset=&subject=&from=&to=`)
  agar tautan hasil filter bisa dibagikan — penting untuk demo juri ("lihat semua
  likuidasi Compound minggu ini": satu link).
  Filter tersedia sesuai kontrak yang didukung endpoint (`subject, kind, protocol,
  cursor, limit`); filter aset & rentang waktu diterapkan **di query yang sama**
  bila didukung backend, atau sebagai penyaringan tambahan di klien atas halaman
  yang sudah dimuat bila backend belum mendukung parameter itu — dicatat jelas di
  komentar kode, jangan diam-diam menyaring dari daftar yang sudah dipaginasi
  (`cursor`) karena itu merusak korespondensi jumlah hasil vs `meta.total`.
- Pagination: cursor-based (`meta.cursor`), tombol "Muat lebih banyak" meng-append
  (`useInfiniteQuery`), bukan pager bernomor — sejalan dengan `GET /v1/facts` yang
  cursor-based di `architecture.md` §9.

**Endpoint:** `GET /v1/facts` dengan query `subject, kind, protocol, cursor, limit`
(≤100). `limit` default 25 untuk daftar UI.

**Loading:** 10 baris `FactRow` skeleton.

**Kosong:** filter aktif menghasilkan nol baris → `EmptyState` *"Tidak ada fakta yang
cocok dengan filter ini."* + tombol "Reset filter". Beda pesan dari kondisi belum ada
fakta sama sekali di sistem (`EmptyState` *"Indexer belum mencatat fakta apa
pun."*).

**Error:** `ErrorState` menggantikan tabel, filter bar tetap interaktif (retry
mengulang query dengan filter yang sama).

**Aksi user:** ubah filter (debounce 300ms untuk yang berbasis teks, langsung untuk
select), klik baris → `/proofs/[factId]`, klik header kolom "Waktu" untuk toggle
urutan (jika didukung), "Muat lebih banyak".

#### 4.3.2 `/proofs/[factId]` — inti pembeda kompetitif

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Proof Viewer                                                   │
│                                                                   │
│  LoanRepaid                                    [Aave V3 logo]   │
│  Subjek  0x1a2b…c9f9                    [copy] [Etherscan ↗]    │
│  Jumlah  1,200.00 USDC  (≈ $1,199.94)                            │
│  Blok Ethereum #21,483,201 · tx index 88 · log index 3           │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Rantai bukti                                                    │
│                                                                   │
│  ①──────────②──────────③──────────④                            │
│  Tx Ethereum   Attestation   Proof        Fakta tercatat         │
│  (mainnet)     Creditcoin    (Attestcoin)  (FactRegistry)        │
│                                                                   │
│  ① 0xabc123…    blok 21483201, terkonfirmasi          ✓ done    │
│     [Lihat di Etherscan ↗]                                       │
│                                                                   │
│  ② Ter-attest di Creditcoin pada blok ter-attest #N   ✓ done    │
│     lag 8 menit 12 detik dari observasi                          │
│                                                                   │
│  ③ Proof dibangun via chainKey=3 (Ethereum mainnet)   ✓ done    │
│     dalam jendela murah (< 24 jam sejak tx)                       │
│                                                                   │
│  ④ recordFact() dipanggil di FactRegistry              ✓ done    │
│     factId  0xdeadbeef…                                          │
│     tx Creditcoin  0x998877…    [Lihat di explorer Creditcoin ↗]│
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Metadata mentah                                     [salin JSON]│
│  chainKey: 3   blockHeight: 21483201   txIndex: 88               │
│  logIndex: 3   observedAt: 1740512340  recordedAt: 1740512820    │
├─────────────────────────────────────────────────────────────────┤
│  Fakta lain dari subjek ini             [lihat semua di /score] │
│  FactRow  FactRow  FactRow                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Komponen:** `FactDetail`, `ProofChain` (visual 4-langkah), `AmountDisplay`,
`UsdDisplay`, `AddressDisplay`, `ExternalLinkButton` ×2 (Etherscan + explorer
Creditcoin), `FactKindBadge`.

**Endpoint:** `GET /v1/facts/:factId` → `Fact` lengkap + "referensi proof" (per
`architecture.md` §9 — bentuk field metadata proof tambahan mengikuti apa pun yang
didefinisikan Dev A di `docs/api.md`; UI merender field yang tersedia di respons dan
menyembunyikan baris "Attestation"/"Proof" secara individual jika field
pendukungnya `null`/tidak ada, **bukan** menampilkan nilai karangan sebagai
pengganti).

**Tautan keluar (wajib, dua arah):**
- Etherscan: `https://etherscan.io/tx/{fact.txHash}` (sisi Ethereum — tx sumber) dan
  `https://etherscan.io/address/{fact.subject}` (di header).
- Explorer Creditcoin: dibangun dari `NEXT_PUBLIC_CREDITCOIN_EXPLORER_URL` +
  `/tx/{fact.creditcoinTxHash}` (sisi pencatatan — lihat `lib/explorer.ts` §7.4).
  URL dasar explorer adalah env var karena domain explorer CC3 Testnet belum
  dikonfirmasi final saat dokumen ini ditulis — **bukan** placeholder di UI,
  melainkan titik konfigurasi standar yang harus diisi sebelum deploy (lihat §8
  checklist pra-submit).

**Loading:** skeleton meniru layout persis (header + 4 langkah `ProofChain` abu-abu
+ metadata block).

**Error:** `factId` tidak ditemukan (`404 NOT_FOUND`) → halaman menampilkan pesan
"Fakta ini tidak ditemukan — factId mungkin salah ketik atau belum tercatat." +
tombol kembali ke `/proofs`, **bukan** generic 404 Next.js, karena `factId` valid
secara format hex tapi tidak ada tetap harus dijelaskan dalam konteks produk.

**Aksi user:** salin `factId`/tx hash, salin metadata sebagai JSON, buka Etherscan
dan explorer Creditcoin di tab baru, navigasi ke fakta lain dari subjek yang sama,
kembali ke `/score/[subject]`.

---

### 4.4 `/market`

**Tujuan:** menampilkan reserve, suku bunga, dan — poin penjualan utama — seberapa
banyak modal yang dihemat user dibanding baseline 150% saat mereka meminjam dengan
skor terbukti.

```
┌─────────────────────────────────────────────────────────────────┐
│  Market                          TVL  $4.82M   Utilisasi  61.2% │
├─────────────────────────────────────────────────────────────────┤
│  Reserve      Supply APY   Borrow APY   Utilisasi   Total Supply│
│  USDC         3.1%         6.4%         61%         $2.1M    ▸ │
│  WETH         1.8%         4.2%         44%         $1.4M    ▸ │
│  USDT         2.9%         6.0%         58%         $0.9M    ▸ │
├─────────────────────────────────────────────────────────────────┤
│  Rasio kolateral kamu (0x1a2b…c9f9, Tier 4)                     │
│  ┌───────────────────────────────────────────────────────────┐│
│  │  110%   vs baseline 150%                                   ││
│  │  Pinjam $10,000 → kolateral kamu: $11,000                  ││
│  │             kolateral peminjam baru: $15,000                ││
│  │             hemat $4,000 modal terkunci                     ││
│  └───────────────────────────────────────────────────────────┘│
│  (belum connect / belum ada skor → panel ini tampil generik:    │
│   "Connect wallet untuk melihat rasio personalmu")               │
├─────────────────────────────────────────────────────────────────┤
│  [ Supply ]  [ Borrow ]        ← buka SupplyBorrowDialog         │
├─────────────────────────────────────────────────────────────────┤
│  Posisi aktif (jika connected & punya posisi)                   │
│  Aset   Disupply   Dipinjam   Health Factor                     │
│  USDC   5,000      3,000      ████████░░ 1.83      [Manage]     │
└─────────────────────────────────────────────────────────────────┘
```

**Komponen:** `ReserveTable`/`ReserveRow`, `CollateralSavingsCallout`,
`SupplyBorrowDialog`, `HealthFactorBar`, `TierBadge` (kecil, inline).

**Endpoint:**
- `GET /v1/market/summary` → TVL, utilisasi agregat.
- `GET /v1/market/reserves` → daftar aset (suku bunga, utilisasi per aset).
- `GET /v1/score/:address` (dari alamat wallet connected) → untuk
  `CollateralRatioBps` personal, dipakai menghitung penghematan.
- `GET /v1/market/positions/:address` → posisi aktif user.
- `GET /v1/prices` → harga terbukti untuk konversi ke USD di kalkulator penghematan.

**Kalkulator penghematan** (`CollateralSavingsCallout`) murni turunan dari data di
atas — bukan komponen input bebas: `requiredCollateral = borrowAmount *
collateralRatioBps / 10000`, dihitung untuk `collateralRatioBps` user vs `15000`
(baseline T0), memakai BigInt/viem `parseUnits`+`formatUnits`, **tidak** memakai
`Number` untuk aritmatika (lihat §6).

**Transaksi tulis:** `SupplyBorrowDialog` memakai `useWriteContract` (wagmi) ke ABI
`EfficiencyMarket` dari `@corolary/shared/abis`. Alur: `approve` (jika allowance
kurang, dicek via `useReadContract` ke ERC-20) → tunggu konfirmasi → panggil
`supply`/`borrow` → `useWaitForTransactionReceipt` → toast sukses + invalidate
query `positions` & `reserves`.

**Loading:** `ReserveTable` skeleton 3 baris, callout penghematan skeleton bar.

**Kosong:** belum connect wallet → callout personal diganti CTA generik (lihat
wireframe). Belum ada posisi → tabel posisi diganti `EmptyState` *"Belum ada posisi
aktif. Mulai dengan Supply."*

**Error:** kegagalan baca reserve → `ErrorState` menggantikan tabel; kegagalan
transaksi tulis (revert, user reject) → toast error dengan pesan yang di-decode dari
custom error kontrak bila memungkinkan (mapping error selector → pesan manusiawi
disiapkan di `lib/api/errors.ts` atau file terpisah `lib/contract-errors.ts`),
fallback ke pesan generik "Transaksi gagal — coba lagi."

**Aksi user:** pilih reserve → detail (baris expand atau navigasi ke
`/market/[asset]` jika kompleksitas justify — untuk cakupan hackathon, expand row
sudah cukup, tidak perlu route terpisah). Buka `SupplyBorrowDialog` dari tombol
global atau dari baris reserve tertentu (prefill aset). Approve → confirm →
lihat status transaksi live.

---

### 4.5 `/portfolio`

**Tujuan:** ringkasan posisi user + riwayat + jalur konkret menuju tier berikutnya —
halaman "apa yang harus saya lakukan selanjutnya".

```
┌─────────────────────────────────────────────────────────────────┐
│  Portfolio            0x1a2b…c9f9                                │
├───────────────────────────────┬───────────────────────────────┤
│  Skor saat ini                 │  Posisi aktif                  │
│  ScoreDial kecil  742  Tier 4  │  USDC  supply 5,000  borrow 3,000│
│  [lihat detail di /score →]    │  HF 1.83  ████████░░            │
├───────────────────────────────┴───────────────────────────────┤
│  Perkembangan skor                                               │
│  [ScoreHistoryChart, sama komponen dengan /score]                │
├─────────────────────────────────────────────────────────────────┤
│  Menuju tier berikutnya                                          │
│  (kosong bila sudah T4 — tampilkan pesan "Kamu di tier tertinggi")│
│  Kamu perlu +58 poin di "Lama riwayat" untuk naik ke Tier 3.     │
│  Cara konkret: pertahankan standing aktif ≥ 4 bulan lagi tanpa   │
│  keterlambatan pembayaran.                                       │
│  [lihat rincian komponen →]  (ke /score/[address], komponen terbuka)│
├─────────────────────────────────────────────────────────────────┤
│  Riwayat aktivitas                              [filter jenis ▾]│
│  ActivityTimeline: FactRow-style, urut waktu, semua kind         │
└─────────────────────────────────────────────────────────────────┘
```

**Komponen:** `ScoreDial` (`size="sm"`), `TierBadge`, `PositionTable`,
`ScoreHistoryChart`, `ScoreProgressCard`/`NextTierGuidance` (dipakai ulang dari
§4.2), `ActivityTimeline`.

**Endpoint:** wajib wallet connected (halaman ini tidak menerima parameter alamat
di URL — ini "punyaku", bukan explorer publik seperti `/score/[address]`). Bila
belum connect: full-page `EmptyState` *"Connect wallet untuk melihat portfolio
kamu."* + `WalletButton` besar.
- `GET /v1/score/:address`
- `GET /v1/score/:address/history`
- `GET /v1/market/positions/:address`
- `GET /v1/facts?subject={address}` (untuk `ActivityTimeline`, cursor-paginated)

**Panduan tier berikutnya** dihitung di klien dari `components[]` yang sudah ada di
`CreditScore` (komponen dengan `points < maxPoints` dan gap terbesar terhadap
`maxPoints` diprioritaskan sebagai saran) — **tidak** memanggil endpoint tambahan,
dan **tidak** mengarang angka proyeksi presisi tinggi; bahasanya arah ("butuh ~N
poin lagi di X"), bukan janji tanggal pasti kenaikan tier (skor bergantung fakta
masa depan yang belum terjadi).

**Loading/Kosong/Error:** sama prinsip dengan §4.2 — skeleton meniru layout,
`EmptyState` jujur untuk wallet belum connect atau belum punya fakta, `ErrorState`
per-section (satu query gagal tidak menjatuhkan seluruh halaman).

**Aksi user:** connect wallet, toggle rentang chart, filter timeline, klik entri
timeline → `/proofs/[factId]`, klik "lihat rincian komponen" → `/score/[address]`
dengan komponen terkait otomatis terbuka (lewat query param `?open=historyDuration`
yang dibaca `ComponentBreakdown` untuk set `defaultOpenKey`).

---

## 5. Katalog komponen

Semua tipe domain (`Fact`, `CreditScore`, `ScoreComponent`, `FactKind`, `Address`,
`Hex`) diimpor dari `@corolary/shared`. Props di bawah menambahkan tipe UI-only.

```ts
// components/score/ScoreDial.tsx
interface ScoreDialProps {
  score: number;                 // 0..1000
  tier: 0 | 1 | 2 | 3 | 4;
  size?: 'sm' | 'md' | 'lg';      // default 'md'
  animated?: boolean;             // animasi isi busur saat mount, default true
}

// components/score/TierBadge.tsx
interface TierBadgeProps {
  tier: 0 | 1 | 2 | 3 | 4;
  collateralRatioBps: number;     // ditampilkan sebagai "T4 · 110%"
  variant?: 'solid' | 'outline';  // default 'solid'
}

// components/score/CollateralRatioCallout.tsx
interface CollateralRatioCalloutProps {
  collateralRatioBps: number;
  baselineBps?: number;           // default 15000
}

// components/score/ComponentBreakdown.tsx
interface ComponentBreakdownProps {
  components: ScoreComponent[];   // 6 item, urutan sesuai ScoreComponentKey
  subject: Address;                // untuk query fakta per komponen
  defaultOpenKey?: ScoreComponentKey;
}

// components/score/ComponentRow.tsx
interface ComponentRowProps {
  component: ScoreComponent;
  subject: Address;
  isOpen: boolean;
  onToggle: () => void;
}

// components/score/ScoreHistoryChart.tsx
interface ScoreHistoryPoint {
  at: number;        // unix seconds
  score: number;
  tier: 0 | 1 | 2 | 3 | 4;
}
interface ScoreHistoryChartProps {
  points: ScoreHistoryPoint[];
  range: '30d' | '90d' | '1y' | 'all';
  onRangeChange: (range: '30d' | '90d' | '1y' | 'all') => void;
}

// components/score/NextTierGuidance.tsx
interface NextTierGuidanceProps {
  currentTier: 0 | 1 | 2 | 3 | 4;
  components: ScoreComponent[];
}

// components/proofs/FactRow.tsx
interface FactRowProps {
  fact: Fact;
  compact?: boolean;              // dipakai di landing/strip, default false
  onClick?: (factId: Hex) => void;
}

// components/proofs/FactTable.tsx
interface FactTableProps {
  facts: Fact[];
  isLoading?: boolean;
  onRowClick?: (factId: Hex) => void;
}

// components/proofs/FactFilters.tsx
interface FactFilterState {
  kind?: FactKind;
  protocol?: Address;
  asset?: Address;
  from?: number;
  to?: number;
}
interface FactFiltersProps {
  value: FactFilterState;
  onChange: (next: FactFilterState) => void;
  availableProtocols: { address: Address; name: string }[];
}

// components/proofs/FactDetail.tsx
interface FactDetailProps {
  fact: Fact;
}

// components/proofs/ProofChain.tsx
type ProofStepStatus = 'pending' | 'done' | 'unknown';
interface ProofChainStep {
  key: 'observed' | 'attested' | 'proved' | 'recorded';
  label: string;
  status: ProofStepStatus;
  detail?: string;                // mis. "lag 8 menit 12 detik"
  externalUrl?: string;
}
interface ProofChainProps {
  fact: Fact;
  steps: ProofChainStep[];
}

// components/market/ReserveTable.tsx
interface Reserve {
  asset: Address;
  assetSymbol: string;
  assetDecimals: number;
  supplyApyBps: number;
  borrowApyBps: number;
  utilizationBps: number;
  totalSupply: string;            // uint256 string
  totalBorrow: string;            // uint256 string
}
interface ReserveTableProps {
  reserves: Reserve[];
  isLoading?: boolean;
  onSelect?: (asset: Address) => void;
}

// components/market/SupplyBorrowDialog.tsx
interface SupplyBorrowDialogProps {
  mode: 'supply' | 'borrow';
  asset: Address;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collateralRatioBps?: number;    // dari skor user, dipakai untuk kalkulator borrow
}

// components/market/CollateralSavingsCallout.tsx
interface CollateralSavingsCalloutProps {
  collateralRatioBps: number;
  baselineBps?: number;           // default 15000
  exampleBorrowAmount?: string;   // uint256 string, default "10000000000" (10k USDC 6dp)
  exampleAssetDecimals?: number;  // default 6
  exampleAssetSymbol?: string;    // default "USDC"
}

// components/market/HealthFactorBar.tsx
interface HealthFactorBarProps {
  healthFactor: string;           // string desimal, mis "1.83"
  dangerThreshold?: number;       // default 1.0
  warningThreshold?: number;      // default 1.2
}

// components/shared/AddressInput.tsx
interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (address: Address) => void;
  placeholder?: string;
  isLoading?: boolean;
}

// components/shared/AddressDisplay.tsx
interface AddressDisplayProps {
  address: Address;
  truncate?: boolean;             // default true
  copyable?: boolean;             // default true
  explorer?: 'etherscan' | 'creditcoin' | 'none';  // default 'none'
}

// components/shared/ProtocolLogo.tsx
interface ProtocolLogoProps {
  protocolName: string;           // "Aave V3" | "Morpho Blue" | "Compound V3"
  size?: number;                  // px, default 20
  monochrome?: boolean;           // default true saat size < 32
}

// components/shared/AmountDisplay.tsx
interface AmountDisplayProps {
  amount: string;                 // uint256 sebagai string, WAJIB
  decimals: number;
  symbol: string;
  maxFractionDigits?: number;     // default 2
}

// components/shared/UsdDisplay.tsx
interface UsdDisplayProps {
  amountUsd: string | null;       // null = tidak ada harga terbukti
  fallback?: string;              // default "—"
}

// components/shared/RelativeTime.tsx
interface RelativeTimeProps {
  unixSeconds: number;
  mode?: 'auto' | 'exact';        // 'auto' = "3 menit lalu", 'exact' = ISO tooltip
}

// components/shared/FactKindBadge.tsx
interface FactKindBadgeProps {
  kind: FactKind;
}

// components/shared/EmptyState.tsx
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

// components/shared/ErrorState.tsx
interface ErrorStateProps {
  code?: string;                  // dari ApiResponse error.code
  message: string;
  onRetry?: () => void;
}
```

---

## 6. Formatting angka (kritis)

**Aturan nol-pengecualian: `uint256` (dan turunannya — `amount`, saldo, jumlah
transfer) SELALU direpresentasikan sebagai `string` di seluruh lintas batas
TypeScript. Tidak pernah `number`.** `Number.MAX_SAFE_INTEGER` adalah
`9007199254740991` — jauh di bawah kapasitas `uint256`. Konversi diam-diam ke
`number` di mana pun (termasuk `parseFloat(amount)` untuk "cuma butuh kira-kira")
adalah bug, bukan jalan pintas.

`apps/web/src/lib/format.ts`:

```ts
import { formatUnits, parseUnits } from 'viem';
import type { Address, Hex } from '@corolary/shared';

/**
 * uint256 string → string tampilan token, mis "1,200.00".
 * Pakai viem formatUnits (BigInt di bawahnya) — TIDAK PERNAH Number(amount).
 */
export function formatTokenAmount(
  amount: string,
  decimals: number,
  opts: { maxFractionDigits?: number } = {},
): string {
  const { maxFractionDigits = 2 } = opts;
  const raw = formatUnits(BigInt(amount), decimals); // string desimal penuh
  const [whole, frac = ''] = raw.split('.');
  const truncatedFrac = frac.slice(0, maxFractionDigits);
  const withGrouping = Number(whole).toLocaleString('en-US'); // aman: `whole`
    // bagian integer di sisi kiri titik desimal setelah formatUnits masih bisa
    // melebihi safe integer untuk saldo ekstrem — untuk kasus itu, grouping manual
    // (tanpa Number()) dipakai; helper `groupThousands(whole)` string-only
    // disediakan di file yang sama untuk saldo > 2^53.
  return truncatedFrac
    ? `${withGrouping}.${truncatedFrac}`
    : withGrouping;
}

/** amountUsd string|null (sudah desimal, dari PriceRegistry via API) → "$1,199.94" atau fallback. */
export function formatUsd(amountUsd: string | null, fallback = '—'): string {
  if (amountUsd === null) return fallback;
  const n = Number(amountUsd); // aman: harga USD, bukan uint256 mentah — sudah
                                 // didesimalkan API, rentang nilainya kecil
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** bps integer → "150.00%" */
export function formatBps(bps: number, fractionDigits = 2): string {
  return `${(bps / 100).toFixed(fractionDigits)}%`;
}

/** Address → "0x1a2b…c9f9" */
export function shortenAddress(address: Address, chars = 4): string {
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

/** Hex (factId/txHash) → "0xdead…beef" — dipendekkan lebih agresif dari alamat */
export function shortenHex(hex: Hex, chars = 6): string {
  return `${hex.slice(0, 2 + chars)}…${hex.slice(-chars)}`;
}

/** unix seconds → "3 menit lalu" (Bahasa Indonesia, Intl.RelativeTimeFormat) */
export function formatRelativeTime(unixSeconds: number): string {
  const rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
  const diffSeconds = unixSeconds - Math.floor(Date.now() / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['day', 86400],
    ['hour', 3600], ['minute', 60], ['second', 1],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diffSeconds) >= secs || unit === 'second') {
      return rtf.format(Math.round(diffSeconds / secs), unit);
    }
  }
  return rtf.format(0, 'second');
}

/** score 0..1000 → "742" — tabular-nums via className, bukan diformat di sini */
export function formatScore(score: number): string {
  return score.toLocaleString('en-US');
}
```

**Aturan tambahan:**
- Aritmatika atas `amount` (mis. kalkulator penghematan kolateral di `/market`,
  jumlah total di tabel) **selalu** lewat `BigInt`/viem `parseUnits`+`formatUnits`,
  tidak pernah `Number(amount) * x`.
- `amountUsd` boleh diperlakukan sebagai `Number` untuk *tampilan* (harga USD sudah
  desimal kecil dari API, bukan uint256 mentah) — tapi tetap **tidak** untuk kalkulasi
  penting lintas komponen; treat sebagai display-only.
- Semua output fungsi di atas dirender dengan `className="font-mono tabular-nums"`
  di titik pemakaian (§2.2).
- Persentase kolateral **selalu** dari `collateralRatioBps` (integer, `bps`), tidak
  pernah dari pecahan desimal buatan sendiri (`1.5` untuk 150%) — sumber kebenaran
  satu representasi saja, sesuai `architecture.md` §8.3.

---

## 7. Lapisan data

### 7.1 Klien API bertipe

```ts
// lib/api/client.ts
import type { Address } from '@corolary/shared';
import { getFixture } from '../dev-fixtures';

type ApiResponse<T> =
  | { ok: true; data: T; meta?: { cursor?: string; total?: number } }
  | { ok: false; error: { code: string; message: string } };

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/v1`;
const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === 'true';

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (USE_FIXTURES) {
    // hanya aktif saat dev secara eksplisit — lihat §8
    return getFixture<T>(path);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const json = (await res.json()) as ApiResponse<T>;

  if (!json.ok) {
    throw new ApiError(json.error.code, json.error.message);
  }
  return json.data;
}
```

`endpoints.ts` — satu fungsi per baris tabel di `architecture.md` §9:

```ts
// lib/api/endpoints.ts
import { apiFetch } from './client';
import type { Fact, CreditScore, Address, Hex } from '@corolary/shared';

export const endpoints = {
  health: () => apiFetch<{ version: string; uptime: number }>('/health'),
  chains: () => apiFetch<ChainStatus[]>('/chains'),
  indexerStatus: () => apiFetch<IndexerStatus>('/indexer/status'),

  facts: (params: FactsQuery) =>
    apiFetch<Fact[]>(`/facts${toQueryString(params)}`),
  fact: (factId: Hex) => apiFetch<Fact>(`/facts/${factId}`),

  score: (address: Address) => apiFetch<CreditScore>(`/score/${address}`),
  scoreHistory: (address: Address, params: { from?: number; to?: number }) =>
    apiFetch<ScoreHistoryPoint[]>(`/score/${address}/history${toQueryString(params)}`),

  marketSummary: () => apiFetch<MarketSummary>('/market/summary'),
  marketReserves: () => apiFetch<Reserve[]>('/market/reserves'),
  marketPositions: (address: Address) =>
    apiFetch<Position[]>(`/market/positions/${address}`),

  prices: () => apiFetch<PriceEntry[]>('/prices'),
};
```

Tipe `ChainStatus`, `IndexerStatus`, `MarketSummary`, `Reserve`, `Position`,
`PriceEntry`, `ScoreHistoryPoint` didefinisikan di `types/index.ts` **hanya** jika
belum ada padanannya di `@corolary/shared` — begitu Dev A mengekspornya di sana,
definisi lokal dihapus dan diganti re-export, tidak dipertahankan dobel.

### 7.2 Pola TanStack Query

Satu hook per resource, `staleTime` disesuaikan volatilitas data:

```ts
// hooks/useScore.ts
export function useScore(address: Address | undefined) {
  return useQuery({
    queryKey: queryKeys.score(address),
    queryFn: () => endpoints.score(address!),
    enabled: !!address,
    staleTime: 30_000,        // skor tidak berubah tiap detik
    retry: (count, err) => err instanceof ApiError && err.code !== 'NOT_FOUND' && count < 2,
  });
}
```

| Hook | `staleTime` | `refetchInterval` | Catatan |
|---|---|---|---|
| `useIndexerStatus` | `10_000` | `15_000` | landing + banner status, harus terasa "hidup" |
| `useMarketSummary` | `20_000` | `30_000` | |
| `useMarketReserves` | `20_000` | `30_000` | |
| `usePrices` | `15_000` | `20_000` | harga terbukti, wajar lebih sering |
| `useScore` | `30_000` | — (manual refetch via invalidate setelah tx) | |
| `useScoreHistory` | `60_000` | — | |
| `useFacts` (list) | `15_000` | — | `useInfiniteQuery`, `getNextPageParam` dari `meta.cursor` |
| `useFact` (detail) | `Infinity` | — | fakta yang sudah tercatat tidak berubah — aman cache permanen per sesi |
| `usePositions` | `10_000` | — | invalidate manual setelah tx supply/borrow/repay |

### 7.3 Key cache

```ts
// lib/api/query-keys.ts
export const queryKeys = {
  chains: () => ['api', 'chains'] as const,
  indexerStatus: () => ['api', 'indexer-status'] as const,
  facts: (filters: FactFilterState) => ['api', 'facts', filters] as const,
  fact: (factId: Hex) => ['api', 'fact', factId] as const,
  score: (address?: Address) => ['api', 'score', address] as const,
  scoreHistory: (address?: Address, range?: string) =>
    ['api', 'score-history', address, range] as const,
  marketSummary: () => ['api', 'market-summary'] as const,
  marketReserves: () => ['api', 'market-reserves'] as const,
  positions: (address?: Address) => ['api', 'positions', address] as const,
  prices: () => ['api', 'prices'] as const,
};
```

Prefix `'api'` memisahkan namespace dari key internal wagmi (`['readContract', ...]`
dll.) di `QueryClient` yang sama — mencegah kolisi tanpa perlu dua `QueryClient`
terpisah.

### 7.4 Explorer link builder

```ts
// lib/explorer.ts
import type { Address, Hex } from '@corolary/shared';

const CREDITCOIN_EXPLORER_BASE =
  process.env.NEXT_PUBLIC_CREDITCOIN_EXPLORER_URL ?? '';

export function buildEtherscanTxUrl(txHash: Hex): string {
  return `https://etherscan.io/tx/${txHash}`;
}
export function buildEtherscanAddressUrl(address: Address): string {
  return `https://etherscan.io/address/${address}`;
}
export function buildCreditcoinTxUrl(txHash: Hex): string {
  if (!CREDITCOIN_EXPLORER_BASE) return '';
  return `${CREDITCOIN_EXPLORER_BASE}/tx/${txHash}`;
}
```

`ExternalLinkButton` yang menerima `href=""` (base explorer belum dikonfigurasi)
otomatis `disabled` dengan tooltip "Explorer Creditcoin belum dikonfigurasi" —
degradasi yang jujur, bukan link mati yang diam-diam 404.

### 7.5 Strategi revalidasi & penanganan error

- Semua fetch List/Detail lewat TanStack Query — **tidak ada** `useEffect` +
  `fetch` manual di komponen.
- Mutasi (`useWriteContract` di `/market`) memanggil `queryClient.invalidateQueries`
  untuk `positions`, `marketReserves`, `score` (rasio bisa berubah efeknya di skor
  berikutnya) setelah `useWaitForTransactionReceipt` sukses.
  Setelah transaksi Ethereum sisi sumber selesai, skor **tidak** langsung berubah —
  itu menunggu siklus indexer + attestation (~8 menit). UI tidak boleh berpura-pura
  instan; toast sukses transaksi eksplisit menyebut "Perubahan akan tercermin di
  skor setelah fakta terbukti (~8 menit)."
- Error network (`fetch` gagal total, bukan `ApiError`) ditangkap di boundary
  `error.tsx` per route group untuk kegagalan fatal, dan di level komponen (via
  `isError` dari `useQuery`) untuk kegagalan parsial — lihat matriks loading/kosong/
  error tiap halaman di §4.
- Retry default TanStack Query: 2× dengan backoff eksponensial, **kecuali**
  `NOT_FOUND` dan `INVALID_ADDRESS` (tidak ada gunanya retry kesalahan permanen).

---

## 8. Kepatuhan aturan nol-mock

`apps/web/src/lib/dev-fixtures.ts` adalah **satu-satunya** tempat data contoh boleh
hidup di seluruh `apps/web`. Aturannya:

```ts
// lib/dev-fixtures.ts
// PERANCAH PEMBANGUNAN, BUKAN FITUR PRODUK.
// Aktif hanya bila NEXT_PUBLIC_USE_FIXTURES === 'true'. Default: MATI.
// Dipanggil HANYA dari lib/api/client.ts, tidak pernah diimpor langsung oleh
// komponen atau halaman.

import type { Fact, CreditScore } from '@corolary/shared';

const fixtureFacts: Fact[] = [
  /* data berbentuk PERSIS sama dengan tipe Fact asli — dipakai untuk
     mengembangkan UI selagi endpoint /v1/facts belum hidup dari Dev A.
     Setiap field diisi masuk akal (alamat checksum valid, factId format benar)
     supaya komponen format (§6) bisa diuji tanpa backend berjalan. */
];

const fixturesByPath: Record<string, unknown> = {
  '/facts': fixtureFacts,
  // ... satu entri per endpoint yang sedang menunggu Dev A
};

export function getFixture<T>(path: string): T {
  const key = path.split('?')[0];
  if (!(key in fixturesByPath)) {
    throw new Error(`No fixture registered for ${path}. Endpoint sudah hidup? ` +
      `Set NEXT_PUBLIC_USE_FIXTURES=false.`);
  }
  return fixturesByPath[key] as T;
}
```

**Cara kerja end-to-end** (selaras `workstreams.md` §2):
1. Selama endpoint backend belum hidup, `apps/web` jalan dengan
   `NEXT_PUBLIC_USE_FIXTURES=true` di `.env.local` **milik masing-masing developer**
   — tidak pernah di `.env.example` bernilai `true`, dan tidak pernah di environment
   Vercel produksi.
2. Begitu Dev A mengumumkan satu endpoint hidup, entri yang bersangkutan dihapus
   dari `fixturesByPath` (bukan dikomentari — dihapus, supaya lupa mengaktifkan
   kembali secara tidak sengaja itu mustahil untuk endpoint tersebut).
3. Setelah **semua** endpoint hidup, `dev-fixtures.ts` idealnya kosong isi map-nya
   (`{}`) — file boleh tetap ada sebagai kerangka, tapi tidak lagi punya data untuk
   dikembalikan.

**Checklist pra-submit (wajib, dalam urutan ini):**

1. `grep -r "NEXT_PUBLIC_USE_FIXTURES" apps/web/.env*` → pastikan tidak ada file
   env yang di-commit dengan nilai `true`.
2. Set `NEXT_PUBLIC_USE_FIXTURES=false` secara eksplisit di environment variables
   Vercel (Production **dan** Preview), jangan mengandalkan default kode saja.
3. `fixturesByPath` di `dev-fixtures.ts` kosong (`{}`) — jika masih berisi entri,
   berarti masih ada endpoint yang UI-nya belum benar-benar terhubung ke backend
   nyata; **jangan submit** sebelum ini selesai.
4. Grep manual tambahan: `grep -rn "hardcode\|TODO\|Coming soon\|dummy\|placeholder"
   apps/web/src` — nol hasil di kode produk (komentar penjelas boleh mengandung kata
   ini bila membicarakan aturan, tapi tidak boleh ada string yang dirender ke UI).
5. Jalankan `pnpm build` lalu `pnpm check:no-mocks` (skrip milik Dev A, lihat
   `architecture.md` §13) dari root repo — **harus lulus**, bukan sekadar
   memperingatkan.
6. Klik-uji manual: buka `/` dan `/market` dengan koneksi API dimatikan sebentar
   (matikan service backend) — pastikan yang muncul adalah `ErrorState`/skeleton,
   **bukan** angka yang masih terlihat masuk akal padahal itu sisa fixture yang
   lupa dicabut.

---

## 9. Aksesibilitas & responsif

**Aksesibilitas (konkret, bukan "harus accessible"):**

- Kontras warna: seluruh pasangan teks/latar di §2.3 diverifikasi memenuhi WCAG AA
  (rasio ≥ 4.5:1 untuk teks body, ≥ 3:1 untuk teks besar ≥ 24px). `--color-ink-500`
  di atas `--color-bg` dicek khusus karena ini pasangan paling rendah kontrasnya
  yang dipakai luas (label/meta) — jika di kemudian hari tokennya diubah, ulangi
  verifikasi ini sebelum ship.
- Semua elemen interaktif (`Button`, `NavLink`, baris tabel yang bisa diklik) punya
  `:focus-visible` ring dengan `--color-focus-ring`, `outline-offset: 2px` — tidak
  pernah `outline: none` tanpa pengganti.
- `ScoreDial` (SVG) punya `role="img"` + `aria-label` deskriptif, mis.
  `"Skor kredit 742 dari 1000, Tier 4"` — nilai numerik tidak boleh hanya
  tersampaikan lewat posisi visual busur.
- `ProofChain` memakai `<ol>` semantik dengan `aria-current="step"` pada langkah
  yang relevan, bukan `<div>` bertumpuk yang hanya benar secara visual.
- Semua ikon aksi-saja (tombol copy, tombol external link tanpa label teks) punya
  `aria-label` (mis. `aria-label="Salin alamat"`, `aria-label="Buka di Etherscan"`).
- Form (`AddressInput`, `SupplyBorrowDialog`) memakai `<label>` terasosiasi
  (`htmlFor`/`id`), pesan error terhubung lewat `aria-describedby`, bukan hanya warna
  merah.
- Tabel data (`FactTable`, `ReserveTable`) memakai elemen `<table>` semantik
  (shadcn `Table`) dengan `<th scope="col">` — bukan `div` grid yang meniru tabel
  secara visual saja.
- Mode gelap/terang: `ThemeToggle` memakai `next-themes`-style pattern (class-based
  di `<html>`), menghormati `prefers-color-scheme` sebagai default awal, dan
  preferensi tersimpan (`localStorage`) untuk kunjungan berikutnya.
- Animasi (`ScoreDial` fill, transisi `ProofChain`) menghormati
  `prefers-reduced-motion: reduce` — durasi dipotong ke instan, tidak dihilangkan
  begitu saja (state akhir tetap harus tampil benar).

**Responsif (breakpoint Tailwind default: `sm 640` `md 768` `lg 1024` `xl 1280`):**

- Header (`AppHeader`): nav penuh di `≥ md`; di bawah `md`, nav masuk ke `Sheet`
  (drawer) yang dipicu tombol hamburger, `WalletButton` tetap selalu terlihat di
  header (tidak ikut masuk drawer).
- `/score/[address]`: layout dua kolom (`ScoreDial` + rasio kolateral) di `≥ lg`
  bertumpuk jadi satu kolom di bawahnya — `ScoreDial` tetap ukuran `md` (tidak
  mengecil drastis) karena ini elemen fokus utama halaman.
- `FactTable`/`ReserveTable`: di `< md`, tabel bertransformasi jadi daftar kartu
  (`FactRow` dalam mode `compact` bertumpuk vertikal per baris, bukan scroll
  horizontal tabel penuh) — kolom yang di-drop di tampilan kartu: log index,
  tx index (tetap ada di halaman detail).
- `ProofChain`: layout horizontal 4 langkah di `≥ md`, vertikal (garis turun ke
  bawah, bukan menyamping) di `< md` — arah alur tetap logis dibaca top-to-bottom.
- `SupplyBorrowDialog`: `Dialog` penuh di `≥ sm`, full-screen `Sheet` dari bawah di
  `< sm` (pola shadcn standar untuk form mobile).
- Target sentuh minimum `44×44px` untuk semua tombol/baris yang bisa diklik di
  breakpoint mobile.
- Chart (`ScoreHistoryChart`, Recharts `ResponsiveContainer`): tinggi tetap
  (`h-64`), lebar mengikuti kontainer; label sumbu-x dikurangi kepadatannya
  (`interval="preserveStartEnd"`) di layar sempit agar tidak tumpang tindih.

---

## 10. Checklist demo video

Urutan ini dirancang untuk membuktikan **kedalaman Attestcoin** ke juri dalam waktu
sesingkat mungkin — prinsipnya: jangan menjelaskan lewat slide apa yang bisa
ditunjukkan lewat klik.

1. **Landing (`/`)** — tunjukkan statistik hidup (fakta terbukti, peminjam
   terindeks, lag attestation) sambil menyebut lisan: *"Angka ini live dari API,
   diambil dari Ethereum mainnet nyata via Attestcoin — bukan mockup."* Scroll ke
   section "cara kerja" 3 detik saja, jangan berlama-lama di sini — bagian ini
   pendukung, bukan bintang.

2. **`/proofs` (daftar)** — filter ke satu jenis fakta (mis. `Liquidated`) untuk
   menunjukkan filter bekerja atas data nyata, lalu klik satu baris.

3. **`/proofs/[factId]` (inti demo — habiskan waktu paling banyak di sini)** —
   telusuri `ProofChain` empat langkah satu per satu sambil narasi: tx Ethereum
   asli → tunggu attestation ~8 menit → proof dibangun di jendela murah → fakta
   tercatat permanen di FactRegistry. **Klik tautan Etherscan langsung di video**
   untuk membuktikan tx itu benar-benar ada di mainnet, lalu kembali dan klik
   tautan explorer Creditcoin untuk membuktikan `recordFact` benar-benar
   tereksekusi on-chain. Ini momen paling penting di seluruh video — jangan
   dipercepat.

4. **`/score/[address]`** — pakai alamat yang barusan muncul di fakta yang
   ditunjukkan pada langkah 3 (kontinuitas naratif: "fakta yang baru kita
   telusuri ini adalah salah satu dari 12 yang membentuk skor 742 milik alamat
   ini"). Buka satu `ComponentRow` (mis. "Lama riwayat"), tunjukkan daftar
   `FactRow` di dalamnya, klik salah satu untuk membuktikan siklusnya tertutup:
   skor → komponen → fakta → proof (kembali ke halaman langkah 3).

5. **`/market`** — tunjukkan `CollateralSavingsCallout` dengan angka personal
   alamat yang sama: rasio 110% vs baseline 150%, penghematan modal dalam dolar.
   Narasikan model bisnisnya secara singkat: *"Ini bukan pinjaman tanpa jaminan —
   tetap over-kolateral, hanya lebih efisien untuk peminjam yang terbukti."*

6. **`/portfolio`** — tunjukkan `ScoreHistoryChart` (perkembangan skor dari waktu
   ke waktu) dan panduan "menuju tier berikutnya" untuk menutup narasi dengan
   arah produk ke depan, bukan cuma snapshot statis.

7. **(opsional, jika waktu tersisa)** Toggle salah jaringan di wallet untuk
   menunjukkan `NetworkGuard` bekerja, lalu ganti kembali dan tunjukkan sekilas
   dark mode via `ThemeToggle` — bukti polish, ditaruh di akhir karena bobotnya
   paling rendah dibanding langkah 1–6.

**Yang harus dihindari saat rekam:** jangan pernah menjeda di halaman yang sedang
menampilkan `Skeleton`/loading state lebih dari 2 detik (edit di post-production
atau tunggu di luar rekaman) — video demo harus terasa selincah produk beneran,
bukan menonjolkan latensi jaringan.
