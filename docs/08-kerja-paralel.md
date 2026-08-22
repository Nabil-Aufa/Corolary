# Kerja Paralel — Dua Orang

Tim: **2 orang.** Satu pegang frontend, satu pegang backend (kontrak + worker + deploy).

Dokumen ini mengatur siapa memegang apa, apa yang diserahterimakan, dan apa yang tidak
boleh diubah sepihak. Tujuannya satu: **tidak pernah ada yang menunggu, dan tidak pernah
ada yang menimpa pekerjaan orang lain.**

---

## 1. Urutan besar

```
TAHAP 1 ─────────────────────────────────────────────────────────
  BACKEND  : kontrak → test di fixture nyata → deploy → ingest pertama
  FRONTEND : desain, shell, komponen, seluruh UI di atas MOCK DATA

             ⬇  TITIK BEKU  ⬇
             artefak: ABI JSON + deployments/<network>.json

TAHAP 2 ─────────────────────────────────────────────────────────
  BACKEND  : off-chain worker          ║  FRONTEND : sambungkan data nyata
  (paralel penuh — tidak saling menunggu)

TAHAP 3 ─────────────────────────────────────────────────────────
  Observatory · dashboard final · deck · video demo
```

**Kenapa kontrak duluan, bukan langsung paralel tiga-tiganya:**
kontrak adalah sumber kebenaran bentuk data. Frontend *dan* worker dua-duanya
bergantung padanya — worker memanggil `ingest()`, frontend membaca event dan
view function. Kalau kontrak berubah setelah keduanya jalan, dua orang menulis ulang.
Satu fase serial yang pendek jauh lebih murah daripada itu.

**Frontend tidak menganggur di Tahap 1.** Sekitar 60–70% pekerjaan frontend tidak
butuh ABI sama sekali (lihat §4).

---

## 2. Kepemilikan file — jangan pernah dilanggar

Tidak ada satu file pun yang dimiliki dua orang.

| Path | Pemilik | Boleh disentuh orang lain? |
|---|---|---|
| `packages/contracts/**` | **Backend** | ❌ |
| `packages/worker/**` | **Backend** | ❌ |
| VPS + deployment worker | **Backend** | ❌ termasuk kunci operator |
| `tools/recon/**` | **Backend** | ❌ |
| `deployments/*.json` | **Backend** (dihasilkan) | ❌ frontend hanya membaca |
| `packages/web/**` | **Frontend** | ❌ |
| `packages/web/src/mocks/**` | **Frontend** | ❌ — dan **dihapus** di Fase 6c |
| `tools/verify-no-mock.sh` | **Berdua** (gerbang rilis) | ✅ boleh diperketat, ❌ jangan dilonggarkan sepihak |
| `docs/**` | **Berdua** | ⚠️ lihat §6 |
| `CLAUDE.md`, `PROGRESS.md`, `README.md` | **Berdua** | ⚠️ lihat §6 |

Kalau kamu merasa perlu mengubah file milik orang lain — **jangan.** Bilang ke dia.
Hampir selalu itu tanda ada kontrak antarmuka yang perlu dibicarakan, bukan file yang
perlu diedit.

---

## 3. Artefak serah-terima — konkret, bukan "nanti aku kabari"

### Dari Backend ke Frontend, di akhir Tahap 1

**1. ABI** — hasil `forge build`, disalin ke lokasi tetap:

```
packages/web/src/abi/ReserveLedger.json
packages/web/src/abi/SolvencyLockedToken.json
packages/web/src/abi/Observatory.json
```

**2. Alamat & konfigurasi deployment:**

```jsonc
// deployments/cc3-testnet.json
{
  "network":      "cc3-testnet",
  "chainId":      102031,
  "rpc":          "https://rpc.cc3-testnet.creditcoin.network",
  "explorer":     "https://creditcoin-testnet.blockscout.com",
  "deployedAt":   { "block": 5238272, "timestamp": "2026-08-..." },
  "sourceChainKey": 3,
  "sourceChain":  { "name": "Ethereum mainnet", "chainId": 1, "explorer": "https://etherscan.io" },
  "contracts": {
    "ReserveLedger":        "0x…",
    "SolvencyLockedToken":  "0x…",
    "Observatory":          "0x…"
  },
  "treasury": "0x…",
  "assets": [
    { "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "symbol": "USDC", "decimals": 6, "haircutBps": 10000 }
  ]
}
```

Frontend **membaca file ini**, tidak pernah menempelkan alamat di kode.
Satu file per network (`cc3-testnet.json`, nanti `cc-mainnet.json`).

**3. Satu tx hash ingest sungguhan** — bukti pipeline hidup, sekaligus data nyata
pertama untuk dipasang di feed.

### Dari Frontend ke Backend

Tidak ada. Frontend tidak menghasilkan apa pun yang dibutuhkan backend. Itu memang
disengaja — arah ketergantungannya satu arah, jadi backend tidak akan pernah terblokir
oleh frontend.

---

## 4. Yang bisa dikerjakan Frontend SEBELUM ABI ada

Semua ini tidak menyentuh chain sama sekali:

- [ ] Arah desain & brand (`Corolary`, tagline *"Solvency isn't claimed. It follows."*)
- [ ] Layout dashboard, sistem komponen, tipografi
- [ ] **Format angka** — jumlah token, rasio bps → persen, nilai besar, presisi desimal.
      Ini butuh ketelitian sendiri dan gampang diremehkan.
- [ ] Rasio raksasa + indikator status `TERKUNCI` / `MEMBEKU`
- [ ] Cadangan vs suplai, headroom minting
- [ ] Feed bukti (dari mock) — tiap baris dua tautan: Etherscan + Blockscout,
      **plus `initiator`**: *"$2,1 juta keluar — dipicu oleh `0xABC…`"*.
      Feed yang menjawab **siapa**, bukan cuma **berapa**
- [ ] Panel serangan — tombol "cetak melebihi cadangan" → tampilan revert
- [ ] Pemilih observatory
- [ ] State kosong, loading, error, RPC mati
- [ ] Panel "verify yourself" — alamat kontrak + endpoint RPC terbuka
- [ ] Responsif; terbaca dari jarak 3 meter saat demo

**Ditambahkan 9 Agustus — lapisan manusia (spek §9.2). Ini yang menaikkan sumbu terlemah
proyek, dan seluruhnya bisa dikerjakan sebelum ABI ada:**

- [ ] **Holder view** — halaman untuk manusia, bukan auditor. Tiga pertanyaan, tiga
      jawaban: *uangku masih ada? · bisa aku ambil? · dikasih tahu kalau ada apa-apa?*
      **Dua lapis:** kalimat manusia di atas, angka teknis satu klik di bawahnya.
- [ ] **Tombol Tebus** sebagai elemen paling menonjol setelah rasio. Copy-nya:
      *"Pintu keluar ini tidak bisa dikunci siapa pun. Termasuk penerbitnya. Termasuk kami."*
- [ ] **Papan skor pembobolan** — `Percobaan: N · Berhasil: 0`
- [ ] Blok README kunci issuer — jelaskan **kenapa** kuncinya publik, jangan cuma tampilkan

⛔ **Dilarang di lapisan ini:** aplikasi fintech palsu dengan akun/saldo karangan ·
menyembunyikan lapisan teknis · onboarding wallet yang ribet.

Yang **harus menunggu** ABI cuma satu: lapisan pengambilan data.

---

## 5. Mock data — perancah bertanggal mati

> ⚠️ **Mock adalah perancah pembangunan, bukan bagian produk.** Tanggal matinya
> **Fase 6c**. Produk final yang dilihat juri harus nol mock — aturan lengkap dan
> alasannya ada di `CLAUDE.md` bagian "⚠️ PRODUK FINAL: NOL MOCK". Ini gerbang rilis,
> bukan preferensi.

Frontend membangun di atas file mock yang bentuknya **persis** seperti data chain nanti.
Dibuat frontend, tapi bentuknya wajib mengikuti Lampiran A & C di
`03-spesifikasi-produk.md`.

### 5.0 Bentuk yang membuat mock bisa dicabut dalam sekali gerak

Rancang ini di **hari pertama**. Kalau mock menyebar ke dalam komponen, mencabutnya di
Fase 6c berarti membongkar seluruh UI di minggu paling sibuk.

```
packages/web/src/
  data/
    source.ts        ← SATU-SATUNYA titik masuk data. Komponen impor dari sini.
    chain.ts         ← implementasi nyata (eth_call / eth_getLogs)
  mocks/
    state.json       ← hanya diimpor oleh source.ts, tidak oleh komponen mana pun
    feed.json
```

```ts
// data/source.ts   — packages/web adalah Next.js (spek §11), jadi NEXT_PUBLIC_*
const MODE = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'chain';

// Gerbang rilis: build produksi menolak berjalan di atas mock.
// Sengaja throw, bukan warning — build yang gagal tidak bisa tanpa sengaja ter-deploy.
if (process.env.NODE_ENV === 'production' && MODE !== 'chain') {
  throw new Error(`Refusing production build with NEXT_PUBLIC_DATA_SOURCE=${MODE}`);
}
```

Kalau nanti frontend memilih Vite alih-alih Next.js, namanya jadi
`VITE_DATA_SOURCE` + `import.meta.env.PROD` — mekanismenya identik, dan
`tools/verify-no-mock.sh` sudah mengenali dua-duanya.

Tiga aturan yang mengikat:

1. **Tidak ada komponen yang mengimpor dari `src/mocks/`.** Hanya `source.ts`.
2. **Tidak ada angka solvabilitas / baris feed yang ditulis literal** di komponen,
   story, atau file style. Kalau butuh contoh untuk styling, ambil dari `source.ts`.
3. **Tidak ada fallback ke mock saat chain gagal.** RPC mati adalah state UI tersendiri
   (`RPC unreachable`), bukan alasan menampilkan angka cadangan. Angka palsu yang
   terlihat sehat adalah kegagalan terburuk yang bisa dilakukan produk ini — seluruh
   tesisnya adalah "angka ini tidak bisa dikarang".

```jsonc
// packages/web/src/mocks/state.json — hasil eth_call
{
  "reserves":              "12500000000",   // 12.500 USDC (6 desimal), string
  "totalSupply":           "10000000000",   // 10.000 token
  "collateralRatioBps":    "12500",         // 125,00%
  "minCollateralRatioBps": "10000",         // lantai 100%
  "mintableHeadroom":      "2500000000",
  "isMintingFrozen":       false,
  "lastIngestedHeight":    25665308
}
```

```jsonc
// packages/web/src/mocks/feed.json — hasil eth_getLogs
[
  {
    "event": "ReserveInflow",
    "queryId": "0x…",
    "asset":   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "height":  25665308,                     // blok Ethereum
    "amount":  "500000000",
    "newReserves": "12500000000",
    "initiator": "0xABC…",                   // tx.from — SIAPA yang memicunya
    "creditcoinTx": "0x…",                   // untuk tautan Blockscout
    "sourceTx":     "0x…",                   // untuk tautan Etherscan
    "timestamp": "2026-08-02T06:00:00Z"
  },
  { "event": "ReserveOutflow", "…": "…" },
  { "event": "Minted",   "to": "0x…", "amount": "1000000000", "collateralRatioBps": "12500", "…": "…" },
  { "event": "Redeemed", "…": "…" }
]
```

**Semua angka on-chain adalah string**, bukan number — JavaScript `number` tidak muat
`uint256`. Pakai `BigInt` atau library big-number sejak awal. Kalau ini disepelekan di
awal, seluruh lapisan format angka harus dibongkar nanti.

**Kasus yang wajib punya mock** — ini yang bikin UI-nya jujur:
- rasio sehat (>100%) · rasio tepat di lantai · **rasio di bawah lantai → MEMBEKU**
- cadangan nol · suplai nol (rasio = tak hingga)
- feed kosong · feed panjang · RPC error

### 5.9 Tiap kasus mock wajib punya pasangan nyata

Mock dipakai untuk **membangun** state ini, bukan untuk **mendemokan**-nya. Sebelum
Fase 6c ditutup, tiap baris di bawah harus pernah terlihat dari chain sungguhan:

| Keadaan | Cara memicunya secara nyata |
|---|---|
| Rasio sehat | Kondisi normal setelah ingest pertama |
| Rasio di lantai / **MEMBEKU** | Tarik dana dari treasury **Sepolia**, tunggu ingest (~9 mnt). Inilah gunanya "panggung kendali" — jangan dipentaskan di UI. |
| `mint()` ditolak | Panggil `mint()` sungguhan melebihi headroom, tangkap `WouldBreachCollateralFloor` dari node |
| Feed kosong | Instance observatory yang baru di-deploy |
| RPC error | Arahkan ke endpoint mati, atau matikan jaringan saat demo |

Kalau sebuah keadaan **tidak bisa** dipicu secara nyata sebelum deadline, keadaan itu
**tidak muncul di UI produksi** dan tidak disebut di deck. Bukan dipentaskan, bukan
diberi label "simulasi" — dihapus. Kejujuran cakupan menaikkan kredibilitas
(`CLAUDE.md` §8.6); satu panel yang dipentaskan menghapusnya sekaligus.

---

## 6. Aturan yang tidak boleh dilanggar sepihak

### 🔒 Katalog event & error adalah JANJI API

`03-spesifikasi-produk.md` **Lampiran A** (event) dan **Lampiran B** (error) diperlakukan
sebagai kontrak antar-orang. Backend **tidak boleh** mengubah nama event, urutan
parameter, atau tipe tanpa memberi tahu frontend lebih dulu.

Kalau memang harus berubah — itu wajar, kontrak belum pernah dikompilasi — maka:
1. Bicarakan **sebelum** menulis kodenya
2. Perbarui Lampiran A/B di dokumen
3. Kirim ABI baru ke frontend

Yang dilarang adalah mengubahnya diam-diam lalu frontend baru sadar saat menyambungkan.

### 🔒 Sumber data frontend sudah dikunci

**Langsung dari chain. Tidak ada API server.** Alasan lengkap di
`03-spesifikasi-produk.md` §9.0 — ini bukan pilihan teknis, ini konsekuensi tesis produk.
Backend **tidak perlu** membangun endpoint HTTP apa pun.

### 🔒 Angka teknis di dokumen

Semua angka di `01-riset-mendalam.md` **diukur, bukan diperkirakan**. Jangan mengubahnya
tanpa mengukur ulang. Kalau kamu menemukan angka yang berbeda, itu temuan — catat, jangan
timpa diam-diam.

### 🔒 Daftar klaim terlarang

`01-riset-mendalam.md` §7. Berlaku untuk **semua** teks yang dilihat juri, termasuk
copy di UI. Frontend jangan menulis "real-time" atau "fully decentralized" di dashboard.

⚠️ **Empat larangan baru 9 Agustus, langsung menyentuh copy UI:**

| Jangan tulis | Tulis ini |
|---|---|
| "lag 44 blok" | "32–42 blok" — lag itu **pita**, berayun tiap attestation |
| "kami membuktikan saldo treasury" | "kami membuktikan **setiap pergerakan** sejak ledger dipasang" |
| "Ethena" (di mana pun) | jangan sebut — dicabut dari daftar target sah |
| "Attestcoin bisa menulis balik ke Ethereum" | jangan sebut di UI sama sekali |

### 🔒 Setiap elemen UI wajib punya asal-usul on-chain

Tabel lengkapnya: `03-spesifikasi-produk.md` **§9.3** — itu adalah **checklist Fase 6c**.

Aturannya satu kalimat: **kalau sebuah elemen tidak muat di tabel itu, elemen itu
dihapus** — bukan diberi label "coming soon", bukan disembunyikan di balik tab.

Satu-satunya elemen yang boleh statis: blok perintah `docker run` (A4) — dan perintahnya
wajib benar-benar jalan kalau disalin.

### 🔒 Istilah per mode — dikunci 7 Agustus 2026 (RT11)

Dua mode **tidak boleh** memakai kata yang sama, karena yang bisa kita buktikan memang
berbeda. Berlaku untuk nama komponen, label, tooltip, dan seluruh copy.

| Mode | Istilah | Boleh bilang | **Haram** |
|---|---|---|---|
| Vault | **solvency / solvabilitas** | rasio, lantai kolateral, "backed" | — |
| Observatory | **proven collateral** | arah & besar perubahan, alarm dini | ❌ "solvency", ❌ "solvent", ❌ rasio apa pun |

Alasannya: di vault mode kewajiban = `totalSupply()` kita sendiri (eksak). Di observatory
mode kewajiban issuer ada di Ethereum dan **tidak** kita buktikan — jadi tidak ada
penyebut, jadi tidak ada rasio. Penjelasan penuh: `07-red-team.md` RT11.

⚠️ Frontend: kunci ini **sebelum Fase 6a**. Murah sekarang, mahal setelah komponen jadi.

---

## 7. Titik temu

Tidak perlu daily standup. Cukup tiga momen:

| Kapan | Yang dibahas |
|---|---|
| **Sebelum backend menulis kontrak** | Konfirmasi Lampiran A & B. Frontend baca dan protes sekarang, bukan nanti. |
| **Titik beku (akhir Tahap 1)** | Serah terima ABI + `deployments/*.json` + satu tx ingest nyata |
| **Gerbang de-mock (Fase 6c)** | Jalankan `tools/verify-no-mock.sh` **berdua**, plus cek manual §5.9. Backend memicu penarikan Sepolia supaya frontend bisa melihat MEMBEKU yang sungguhan. |
| **Sebelum rekam demo** | Urutan demo, siapa memegang layar, siapa memicu penarikan di Sepolia |

Di luar itu: kerja sendiri-sendiri. Kalau ada yang perlu diubah di wilayah orang lain,
itu percakapan, bukan commit.

---

## 8. Git

- Repo tidak boleh dibuat sebelum `.gitignore` memuat `.env*` dan `arsip-kode-lama-*.tar.gz`
- **Jangan pernah commit private key** — lihat `06-akun-dan-dana.md`
- Branch per fase, bukan per orang: `feat/contracts`, `feat/worker`, `feat/dashboard`
- Karena kepemilikan file terpisah tegas, konflik merge seharusnya nyaris nol.
  Kalau sering konflik, berarti §2 sedang dilanggar.

---

## 9. Kalau frontend selesai lebih dulu

Sangat mungkin — worker adalah bagian terberat di proyek ini (~60% pekerjaan backend).
Kalau frontend rampung sementara worker belum, kerjakan yang ini, berurutan:

1. **Deck** (`07-red-team.md` dulu — adopsi protagonis penabung, siapkan jawaban satu
   kalimat untuk RT4/RT5/RT8)
2. **Naskah video demo** — urutan di `03-spesifikasi-produk.md` §10
3. **Halaman observatory** untuk target terverifikasi di `01-riset-mendalam.md` §3.5 —
   ⭐ Sky LitePSM Pocket, Resolv, (Reserve eUSD bersyarat).
   ⛔ **bukan** Ethena (dicabut) · ⛔ bukan Circle/BUIDL/Ondo/PAXG (RT1) · ⛔ bukan Aave
4. **README repo dalam bahasa Inggris** — syarat wajib submission

Jangan menganggur, dan jangan "membantu" di `packages/worker/`.
