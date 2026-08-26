# Deployment — Apa yang Di-deploy dan Di Mana

> Semua URL dan alamat di dokumen ini sudah diverifikasi live pada 2026-08-23.
> Pemilik: **Dev A** (semua kecuali frontend). Frontend: **Dev B**.

---

## 1. Peta Deployment

Ada **lima hal** yang perlu di-deploy, plus dua layanan eksternal yang cukup didaftari.

```
┌─────────────────────────────────────────────────────────────────┐
│  ETHEREUM MAINNET            (tidak deploy apa pun — cuma baca) │
│  Aave V3 · Morpho · Compound · Chainlink                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ eth_getLogs (RPC archive — berbayar/akun)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  ③ INDEXER            Railway (worker always-on)                │
│     + dompet panas ber-CTC                                      │
└──────────┬──────────────────────────────────┬───────────────────┘
           │ recordFact()                     │ tulis
           ▼                                  ▼
┌──────────────────────────┐      ┌───────────────────────────────┐
│ ① KONTRAK                │      │ ② POSTGRES                    │
│   Creditcoin CC3 Testnet │      │   Railway / Neon              │
└──────────┬───────────────┘      └───────────┬───────────────────┘
           │ baca                             │ baca
           └──────────────┬───────────────────┘
                          ▼
              ┌───────────────────────┐
              │ ④ API   Railway       │
              └───────────┬───────────┘
                          │ HTTPS
                          ▼
              ┌───────────────────────┐
              │ ⑤ WEB   Vercel        │
              └───────────────────────┘
```

| # | Komponen | Di mana | Kenapa di situ |
|---|---|---|---|
| ① | Smart contract | **Creditcoin CC3 Testnet** (102031) | Diwajibkan aturan hackathon |
| ② | PostgreSQL | **Railway** (atau Neon) | Mirror baca + pembukuan indexer |
| ③ | Indexer | **Railway** — worker always-on | **Tidak boleh serverless** (lihat §4) |
| ④ | API | **Railway** — service terpisah | Satu jaringan dengan DB |
| ⑤ | Frontend | **Vercel** | Next.js, preview per-PR |

**Layanan eksternal — daftar saja, tidak deploy:**

| Layanan | Untuk apa | Catatan |
|---|---|---|
| **Alchemy / Infura / QuickNode** | RPC Ethereum **archive** | Wajib. RPC publik menolak query log historis — sudah diuji dan gagal. |
| RPC Creditcoin | `https://rpc.cc3-testnet.creditcoin.network` | Publik, gratis |
| Proof Builder | `https://prover.cc3-testnet.creditcoin.network` | Publik, gratis |

---

## 2. ① Kontrak — Creditcoin CC3 Testnet

**Jaringan:** chainId **102031** · RPC `https://rpc.cc3-testnet.creditcoin.network`
**Explorer:** `https://creditcoin-testnet.blockscout.com` (Blockscout v11.2.7 — terverifikasi)

### Yang di-deploy (9 kontrak + 2 token uji)

| Urutan | Kontrak | Catatan |
|---|---|---|
| 1 | `PriceRegistry` | |
| 2 | `FactRegistry` | |
| 3 | `CreditGraph` | butuh alamat `FactRegistry` |
| 4 | `AaveV3Adapter` | |
| 5 | `MorphoBlueAdapter` | boleh ditunda — lihat `open-issues.md` T4 |
| 6 | `CompoundV3Adapter` | boleh ditunda |
| 7 | `ChainlinkAdapter` | |
| 8 | `EfficiencyMarket` | |
| 9 | `TestUSDC`, `TestWETH` + faucet | lihat `open-issues.md` B2 |

Transaksi konfigurasi pasca-deploy ada di `contracts.md` §12 — **wajib dijalankan urut**.
Yang paling sering terlupa: `setChainKeyAllowed(3, true)`. Tanpa itu setiap `recordFact`
revert, dan gejalanya mirip proof rusak.

### Dua dompet, jangan satu

| Dompet | Peran | Sifat |
|---|---|---|
| **Deployer** | deploy + `DEFAULT_ADMIN_ROLE`, `CURATOR_ROLE` | dingin, jarang dipakai |
| **Submitter** | `RECORDER_ROLE`, `PRICE_RECORDER_ROLE` | **panas** — kuncinya hidup di Railway |

Kunci submitter ada di server produksi dan mengirim transaksi terus-menerus. Kalau ia
juga memegang admin, satu kebocoran berarti kehilangan kendali kontrak. Pisahkan sejak awal.

### Cara dapat CTC — **kerjakan paling awal**

Faucet Creditcoin adalah **bot Discord**, bukan situs web:

1. Gabung `https://discord.gg/creditcoin`
2. Buka channel `#token-faucet`
3. `/faucet address:0xAlamatEVMkamu`

Manual dan ada rate limit. Minta CTC untuk **kedua** dompet **di hari pertama** —
kalau submitter kehabisan gas di tengah demo, pipeline mati senyap dan kamu menunggu
bot Discord. Perlakukan ini sebagai jalur kritis, bukan urusan menit terakhir.

### Deploy & verifikasi

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://rpc.cc3-testnet.creditcoin.network \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

# Verifikasi di Blockscout (submission jauh lebih kredibel kalau terverifikasi)
forge verify-contract <ADDRESS> src/FactRegistry.sol:FactRegistry \
  --verifier blockscout \
  --verifier-url https://creditcoin-testnet.blockscout.com/api \
  --chain-id 102031
```

Catat semua alamat di `.env` dan di tabel README — juri akan mengeceknya.

---

## 3. ② PostgreSQL

**Rekomendasi: Railway Postgres** — satu vendor dengan indexer dan API, jaringan
internal, tanpa urusan connection pooling.

Alternatif: **Neon** (serverless, free tier lega). Kalau pakai Neon, gunakan
**pooled connection string** untuk API; indexer boleh koneksi langsung karena ia
proses tunggal berumur panjang.

```bash
pnpm db:migrate    # jalankan sekali setelah DB hidup
```

Ukuran data kecil — puluhan ribu baris. Free tier lebih dari cukup untuk hackathon.

---

## 4. ③ Indexer — **tidak boleh serverless**

**Rekomendasi: Railway** (service tipe worker). Alternatif: Fly.io, Render, VPS biasa.

**Kenapa Vercel/Lambda tidak bisa:**
- Ia menahan **cursor** per protokol dan harus tahan restart
- Ia **menunggu attestation ~8 menit** per event — jauh melewati batas eksekusi serverless
- Ia mengelola **urutan nonce** untuk dompet submitter; instance paralel akan saling menabrak nonce
- Ia berjalan **terus-menerus**, bukan per-request

Ini bukan preferensi gaya. Menjalankannya serverless akan rusak dengan cara yang halus
dan sulit didiagnosis.

**Healthcheck harus DIKOSONGKAN untuk indexer.** Ia worker tanpa server HTTP;
mengisi path apa pun membuat setiap deploy gagal, dan gejalanya terbaca seperti
aplikasinya yang rusak. API sebaliknya: isi `/v1/health`.

**Jalankan tepat satu instance.** Jangan aktifkan autoscaling. Dua indexer yang
memproses event sama akan bertabrakan nonce; replay protection on-chain menyelamatkan
konsistensi data, tapi transaksi terbuang dan CTC terkuras.


### Build & start command — Railway TIDAK bisa menebaknya

Ditemukan saat deploy sungguhan 2026-08-26. Ketiganya gagal dengan gejala yang
tidak menunjuk penyebabnya, jadi ditulis lengkap di sini.

| Setting | Nilai |
|---|---|
| Build | `pnpm install --frozen-lockfile && pnpm --filter @corolary/shared build` |
| Start (indexer) | `pnpm --filter @corolary/indexer start` |
| Start (API) | `pnpm --filter @corolary/api start` |

**Jangan pakai `pnpm build` di root.** Ia memanggil `turbo run build`, yang ikut
menyapu `@corolary/contracts` → `forge build`. Foundry tidak ada di Railway dan
build-nya gagal di sana. Satu-satunya paket yang benar-benar perlu dibangun
adalah `@corolary/shared`, karena `exports`-nya menunjuk ke `./dist`; kedua
service berjalan lewat `tsx` langsung dari sumber dan tidak punya langkah build
sama sekali.

**Start command WAJIB diisi eksplisit.** Builder Railway (Railpack) mencari
skrip `start` di `package.json` root, dan di monorepo ini skrip itu memang tidak
ada — keduanya dipanggil lewat `--filter`. Tanpa Start Command, deploy mati di
detik ke-7 dengan `No start command detected`, **sebelum** `pnpm install`
sempat jalan, sehingga log-nya tidak memuat satu pun petunjuk tentang aplikasi.

**`tsx` ada di `dependencies`, bukan `devDependencies`** — sengaja. Railway
menyetel `NODE_ENV=production`, dan install produksi melewatkan `devDependencies`;
kalau `tsx` ada di sana, service naik lalu langsung mati dengan `tsx: not found`.
Karena kedua service memang dijalankan oleh `tsx` saat runtime, tempatnya di
`dependencies` bukan siasat melainkan klasifikasi yang benar. Ini juga berarti
`--prod=false` **tidak** diperlukan di build command.

### Env (indexer)
```bash
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/xxx   # WAJIB archive
ETHEREUM_CHAIN_KEY=3
CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
CREDITCOIN_CHAIN_ID=102031
PROOF_BUILDER_URL=https://prover.cc3-testnet.creditcoin.network
SUBMITTER_PRIVATE_KEY=0x...          # ← rahasia, HANYA di service ini
DATABASE_URL=postgres://...
FACT_REGISTRY_ADDRESS=0x...
PRICE_REGISTRY_ADDRESS=0x...
CREDIT_GRAPH_ADDRESS=0x...
```

---

## 5. ④ API

**Rekomendasi: Railway**, service terpisah di project yang sama. Berbagi jaringan
internal dengan Postgres.

Secara teknis API **bisa** serverless (ia stateless), tapi menaruhnya bersama indexer
memangkas satu vendor, satu set secret, dan satu sumber kebingungan konfigurasi.
Untuk tim dua orang, itu sepadan.

### Env (API)
```bash
DATABASE_URL=postgres://...
ETHEREUM_CHAIN_KEY=3                 # ← WAJIB, walau API tak menyentuh Ethereum
CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
CREDITCOIN_CHAIN_ID=102031           # ← WAJIB
FACT_REGISTRY_ADDRESS=0x...
CREDIT_GRAPH_ADDRESS=0x...
EFFICIENCY_MARKET_ADDRESS=0x...
PRICE_REGISTRY_ADDRESS=0x...
```

Daftar ini persis skema di `services/api/src/config.ts` — kalau ada yang kurang,
service gagal start dengan menyebut nama variabelnya. Dua catatan:

- **`API_PORT` tidak perlu diisi di Railway.** Platform menyuntikkan `PORT`, dan
  `PORT` menang atas `API_PORT`. Mengisi `API_PORT` dengan nilai lain justru
  membuat service mendengarkan port yang tidak dipetakan: ia naik dengan sehat,
  log-nya bersih, dan domainnya tidak pernah menjawab.
- **`CORS_ORIGIN` tidak ada.** Versi terdahulu dokumen ini mencantumkannya;
  variabel itu tidak pernah dibaca kode mana pun. CORS di v1 dibuka untuk semua
  origin secara sengaja (`docs/api.md` §0.9) karena seluruh datanya publik.

> **API TIDAK boleh punya `SUBMITTER_PRIVATE_KEY` maupun `ETHEREUM_RPC_URL`.**
> Ia hanya membaca DB dan state Creditcoin. Kalau ia butuh kunci privat, ada yang salah
> dengan desainnya.

---

## 6. ⑤ Frontend — Vercel

```bash
vercel --prod
```

Root directory: `apps/web`. Preview otomatis per PR — berguna untuk review Dev A.

### Env (Vercel)
```bash
NEXT_PUBLIC_API_URL=https://corolary-production.up.railway.app
NEXT_PUBLIC_CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
NEXT_PUBLIC_USE_FIXTURES=false      # ← WAJIB false di produksi
```

> Semua env frontend `NEXT_PUBLIC_*` dan **terekspos ke publik**. Jangan pernah menaruh
> kunci privat, secret RPC berbayar, atau kredensial DB di sini.

**Gerbang sebelum promote ke produksi:** `pnpm check:no-mocks` harus lulus.

---

## 7. Urutan Deploy

```
0. Minta CTC dari bot Discord untuk dompet deployer + submitter   ← paling awal
1. Deploy kontrak + jalankan transaksi konfigurasi
2. Verifikasi kontrak di Blockscout
3. Provision Postgres → pnpm db:migrate
4. Deploy indexer (isi alamat kontrak di env)
5. Tunggu fakta pertama tercatat  ← ini M1, buktikan sebelum lanjut
6. Deploy API
7. Deploy frontend, arahkan ke API
8. Uji asap end-to-end
```

Langkah 5 adalah gerbangnya. Jangan deploy API dan frontend di atas indexer yang belum
terbukti mencatat satu fakta pun.

---

## 8. Pemantauan (jangan dilewat)

Tiga alarm ini yang benar-benar penting:

| Alarm | Ambang | Kenapa |
|---|---|---|
| `oldestUnprovenAgeSeconds` | > 43.200 (12 jam) | Melewati 24 jam, biaya proof naik ~12x. Ini metrik paling penting di sistem. |
| Saldo CTC submitter | < 10 CTC | Habis = pipeline mati senyap, dan faucet-nya manual |
| `GET /v1/health` | gagal 2x berturut | Uptime dasar |

Tambahkan: umur harga (kalau melewati 24 jam pasar membeku — lihat `open-issues.md` T5)
dan alert rotasi aggregator Chainlink.

Cek uptime gratis lewat UptimeRobot/BetterStack ke `/v1/health` sudah cukup.

---

## 9. Biaya

| Item | Biaya |
|---|---|
| Kontrak CC3 Testnet | Gratis (CTC faucet) |
| Gas `recordFact` | ~2,59×10⁻⁵ CTC per fakta — praktis nol |
| Railway (indexer + API + PG) | Free tier / ~$5 per bulan |
| Vercel | Gratis (hobby) |
| **RPC Ethereum archive** | **Satu-satunya biaya nyata** — free tier Alchemy biasanya cukup, tapi backfill bisa melahapnya |

Yang perlu diawasi hanyalah kuota RPC Ethereum. Backfill (`open-issues.md` B1) memindai
rentang blok besar; batasi jendela dan cache hasilnya.

---

## 10. Yang Harus Publik untuk Submission

| Item | Sumber |
|---|---|
| URL repo GitHub (+ README) | GitHub |
| URL demo langsung | Vercel |
| Alamat kontrak, terverifikasi | Blockscout |
| Video demo | YouTube / Loom |
| Deck / whitepaper PDF | Drive publik |

Cantumkan alamat kontrak terverifikasi di README. Ini bukti termurah dan paling kuat
bahwa proyeknya nyata — juri bisa mengklik dan melihat sendiri fakta tercatat di on-chain.
