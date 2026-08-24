# Corolary

Riwayat kredit on-chain yang terbukti secara kriptografis, diturunkan dari aktivitas
pinjam-meminjam **nyata di Ethereum mainnet** lewat **Attestcoin Protocol**, dipakai
untuk membuka **efisiensi kolateral** di pasar pinjaman **Creditcoin**.

Dibangun untuk hackathon **BUIDL CTC 2026 Fall**. Tim: 2 orang (Dev A = backend+onchain,
Dev B = frontend).

---

## Baca ini dulu

Sebelum menulis kode apa pun di repo ini:

1. **`docs/architecture.md`** — tulang punggung. Semua kontrak antar-bagian ada di sini.
2. **`docs/attestcoin-research.md`** — batasan protokol yang sudah diverifikasi live.
3. **`docs/workstreams.md`** — siapa memiliki file mana.
4. **`docs/shared-types.md`** — kontrak tipe antara backend dan frontend.
5. **`docs/open-issues.md`** — gap & blocker yang masih terbuka, beserta solusinya.
   Cek ini sebelum memutuskan sesuatu terasa "belum diputuskan" — kemungkinan besar
   sudah ada resolusinya di sana.

Kalau ada konflik antar dokumen, `docs/architecture.md` yang menang.

---

## Aturan keras (melanggar ini = merusak produk)

### 1. NOL MOCK DATA di produk akhir
Permintaan eksplisit pemilik proyek, dan bagian dari penilaian hackathon.

- Setiap angka yang tampil di UI harus berasal dari transaksi Ethereum mainnet nyata
  yang dibuktikan lewat Attestcoin, atau dari state kontrak Creditcoin nyata.
- Dilarang: seed data, angka hardcoded, grafik dari data karangan, tombol
  "Coming soon", fitur yang tidak berfungsi.
- Fixture dev hanya boleh di `apps/web/src/lib/dev-fixtures.ts`, dijaga
  `NEXT_PUBLIC_USE_FIXTURES` yang default `false`.
- `pnpm check:no-mocks` harus lulus sebelum submit.

### 2. WAJIB cek status transaksi sumber
Block Prover Precompile **tidak** memvalidasi sukses/gagalnya transaksi Ethereum —
ia hanya membuktikan inklusi. Setiap jalur yang mengonsumsi transaksi terbukti **HARUS**:

```solidity
EvmV1Decoder.ReceiptFields memory r = EvmV1Decoder.decodeReceiptFields(encodedTx);
require(r.receiptStatus == 1, "source tx reverted");
```

Tanpa ini, transaksi Ethereum yang **revert** tetap lolos dan meracuni registry.
Ini lubang keamanan #1 di proyek ini.

### 3. WAJIB validasi alamat emitter
Terbukti "sebuah log ada di transaksi ini" ≠ "log ini dari Aave". Selalu cek alamat
pemancar log cocok dengan protokol yang terdaftar. Tanpa ini siapa pun bisa men-deploy
kontrak peniru yang memancarkan event Aave palsu, dan proof-nya akan sah.

### 4. Eager proving, jangan lazy
Proof **10x lebih murah** bila dibuat < 24 jam setelah transaksi
(2,59×10⁻⁵ vs 3,13×10⁻⁴ CTC). Indexer membuktikan event selagi segar lalu menyimpan
faktanya permanen. **Jangan pernah** membuat jalur yang mem-prove data lama on-demand
di jalur panas.

### 5. Searah saja — writability belum ada
Attestcoin Writability (Creditcoin → Ethereum) **belum rilis**, masih audit.
Jangan rancang apa pun yang butuh menulis balik ke Ethereum.

### 6. uint256 selalu string di TypeScript
`amount`, saldo, harga — semuanya `string` di lintas batas TS. Jangan pernah `number`.
uint256 melebihi `Number.MAX_SAFE_INTEGER`.

### 7. Batas kepemilikan file
- **Dev B hanya menyentuh `apps/web/**`.** Tidak ada pengecualian.
- **Dev A memiliki sisanya.**
- `packages/shared` searah: A menulis, B membaca. B minta perubahan, bukan mengedit.
- Mengubah bentuk API = commit yang menyentuh `docs/api.md` **dan**
  `packages/shared/src/types.ts` bersamaan.

---

## Fakta jaringan (terverifikasi live 2026-08-22, jangan ditebak ulang)

| Item | Nilai |
|---|---|
| Creditcoin CC3 Testnet RPC | `https://rpc.cc3-testnet.creditcoin.network` |
| CC3 Testnet chainId | **102031** (`0x18e8f`) |
| Block Prover Precompile | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo Precompile | `0x0000000000000000000000000000000000000fd3` |
| Proof Builder API | `https://prover.cc3-testnet.creditcoin.network` |
| Decoder contract (testnet) | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| SDK | `@gluwa/usc-sdk@0.18.0` |
| **Source chain yang dipakai** | **`chainKey = 3` → Ethereum MAINNET** (chainId 1) |
| `chainKey = 1` | Sepolia — **jangan dipakai untuk produk akhir** |
| Lag attestation | ~38 blok ≈ 8 menit |
| Batas batch proof | 10 tx, rentang 1000 blok |

**Kenapa `chainKey 3` penting:** hackathon mewajibkan deploy di testnet, tapi kita
tidak boleh pakai mock data. CC3 Testnet bisa membaca Ethereum **mainnet** asli — jadi
kedua syarat terpenuhi sekaligus. Peserta lain akan pakai Sepolia dan token karangan.

**RPC Ethereum harus archive-capable** (Alchemy/Infura/QuickNode). RPC publik menolak
query log historis — sudah diuji dan gagal.

---

## Perintah

```bash
# Setup
pnpm install
docker compose up -d              # postgres lokal
cp .env.example .env

# Kontrak (packages/contracts)
forge build
forge test -vvv
forge test --match-test testFoo -vvvv
pnpm contracts:deploy:testnet
pnpm contracts:abi                # generate ABI ke packages/shared/src/abis

# Backend
pnpm db:migrate
pnpm dev:indexer
pnpm dev:api

# Frontend
pnpm dev:web

# Mutu
pnpm lint
pnpm typecheck
pnpm test
pnpm check:no-mocks               # WAJIB lulus sebelum submit
```

---

## Peta arsitektur singkat

```
Ethereum mainnet (Aave V3 / Morpho / Compound / Chainlink)
        │  event nyata
        ▼
services/indexer   watcher → tunggu attestation → prover (batch) → submitter
        ▼
FactRegistry.sol   verifikasi via precompile → adapter decode → simpan permanen
        ▼
CreditGraph.sol    skor 0..1000 + tier
        ▼
EfficiencyMarket   rasio kolateral 150% → 110% mengikuti skor
        ▼
services/api  →  apps/web
```

Tiga lapis: **FactRegistry** (infrastruktur, inti produk) → **CreditGraph** (skor)
→ **EfficiencyMarket** (pasar).

---

## Jebakan yang sudah diketahui

- **Pragma WAJIB `^0.8.28`, bukan `^0.8.23`.** `@gluwa/usc-contracts` v0.2.0 memakai
  `^0.8.28`. Contoh `USCBase.sol` di repo tutorial memakai `^0.8.23` dan akan gagal
  compile begitu kamu meng-import `EvmV1Decoder`.
- **Path import `EvmV1Decoder` yang ditulis dokumentasi resmi SALAH.** Yang benar:
  `@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol`
  (dokumentasi menulis `contracts/decoding/...`, path itu tidak ada).
- **`EvmV1Decoder.LogEntry` TIDAK punya `logIndex`.** Strukturnya hanya
  `{address address_; bytes32[] topics; bytes data;}`. Indeks log harus diambil dari
  posisi iterasi di `receipt.receiptLogs` — dan karena itu **jangan pakai
  `getLogsByEventSignature`** di jalur pencatatan fakta: ia mengembalikan array
  terfilter sehingga posisi aslinya hilang.
- **Jangan salin `VerifierInterface.sol` dari repo tutorial** — versinya tertinggal dan
  tidak memuat overload batch. Pakai
  `@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol`,
  yang punya `verifyAndEmit`/`verify` varian batch. Batching adalah strategi biaya inti kita.
- **Ada DUA struct `MerkleProofEntry` yang berbeda** di paket yang sama:
  `INativeQueryVerifier.MerkleProofEntry` memakai field `hash`, sedangkan
  `BlockProverTypes.MerkleProofEntry` memakai field `sibling`. Untuk memanggil
  precompile, pakai yang dari `INativeQueryVerifier`. Keduanya bertipe
  `(bytes32, bool)` sehingga **ABI-nya identik** — kompiler tidak akan menolong
  kalau kamu salah pilih.
- **Ada DUA file `INativeQueryVerifier.sol`** di paket yang sama. Yang di
  `contracts/write-ability/INativeQueryVerifier.sol` adalah salinan vendored yang
  **basi**: pragma `^0.8.20`, hanya `verify` tunggal, **tanpa** `verifyAndEmit`.
  Yang benar selalu `contracts/write-ability/common/INativeQueryVerifier.sol`.
  Aturan praktis: di paket ini, **`common/` selalu yang benar**.
- **`via_ir = true` WAJIB.** Overload batch `verifyAndEmit` menerima array calldata
  bersarang dan menabrak "stack too deep" di codegen lama. Sudah dibuktikan, bukan
  dugaan. Tanpa ini, strategi batching — inti model biaya proyek — tidak bisa dipanggil.
- **Dependensi Solidity dipasang lewat pnpm, bukan `forge install`.** `.gitignore`
  mengabaikan `lib/`, jadi submodule Foundry akan hilang dari repo. `remappings.txt`
  menunjuk ke `node_modules/`. Hanya `forge-std` yang tetap submodule.
- **Biaya gas `recordFact` didominasi ukuran `encodedTx`, BUKAN jumlah log.** Terukur
  atas tx mainnet nyata: decode receipt 4.864 byte = 375.316 gas, sementara mengiterasi
  seluruh 10 log hanya 2.254 gas (0,6%). Batasi batch berdasarkan **total byte**.

- **Subjek Aave `Borrow` adalah `onBehalfOf`, bukan `user`.** Untuk `Repay`, subjeknya
  `user` (yang berutang), bukan `repayer`. Salah pilih = seluruh skor teracuni.
- **Offset `amount` Aave TIDAK sama untuk semua event.** Pada `Borrow` dan `Supply`,
  `user` **tidak** di-index sehingga ia menempati `data[0]` dan `amount` bergeser ke
  **`data[1]`**. Pada `Repay`, `Withdraw`, dan `LiquidationCall`, `amount` memang di
  `data[0]`. Membaca word 0 untuk `Borrow`/`Supply` akan mencatat **alamat dompet
  sebagai jumlah pinjaman** — angka astronomis yang meracuni skor tanpa gejala.
  Diverifikasi dari `aave-v3-origin/IPool.sol` dan dikunci sebagai tes.
- **`observedAt` adalah satu-satunya field Fact yang TIDAK terbukti kriptografis.**
  Receipt Ethereum tidak memuat timestamp. Untuk urutan, durasi, dan kesegaran,
  pakai `blockHeight` — bukan `observedAt`.
- **Aggregator Chainlink bisa berganti** saat upgrade feed. Resolve `aggregator()`
  dari proxy secara berkala; simpan himpunan aggregator tepercaya, jangan hardcode satu.
- **Dokumentasi Creditcoin memakai path lama.** `docs.creditcoin.org/creditcoin-usc`
  sekarang 404. Pakai `docs.creditcoin.org/attestcoin-protocol`.
- **Nama "USC" masih ada di mana-mana** (nama repo, paket npm, nama kontrak) meski
  protokolnya sudah di-rebrand jadi Attestcoin. Keduanya hal yang sama.
- **Backend pakai ethers v6, frontend pakai viem/wagmi.** Disengaja — SDK Attestcoin
  memaksa ethers. Jangan diseragamkan; keduanya tak pernah bertemu di satu file.
- **Kolom `amount` di Postgres harus `NUMERIC(78,0)`**, bukan `BIGINT`.

---

## Gaya

- TypeScript strict. Tanpa `any` implisit.
- Solidity `^0.8.28` — **dipaksa oleh `@gluwa/usc-contracts` v0.2.0**, bukan 0.8.23.
  Custom error, bukan string `require`, di kontrak baru.
- Komentar menjelaskan **kenapa**, bukan **apa**.
- Bahasa dokumen: Indonesia. Identifier kode, commit, dan komentar: Inggris.
