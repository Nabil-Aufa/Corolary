# Corolary — Referensi REST API

> **Status dokumen:** kontrak resmi antara `services/api` (Dev A) dan `apps/web` (Dev B).
> Diturunkan dari `docs/architecture.md` §9. Kalau ada konflik, `architecture.md` menang;
> tapi bentuk detail request/response ada **hanya** di sini — `architecture.md` cuma
> memuat ringkasan satu baris per endpoint.
>
> **Aturan perubahan:** mengubah bentuk respons apa pun WAJIB commit yang menyentuh
> dokumen ini **dan** `packages/shared/src/types.ts` sekaligus (lihat `architecture.md` §12).

---

## 0. Konvensi Umum

### 0.1 Base URL

| Lingkungan | Base URL |
|---|---|
| Lokal | `http://localhost:8080/v1` |
| Produksi (testnet) | `https://api.corolary.xyz/v1` *(nama domain final ditentukan saat deploy)* |

Semua path di dokumen ini ditulis relatif terhadap `/v1`, mis. `GET /v1/health` berarti
`GET {baseUrl}/v1/health`.

### 0.2 Format

- Semua request/response berbadan **JSON** (`Content-Type: application/json`).
- Semua field **uint256** (`amount`, `answer`, `roundId`, saldo, dsb.) SELALU dikirim
  sebagai **string desimal**, tidak pernah `number`. Ini berlaku tanpa kecuali di
  seluruh permukaan API — lihat `architecture.md` §8.2.
- Semua timestamp adalah **unix seconds** (`number`), bukan ISO string, bukan milidetik.
- Semua alamat Ethereum/Creditcoin adalah string heksadesimal checksum-case
  `0x`-prefixed, 42 karakter (`Address` type di `packages/shared`).
- Semua hash (`txHash`, `factId`, `creditcoinTxHash`, `sourceTxHash`) adalah string
  heksadesimal `0x`-prefixed, 66 karakter (32 byte).

### 0.2b Field yang bisa `null`, dan kenapa

`amountUsd`, `priceUsd`, dan `priceSourceTxHash` bernilai `null` selama belum ada
**harga terbukti** untuk aset tersebut di `PriceRegistry`.

Sejak 2026-08-25 jalur harga Chainlink hidup dan tiga aset punya harga terbukti:
**WETH** (feed ETH/USD), **WBTC** (feed BTC/USD), dan **USDC** (feed USDC/USD).
Aset lain yang muncul di fakta — USDT, USDe, sUSDe, USDS, cbBTC — belum punya
aggregator tepercaya, jadi `amountUsd` untuk fakta beraset itu tetap `null`.
Ini keadaan permanen sampai kurator memanggil `trustAggregator`, bukan antrean
yang sedang jalan.

Ini bukan bug dan bukan data yang belum sempat diisi. Setiap angka USD di API
ini harus bisa ditelusuri ke satu event `AnswerUpdated` Chainlink yang dibuktikan
lewat Attestcoin. Membaca feed harga langsung akan mengisi kolom itu dengan
angka yang tampak benar tapi tidak punya bukti — dan itu merusak satu-satunya
klaim yang membedakan produk ini, tanpa terlihat sama sekali di UI.

Frontend harus menampilkan keadaan ini apa adanya (mis. "harga belum
dibuktikan"), bukan menggantinya dengan nol atau menyembunyikan barisnya.

---

### 0.3 Amplop Respons (Response Envelope)

Setiap respons — sukses maupun gagal — mengikuti bentuk seragam ini
(`ApiResponse<T>` di `packages/shared/src/types.ts`):

```typescript
type ApiResponse<T> =
  | { ok: true;  data: T; meta?: { cursor?: string; total?: number } }
  | { ok: false; error: { code: string; message: string } };
```

- `data` **hanya** hadir kalau `ok: true`.
- `error` **hanya** hadir kalau `ok: false`.
- `meta` **opsional**, hanya dipakai endpoint dengan paginasi atau hitungan total.
- Tidak ada endpoint yang menyimpang dari amplop ini — termasuk `/v1/health`.

### 0.4 Kode Status HTTP ↔ Kode Error

| HTTP Status | `error.code` | Kapan dipakai |
|---|---|---|
| 200 | — | Sukses (GET, dan `GET /v1/prove/:jobId`) |
| 202 | — | Sukses, request diterima untuk diproses async (`POST /v1/prove`) |
| 400 | `INVALID_ADDRESS` | Path/query parameter alamat bukan hex 20-byte yang valid |
| 400 | `INVALID_PARAM` | Parameter lain tidak valid (format, range, enum, kombinasi) |
| 404 | `NOT_FOUND` | Resource dengan identifier tersebut tidak ada |
| 429 | `RATE_LIMITED` | Klien melewati kuota rate limit |
| 502 / 503 | `UPSTREAM_UNAVAILABLE` | RPC Ethereum, RPC Creditcoin, prover, atau DB tak terjangkau |
| 500 | `INTERNAL` | Error tak terduga di server; sudah di-log dengan `requestId` |

> **Catatan desain `INVALID_ADDRESS` vs `INVALID_PARAM`:** alamat punya kode
> khusus karena ini kesalahan paling umum dari frontend (checksum salah, ENS
> belum diresolve, dsb.) dan berguna untuk penanganan UI yang berbeda (mis.
> highlight input alamat vs pesan generik).

### 0.5 Kode Error Lengkap

| Kode | Arti |
|---|---|
| `NOT_FOUND` | Resource tidak ditemukan (factId, jobId, atau alamat tanpa data market) |
| `INVALID_ADDRESS` | String alamat tidak valid — bukan `0x` + 40 hex char, atau checksum gagal |
| `INVALID_PARAM` | Query/body parameter tidak valid — tipe salah, di luar rentang, enum tak dikenal |
| `RATE_LIMITED` | Kuota rate limit klien habis; lihat `Retry-After` |
| `UPSTREAM_UNAVAILABLE` | Dependensi hilir (RPC Ethereum/Creditcoin, prover, Postgres) tidak merespons |
| `INTERNAL` | Error tak terduga di server |

### 0.6 Paginasi Berbasis Cursor

Dipakai di `GET /v1/facts` (satu-satunya endpoint dengan koleksi tak terbatas panjang).

- Parameter query `cursor` (string, opsional): **opaque** — klien tidak boleh
  membentuknya sendiri, cukup teruskan nilai `meta.cursor` dari respons sebelumnya.
- Parameter query `limit` (integer, opsional, default `20`, maks `100`): jumlah item
  per halaman. Nilai di atas `100` ditolak dengan `INVALID_PARAM`, **bukan** dipangkas
  diam-diam.
- Urutan default: **terbaru dulu** — descending berdasarkan
  `(blockHeight, txIndex, logIndex)`.
- Secara internal, `cursor` adalah Base64URL dari JSON
  `{"blockHeight":number,"txIndex":number,"logIndex":number}` milik item terakhir
  pada halaman tersebut. Ini detail implementasi; klien memperlakukannya sebagai
  string buram.
- Kalau `meta.cursor` **tidak hadir** di respons, berarti tidak ada halaman
  berikutnya (sudah di ujung koleksi).
- `meta.total` **tidak** disediakan di endpoint berpaginasi cursor (menghitung
  total di tabel besar mahal dan tidak konsisten dengan cursor). `meta.total`
  hanya dipakai di endpoint non-cursor seperti `GET /v1/market/reserves`.

### 0.7 Rate Limit

Token bucket per alamat IP (per API key di fase mendatang bila autentikasi
ditambahkan — belum ada di v1).

| Kelompok endpoint | Batas | Alasan |
|---|---|---|
| `GET /v1/*` (baca) | 120 request / menit / IP, burst 20 | Data publik, murah untuk API baca dari mirror Postgres |
| `POST /v1/prove` | 10 request / menit / IP | Tiap panggilan berujung ke antrean job yang memanggil prover + mengirim tx on-chain (biaya CTC nyata) |
| `GET /v1/prove/:jobId` | Termasuk kelompok baca (120/menit) | Polling status murah |
| `POST /v1/backfill` | 3 request / menit / IP, burst 2 | Paling mahal di seluruh API: satu panggilan yang lolos dedupe memindai ribuan blok lalu membuktikan SETIAP transaksi yang ditemukan pada tarif lazy 3,13×10⁻⁴ CTC |
| `GET /v1/backfill/:jobId` | Termasuk kelompok baca (120/menit) | Polling status murah |

Rate limit per-IP bukan rem biaya yang sebenarnya untuk `POST /v1/backfill` — ia
hanya membatasi seberapa cepat job MASUK. Yang membatasi seberapa cepat CTC
KELUAR adalah pekerja di indexer, yang menjalankan **satu backfill pada satu
waktu** (`services/indexer/src/jobs/backfill.ts`).

Header yang selalu disertakan di respons:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 117
X-RateLimit-Reset: 1787400060
```

Saat limit terlampaui, HTTP `429` dengan header tambahan:

```
Retry-After: 42
```

dan body:

```json
{ "ok": false, "error": { "code": "RATE_LIMITED", "message": "Rate limit exceeded, retry after 42s" } }
```

### 0.8 Versioning

- Versi berada di path: `/v1`. Tidak ada versioning lewat header.
- **Perubahan aditif** (field baru yang opsional di response, endpoint baru,
  parameter query opsional baru) **tidak** menaikkan versi — boleh langsung masuk `/v1`.
- **Perubahan breaking** (menghapus/mengganti tipe field, mengubah makna field,
  menghapus endpoint, mengubah kode status) WAJIB rilis sebagai `/v2` berdampingan
  dengan `/v1` sampai frontend bermigrasi. `/v1` tidak pernah diubah bentuknya
  secara breaking setelah dipakai `apps/web`.
- `GET /v1/health` men-tampilkan `version` (semver `services/api`) untuk debugging,
  bukan untuk content negotiation.

### 0.9 CORS

- API ini publik dan tanpa autentikasi/cookie di v1 (tidak ada data privat per
  user — semua data berasal dari fakta on-chain yang bisa dibaca siapa pun).
- Semua endpoint GET mengirim `Access-Control-Allow-Origin: *`.
- `POST /v1/prove` juga mengizinkan origin apa pun (`*`) karena dilindungi oleh
  rate limit per-IP di §0.7, bukan oleh origin check — origin check tidak
  memberi keamanan nyata untuk endpoint tanpa kredensial.
- Tidak ada `Access-Control-Allow-Credentials` (tidak dipakai, tidak ada cookie/session).
- Preflight (`OPTIONS`) menjawab `204` dengan `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  dan `Access-Control-Allow-Headers: Content-Type`.

### 0.10 Daftar Endpoint

| Method | Path | Ringkasan |
|---|---|---|
| GET | `/v1/health` | Liveness & versi service |
| GET | `/v1/chains` | Status source chain & attestation |
| GET | `/v1/indexer/status` | Cursor, lag, antrean indexer |
| GET | `/v1/facts` | Daftar fakta terverifikasi (berpaginasi) |
| GET | `/v1/facts/:factId` | Satu fakta + referensi proof |
| GET | `/v1/score/:address` | Skor kredit terkini |
| GET | `/v1/score/:address/history` | Riwayat skor dari waktu ke waktu |
| GET | `/v1/market/summary` | TVL, utilisasi, suku bunga agregat |
| GET | `/v1/market/reserves` | Daftar aset & parameter pasar |
| GET | `/v1/market/positions/:address` | Posisi kolateral/utang user |
| GET | `/v1/prices` | Harga terbukti terbaru per aset |
| POST | `/v1/prove` | Antre eager-proof untuk sebuah tx |
| GET | `/v1/prove/:jobId` | Status job proving |
| POST | `/v1/backfill` | Antre pemindaian riwayat mainnet untuk satu dompet |
| GET | `/v1/backfill/:jobId` | Status job backfill |

---

## 1. `GET /v1/health`

Liveness check dasar. Tidak menyentuh Postgres maupun RPC — dipakai load balancer /
orkestrator (Railway/Fly.io) untuk health probe, harus cepat dan selalu `200` selama
proses Node hidup.

> **Catatan penamaan:** field status di dalam `data` dinamai `status` (bukan `ok`)
> supaya tidak rancu dengan `ok` di amplop respons — dua hal yang berbeda lapis.

### Parameter

Tidak ada.

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/health
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "version": "1.4.0",
    "uptime": 385920.42,
    "timestamp": 1787400000
  }
}
```

### Respons Error

Endpoint ini praktis tidak pernah gagal selain `500` bila proses Node sendiri dalam
keadaan tak sehat (mis. out of memory) — dalam kasus itu proses biasanya sudah tidak
merespons sama sekali, bukan mengembalikan JSON error.

```json
{ "ok": false, "error": { "code": "INTERNAL", "message": "Unexpected error while reading process health" } }
```

### Kode Error yang Mungkin

`INTERNAL`

---

## 2. `GET /v1/chains`

Status source chain yang didukung Attestcoin dan posisi attestation-nya. Corolary
hanya memakai `chainKey = 3` (Ethereum mainnet) — lihat `architecture.md` §3 — tapi
endpoint ini tetap mengembalikan array untuk konsistensi bentuk dan kesiapan ekspansi.

### Parameter

Tidak ada.

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/chains
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": [
    {
      "chainKey": 3,
      "chainId": 1,
      "name": "Ethereum",
      "encoding": 1,
      "isSourceForFacts": true,
      "latestHeight": 25810648,
      "attestedHeight": 25810610,
      "checkpointHeight": 25810500,
      "lagBlocks": 38,
      "lagSeconds": 480,
      "genesisHeight": 0
    }
  ]
}
```

Field kunci:

| Field | Arti |
|---|---|
| `latestHeight` | Tinggi kepala Ethereum mainnet dari RPC indexer sendiri |
| `attestedHeight` | Tinggi tertinggi yang sudah ter-attest, dari `ChainInfo.get_latest_attestation_height_and_hash` |
| `checkpointHeight` | Checkpoint terakhir (1 per 1000 blok) — batas biaya proof murah vs mahal |
| `lagBlocks` / `lagSeconds` | `latestHeight - attestedHeight`, dan estimasinya dalam detik (~12 dtk/blok Ethereum) |
| `isSourceForFacts` | `true` hanya untuk `chainKey 3`; field ini eksplisit menandai chain lain (kalau muncul) tidak dipakai untuk FactRegistry |

### Respons Error

```json
{ "ok": false, "error": { "code": "UPSTREAM_UNAVAILABLE", "message": "Creditcoin RPC did not respond while querying ChainInfo precompile" } }
```

### Kode Error yang Mungkin

`UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 3. `GET /v1/indexer/status`

Kesehatan operasional indexer: cursor per protokol, lag terhadap attestation, dan
ukuran antrean per status (`observed_events.status`). Dipakai untuk dashboard
internal maupun badge "live" di frontend.

### Parameter

Tidak ada.

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/indexer/status
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": {
    "chainKey": 3,
    "latestEthereumBlock": 25810648,
    "attestedHeight": 25810610,
    "lagBlocks": 38,
    "cursors": [
      { "protocol": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", "protocolName": "Aave V3", "lastScannedBlock": 25810600, "updatedAt": 1787399940 },
      { "protocol": "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", "protocolName": "Morpho Blue", "lastScannedBlock": 25810598, "updatedAt": 1787399925 },
      { "protocol": "0xc3d688B66703497DAA19211EEdff47f25384cdc3", "protocolName": "Compound V3", "lastScannedBlock": 25810601, "updatedAt": 1787399951 }
    ],
    "queue": {
      "pending": 3,
      "awaitingAttestation": 12,
      "proving": 1,
      "submitting": 0,
      "recorded24h": 214,
      "failed": 0,
      "skipped24h": 5
    },
    "oldestUnprovenAgeSeconds": 612
  }
}
```

Field kunci:

| Field | Arti |
|---|---|
| `cursors[].lastScannedBlock` | Blok Ethereum terakhir yang sudah dipindai tuntas untuk protokol itu (`source_cursors.last_scanned_block`) |
| `queue.*` | Hitungan baris `observed_events` per nilai `status` saat ini (kecuali `recorded24h`/`skipped24h` yang dihitung 24 jam terakhir) |
| `oldestUnprovenAgeSeconds` | Umur event tertua yang belum `recorded`/`skipped` — indikator paling penting untuk memantau bahwa eager-proving (< 24 jam) tetap terjaga; lihat `docs/indexer.md` §4 |

### Respons Error

```json
{ "ok": false, "error": { "code": "UPSTREAM_UNAVAILABLE", "message": "Database unreachable while aggregating queue counts" } }
```

### Kode Error yang Mungkin

`UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 4. `GET /v1/facts`

Daftar fakta yang sudah terverifikasi dan tersimpan permanen di `FactRegistry`,
dibaca dari mirror Postgres (`facts` table). Ini adalah endpoint utama untuk feed
aktivitas dan penelusuran bukti.

### Parameter Query

| Parameter | Tipe | Wajib | Default | Validasi |
|---|---|---|---|---|
| `subject` | `Address` | tidak | — | Harus `0x` + 40 hex char valid, jika tidak → `INVALID_ADDRESS` |
| `kind` | integer `0`–`4` | tidak | — | Harus salah satu nilai `FactKind` (lihat tabel di bawah); nilai lain → `INVALID_PARAM` |
| `protocol` | `Address` | tidak | — | Harus alamat valid; tidak divalidasi terhadap daftar protokol terdaftar (hasil kosong kalau tidak cocok) |
| `cursor` | string | tidak | — | Nilai buram dari `meta.cursor` respons sebelumnya; nilai rusak → `INVALID_PARAM` |
| `limit` | integer | tidak | `20` | `1`–`100`; di luar rentang → `INVALID_PARAM` |

`FactKind`:

| Nilai | Nama |
|---|---|
| `0` | `LoanOriginated` |
| `1` | `LoanRepaid` |
| `2` | `Liquidated` |
| `3` | `CollateralSupplied` |
| `4` | `CollateralWithdrawn` |

Filter yang dikirim bersamaan digabung dengan **AND** (mis. `subject` + `kind`
berarti "fakta jenis X milik alamat Y").

### Contoh Request

```bash
curl -s "https://api.corolary.xyz/v1/facts?subject=0x1234567890AbcdEF1234567890aBcdef12345678&kind=1&limit=2"
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": [
    {
      "factId": "0xa680d3c5d1d79302e99566b95840e65404eb025789d38d0008ac879a93ceb975",
      "chainKey": 3,
      "blockHeight": 25808842,
      "txHash": "0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939",
      "txIndex": 87,
      "txLogIndex": 142,
      "logIndex": 142,
      "kind": 1,
      "subject": "0x1234567890AbcdEF1234567890aBcdef12345678",
      "protocol": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      "protocolName": "Aave V3",
      "asset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "assetSymbol": "USDC",
      "assetDecimals": 6,
      "amount": "2500000000",
      "amountUsd": "2499.85",
      "observedAt": 1787395200,
      "recordedAt": 1787396040,
      "creditcoinTxHash": "0xba6578295eb9ac57b17a37c93bb0aae0e55ca3e866b84a98d9b00ce513a345b6",
      "etherscanUrl": "https://etherscan.io/tx/0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939"
    },
    {
      "factId": "0x7ce0d37c06f0059c0aace8ea5991503c32de87a9140e4bbf237705352928e16a",
      "chainKey": 3,
      "blockHeight": 25801117,
      "txHash": "0x6ce1fe2393ae2f1498b141d2712a0969c3d28c3f40889f58a808741e869b1115",
      "txIndex": 41,
      "txLogIndex": 9,
      "logIndex": 9,
      "kind": 1,
      "subject": "0x1234567890AbcdEF1234567890aBcdef12345678",
      "protocol": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      "protocolName": "Aave V3",
      "asset": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "assetSymbol": "WETH",
      "assetDecimals": 18,
      "amount": "750000000000000000",
      "amountUsd": "1821.99",
      "observedAt": 1787131200,
      "recordedAt": 1787131980,
      "creditcoinTxHash": "0x7ca155d4f77491cedd928494034f67248e3446aaf1538a8b50d40a74a5c23461",
      "etherscanUrl": "https://etherscan.io/tx/0x6ce1fe2393ae2f1498b141d2712a0969c3d28c3f40889f58a808741e869b1115"
    }
  ],
  "meta": {
    "cursor": "eyJibG9ja0hlaWdodCI6MjU4MDExMTcsInR4SW5kZXgiOjQxLCJsb2dJbmRleCI6OX0"
  }
}
```

Panggil ulang dengan `&cursor=eyJibG9ja0hlaWdodCI6MjU4MDExMTcsInR4SW5kZXgiOjQxLCJsb2dJbmRleCI6OX0`
untuk halaman berikutnya. Kalau `meta.cursor` tidak ada di respons, ini halaman terakhir.

### Respons Error

```json
{ "ok": false, "error": { "code": "INVALID_ADDRESS", "message": "subject is not a valid 20-byte hex address: 0xzz" } }
```

```json
{ "ok": false, "error": { "code": "INVALID_PARAM", "message": "kind must be an integer between 0 and 4, got 9" } }
```

```json
{ "ok": false, "error": { "code": "INVALID_PARAM", "message": "limit must be between 1 and 100, got 500" } }
```

### Kode Error yang Mungkin

`INVALID_ADDRESS`, `INVALID_PARAM`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 5. `GET /v1/facts/:factId`

Satu fakta lengkap beserta **referensi proof** — informasi yang memungkinkan UI
menautkan sampai ke bukti kriptografis di balik fakta itu (bukan proof mentah itu
sendiri, yang sudah dikonsumsi on-chain saat `recordFact` dipanggil dan tidak
disimpan ulang di Postgres).

Bentuk respons adalah `Fact` (persis §8.2 `architecture.md`) **ditambah** objek
`proof` — perluasan khusus endpoint ini, bukan perubahan pada tipe `Fact` itu sendiri.

### Parameter Path

| Parameter | Tipe | Wajib | Validasi |
|---|---|---|---|
| `factId` | `Hex` (bytes32) | ya | `0x` + 64 hex char; jika tidak → `INVALID_PARAM` |

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/facts/0xa680d3c5d1d79302e99566b95840e65404eb025789d38d0008ac879a93ceb975
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": {
    "factId": "0xa680d3c5d1d79302e99566b95840e65404eb025789d38d0008ac879a93ceb975",
    "chainKey": 3,
    "blockHeight": 25808842,
    "txHash": "0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939",
    "txIndex": 87,
    "txLogIndex": 142,
    "logIndex": 142,
    "kind": 1,
    "subject": "0x1234567890AbcdEF1234567890aBcdef12345678",
    "protocol": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    "protocolName": "Aave V3",
    "asset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "assetSymbol": "USDC",
    "assetDecimals": 6,
    "amount": "2500000000",
    "amountUsd": "2499.85",
    "observedAt": 1787395200,
    "recordedAt": 1787396040,
    "creditcoinTxHash": "0xba6578295eb9ac57b17a37c93bb0aae0e55ca3e866b84a98d9b00ce513a345b6",
    "etherscanUrl": "https://etherscan.io/tx/0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939",
    "proof": {
      "provedWithinHours": 0.23,
      "continuityProofRootsCount": 10,
      "merkleProofSiblingsCount": 9,
      "batchId": "batch-25808800-25808842-0",
      "batchSize": 6,
      "verifiedAtBlock": 1284771,
      "creditcoinExplorerUrl": "https://creditcoin-testnet.blockscout.com/tx/0xba6578295eb9ac57b17a37c93bb0aae0e55ca3e866b84a98d9b00ce513a345b6"
    }
  }
}
```

Field `proof`:

| Field | Arti |
|---|---|
| `provedWithinHours` | Selisih `recordedAt - observedAt` dalam jam — bukti nyata bahwa fakta ini dibuktikan lewat jalur eager (< 24 jam), lihat `docs/indexer.md` §4 |
| `continuityProofRootsCount` | Panjang continuity proof saat submit — kecil karena masih segar (bandingkan §2.3 `attestcoin-research.md`) |
| `merkleProofSiblingsCount` | Jumlah sibling Merkle inclusion proof |
| `batchId` | Identifier batch proving internal indexer (lihat `docs/indexer.md` §5) |
| `batchSize` | Jumlah tx yang berbagi continuity proof yang sama di batch ini |
| `verifiedAtBlock` | Blok Creditcoin tempat `FactRecorded` di-emit |
| `creditcoinExplorerUrl` | Tautan ke transaksi Creditcoin yang mencatat fakta ini |

### Respons Error

```json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "no fact found with factId 0xdead...beef" } }
```

```json
{ "ok": false, "error": { "code": "INVALID_PARAM", "message": "factId must be a 32-byte hex string prefixed with 0x" } }
```

### Kode Error yang Mungkin

`NOT_FOUND`, `INVALID_PARAM`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 6. `GET /v1/score/:address`

Skor kredit terkini untuk sebuah alamat — bentuk `CreditScore` persis §8.3
`architecture.md`.

> **Keputusan desain:** alamat yang **belum pernah** punya fakta tercatat **bukan**
> `404`. Ia mengembalikan `CreditScore` dengan `score: 0`, `tier: 0`, `factCount: 0`,
> `components: []` — konsisten dengan filosofi "setiap alamat mulai dari nol,
> bukan dari ketiadaan". `NOT_FOUND` di endpoint ini hanya dipakai kalau `address`
> sendiri tidak valid secara format... yang justru sudah ditangani oleh `INVALID_ADDRESS`.
> Jadi endpoint ini **tidak pernah** mengembalikan `NOT_FOUND` — didokumentasikan
> di sini secara eksplisit supaya tidak ambigu bagi Dev B.

### Parameter Path

| Parameter | Tipe | Wajib | Validasi |
|---|---|---|---|
| `address` | `Address` | ya | `0x` + 40 hex char valid; jika tidak → `INVALID_ADDRESS` |

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/score/0x1234567890AbcdEF1234567890aBcdef12345678
```

### Respons Sukses — `200`

Contoh nyata: dompet demo, skor 813 (tier 4).

```json
{
    "ok": true,
    "data": {
        "subject": "0x94963B928498bE7f06637C3D57ea1E74D7f73423",
        "score": 813,
        "tier": 4,
        "collateralRatioBps": 11000,
        "components": [
            {
                "key": "repaymentVolume",
                "label": "Volume pelunasan",
                "points": 297,
                "maxPoints": 300,
                "factCount": 72,
                "factIds": [
                    "0x1eaf52b3798479582a00254c835f0bd394fb703e63683c7528598bda7ec6a43d",
                    "0xd082a1e76fc34c3fabf37c7a4a2af485a3d6fe0a8039786ffe8cf5cf3feca281",
                    "0x721b3f4246795a21e652d9fadd9843c660112a8a51ec5b7a9b32f23783b7ebf8",
                    "0x3865076f4ad395ecb311db5ce5ceec8d4607a7a782be29ed06a8b3668cdd7264",
                    "0x1b6d488789af73ff364715f6426c51b190be12806a621a0ded9b84f184b06152",
                    "0x3988e969891d80292fdd3faa8715110fddb8b0372579353df9b9881a542b5482",
                    "0x668a682fdb7c0dfd8c771df41ab47b07849f798359c2d3045991d0050ad57e20",
                    "0xe0e67d37e8b8266ec5ba34947b9429c8aacf262991612bb7c8b5df6620b9ea1c",
                    "0x373bdb9422556307d2c06191953d8a88e76c47d419d40487454f213b2851f738",
                    "0xd28b68f0f4de1d9e2a4e7b4b4d0eca8d6053aec59b12840fe98ca93a587245a5"
                ]
            },
            {
                "key": "repaymentCount",
                "label": "Jumlah pelunasan",
                "points": 171,
                "maxPoints": 200,
                "factCount": 72,
                "factIds": [
                    "0x1eaf52b3798479582a00254c835f0bd394fb703e63683c7528598bda7ec6a43d",
                    "0xd082a1e76fc34c3fabf37c7a4a2af485a3d6fe0a8039786ffe8cf5cf3feca281",
                    "0x721b3f4246795a21e652d9fadd9843c660112a8a51ec5b7a9b32f23783b7ebf8",
                    "0x3865076f4ad395ecb311db5ce5ceec8d4607a7a782be29ed06a8b3668cdd7264",
                    "0x1b6d488789af73ff364715f6426c51b190be12806a621a0ded9b84f184b06152",
                    "0x3988e969891d80292fdd3faa8715110fddb8b0372579353df9b9881a542b5482",
                    "0x668a682fdb7c0dfd8c771df41ab47b07849f798359c2d3045991d0050ad57e20",
                    "0xe0e67d37e8b8266ec5ba34947b9429c8aacf262991612bb7c8b5df6620b9ea1c",
                    "0x373bdb9422556307d2c06191953d8a88e76c47d419d40487454f213b2851f738",
                    "0xd28b68f0f4de1d9e2a4e7b4b4d0eca8d6053aec59b12840fe98ca93a587245a5"
                ]
            },
            {
                "key": "historyDuration",
                "label": "Lama riwayat",
                "points": 95,
                "maxPoints": 200,
                "factCount": 0,
                "factIds": []
            },
            {
                "key": "liquidationPenalty",
                "label": "Penalti likuidasi",
                "points": 0,
                "maxPoints": 300,
                "factCount": 0,
                "factIds": []
            },
            {
                "key": "protocolDiversity",
                "label": "Diversitas protokol",
                "points": 50,
                "maxPoints": 100,
                "factCount": 139,
                "factIds": [
                    "0x1eaf52b3798479582a00254c835f0bd394fb703e63683c7528598bda7ec6a43d",
                    "0xd082a1e76fc34c3fabf37c7a4a2af485a3d6fe0a8039786ffe8cf5cf3feca281",
                    "0x721b3f4246795a21e652d9fadd9843c660112a8a51ec5b7a9b32f23783b7ebf8",
                    "0x3865076f4ad395ecb311db5ce5ceec8d4607a7a782be29ed06a8b3668cdd7264",
                    "0x1b6d488789af73ff364715f6426c51b190be12806a621a0ded9b84f184b06152",
                    "0xbe1004a9d8c8390bef2bf2c74b28eb20e2073ada57bfb4dcf10c8a5ddf4245f9",
                    "0xcd49039ef07248ffe6637057359fdd22566b3ae6c349f9dec97ef76b0081b385",
                    "0xa49efaf3a0d997f1133366e3e3b8aa04c36167b471d658e718a8dd3fbe29bfdf",
                    "0x3988e969891d80292fdd3faa8715110fddb8b0372579353df9b9881a542b5482",
                    "0x668a682fdb7c0dfd8c771df41ab47b07849f798359c2d3045991d0050ad57e20"
                ]
            },
            {
                "key": "activeStanding",
                "label": "Status aktif",
                "points": 200,
                "maxPoints": 200,
                "factCount": 129,
                "factIds": [
                    "0x1eaf52b3798479582a00254c835f0bd394fb703e63683c7528598bda7ec6a43d",
                    "0xd082a1e76fc34c3fabf37c7a4a2af485a3d6fe0a8039786ffe8cf5cf3feca281",
                    "0x721b3f4246795a21e652d9fadd9843c660112a8a51ec5b7a9b32f23783b7ebf8",
                    "0x3865076f4ad395ecb311db5ce5ceec8d4607a7a782be29ed06a8b3668cdd7264",
                    "0x1b6d488789af73ff364715f6426c51b190be12806a621a0ded9b84f184b06152",
                    "0xb5423aada02c813a051329269a54e4d00f96e51253d935d620f5a5c51b65caad",
                    "0x3988e969891d80292fdd3faa8715110fddb8b0372579353df9b9881a542b5482",
                    "0x668a682fdb7c0dfd8c771df41ab47b07849f798359c2d3045991d0050ad57e20",
                    "0xe0e67d37e8b8266ec5ba34947b9429c8aacf262991612bb7c8b5df6620b9ea1c",
                    "0x105058c791fdd3c20e8b48c64b86a38ae2354ca0cd88da4bed138a92e80f0870"
                ]
            }
        ],
        "factCount": 264,
        "firstFactAt": 1758648299,
        "lastFactAt": 1787630591,
        "computedAt": 1787675436,
        "onChainBlock": 5372485
    }
}
```

**`factIds` dipotong ke 10 terbaru, `factCount` tidak.** Di respons di atas
`repaymentVolume` menunjuk `factCount: 72` tapi hanya membawa 10 id. UI yang
menganggap `factIds.length === factCount` akan mengaku menampilkan seluruh bukti
padahal tidak. Untuk daftar penuh, pakai `GET /v1/facts?subject=…`.

`liquidationPenalty` punya `maxPoints: 300` dan `points` yang **boleh negatif**;
komponen lain selalu nol atau positif. `historyDuration` selalu
`factIds: []` karena ia diturunkan dari `firstFactAt`, bukan dari satu fakta
tertentu.

### Contoh Respons — Alamat Tanpa Riwayat

`components` adalah array KOSONG, bukan enam komponen bernilai nol.

```json
{
    "ok": true,
    "data": {
        "subject": "0x000000000000000000000000000000000000dEaD",
        "score": 0,
        "tier": 0,
        "collateralRatioBps": 15000,
        "components": [],
        "factCount": 0,
        "firstFactAt": null,
        "lastFactAt": null,
        "computedAt": 1787679517,
        "onChainBlock": 5372755
    }
}
```

### Respons Error

```json
{ "ok": false, "error": { "code": "INVALID_ADDRESS", "message": "address is not a valid 20-byte hex address: 0x123" } }
```

### Kode Error yang Mungkin

`INVALID_ADDRESS`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 7. `GET /v1/score/:address/history`

Riwayat perubahan skor dari waktu ke waktu, dari tabel `score_history` — dipakai
untuk grafik tren di UI.

### Parameter Path

| Parameter | Tipe | Wajib | Validasi |
|---|---|---|---|
| `address` | `Address` | ya | `0x` + 40 hex char valid; jika tidak → `INVALID_ADDRESS` |

### Parameter Query

| Parameter | Tipe | Wajib | Default | Validasi |
|---|---|---|---|---|
| `from` | integer (unix seconds) | tidak | `0` | Harus `>= 0`; jika tidak → `INVALID_PARAM` |
| `to` | integer (unix seconds) | tidak | waktu sekarang saat request diterima | Harus `>= from`; jika tidak → `INVALID_PARAM` |
| `limit` | integer | tidak | `500` | `1`–`1000`; di luar rentang → `INVALID_PARAM` |

Rentang `[from, to]` inklusif di kedua ujung. Titik data diurutkan menaik
berdasarkan `atTime`. Kalau titik dalam rentang lebih banyak dari `limit`,
respons memotong dari yang **terlama** (mengembalikan `limit` titik terbaru
dalam rentang) — pilihan ini disengaja supaya grafik tren selalu menunjukkan
kondisi terbaru, bukan terpotong di ujung yang salah.

### Contoh Request

```bash
curl -s "https://api.corolary.xyz/v1/score/0x1234567890AbcdEF1234567890aBcdef12345678/history?from=1780000000&to=1787400000"
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": [
    { "subject": "0x1234567890AbcdEF1234567890aBcdef12345678", "score": 610, "tier": 3, "atBlock": 1201042, "atTime": 1781000000 },
    { "subject": "0x1234567890AbcdEF1234567890aBcdef12345678", "score": 655, "tier": 3, "atBlock": 1234981, "atTime": 1783500000 },
    { "subject": "0x1234567890AbcdEF1234567890aBcdef12345678", "score": 742, "tier": 3, "atBlock": 1284790, "atTime": 1787396040 }
  ],
  "meta": { "total": 3 }
}
```

### Respons Error

```json
{ "ok": false, "error": { "code": "INVALID_PARAM", "message": "to (1770000000) must be >= from (1780000000)" } }
```

### Kode Error yang Mungkin

`INVALID_ADDRESS`, `INVALID_PARAM`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 8. `GET /v1/market/summary`

Ringkasan agregat `EfficiencyMarket`: TVL, total dipinjam, utilisasi keseluruhan.
Semua angka diturunkan dari state kontrak on-chain (dibaca via RPC Creditcoin dan
di-cache singkat di API), bukan dihitung dari fakta Ethereum — market adalah
Lapis 3, hidup penuh di Creditcoin.

### Parameter

Tidak ada.

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/market/summary
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": {
    "tvlUsd": "4812390.55",
    "totalSuppliedUsd": "4812390.55",
    "totalBorrowedUsd": "2103771.02",
    "utilizationBps": 4372,
    "reserveCount": 3,
    "avgCollateralRatioBps": 12850,
    "updatedAt": 1787399820,
    "onChainBlock": 1284790
  }
}
```

### Respons Error

```json
{ "ok": false, "error": { "code": "UPSTREAM_UNAVAILABLE", "message": "Creditcoin RPC timeout while reading EfficiencyMarket state" } }
```

### Kode Error yang Mungkin

`UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 9. `GET /v1/market/reserves`

Daftar aset yang didukung `EfficiencyMarket`, dengan parameter dan state per aset.

### Parameter

Tidak ada (daftar aset kecil dan tetap — tidak dipaginasi).

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/market/reserves
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": [
    {
      "asset": "0x66f5F2C577ec38CE5bb7BCb7054a531a72004d19",
      "symbol": "tUSDC",
      "decimals": 6,
      "totalSupplied": "0",
      "totalBorrowed": "0",
      "supplyApyBps": 0,
      "borrowApyBps": 0,
      "utilizationBps": 0,
      "priceUsd": "0.99",
      "priceSourceTxHash": "0x25466b36fdf34cfe1b767e4a64b7389cd96b32ec80a1d3d105d1560c5525321c"
    },
    {
      "asset": "0x886E3d92314c037206bB789Ee3A9016EE67b661E",
      "symbol": "tWETH",
      "decimals": 18,
      "totalSupplied": "0",
      "totalBorrowed": "0",
      "supplyApyBps": 0,
      "borrowApyBps": 0,
      "utilizationBps": 0,
      "priceUsd": "2511.24",
      "priceSourceTxHash": "0x7f4c377c94034e24d8c9f49f579581ba8b1087605a6f6f319ba68f29ef18b659"
    }
  ],
  "meta": { "total": 2 }
}
```

Contoh di atas adalah respons SUNGGUHAN dari CC3 Testnet (2026-08-25). Reserve-nya
adalah token testnet karena `EfficiencyMarket` berjalan di CC3, di mana USDC/WETH
sungguhan tidak ada (open-issues B2). **Harganya tidak testnet**: `priceSourceTxHash`
menunjuk ke transaksi Ethereum mainnet yang sungguhan, lewat
`PriceRegistry.setPriceAlias` yang memetakan tUSDC→USDC dan tWETH→WETH. Alias itu
di-resolve dari KONTRAK saat permintaan, bukan disalin ke SQL — aturan aliasnya
milik kontrak, dan salinan kedua adalah salinan yang akan menyimpang.

Saldo nol karena belum ada yang meminjam di pasar testnet; itu state sungguhan,
bukan placeholder.

> **Catatan `priceUsd`:** desimal string non-integer, **bukan** uint256 mentah —
> ini nilai yang sudah dibagi `decimals` feed (8) untuk keterbacaan UI. Nilai
> mentah `answer` (uint256/int256 sesuai Chainlink) tersedia apa adanya di
> `GET /v1/prices`.

### Respons Error

```json
{ "ok": false, "error": { "code": "UPSTREAM_UNAVAILABLE", "message": "Creditcoin RPC timeout while reading reserve state" } }
```

### Kode Error yang Mungkin

`UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 10. `GET /v1/market/positions/:address`

Posisi kolateral dan utang sebuah alamat di `EfficiencyMarket`, plus rasio
kolateral efektif yang berlaku untuknya (hasil dari tier skor kredit).

### Parameter Path

| Parameter | Tipe | Wajib | Validasi |
|---|---|---|---|
| `address` | `Address` | ya | `0x` + 40 hex char valid; jika tidak → `INVALID_ADDRESS` |

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/market/positions/0x1234567890AbcdEF1234567890aBcdef12345678
```

### Respons Sukses — `200`

Contoh nyata dari CC3 Testnet: dompet deployer, punya kolateral tapi nol utang.

```json
{
    "ok": true,
    "data": {
        "subject": "0x4e83Fa344E529f4c03948691BDD5A9A83384ED05",
        "tier": 0,
        "collateralRatioBps": 15000,
        "totalCollateralUsd": "12284.96",
        "totalDebtUsd": "0.00",
        "healthFactorBps": null,
        "capitalSavedUsd": "0.00",
        "positions": [
            {
                "asset": "0x66f5F2C577ec38CE5bb7BCb7054a531a72004d19",
                "symbol": "tUSDC",
                "decimals": 6,
                "supplied": "9999500274",
                "borrowed": "0",
                "collateralEnabled": false
            },
            {
                "asset": "0x886E3d92314c037206bB789Ee3A9016EE67b661E",
                "symbol": "tWETH",
                "decimals": 18,
                "supplied": "5000000000000000000",
                "borrowed": "0",
                "collateralEnabled": true
            }
        ],
        "updatedAt": 1787679291,
        "onChainBlock": 5372740
    }
}
```

### Contoh Respons — Dompet Berskor Tinggi Tanpa Posisi

Dompet demo berskor 813 (tier 4). Perhatikan `collateralRatioBps` sudah **11000**
walau ia belum meminjam apa pun.

```json
{
    "ok": true,
    "data": {
        "subject": "0x94963B928498bE7f06637C3D57ea1E74D7f73423",
        "tier": 4,
        "collateralRatioBps": 11000,
        "totalCollateralUsd": "0.00",
        "totalDebtUsd": "0.00",
        "healthFactorBps": null,
        "capitalSavedUsd": "0.00",
        "positions": [],
        "updatedAt": 1787679296,
        "onChainBlock": 5372740
    }
}
```

`healthFactorBps` bernilai `null` ketika tidak ada utang — rasionya memang tak
terdefinisi, dan `Infinity` bukan JSON yang sah. Kontrak mengembalikan
`type(uint256).max` untuk kasus ini; API **tidak** meneruskannya apa adanya,
karena UI yang merendernya akan menampilkan health factor
900.719.925.474.099.100%.

`capitalSavedUsd` adalah modal yang tidak perlu dikunci berkat skor, dibanding
baseline 150% — `debtUsd × (15000 − collateralRatioBps) / 10000`. Ia **nol**
dalam dua keadaan yang sama-sama normal: dompet tanpa riwayat terbukti (rasionya
masih baseline), dan dompet berskor tinggi yang belum meminjam apa pun.
Penghematan dihitung terhadap utang yang benar-benar ada, bukan terhadap utang
yang mungkin diambil.

### Respons Error

```json
{ "ok": false, "error": { "code": "INVALID_ADDRESS", "message": "address is not a valid 20-byte hex address" } }
```

### Kode Error yang Mungkin

`INVALID_ADDRESS`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 11. `GET /v1/prices`

Harga terbukti terbaru per aset, dari `PriceRegistry` (di-mirror ke tabel `prices`),
beserta umur bukti — menegakkan prinsip "nol oracle terpusat" (§2 `architecture.md`):
tiap harga menunjuk ke `sourceTxHash`, yaitu transaksi Ethereum yang memuat event
`AnswerUpdated` yang membuktikannya.

> **Kenapa bukan `factId`.** Harga bukan Fact. `PriceRegistry` menyimpan ronde
> TERBARU per aset — bukan catatan permanen ber-ID seperti `FactRegistry` — jadi
> tidak ada `factId` untuk ditunjuk. Artefak yang benar-benar bisa ditelusuri
> adalah transaksi Ethereum-nya, dan itulah yang dikembalikan.

> **`pair` adalah nama feed Chainlink, bukan simbol aset + "/USD".** WBTC dihargai
> oleh feed **BTC/USD**; "WBTC/USD" adalah feed Chainlink yang berbeda (WBTC/BTC
> dikali BTC/USD) yang tidak pernah kita baca. Sama untuk WETH ↔ ETH/USD.

### Parameter

Tidak ada (daftar aset dengan feed harga kecil dan tetap).

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/prices
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": [
    {
      "asset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "assetSymbol": "USDC",
      "pair": "USDC/USD",
      "aggregator": "0xc9E1a09622afdB659913fefE800fEaE5DBbFe9d7",
      "answer": "99993882",
      "decimals": 8,
      "roundId": "1151",
      "sourceBlock": 25830582,
      "sourceTxHash": "0x25466b36fdf34cfe1b767e4a64b7389cd96b32ec80a1d3d105d1560c5525321c",
      "updatedAt": 1787641259,
      "ageSeconds": 2204
    },
    {
      "asset": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      "assetSymbol": "WBTC",
      "pair": "BTC/USD",
      "aggregator": "0x4a3411ac2948B33c69666B35cc6d055B27Ea84f1",
      "answer": "8071083412016",
      "decimals": 8,
      "roundId": "23682",
      "sourceBlock": 25830441,
      "sourceTxHash": "0x57863a8ec71d04d0fe4928dbd9e3bfa97878e632aab9351b472f4f8909910806",
      "updatedAt": 1787639555,
      "ageSeconds": 3908
    },
    {
      "asset": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "assetSymbol": "WETH",
      "pair": "ETH/USD",
      "aggregator": "0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5",
      "answer": "251124360000",
      "decimals": 8,
      "roundId": "32938",
      "sourceBlock": 25830607,
      "sourceTxHash": "0x7f4c377c94034e24d8c9f49f579581ba8b1087605a6f6f319ba68f29ef18b659",
      "updatedAt": 1787641559,
      "ageSeconds": 1904
    }
  ],
  "meta": { "total": 3 }
}
```

Contoh di atas adalah respons SUNGGUHAN dari jalur yang berjalan (2026-08-25),
bukan angka ilustrasi. `roundId` di sini kecil karena ia nomor ronde milik
**aggregator**, bukan `roundId` gabungan berfase yang dikembalikan proxy — event
`AnswerUpdated` dipancarkan aggregator, jadi itulah yang terbukti.

`roundId` adalah `uint80` di Chainlink — juga selalu string. `ageSeconds` dihitung
server-side (`now - updatedAt`) saat respons dibentuk, bukan disimpan di DB.

### Respons Error

```json
{ "ok": false, "error": { "code": "UPSTREAM_UNAVAILABLE", "message": "Postgres query timed out reading prices table" } }
```

### Kode Error yang Mungkin

`UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 12. `POST /v1/prove`

Meminta indexer mengantre eager-proof untuk sebuah transaksi Ethereum tertentu di
luar jalur pemindaian otomatis biasa — dipakai untuk kasus seperti "user klaim sudah
melakukan repay tapi belum muncul di feed" atau tooling internal/demo. Ini
**mengantre job**, bukan memprosesnya secara sinkron — panggil prover dan
mengirim transaksi Creditcoin butuh waktu (menunggu attestation kalau belum
ter-attest, lalu proving, lalu submit).

### Body Request

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `txHash` | `Hex` (32 byte) | ya | `0x` + 64 hex char; jika tidak → `INVALID_PARAM` |
| `chainKey` | integer | ya | Harus `3` (satu-satunya source chain yang dipakai Corolary — lihat `architecture.md` §3); nilai lain → `INVALID_PARAM` |

### Contoh Request

```bash
curl -s -X POST https://api.corolary.xyz/v1/prove \
  -H "Content-Type: application/json" \
  -d '{"txHash":"0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939","chainKey":3}'
```

### Respons Sukses — `202 Accepted`

```json
{
  "ok": true,
  "data": {
    "jobId": "b2f1a6c4-8e3d-4f7a-9c1e-5d8b3f2a7c94",
    "status": "pending",
    "txHash": "0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939",
    "chainKey": 3,
    "createdAt": 1787400000
  }
}
```

Kalau `txHash` yang sama sudah pernah diminta dan masih ada di antrean, API
mengembalikan job yang sudah ada alih-alih membuat duplikat.

Kalau transaksinya **sudah tercatat sebagai `Fact`**, API tidak membuat job sama
sekali dan langsung menjawab dengan `factId`-nya. `jobId` bernilai `null` di
kasus ini: fakta yang ditemukan watcher live tidak pernah lewat tabel `jobs`,
jadi tidak ada apa pun untuk ditanyakan lewat `GET /v1/prove/:jobId`.

Pemeriksaan itu **wajib ada**, bukan optimasi. Tanpanya setiap permintaan untuk
transaksi yang sudah tercatat tetap membeli proof, membayarnya, lalu ditolak
on-chain dengan `QueryAlreadyProcessed` dan diklasifikasi `skip` — biaya CTC
nyata untuk hasil nol, dalam batas rate limit yang sah.

Contoh nyata dari CC3 Testnet:

```json
{
    "ok": true,
    "data": {
        "jobId": null,
        "status": "recorded",
        "txHash": "0x9a0043b1188571c6ca69b1c93c0ae61b8e33e831a742b13ec74ea9f1d9b9b3bb",
        "chainKey": 3,
        "createdAt": 1787680140,
        "factId": "0x05e9d1ab86d63b902696051bcb8b5582c0008ec9344a9990b383b62ba8e64e13"
    }
}
```

### Respons Error

```json
{ "ok": false, "error": { "code": "INVALID_PARAM", "message": "chainKey must be 3 (Ethereum mainnet); received 1" } }
```

```json
{ "ok": false, "error": { "code": "INVALID_PARAM", "message": "txHash must be a 32-byte hex string prefixed with 0x" } }
```

```json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "transaction 0x38e9...92e939 not found on Ethereum mainnet (checked via ETHEREUM_RPC_URL)" } }
```

```json
{ "ok": false, "error": { "code": "UPSTREAM_UNAVAILABLE", "message": "could not reach Ethereum RPC to validate transaction existence" } }
```

### Kode Error yang Mungkin

`INVALID_PARAM`, `NOT_FOUND`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 13. `GET /v1/prove/:jobId`

Status job proving yang diantre lewat `POST /v1/prove` (mencerminkan baris tabel
`jobs`).

### Parameter Path

| Parameter | Tipe | Wajib | Validasi |
|---|---|---|---|
| `jobId` | string (UUID v4) | ya | Format UUID; jika tidak → `INVALID_PARAM` |

### Contoh Request

```bash
curl -s https://api.corolary.xyz/v1/prove/b2f1a6c4-8e3d-4f7a-9c1e-5d8b3f2a7c94
```

### Respons Sukses — `200` (masih diproses)

```json
{
  "ok": true,
  "data": {
    "jobId": "b2f1a6c4-8e3d-4f7a-9c1e-5d8b3f2a7c94",
    "kind": "eager_prove",
    "status": "awaiting_attestation",
    "txHash": "0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939",
    "chainKey": 3,
    "attempts": 1,
    "lastError": null,
    "createdAt": 1787400000,
    "updatedAt": 1787400015
  }
}
```

### Respons Sukses — `200` (selesai)

```json
{
  "ok": true,
  "data": {
    "jobId": "b2f1a6c4-8e3d-4f7a-9c1e-5d8b3f2a7c94",
    "kind": "eager_prove",
    "status": "recorded",
    "txHash": "0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939",
    "chainKey": 3,
    "attempts": 1,
    "lastError": null,
    "createdAt": 1787400000,
    "updatedAt": 1787400840,
    "factId": "0xa680d3c5d1d79302e99566b95840e65404eb025789d38d0008ac879a93ceb975"
  }
}
```

### Respons Sukses — `200` (gagal permanen)

```json
{
  "ok": true,
  "data": {
    "jobId": "b2f1a6c4-8e3d-4f7a-9c1e-5d8b3f2a7c94",
    "kind": "eager_prove",
    "status": "skipped",
    "txHash": "0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939",
    "chainKey": 3,
    "attempts": 1,
    "lastError": "source transaction reverted (receiptStatus != 1); no fact recorded by design",
    "createdAt": 1787400000,
    "updatedAt": 1787400120,
    "factId": null
  }
}
```

`status` memakai enum yang persis sama dengan `observed_events.status` di
`architecture.md` §10: `pending | awaiting_attestation | proving | submitting |
recorded | failed | skipped`. Lihat `docs/indexer.md` §2 untuk state machine
lengkapnya.

### Respons Error

```json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "no job found with jobId b2f1a6c4-...-000000000000" } }
```

```json
{ "ok": false, "error": { "code": "INVALID_PARAM", "message": "jobId must be a valid UUID" } }
```

### Kode Error yang Mungkin

`NOT_FOUND`, `INVALID_PARAM`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`


---

## 14. `POST /v1/backfill`

Memicu pemindaian riwayat Ethereum mainnet untuk satu dompet, sedalam `months`
bulan ke belakang, di keempat protokol sekaligus.

Ada karena tanpanya UI tidak punya jalan keluar: dompet yang belum pernah
dipindai menampilkan skor 0, dan satu-satunya cara memperbaikinya adalah CLI di
laptop Dev A. Endpoint ini yang membuat tombol "Claim your history" berfungsi.

API **tidak** memindai apa pun sendiri. Ia menitipkan job dan indexer yang
mengerjakannya — alasan yang sama dengan `POST /v1/prove`: submitter harus tetap
satu-satunya penulis dari kunci submitter, dan backfill berbagi RPC Ethereum
dengan watcher live.

### Body Request

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `address` | `Address` | ya | Dompet yang riwayatnya dipindai |
| `months` | `number` | tidak | Kedalaman riwayat, bilangan bulat `1..24`. Default `6` |

`months` di luar rentang **ditolak**, tidak dipangkas diam-diam. Memangkas
`120` jadi `24` membuat pemanggil mengira ia memesan riwayat sepuluh tahun, lalu
membaca skor yang lebih rendah sebagai sifat dompetnya alih-alih sebagai jendela
yang dipotong.

**Kenapa default 6 dan bukan 24.** `historyDuration` memakai half-saturation
`saturating(days, 365, 200)`: 365 hari memberi 100 dari 200 poin, 730 hari
memberi 133. Menggandakan jendela dari 6 ke 12 bulan hanya menambah ~34 poin,
sementara biayanya naik sebanding jumlah transaksi yang ditemukan. Tuas skor yang
sebenarnya ada di cakupan protokol (`protocolDiversity`, linear, 25 poin per
protokol) — dan endpoint ini selalu memindai keempat-empatnya.

### Contoh Request

```bash
curl -X POST http://localhost:8080/v1/backfill \
  -H 'content-type: application/json' \
  -d '{"address":"0x1111111111111111111111111111111111111111","months":1}'
```

### Respons Sukses — `202 Accepted`

```json
{
  "ok": true,
  "data": {
    "jobId": "b38e5847-3430-40df-80ad-2ec0249d10f8",
    "status": "pending",
    "subject": "0x1111111111111111111111111111111111111111",
    "months": 1,
    "createdAt": 1787714719
  }
}
```

### Respons Sukses — sudah pernah dipindai sedalam ini

```json
{
  "ok": true,
  "data": {
    "jobId": null,
    "status": "covered",
    "subject": "0x1111111111111111111111111111111111111111",
    "months": 1,
    "createdAt": 1787715063
  }
}
```

Tidak ada job yang dibuat dan tidak ada CTC yang keluar. UI harus langsung
menampilkan skor yang ada, bukan spinner.

**Dedupe-nya terhadap KENYATAAN, bukan terhadap antrean.** Cakupan dibaca dari
tabel `backfill_runs`, yang ditulis `backfillSubject` — jadi backfill lewat CLI
ikut terhitung. Dedupe yang hanya melihat tabel `jobs` akan memindai ulang
riwayat yang sudah dibayar lengkap, karena CLI tidak pernah menulis baris `jobs`.
Dompet demo salah satu contohnya.

Cakupan dituntut lengkap untuk **setiap** protokol yang diawasi watcher, bukan
sekadar "ada satu barisnya". `firstFactAt` adalah minimum lintas protokol, jadi
kedalaman yang tidak seragam menghasilkan kesimpulan yang salah tentang
dompetnya: dompet demo pernah dipindai 24 bulan di Aave tapi hanya 9 bulan di
Morpho, dan "riwayatnya mentok 8 bulan" ternyata pernyataan tentang jendela
pemindaian. Dua transaksi Morpho dari 2025-09-23 menggeser skornya 797 → 813.

### Job yang sedang berjalan

Permintaan untuk dompet yang sudah punya job `pending`/`running` mengembalikan
job yang sudah ada, bukan job kedua. Kalau job itu belum mulai dan lebih dangkal
dari yang diminta, kedalamannya **diperdalam di tempat**.

`months` di respons selalu kedalaman yang **benar-benar dikerjakan**, bukan yang
diminta. Meminta 3 bulan saat job 24 bulan sedang antre akan dijawab `24`.

### Respons Error

| Kondisi | Kode | HTTP |
|---|---|---|
| `address` cacat atau kosong | `INVALID_ADDRESS` | 400 |
| `months` di luar `1..24`, atau body bukan JSON | `INVALID_PARAM` | 400 |
| Melebihi 3 request/menit | `RATE_LIMITED` | 429 |

### Kode Error yang Mungkin

`INVALID_ADDRESS`, `INVALID_PARAM`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`

---

## 15. `GET /v1/backfill/:jobId`

### Parameter Path

| Nama | Tipe | Keterangan |
|---|---|---|
| `jobId` | `string` (UUID) | Dari respons `POST /v1/backfill` |

### Contoh Request

```bash
curl http://localhost:8080/v1/backfill/b38e5847-3430-40df-80ad-2ec0249d10f8
```

### Respons Sukses — `200`

```json
{
  "ok": true,
  "data": {
    "jobId": "b38e5847-3430-40df-80ad-2ec0249d10f8",
    "status": "complete",
    "subject": "0x1111111111111111111111111111111111111111",
    "months": 1,
    "attempts": 0,
    "lastError": null,
    "failedRanges": 0,
    "logsFound": 0,
    "createdAt": 1787714719,
    "updatedAt": 1787714957
  }
}
```

### Status

| Nilai | Arti |
|---|---|
| `pending` | Sudah diantre, belum mulai |
| `running` | Sedang memindai |
| `complete` | Selesai, seluruh rentang terbaca |
| `partial` | Selesai, tapi sebagian rentang **tidak terbaca** |
| `covered` | Hanya muncul di respons POST; tidak ada job |
| `failed` | Gagal permanen setelah 3 percobaan |

**`partial` bukan kesuksesan.** Ia berarti riwayatnya berlubang, dan lubang itu
tidak punya gejala apa pun selain skor yang lebih rendah dari seharusnya —
skornya tetap sah, tidak ada yang tampak rusak. `failedRanges` menyebut berapa
rentang yang menyerah. Menjalankan ulang permintaan yang sama akan melanjutkan;
insert-nya idempoten.

`logsFound` adalah log yang cocok subjek **sebelum** dedup terhadap apa yang
sudah tercatat — bukan jumlah fakta baru. Sebagian besar bisa saja sudah ada di
registry.

### Respons Error

| Kondisi | Kode | HTTP |
|---|---|---|
| `jobId` bukan UUID | `INVALID_PARAM` | 400 |
| Job tidak ada, atau bukan job backfill | `NOT_FOUND` | 404 |

### Kode Error yang Mungkin

`NOT_FOUND`, `INVALID_PARAM`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`
