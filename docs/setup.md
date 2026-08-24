# Corolary — Panduan Setup Lingkungan Dev

> Ikuti dokumen ini dari atas ke bawah, dari mesin kosong sampai indexer/API/web
> jalan lokal. Kalau ada konflik dengan dokumen lain, `docs/architecture.md` yang
> menang — dokumen ini hanya menurunkan langkah operasional dari sana.
>
> Target OS: **macOS**. Kalau kamu memakai Linux, ganti perintah `brew` dengan
> package manager distro-mu; sisanya identik.

---

## 0. Siapa butuh apa — baca ini dulu

Corolary punya dua peran dengan kebutuhan setup yang **berbeda jauh**:

| Kebutuhan | Dev A (backend + on-chain) | Dev B (frontend) |
|---|---|---|
| Node 24 + pnpm | ✅ | ✅ |
| Docker + Postgres lokal | ✅ | opsional (bisa pakai API milik Dev A yang jalan) |
| **Foundry** | ✅ wajib | ❌ tidak perlu sama sekali |
| **Ethereum RPC archive-capable** | ✅ wajib | ❌ tidak perlu — B hanya bicara ke API Corolary & RPC Creditcoin |
| Dompet dengan CTC testnet | ✅ wajib (submitter + deploy) | ✅ ringan (hanya untuk connect wallet di UI, tidak perlu saldo besar) |
| RPC Creditcoin (`rpc.cc3-testnet.creditcoin.network`) | ✅ | ✅ (dipakai wagmi di browser) |

**Kalau kamu Dev B: lewati §5 (Foundry) dan bagian RPC Ethereum di §4.** Cukup
jalankan §1–§3, lalu §7 (env var frontend saja), lalu §9 (`pnpm dev:web`).
Kamu tetap butuh Postgres/indexer/API jalan — baik lokal (§8-§9) atau menunjuk ke
instance milik Dev A lewat `NEXT_PUBLIC_API_URL`.

---

## 1. Prasyarat — instalasi macOS

Semua lewat [Homebrew](https://brew.sh). Kalau belum ada:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 1.1 Git

```bash
brew install git
git --version
```

### 1.2 Node.js 24 (LTS) + pnpm

Pakai `nvm` supaya versi Node terkunci per-proyek dan tidak bentrok dengan proyek lain.

```bash
brew install nvm
mkdir -p ~/.nvm
# tambahkan ke ~/.zshrc bila belum ada:
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
source ~/.zshrc

nvm install 24
nvm use 24
node --version     # harus v24.x

corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
```

### 1.3 Docker Desktop

```bash
brew install --cask docker
open -a Docker      # tunggu ikon Docker di menu bar jadi hijau/stabil
docker --version
docker compose version
```

### 1.4 Foundry (**hanya Dev A**)

```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.zshrc     # atau buka terminal baru — ini menambahkan foundryup ke PATH
foundryup

forge --version
cast --version
anvil --version
```

---

## 2. Clone & setup monorepo

```bash
git clone <URL_REPO_COROLARY> corolary
cd corolary

pnpm install
```

Ini menginstal seluruh workspace (`packages/*`, `services/*`, `apps/*`) sekaligus
lewat pnpm workspaces + Turborepo. Jangan `cd` ke sub-paket dan `npm install` di sana
— itu akan merusak symlink workspace.

Verifikasi struktur workspace:

```bash
cat pnpm-workspace.yaml
# harus mencantumkan packages/*, services/*, apps/*
```

---

## 3. Postgres lewat Docker Compose

`docker-compose.yml` di root repo (dimiliki Dev A, jangan diedit Dev B):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: corolary-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: corolary
      POSTGRES_PASSWORD: corolary_dev
      POSTGRES_DB: corolary
    ports:
      - "5432:5432"
    volumes:
      - corolary-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U corolary -d corolary"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  corolary-pgdata:
```

Jalankan:

```bash
docker compose up -d
docker compose ps               # STATUS harus "healthy" setelah beberapa detik

# cek koneksi
docker exec -it corolary-postgres psql -U corolary -d corolary -c '\dt'
# tabel belum ada — normal, itu tugas migrasi (§8)
```

Untuk berhenti tanpa menghapus data: `docker compose stop`.
Untuk reset total (hapus data): `docker compose down -v`.

---

## 4. Variabel lingkungan

**Satu file `.env` untuk seluruh repo** — kontrak, indexer, API, dan frontend semuanya
membaca file yang sama di root. Tidak ada `.env` kedua di `apps/web` atau `services/*`.

```bash
cp .env.example .env
```

Next.js hanya membaca file env di dalam direktorinya sendiri, jadi `apps/web/.env.local`
dibuat sebagai **symlink** ke `.env` root:

```bash
pnpm env:link      # dipanggil otomatis oleh `pnpm dev:web` dan `pnpm build:web`
```

Symlink, bukan salinan — supaya tetap satu file fisik dan tidak mungkin melenceng.
Kalau `apps/web/.env.local` sudah terlanjur jadi file biasa, `pnpm env:link` akan
menolak dan menyuruh kamu memindahkan isinya ke `.env` root dulu, bukan diam-diam
menimpanya.

Isi tiap variabel sesuai tabel berikut. Kolom "Dibutuhkan oleh" menandai siapa yang
benar-benar memakainya — kalau kamu Dev B, boleh biarkan kosong variabel yang
ditandai "hanya A".

| Variabel | Dibutuhkan oleh | Cara mendapatkan |
|---|---|---|
| `ETHEREUM_RPC_URL` | hanya A | Lihat §4.1 di bawah — **wajib archive-capable** |
| `ETHEREUM_CHAIN_KEY` | hanya A | Selalu `3` — konstanta, jangan diubah (lihat `architecture.md` §3) |
| `CREDITCOIN_RPC_URL` | A & B | `https://rpc.cc3-testnet.creditcoin.network` — RPC publik CC3 Testnet, tidak butuh API key |
| `CREDITCOIN_CHAIN_ID` | A & B | `102031` — chainId CC3 Testnet |
| `PROOF_BUILDER_URL` | hanya A | `https://prover.cc3-testnet.creditcoin.network` — Proof Builder API publik testnet |
| `SUBMITTER_PRIVATE_KEY` | hanya A | Private key dompet dev yang mengirim `recordFact`. **Jangan pernah** dompet mainnet asli. Generate baru: `cast wallet new` |
| `FACT_REGISTRY_ADDRESS` dst. | hanya A | Diisi **setelah** `forge script Deploy.s.sol` sukses (§6) |
| `DATABASE_URL` | A (indexer/API) | `postgres://corolary:corolary_dev@localhost:5432/corolary` — cocok dengan §3 |
| `API_PORT` | hanya A | Bebas, default `8080` |
| `NEXT_PUBLIC_API_URL` | hanya B | `http://localhost:8080` saat API jalan lokal, atau URL API Dev A yang di-deploy |
| `NEXT_PUBLIC_CREDITCOIN_RPC_URL` | hanya B | Sama seperti `CREDITCOIN_RPC_URL` — dipakai wagmi di browser |
| `NEXT_PUBLIC_USE_FIXTURES` | hanya B | **Selalu `false`** kecuali sedang mengembangkan UI sebelum endpoint API hidup |

### 4.1 Kenapa `ETHEREUM_RPC_URL` harus archive-capable

Indexer Corolary perlu **query log historis** — memindai event `Borrow`/`Repay`/dst.
dari Aave V3, Morpho Blue, Compound V3 di rentang blok Ethereum mainnet yang bisa jauh
di belakang head. Ini butuh node dengan riwayat state/log lengkap, bukan hanya blok
terbaru.

**RPC publik gratis (mis. `https://eth.llamarpc.com`, `https://cloudflare-eth.com`)
menolak query semacam ini** — sudah dicoba dan gagal saat riset arsitektur proyek ini
(lihat `docs/attestcoin-research.md` §2.1 dan `docs/architecture.md` §11 untuk konteks
data yang dibaca). Errornya biasanya `"query returned more than 10000 results"` atau
`"the method eth_getLogs does not exist/is not available"` karena node full/pruned
tidak menyimpan histori log jauh ke belakang.

Pilih salah satu provider archive-capable:

| Provider | Free tier | Catatan |
|---|---|---|
| **Alchemy** | Ya — cukup untuk dev (compute units/bulan) | https://www.alchemy.com — buat app "Ethereum Mainnet", salin HTTPS URL |
| **Infura** | Ya — kuota request/hari | https://www.infura.io — buat project, pilih network "Ethereum Mainnet" |
| **QuickNode** | Trial terbatas, tidak permanen gratis | https://www.quicknode.com — cocok kalau butuh throughput lebih tinggi |

Langkah umum (contoh Alchemy):

```bash
# 1. Daftar di alchemy.com, buat app baru:
#    Network = Ethereum Mainnet, tipe = HTTPS
# 2. Salin URL, biasanya berbentuk:
#    https://eth-mainnet.g.alchemy.com/v2/<API_KEY>
# 3. Isi ke .env
echo 'ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<API_KEY>' >> .env
```

Verifikasi RPC benar-benar bisa membaca log historis (contoh: query event `Repay`
Aave V3 di rentang blok lama):

```bash
cast logs \
  --rpc-url "$ETHEREUM_RPC_URL" \
  --from-block 18900000 --to-block 18900100 \
  --address 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
# harus mengembalikan array log (boleh kosong di rentang tertentu),
# BUKAN error "query returned more than X results" atau "method not available"
```

Kalau perintah di atas error, RPC-mu bukan archive node yang layak — ganti provider
atau tier sebelum lanjut. Ini jebakan setup paling umum di proyek ini.

---

## 5. Faucet CTC testnet

Dev A (dan Dev B bila ingin connect wallet di UI) butuh CTC testnet untuk gas di CC3
Testnet.

1. Siapkan alamat EVM (lihat §6 untuk membuat dompet dev lewat `cast wallet`, atau
   pakai MetaMask).
2. Buka dashboard/faucet resmi Creditcoin testnet:
   `https://dashboard.cc3-testnet.creditcoin.network/`
3. Masukkan alamat, minta CTC testnet. Faucet biasanya membatasi jumlah per hari —
   kalau butuh lebih banyak untuk deploy + banyak transaksi test, minta ulang esok
   hari atau minta ke channel Discord `#buidl-ctc-qna` bila faucet kosong.
4. Cek saldo masuk:

```bash
cast balance <ALAMATMU> --rpc-url https://rpc.cc3-testnet.creditcoin.network --ether
```

---

## 6. Setup wallet untuk CC3 Testnet

### 6.1 Dompet dev baru (disarankan, jangan pakai key produksi)

```bash
cast wallet new
# catat: Address dan Private key
```

Simpan private key ke `.env` sebagai `SUBMITTER_PRIVATE_KEY` (hanya Dev A butuh ini
untuk mengirim `recordFact` dan deploy kontrak).

### 6.2 Tambahkan network CC3 Testnet ke MetaMask (untuk UI/testing manual)

| Field | Nilai |
|---|---|
| Network Name | Creditcoin CC3 Testnet |
| RPC URL | `https://rpc.cc3-testnet.creditcoin.network` |
| Chain ID | `102031` |
| Currency Symbol | CTC |
| Block Explorer (bila ada) | lihat dashboard testnet |

### 6.3 Verifikasi wallet & network terhubung

```bash
cast chain-id --rpc-url https://rpc.cc3-testnet.creditcoin.network
# harus mengembalikan 102031
```

---

## 7. Setup Foundry (hanya Dev A)

```bash
cd packages/contracts
forge --version      # pastikan foundryup sudah jalan (§1.4)
```

### 7.1 Install dependency

```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install gluwa/usc-contracts --no-commit
```

### 7.2 Remapping (`packages/contracts/remappings.txt`)

```
@openzeppelin/=lib/openzeppelin-contracts/
@gluwa/usc-contracts/=lib/usc-contracts/
```

Cek remapping terdeteksi Foundry:

```bash
forge remappings
```

### 7.3 Build & test

```bash
forge build

forge test -vvv
# uji spesifik dengan trace penuh:
forge test --match-test testFoo -vvvv
```

### 7.4 Deploy ke CC3 Testnet

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://rpc.cc3-testnet.creditcoin.network \
  --private-key "$SUBMITTER_PRIVATE_KEY" \
  --broadcast
```

Salin alamat kontrak yang tercetak ke `.env` (`FACT_REGISTRY_ADDRESS`,
`PRICE_REGISTRY_ADDRESS`, `CREDIT_GRAPH_ADDRESS`, `EFFICIENCY_MARKET_ADDRESS`).

### 7.5 Generate ABI untuk frontend/backend

```bash
pnpm contracts:abi
# menulis ke packages/shared/src/abis/*.json — Dev B baca dari sini, jangan edit manual
```

---

## 8. Migrasi database

Dari root repo, dengan Postgres jalan (§3) dan `DATABASE_URL` terisi (§4):

```bash
pnpm db:migrate
```

Verifikasi tabel sudah dibuat sesuai skema (`docs/architecture.md` §10):

```bash
docker exec -it corolary-postgres psql -U corolary -d corolary -c '\dt'
# harus muncul: source_cursors, observed_events, facts, scores,
# score_history, prices, jobs
```

---

## 9. Menjalankan layanan secara lokal

Buka beberapa terminal terpisah (semua dari root repo):

```bash
# Terminal 1 — indexer (hanya Dev A; butuh ETHEREUM_RPC_URL archive-capable)
pnpm dev:indexer

# Terminal 2 — API (hanya Dev A; Dev B bisa menunjuk ke API Dev A yang jalan di sini)
pnpm dev:api

# Terminal 3 — web (Dev B; atau Dev A untuk cek integrasi ujung-ke-ujung)
pnpm dev:web
```

Cek API hidup:

```bash
curl -s http://localhost:8080/v1/health | jq
# { "ok": true, "data": { "ok": true, "version": "...", "uptime": ... } }
```

Cek web hidup: buka `http://localhost:3000`.

---

## 10. Verifikasi setup berhasil

Jalankan urutan berikut. Kalau semua lolos, lingkungan devmu sudah siap.

```bash
# 1. RPC Creditcoin hidup dan chainId benar
cast chain-id --rpc-url https://rpc.cc3-testnet.creditcoin.network
# → 102031

# 2. ChainInfo precompile menunjukkan chainKey 3 (Ethereum mainnet) didukung
cast call 0x0000000000000000000000000000000000000fd3 \
  "get_supported_chains()((uint64,uint64,bytes,uint8)[])" \
  --rpc-url https://rpc.cc3-testnet.creditcoin.network
# → harus memuat (3, 1, 0x457468657265756d, 1)   ← chainKey 3 = Ethereum mainnet

# 3. Proof Builder API testnet hidup dan punya attested height untuk chainKey 3
curl -s https://prover.cc3-testnet.creditcoin.network/api/v1/attested-height/3
# → {"attestedHeight": <angka besar, naik terus>}

# 4. (Dev A) RPC Ethereum bisa baca log historis — lihat §4.1
cast logs --rpc-url "$ETHEREUM_RPC_URL" \
  --from-block 18900000 --to-block 18900100 \
  --address 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2

# 5. (Dev A) Kontrak ter-build
cd packages/contracts && forge build

# 6. Postgres hidup dan bermigrasi
docker exec -it corolary-postgres psql -U corolary -d corolary -c '\dt'

# 7. API lokal merespons
curl -s http://localhost:8080/v1/health

# 8. Wallet dev punya saldo CTC testnet
cast balance <ALAMATMU> --rpc-url https://rpc.cc3-testnet.creditcoin.network --ether
```

---

## 11. Troubleshooting

| Gejala | Penyebab umum | Perbaikan |
|---|---|---|
| `eth_getLogs` error "query returned more than 10000 results" atau "method not available" | RPC Ethereum bukan archive node / tier tidak mendukung range log besar | Ganti provider (§4.1), atau perkecil `--from-block`/`--to-block` per batch (indexer sudah membatasi 1000 blok per batch proof, tapi `eth_getLogs` sendiri punya batas provider yang bisa lebih kecil) |
| `forge: command not found` setelah install | `foundryup` belum menambahkan PATH ke shell aktif | `source ~/.zshrc` atau buka terminal baru |
| `docker compose up -d` gagal, `Cannot connect to the Docker daemon` | Docker Desktop belum jalan | `open -a Docker`, tunggu sampai ikon stabil, ulangi |
| `pnpm install` gagal dengan error workspace | Menjalankan `npm install` di sub-folder alih-alih `pnpm install` di root | Hapus `node_modules` yang salah, jalankan `pnpm install` dari root repo |
| `cast chain-id` timeout / connection refused | RPC Creditcoin sedang down atau typo URL | Cek `https://dashboard.cc3-testnet.creditcoin.network/` status; pastikan `https://rpc.cc3-testnet.creditcoin.network` persis |
| `recordFact` revert dengan alasan tidak jelas | Proof sudah kedaluwarsa (attestation basi) atau `receiptStatus != 1` di tx sumber | Cek tx sumber sukses di Etherscan; minta proof baru; pastikan blok sudah ter-attest (`attested-height` ≥ block target) |
| Indexer stuck di `awaiting_attestation` lama sekali | Lag attestation memang ~8 menit, ini normal untuk blok baru | Tunggu; kalau > 30 menit, cek `attested-height` API — mungkin attestor sedang bermasalah |
| Web menampilkan data kosong padahal indexer jalan | `NEXT_PUBLIC_USE_FIXTURES` masih `true`, atau `NEXT_PUBLIC_API_URL` salah | Set `false`, cek URL API benar dan bisa diakses dari browser |
| `db:migrate` gagal "relation already exists" | Migrasi dijalankan dua kali di DB yang sama tanpa reset | `docker compose down -v && docker compose up -d`, lalu migrasi ulang (hanya untuk dev, ini menghapus data lokal) |
| `forge build` gagal "source not found" untuk `@openzeppelin` / `@gluwa` | Remapping belum benar atau `forge install` belum jalan | Cek `remappings.txt` (§7.2), jalankan ulang `forge install` |
| Deploy sukses tapi `FACT_REGISTRY_ADDRESS` di `.env` masih kosong | Lupa menyalin output `forge script` ke `.env` | Salin manual dari log broadcast (`packages/contracts/broadcast/Deploy.s.sol/102031/run-latest.json`) |

---

## 12. Ringkasan alur cepat (setelah setup awal selesai)

```bash
# Dev A, sesi kerja harian
docker compose up -d
pnpm dev:indexer &
pnpm dev:api &

# Dev B, sesi kerja harian
pnpm dev:web
```

Selesai — lingkungan siap untuk membangun sesuai `docs/workstreams.md`.
