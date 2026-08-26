# Corolary — Desain Indexer (Eager-Proving Worker)

> Diturunkan dari `docs/architecture.md` (tulang punggung, §5, §6, §10, §11, §15) dan
> `docs/attestcoin-research.md` (batasan protokol, §2–§4). Kalau ada konflik, dua
> dokumen itu yang menang. Dokumen ini memuat desain lengkap `services/indexer`
> (milik Dev A), termasuk kode TypeScript nyata memakai `@gluwa/usc-sdk@0.18.0`.

---

## 1. Tujuan & Prinsip

`services/indexer` adalah **satu proses Node.js long-running** (bukan serverless —
lihat `architecture.md` §14) yang:

1. Memantau event pinjam-meminjam nyata di Ethereum mainnet (`chainKey = 3`) dari
   Aave V3, Morpho Blue, Compound V3, dan `AnswerUpdated` Chainlink.
2. Menunggu blok yang memuat event itu ter-attest di Creditcoin.
3. Meminta proof dari Attestcoin **selagi masih murah** (< 24 jam) — **eager proving**.
4. Mengirim `FactRegistry.recordFact(...)` / `PriceRegistry.recordPrice(...)` di
   Creditcoin, memicu verifikasi via precompile `0x0FD2`, lalu menyimpan fakta
   permanen.

Prinsip yang mengikat desain (lihat `CLAUDE.md` & `architecture.md` §2):

- **Nol mock data** — semua fakta berasal dari transaksi Ethereum mainnet nyata.
- **Eager, bukan lazy** — tidak ada jalur yang mem-*prove* data lama on-demand.
- **Tahan restart** — proses boleh mati kapan saja tanpa kehilangan progres atau
  membuat duplikat.
- **Searah** — Ethereum → Creditcoin saja; tidak ada tulis balik (writability belum
  rilis).

---

## 2. Arsitektur Pipeline

Empat tahap logis, dijalankan sebagai **loop in-process** di satu proses Node
(bukan microservice terpisah, bukan Redis — sesuai `architecture.md` §6 "Queue/retry:
in-process + tabel `jobs` di Postgres"). Tiap tahap adalah *poller* yang membaca
baris `observed_events` pada `status` tertentu, memprosesnya, dan menulis `status`
berikutnya. Postgres adalah bus pesan sekaligus sumber kebenaran progres.

```
┌────────────┐   INSERT status=pending    ┌──────────────────────┐
│  watcher   │ ─────────────────────────▶ │   observed_events    │
│ (per-      │                             │   (Postgres)         │
│  protocol  │                             └──────────┬───────────┘
│  eth_getLogs)                                        │
└────────────┘                                         │ polling tiap tahap
                                                        ▼
                                   ┌─────────────────────────────────────┐
                                   │  attestation-waiter                 │
                                   │  status=pending                     │
                                   │  → cek ChainInfo.is_height_attested │
                                   │  → status=awaiting_attestation      │
                                   │    (kalau belum ter-attest)         │
                                   │  → status=proving                   │
                                   │    (begitu ter-attest)              │
                                   └───────────────┬───────────────────┘
                                                    ▼
                                   ┌─────────────────────────────────────┐
                                   │  prover                             │
                                   │  status=proving                     │
                                   │  → kumpulkan batch (≤10 tx,          │
                                   │    rentang ≤1000 blok)              │
                                   │  → panggil Proof Builder API         │
                                   │  → status=submitting                │
                                   └───────────────┬───────────────────┘
                                                    ▼
                                   ┌─────────────────────────────────────┐
                                   │  submitter                          │
                                   │  status=submitting                  │
                                   │  → kirim recordFact()/recordPrice() │
                                   │    ke FactRegistry/PriceRegistry     │
                                   │  → tunggu receipt                   │
                                   │  → status=recorded | skipped        │
                                   └─────────────────────────────────────┘
```

Setiap tahap adalah fungsi `async function runOnce(): Promise<void>` yang dipanggil
dalam loop `setInterval`-style dengan jeda berbeda (watcher tiap ~15 dtk, waiter tiap
~15 dtk mengikuti waktu blok Creditcoin, prover/submitter tiap ~5 dtk atau segera
setelah ada baris baru). Semua tahap idempoten: menjalankan ulang tahap yang sama
pada baris yang sudah pindah status tidak melakukan apa-apa (di-filter oleh `WHERE
status = '<tahap>'`).

### 2.1 Kenapa satu proses, bukan microservice terpisah

- Antrean adalah tabel Postgres, bukan Redis/Kafka — sesuai kunci konvensi di
  `architecture.md` §6. Satu proses meniadakan kebutuhan koordinasi lintas-proses
  untuk hal sesederhana ini di skala hackathon/testnet.
- Submitter butuh **nonce management** yang jauh lebih sederhana kalau hanya ada
  satu writer ke `SUBMITTER_PRIVATE_KEY` (lihat §9). Memisah submitter ke proses lain
  hanya menambah risiko nonce race tanpa manfaat nyata di skala ini.
- Deploy tetap sesuai `architecture.md` §14: satu proses long-running di VPS/Railway/
  Fly.io.

---

## 3. State Machine per Event

Status disimpan di `observed_events.status` (persis enum di `architecture.md` §10):

```
pending | awaiting_attestation | proving | submitting | recorded | failed | skipped
```

### 3.1 Diagram Transisi

```
                         ┌─────────────────────────────────────────────┐
                         │                                             │
                         ▼                                             │
   watcher ──insert──▶ pending ──attested?no──▶ awaiting_attestation ──┘
                         │                              │
                         │ attested?yes                 │ attested?yes
                         ▼                              ▼
                       proving ◀─────────────────────────
                         │  │
       prover error      │  │ proof fetched ok
       (retryable)        │  ▼
         │ ◀──────────────┘ submitting
         │                    │  │
         └──────retry─────────┘  │
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                          │
   receiptStatus==1          receiptStatus!=1           replay (queryId
   & FactRecorded emitted    di source tx, ATAU          sudah diproses),
        │                    emitter bukan protokol      ATAU submit tx
        ▼                    terdaftar                   retryable gagal
     recorded                     │                       terus (nonce/
                                  ▼                        gas/RPC)
                               skipped                        │
                                                                ▼
                                                            failed (setelah
                                                            MAX_ATTEMPTS)
                                                                │
                                                       operator re-queue
                                                       (reset ke pending)
                                                                │
                                                                ▼
                                                              pending
```

### 3.2 Arti & Transisi Tiap Status

| Status | Arti | Masuk dari | Keluar ke |
|---|---|---|---|
| `pending` | Log Ethereum sudah terlihat watcher, belum dicek attestation | watcher (INSERT baru), atau `failed` yang di-*requeue* manual | `awaiting_attestation`, `proving` |
| `awaiting_attestation` | Blok event ini belum ter-attest di Creditcoin | `pending` (saat dicek dan belum ter-attest) | `proving` |
| `proving` | Sedang / siap meminta proof dari Proof Builder API | `pending`/`awaiting_attestation` (begitu ter-attest), atau retry dari dirinya sendiri | `submitting`, `failed` |
| `submitting` | Proof di tangan, sedang mengirim `recordFact`/`recordPrice` ke Creditcoin | `proving` (proof berhasil didapat) | `recorded`, `skipped`, `failed` |
| `recorded` | Fakta tersimpan permanen di `FactRegistry`/`PriceRegistry` — status terminal sukses | `submitting` | *(terminal)* |
| `failed` | Retry non-retryable habis / error teknis persisten — perlu perhatian operator | `proving`, `submitting` | `pending` (manual re-queue) |
| `skipped` | Diproses sampai tuntas tapi **secara sengaja tidak** menghasilkan fakta (tx sumber revert, emitter bukan protokol terdaftar, atau duplikat/replay) — status terminal, **bukan error** | `submitting` | *(terminal)* |

> **Kenapa `skipped` dipisah dari `failed`:** `skipped` berarti sistem bekerja
> **benar** — ia menolak sesuatu yang memang seharusnya ditolak (tx revert, event
> palsu dari kontrak peniru, atau duplikat). `failed` berarti sesuatu **rusak**
> secara teknis dan butuh intervensi (RPC mati berkepanjangan, dompet submitter
> kehabisan CTC, dsb.). Mencampur keduanya membuat dashboard operasional (§12)
> tidak bisa membedakan "semua normal" dari "butuh perhatian sekarang".

---

## 4. Eager Proving — Rasional & Jaminan

### 4.1 Kenapa

Dari `attestcoin-research.md` §2.3, biaya proof naik ~10x setelah 24 jam karena
continuity proof beralih dari checkpoint rapat ke checkpoint jarang (1 per 1000 blok):

| Umur transaksi | Panjang continuity proof | Biaya |
|---|---|---|
| ~10 menit | 10 hash | **2,59 × 10⁻⁵ CTC** |
| ~24 jam+ | 1000 hash | **3,13 × 10⁻⁴ CTC** |

Rumus: `CTC ≈ 2,3×10⁻⁵ + 2,9×10⁻⁷ × (jumlah hash continuity)`.

Untuk 1000 transaksi/hari (order-of-magnitude realistis untuk tiga protokol kredit
utama di Ethereum), selisihnya:

| Strategi | Biaya/hari | Biaya/bulan |
|---|---|---|
| Eager (< 24 jam) | 1000 × 2,59×10⁻⁵ = **0,0259 CTC** | ≈ **0,78 CTC** |
| Lazy (dibuktikan setelah 24 jam+) | 1000 × 3,13×10⁻⁴ = **0,313 CTC** | ≈ **9,39 CTC** |

**~12x lebih murah** per bulan pada skala ini — dan proof yang sudah dibuat sekali
disimpan **permanen** sebagai `Fact`, jadi dibaca berkali-kali nyaris gratis
(§0.4, `architecture.md` §4). Ini mengubah Attestcoin dari oracle per-query menjadi
lapisan data terbukti persisten — argumen inti kenapa `FactRegistry` adalah
kontribusi teknis utama Corolary.

### 4.2 Bagaimana Menjamin < 24 Jam

Eager proving bukan sekadar niat baik — ia harus **dijamin secara operasional**:

1. **Prioritas antrean berbasis umur.** Tahap `prover` (§5) selalu memproses baris
   `observed_events` dengan `observed_at` **paling tua dulu** (`ORDER BY observed_at
   ASC`), bukan FIFO insersi maupun LIFO — memastikan event yang mendekati batas
   24 jam selalu didahulukan di atas event yang baru masuk.
2. **Ambang peringatan bertingkat**, dipantau lewat metrik `oldest_unproven_age_seconds`
   (juga diekspos di `GET /v1/indexer/status` — lihat `docs/api.md` §3):
   - `>= 12 jam` → log level `warn`, badge dashboard kuning.
   - `>= 20 jam` → log level `error`, alert (mis. webhook Slack/Discord jika dikonfig),
     badge dashboard merah.
   - `>= 24 jam` → event tetap diproses (proof tetap valid, hanya lebih mahal), tapi
     dicatat dengan flag `provedLate: true` di log — ini kegagalan SLA operasional,
     bukan kegagalan korektnes.
3. **Batching agresif saat ada backlog** (§5): kalau `awaiting_attestation`/`proving`
   queue menumpuk (mis. setelah downtime — §6), indexer memprioritaskan mengisi
   batch penuh (10 tx) dari event tertua terlebih dulu supaya throughput proving
   maksimal per panggilan API.
4. **Attestation lag sudah diperhitungkan dalam anggaran waktu.** Lag ~8 menit
   (`attestcoin-research.md` §3.3) hanya memakan ~0,5% dari anggaran 24 jam — bukan
   risiko utama. Risiko utama adalah backlog pemrosesan internal (RPC lambat, prover
   API down, submitter macet) — makanya §12 memantau `oldest_unproven_age_seconds`
   sebagai metrik tunggal paling penting di seluruh sistem.

---

## 5. Strategi Batching

Batas protokol (`attestcoin-research.md` §2.4): **maksimum 10 proof per batch**,
harus berada dalam **rentang 1000 blok**, dan satu batch **berbagi satu continuity
proof** — jauh lebih efisien daripada 10 continuity proof terpisah.

### 5.1 Algoritma Pembentukan Batch

Dijalankan tiap kali tahap `prover` berjalan, per `chainKey` (hanya `3` di Corolary):

```typescript
interface ProvableEvent {
  id: string;
  txHash: string;
  blockHeight: number;
  observedAt: number;
}

const MAX_BATCH_SIZE = 10;
const MAX_BLOCK_SPAN = 1000;

/**
 * Greedy batching: urutkan berdasarkan umur (tertua dulu, lihat §4.2),
 * lalu isi tiap batch selama masih di bawah MAX_BATCH_SIZE dan span blok
 * (max - min height dalam batch) masih <= MAX_BLOCK_SPAN.
 */
function buildBatches(events: ProvableEvent[]): ProvableEvent[][] {
  const sorted = [...events].sort((a, b) => a.observedAt - b.observedAt);
  const batches: ProvableEvent[][] = [];
  let current: ProvableEvent[] = [];

  for (const event of sorted) {
    if (current.length === 0) {
      current.push(event);
      continue;
    }

    const minHeight = Math.min(...current.map((e) => e.blockHeight));
    const maxHeight = Math.max(...current.map((e) => e.blockHeight), event.blockHeight);
    const spanOk = maxHeight - minHeight <= MAX_BLOCK_SPAN;
    const sizeOk = current.length < MAX_BATCH_SIZE;

    if (spanOk && sizeOk) {
      current.push(event);
    } else {
      batches.push(current);
      current = [event];
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
```

Karena event terbaru muncul dari watcher yang memindai secara berurutan per blok,
dalam praktiknya event yang diproses bersamaan biasanya sudah berdekatan tinggi
bloknya (jarak menit ke jam, jauh di bawah 1000 blok ≈ 3,3 jam Ethereum). Split
karena `spanOk == false` jarang terjadi kecuali saat *catch-up* dari backlog besar
(§6) yang mencakup rentang blok lebar.

### 5.2 `batchId` & Ketertelusuran

Tiap batch diberi `batchId` deterministik `batch-{minHeight}-{maxHeight}-{seq}`
(dipakai di `GET /v1/facts/:factId` → `proof.batchId`, lihat `docs/api.md` §5) supaya
operator bisa menelusuri fakta mana saja yang berbagi satu continuity proof yang sama.

---

## 6. Manajemen Cursor, Tahan Restart, Catch-Up

### 6.1 Skema Cursor

Tabel `source_cursors` (`architecture.md` §10):

```sql
CREATE TABLE source_cursors (
  chain_key         BIGINT NOT NULL,
  protocol          TEXT   NOT NULL,
  last_scanned_block BIGINT NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_key, protocol)
);
```

Satu baris **per protokol** (bukan satu cursor global) — Aave V3, Morpho Blue,
Compound V3, dan Chainlink feed masing-masing punya `topic0`/alamat emitter
berbeda dan dipindai lewat `eth_getLogs` terpisah, sehingga bisa maju dengan
kecepatan berbeda tanpa saling memblokir.

### 6.2 Loop Watcher

```typescript
import { ethers } from 'ethers';
import { db } from '../db/client';
import { sourceCursors, observedEvents } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const CHUNK_SIZE = 2000; // blok per panggilan eth_getLogs, aman untuk RPC archive umum
const CONFIRMATION_TAG = 'finalized'; // lihat §14.5 — hindari reorg tanpa menunggu attestation

interface ProtocolWatchConfig {
  chainKey: number;
  protocol: string; // alamat kontrak emitter
  protocolName: string;
  topics: string[]; // topic0 event yang relevan (lihat architecture.md §11)
  genesisBlock: number; // blok mulai indexing kalau cursor belum ada
}

async function watchOnce(rpc: ethers.JsonRpcProvider, cfg: ProtocolWatchConfig): Promise<void> {
  const finalized = await rpc.getBlock(CONFIRMATION_TAG);
  if (!finalized) return; // RPC belum siap, coba lagi di iterasi berikutnya

  const cursor = await db.query.sourceCursors.findFirst({
    where: and(eq(sourceCursors.chainKey, cfg.chainKey), eq(sourceCursors.protocol, cfg.protocol)),
  });
  const fromBlock = (cursor?.lastScannedBlock ?? cfg.genesisBlock - 1) + 1;
  const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, finalized.number);

  if (fromBlock > toBlock) return; // sudah mengejar tinggi finalized, tunggu blok baru

  const logs = await rpc.getLogs({
    address: cfg.protocol,
    topics: [cfg.topics],
    fromBlock,
    toBlock,
  });

  await db.transaction(async (tx) => {
    for (const log of logs) {
      await tx
        .insert(observedEvents)
        .values({
          chainKey: cfg.chainKey,
          blockHeight: log.blockNumber,
          txHash: log.transactionHash,
          txIndex: log.transactionIndex,
          logIndex: log.index,
          topic0: log.topics[0],
          protocol: cfg.protocol,
          rawLog: JSON.stringify(log),
          status: 'pending',
          attempts: 0,
          observedAt: Math.floor(Date.now() / 1000), // diperbaiki dengan block.timestamp saat decode (§14)
        })
        // Lapis dedup #1 — lihat §7.1
        .onConflictDoNothing({ target: [observedEvents.chainKey, observedEvents.blockHeight, observedEvents.txIndex, observedEvents.logIndex] });
    }

    await tx
      .insert(sourceCursors)
      .values({ chainKey: cfg.chainKey, protocol: cfg.protocol, lastScannedBlock: toBlock })
      .onConflictDoUpdate({
        target: [sourceCursors.chainKey, sourceCursors.protocol],
        set: { lastScannedBlock: toBlock, updatedAt: new Date() },
      });
  });
}
```

Poin desain penting:

- **Insert log dan update cursor dalam satu transaksi Postgres.** Kalau proses mati
  di tengah, restart akan memindai ulang rentang yang sama — aman karena
  `onConflictDoNothing` di §7.1 membuatnya idempoten. Tanpa transaksi ini, cursor
  bisa maju sementara log belum ke-insert (event hilang selamanya).
- **`fromBlock = lastScannedBlock + 1`** — cursor menyimpan blok terakhir yang
  **sudah tuntas** dipindai, bukan blok berikutnya, supaya restart selalu tahu
  persis dari mana melanjutkan tanpa off-by-one.
- **`CHUNK_SIZE = 2000` blok per panggilan** — cukup kecil untuk tidak melanggar
  batas RPC (lihat §11) dan cukup besar untuk catch-up cepat.

### 6.3 Catch-Up Setelah Downtime

Tidak ada mode "catch-up" terpisah — loop watcher yang sama di §6.2 secara alami
melakukan catch-up karena `fromBlock` dihitung dari cursor tersimpan, bukan dari
`latest - N`. Kalau indexer mati selama 6 jam (≈1800 blok Ethereum), saat menyala
kembali ia akan memproses ulang mulai `lastScannedBlock + 1` dalam potongan
`CHUNK_SIZE`, mengejar ke `finalized` secara bertahap tanpa melewatkan satu blok pun.

Efek pada eager-proving: backlog dari downtime otomatis diprioritaskan lewat urutan
`observed_at ASC` di §4.2/§5 — event terlama dalam backlog diproses lebih dulu,
meminimalkan jumlah event yang jatuh ke wilayah "> 24 jam" akibat downtime.

---

## 7. Deduplikasi & Replay Protection (Dua Lapis)

### 7.1 Lapis 1 — Database

Constraint unik di `observed_events` pada `(chain_key, block_height, tx_index,
log_index)` — kombinasi yang **sama persis** dipakai untuk menurunkan `factId`
(`architecture.md` §8.1: `keccak256(chainKey, blockHeight, txIndex, txLogIndex)` —
**`txLogIndex`** adalah posisi log di dalam `receipt.receiptLogs`, BUKAN `logIndex`
block-wide Ethereum. Lihat catatan di `architecture.md` §8.1.)
Kalau watcher memindai ulang rentang blok yang sama (restart, overlap `CHUNK_SIZE`
antar-batch, dsb.), `onConflictDoNothing` membuat insert kedua menjadi no-op.

```sql
ALTER TABLE observed_events
  ADD CONSTRAINT observed_events_unique_log
  UNIQUE (chain_key, block_height, tx_index, log_index);
```

Ini melindungi dari duplikasi **sebelum** tahap `proving`/`submitting` — mencegah
biaya prover/gas Creditcoin terbuang untuk log yang sudah pernah diproses.

### 7.2 Lapis 2 — On-Chain (`queryId`)

Bahkan kalau lapis 1 entah bagaimana terlewati (mis. dua instance indexer berjalan
bersamaan karena kesalahan deploy), `FactRegistry` yang mewarisi pola `USCBase`
(`attestcoin-research.md` §5) menegakkan replay protection independen:

```solidity
mapping(bytes32 => bool) public processedQueries;

function recordFact(...) external {
    bytes32 queryId = _computeQueryId(chainKey, blockHeight, encodedTx, ...);
    require(!processedQueries[queryId], "already processed");
    // ... verifyAndEmit via precompile, cek receiptStatus == 1, dst.
    processedQueries[queryId] = true;
}
```

`queryId` dari `USCBase` dan `factId` Corolary (`architecture.md` §8.1) sengaja
diturunkan dari komponen yang sama `(chainKey, blockHeight, txIndex, logIndex)` —
selaras satu sama lain, bukan dua skema paralel yang bisa berbeda pendapat.

Kalau submitter mengirim `recordFact` untuk `queryId` yang sudah tercatat (mis.
karena retry setelah timeout RPC padahal tx sebelumnya sebenarnya sukses), transaksi
akan **revert** dengan alasan `"already processed"`. Submitter mengklasifikasikan
revert ini sebagai **non-retryable** dan memindahkan baris ke `skipped` (bukan
`failed`) — lihat §8.2, karena hasil akhirnya (fakta sudah tercatat) tetap benar.

---

## 8. Kebijakan Retry & Klasifikasi Error

### 8.1 Backoff Eksponensial

```typescript
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000; // 5 menit
const MAX_ATTEMPTS = 8;

function nextRetryDelayMs(attempts: number): number {
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
  const jitter = exp * (0.5 + Math.random() * 0.5); // full jitter di rentang [0.5x, 1x]
  return Math.round(jitter);
}
```

Delay disimpan sebagai `run_after` di tabel `jobs` (dan sebagai kolom turunan di
`observed_events` untuk tahap `proving`/`submitting`), dibaca ulang oleh poller
tahap terkait — bukan `setTimeout` in-memory, supaya jadwal retry selamat dari
restart proses.

Setelah `MAX_ATTEMPTS` percobaan retryable habis, baris dipindah ke `failed` dan
`last_error` diisi pesan terakhir untuk investigasi operator (§13).

### 8.2 Klasifikasi Error

| Kategori | Contoh | Retryable? | Efek |
|---|---|---|---|
| Jaringan/timeout RPC Ethereum | `ETIMEDOUT`, `ECONNRESET`, 5xx dari provider RPC | Ya | Retry dengan backoff, tetap di status semula |
| Rate limit RPC (`429` / `-32005`) | Provider RPC menolak sementara | Ya | Retry dengan backoff **lebih panjang** (hormati header `Retry-After` bila ada) |
| Prover API tidak tersedia | Timeout / 5xx dari `PROOF_BUILDER_URL` | Ya | Retry dengan backoff, tetap di `proving` |
| Blok belum ter-attest | `is_height_attested == false` | Ya (bukan error, kondisi normal) | Tetap/pindah ke `awaiting_attestation`, cek ulang tiap ~15 dtk |
| RPC Creditcoin timeout saat submit | Timeout sebelum tahu hasil tx | Ya, dengan pengecekan status tx dulu sebelum retry (hindari kirim dobel — §9.3) | Retry di `submitting` |
| Nonce terlalu rendah / gas price terlalu rendah | `nonce too low`, `replacement transaction underpriced` | Ya | Ambil ulang nonce dari chain, naikkan gas price, retry (§9) |
| Dompet submitter kehabisan CTC | `insufficient funds for gas` | **Tidak** (butuh top-up manual) | → `failed` segera, alert kritikal (§12) |
| `require(receiptStatus == 1)` gagal on-chain | Tx sumber Ethereum sebenarnya revert | **Tidak** (hasil valid, bukan error) | → `skipped` |
| Alamat emitter tidak cocok protokol terdaftar | Event dari kontrak peniru | **Tidak** | → `skipped` |
| `queryId` sudah `processedQueries` | Replay/duplikat (§7.2) | **Tidak** | → `skipped` |
| Bug decoding / ABI mismatch | Struktur log tak terduga | **Tidak** (butuh perbaikan kode) | → `failed`, alert kritikal |

Prinsip pemisahnya: **retryable = kegagalan sementara di infrastruktur** (jaringan,
rate limit, RPC belum sinkron); **non-retryable = hasil yang sudah pasti** (tx
sumber memang revert, event memang bukan dari protokol asli, memang sudah pernah
diproses) atau **butuh intervensi manusia** (dompet kosong, bug kode).

---

## 9. Manajemen Nonce untuk Submitter

Submitter adalah **satu-satunya** penulis dari `SUBMITTER_PRIVATE_KEY` di seluruh
sistem (§2.1) — ini yang membuat manajemen nonce sederhana dan aman tanpa lock
terdistribusi.

### 9.1 Strategi

- Nonce dikelola **secara eksplisit di aplikasi**, disimpan sebagai kolom
  `next_nonce` di tabel kecil `submitter_state` (satu baris), **bukan**
  mengandalkan `getTransactionCount('pending')` di setiap panggilan — nilai
  `pending` dari RPC publik bisa tidak konsisten antar-node di balik load balancer.
- Saat start-up, submitter melakukan **rekonsiliasi sekali**: ambil
  `getTransactionCount('latest')` dari RPC Creditcoin sebagai batas bawah yang
  pasti benar, bandingkan dengan `next_nonce` tersimpan, pakai yang **lebih besar**
  (melindungi dari kehilangan progres kalau baris `submitter_state` hilang, tanpa
  pernah mundur ke nonce yang sudah terpakai).

```typescript
import { ethers } from 'ethers';
import { db } from '../db/client';
import { submitterState } from '../db/schema';

async function reconcileNonce(rpc: ethers.JsonRpcProvider, address: string): Promise<number> {
  const onChain = await rpc.getTransactionCount(address, 'latest');
  const stored = await db.query.submitterState.findFirst();
  const next = Math.max(onChain, stored?.nextNonce ?? 0);

  await db
    .insert(submitterState)
    .values({ id: 1, nextNonce: next })
    .onConflictDoUpdate({ target: submitterState.id, set: { nextNonce: next } });

  return next;
}

async function claimNextNonce(): Promise<number> {
  // UPDATE ... RETURNING dalam satu statement — aman untuk concurrency ringan
  // meski submitter dirancang single-writer per §2.1.
  const [row] = await db.execute(sql`
    UPDATE submitter_state SET next_nonce = next_nonce + 1
    WHERE id = 1
    RETURNING next_nonce - 1 AS claimed
  `);
  return row.claimed as number;
}
```

### 9.2 Penanganan Tx Macet (Stuck)

Kalau sebuah tx dengan nonce `N` tidak ter-mine dalam `STUCK_TIMEOUT_MS` (mis. 3
menit — jauh di atas waktu blok Creditcoin ~15 detik), submitter mengirim **replace-
by-fee**: transaksi baru dengan nonce `N` yang sama tapi `maxFeePerGas`/
`maxPriorityFeePerGas` dinaikkan minimal 12,5% (aturan umum EIP-1559 untuk replacement
diterima mempool), bukan menaikkan `next_nonce` (itu akan meninggalkan nonce `N`
bolong dan memblokir semua nonce sesudahnya).

### 9.3 Menghindari Kirim Dobel Setelah Timeout RPC

Kalau `sendTransaction`/`wait()` timeout tanpa kepastian hasil (§8.2), submitter
**tidak langsung retry dengan tx baru**. Ia terlebih dulu mengecek:

1. `getTransactionReceipt(txHash)` — kalau ada dan sukses, lanjut seperti biasa
   (pindah ke `recorded`), jangan kirim ulang.
2. Kalau tidak ada receipt tapi nonce `N` sudah lebih rendah dari nonce on-chain
   terkini (tx lain dengan nonce sama sudah termasuk ke blok — bisa terjadi kalau
   ada proses lama yang belum mati sempurna saat deploy ulang), tandai baris ini
   untuk investigasi manual (`failed`) alih-alih menebak.
3. Baru kalau benar-benar belum ter-mine, lakukan replace-by-fee (§9.2), bukan
   nonce baru.

---

## 10. Penggunaan `@gluwa/usc-sdk` v0.18.0

Modul yang dipakai (`attestcoin-research.md` §4.3): `chainInfo`, `blockProver`,
`proofProvider` (`service.ProofBuilder`), `encoding`, `utils`. Signature persis
mengikuti definisi tipe SDK v0.18.0 terpasang di `node_modules/@gluwa/usc-sdk`;
contoh di bawah konsisten dengan konvensi yang sudah diverifikasi live di
`attestcoin-research.md` §3–§4 (endpoint attested-height, proof-by-tx, dan
proof-batch-by-tx).

### 10.1 Setup

```typescript
// services/indexer/src/prover/client.ts
import { ethers } from 'ethers';
import { chainInfo, proofProvider } from '@gluwa/usc-sdk';

export const ETH_CHAIN_KEY = 3; // Ethereum mainnet, architecture.md §3

export const creditcoinRpc = new ethers.JsonRpcProvider(process.env.CREDITCOIN_RPC_URL);

// KOREKSI (diverifikasi terhadap dist/proof-provider/service/index.d.ts SDK
// v0.18.0 yang benar-benar terpasang): konstruktornya POSISIONAL, bukan objek
// opsi — ProofBuilder(chainKey, builderUrl, timeout?).
export const proofBuilder = new proofProvider.service.ProofBuilder(
  ETH_CHAIN_KEY,
  process.env.PROOF_BUILDER_URL!, // https://prover.cc3-testnet.creditcoin.network
);
```

### 10.2 `waitUntilHeightAttested` — Tahap `attestation-waiter`

```typescript
// services/indexer/src/attestation-waiter/waitForAttestation.ts
import { chainInfo } from '@gluwa/usc-sdk';
import { creditcoinRpc, ETH_CHAIN_KEY } from '../prover/client';

/**
 * Resolve begitu blockHeight sudah ter-attest di Creditcoin, atau lempar
 * timeout error yang dianggap retryable (RPC/attestor mungkin sedang lambat,
 * bukan berarti blok itu tak akan pernah ter-attest).
 */
export async function waitUntilAttested(blockHeight: number): Promise<void> {
  await chainInfo.waitUntilHeightAttested(creditcoinRpc, {
    chainKey: ETH_CHAIN_KEY,
    height: blockHeight,
    pollIntervalMs: 15_000,       // ~1 blok Creditcoin
    timeoutMs: 20 * 60_000,       // lag tipikal ~8 menit (attestcoin-research.md §3.3); beri margin 2.5x
  });
}

/** Dipakai poller non-blocking di tahap attestation-waiter (§2). */
export async function isAttested(blockHeight: number): Promise<boolean> {
  return chainInfo.isHeightAttested(creditcoinRpc, { chainKey: ETH_CHAIN_KEY, height: blockHeight });
}
```

> Tahap `attestation-waiter` di pipeline (§2) memakai `isAttested()` di dalam loop
> poll biasa (non-blocking, cocok untuk banyak event bersamaan), sedangkan
> `waitUntilAttested()` (blocking dengan timeout) dipakai di jalur `POST /v1/prove`
> (`docs/api.md` §12) yang memproses satu tx spesifik atas permintaan eksplisit.

### 10.3 `getProof` — Proof Tunggal (Tahap `prover`)

```typescript
// services/indexer/src/prover/getProof.ts
import { proofBuilder, ETH_CHAIN_KEY } from './client';

export interface FetchedProof {
  headerNumber: number;
  txIndex: number;
  merkleProof: { root: string; siblings: string[] };
  continuityProof: { roots: string[] };
  encodedTransaction: string;
}

/** GET /api/v1/proof-by-tx/3/{txHash} lewat SDK — dipakai untuk batch berukuran 1. */
export async function getProof(txHash: string): Promise<FetchedProof> {
  return proofBuilder.getProof({ chainKey: ETH_CHAIN_KEY, txHash });
}
```

### 10.4 `getBatchProof` — Batch (≤10 tx, ≤1000 blok)

```typescript
// services/indexer/src/prover/getBatchProof.ts
import { proofBuilder, ETH_CHAIN_KEY } from './client';
import type { ProvableEvent } from '../db/schema';

export interface BatchProofResult {
  continuityProof: { roots: string[] }; // dibagi oleh seluruh tx di batch
  proofs: Array<{
    txHash: string;
    headerNumber: number;
    txIndex: number;
    merkleProof: { root: string; siblings: string[] };
    encodedTransaction: string;
  }>;
}

/** POST /api/v1/proof-batch-by-tx/3 — satu continuity proof untuk seluruh batch. */
export async function getBatchProof(batch: ProvableEvent[]): Promise<BatchProofResult> {
  if (batch.length === 0 || batch.length > 10) {
    throw new Error(`batch size must be 1..10, got ${batch.length}`);
  }
  const minHeight = Math.min(...batch.map((e) => e.blockHeight));
  const maxHeight = Math.max(...batch.map((e) => e.blockHeight));
  // KOREKSI: kontrak menolak `span >= 1000`, jadi span maksimum yang aman 999.
  // `> 1000` di sini akan meloloskan batch yang kemudian revert on-chain SETELAH
  // proof-nya dibayar.
  if (maxHeight - minHeight > 999) {
    throw new Error(`batch block span ${maxHeight - minHeight} exceeds 999-block limit`);
  }

  return proofBuilder.getBatchProof({
    chainKey: ETH_CHAIN_KEY,
    txHashes: batch.map((e) => e.txHash),
  });
}
```

### 10.5 Submitter — Memanggil `FactRegistry.recordFact`

```typescript
// services/indexer/src/submitter/submitFact.ts
import { ethers } from 'ethers';
import { creditcoinRpc } from '../prover/client';
import { claimNextNonce } from './nonce';
import factRegistryAbi from '@corolary/shared/abis/FactRegistry.json';
import type { FetchedProof } from '../prover/getProof';

const wallet = new ethers.Wallet(process.env.SUBMITTER_PRIVATE_KEY!, creditcoinRpc);
const factRegistry = new ethers.Contract(process.env.FACT_REGISTRY_ADDRESS!, factRegistryAbi, wallet);

export async function submitFact(proof: FetchedProof, adapterKey: string): Promise<ethers.TransactionReceipt> {
  const nonce = await claimNextNonce();

  // KOREKSI: signature ini sudah basi. FactRegistry yang benar-benar dibangun
  // menerima ProofBundle pipih + observedAt, dan TIDAK menerima adapterKey —
  // adapter dipilih ON-CHAIN berdasarkan alamat pemancar tiap log, karena
  // memilihnya dari sisi indexer berarti mempercayai indexer soal protokol
  // mana yang memancarkan log, dan itu persis yang harus dibuktikan.
  //
  //   recordFact(ProofBundle bundle, bytes encodedTransaction, uint64 observedAt)
  //   ProofBundle { chainKey, blockHeight, merkleRoot, siblings[],
  //                 lowerEndpointDigest, continuityRoots[] }
  const tx = await factRegistry.recordFact(
    {
      chainKey: ETH_CHAIN_KEY,
      blockHeight: proof.headerNumber,
      merkleRoot: proof.merkleProof.root,
      siblings: proof.merkleProof.siblings,
      lowerEndpointDigest: proof.continuityProof.lowerEndpointDigest,
      continuityRoots: proof.continuityProof.roots,
    },
    proof.encodedTransaction,
    observedAt,
    { nonce },
  );

  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    // Ini Creditcoin tx yang revert (mis. FactRegistry menolak karena
    // receiptStatus source tx != 1, atau replay) — bukan error jaringan.
    throw new NonRetryableSubmitError(`recordFact reverted on-chain: ${tx.hash}`);
  }
  return receipt;
}

export class NonRetryableSubmitError extends Error {}
```

### 10.6 `encoding` — Ekstraksi Field Selektif (Opsional, Hemat Gas)

```typescript
// Contoh pola QueryBuilder (attestcoin-research.md §4.4) untuk kasus di mana
// adapter hanya butuh argumen event tertentu, bukan seluruh calldata terenkode.
import { encoding } from '@gluwa/usc-sdk';

export async function buildRepayFieldQuery(rpc: ethers.JsonRpcProvider, txHash: string) {
  const qb = await encoding.QueryBuilder.createFromTransactionHash(rpc, txHash);
  await qb.addEventArgument('Repay(address,address,address,uint256,bool)', 'user', {});
  await qb.addEventArgument('Repay(address,address,address,uint256,bool)', 'amount', {});
  return qb.build(); // -> [{ offset, size }, ...] untuk decode parsial di kontrak
}
```

Corolary v1 memakai `getProof`/`getBatchProof` penuh (§10.3–10.4) karena adapter
perlu men-decode seluruh log event, bukan satu field — `QueryBuilder` didokumentasikan
di sini sebagai jalur optimasi yang tersedia untuk fase berikutnya (bukan bagian
jalur kritis saat ini).

---

## 11. Rate Limit RPC & Kewajiban Archive Node

### 11.0 Failover RPC — sadar kemampuan, bukan `FallbackProvider`

`ETHEREUM_RPC_URL_FALLBACK` dipakai OTOMATIS sejak 2026-08-26. Sebelumnya ia ada
di `.env` selama berminggu-minggu tanpa dibaca kode mana pun — memberi rasa aman
yang palsu.

**Kenapa bukan `ethers.FallbackProvider`:** ia mengasumsikan para provider setara.
Terukur pada rentang 2.000 blok kontrak Aave V3, 2026-08-26:

| Provider | Hasil |
|---|---|
| **drpc** | 2.602 log dalam 0,9 detik |
| Alchemy free | ditolak — `eth_getLogs` maks **10 blok** |
| publicnode | ditolak — archive butuh token |
| ankr | ditolak — butuh autentikasi |
| 1rpc | ditolak — maks 50 blok |
| llamarpc | tidak menjawab JSON sama sekali |

Tidak ada provider gratis kedua yang menyamai drpc untuk `eth_getLogs` rentang
lebar. Jadi failover-nya bertingkat menurut kemampuan:

- **`getBlock`, `getTransactionReceipt`, `eth_call`** — cadangan melayani penuh
  (`ethCall()` di `chain/providers.ts`).
- **`eth_getLogs`** — cadangan hanya sanggup <= 10 blok, jadi `ethGetLogs()`
  memecah rentangnya. Di atas **50 potongan** ia MENOLAK dengan sebab yang jelas
  alih-alih membanjiri provider yang justru sedang kita andalkan.

**Ia tidak pernah mengembalikan array kosong saat cadangan tidak sanggup.**
Provider yang menjawab kosong tanpa error sudah pernah menipu proyek ini
(llamarpc menjawab `result: []` untuk rentang berisi 711 log Aave). Kalau failover
meniru itu, watcher menyimpulkan protokolnya sepi lalu memajukan cursor melewati
event yang tidak pernah terbaca — kehilangan permanen tanpa satu pun gejala.

**Terverifikasi live**, bukan hanya lewat tes: dengan primary diarahkan ke host
yang tidak ada, Alchemy melayani `getBlock` dan `getLogs` 30 blok, dan hasilnya
**56 log di 15 blok — identik dengan kontrol saat primary sehat**. Mencocokkan
hasil dengan provider kedua adalah syaratnya, bukan sekadar memastikan tidak error.

Log-nya berjenjang: peringatan PERTAMA berlevel `error` dan menyebut
"Pipeline berjalan DEGRADASI"; berikutnya `warn`. Kalau tiap permintaan berteriak
sama kencangnya, tidak ada yang terbaca.

**Batasnya, dinyatakan terbuka:** kalau drpc mati, watcher berjalan jauh lebih
lambat dan chunk lebar akan ditolak. Yang menyelamatkan situasi itu bukan failover
melainkan kenyataan bahwa pemadaman RPC Ethereum hanya menghentikan PENEMUAN event
baru — attestation, prover, dan submitter memakai Creditcoin dan Proof Builder,
jadi antrean yang sudah ada tetap mengalir.

---

### 11.1 Kenapa RPC Harus Archive-Capable

`ETHEREUM_RPC_URL` **wajib** archive-capable (Alchemy/Infura/QuickNode) —
`architecture.md` §15 mencatat ini **sudah diuji dan gagal** dengan RPC publik.

Alasan teknis: watcher (§6.2) memanggil `eth_getLogs` dengan `fromBlock`/`toBlock`
yang **historis** (bisa jauh di belakang head, terutama saat catch-up §6.3 atau
backfill §13). RPC publik gratis (mis. endpoint default banyak provider non-archive)
membatasi atau menolak query log yang menjangkau rentang blok lama — baik karena
node mereka **pruned** (tidak menyimpan state/log historis penuh) maupun karena
kebijakan rate limit agresif untuk query berat semacam ini. Node archive menyimpan
seluruh riwayat state dan log sejak genesis, sehingga `eth_getLogs` pada rentang
manapun selalu bisa dilayani.

### 11.2 Rate Limit Praktis

| Aspek | Kebijakan |
|---|---|
| `CHUNK_SIZE` per `eth_getLogs` | 2000 blok (§6.2) — cukup kecil untuk tidak memicu `query returned more than 10000 results` di sebagian besar provider, cukup besar untuk catch-up efisien |
| Concurrency panggilan RPC | Maks **1 panggilan `eth_getLogs` in-flight per protokol** (4 protokol × 1 = maks 4 concurrent) — dijaga lewat loop sekuensial per watcher, bukan `Promise.all` tanpa batas |
| Retry saat `429`/`-32005` | Backoff eksponensial (§8.1) dengan `BASE_DELAY_MS` dinaikkan ke 5 detik khusus kategori rate-limit, hormati header `Retry-After` bila provider mengirimkannya |
| Provider yang disarankan | Alchemy/Infura/QuickNode tier berbayar (bukan free tier default) — kuota archive query jauh lebih tinggi |

### 11.3 Rate Limit ke Prover API dan Creditcoin RPC

Prover (`PROOF_BUILDER_URL`) dan Creditcoin RPC (`CREDITCOIN_RPC_URL`) jauh lebih
ringan dipakai (satu panggilan per batch ≤10 tx, satu tx submit per batch) —
tidak butuh chunking, cukup mengikuti kebijakan retry umum §8.1. `@gluwa/usc-sdk`
sendiri sudah membawa `exponential-backoff` sebagai dependensi
(`attestcoin-research.md` §4.3), yang dipakai secara default di panggilan
`proofProvider`.

---

## 12. Observabilitas

### 12.1 Structured Logging

Semua log dalam format JSON satu baris (`pino` atau setara), field wajib:

| Field | Contoh | Kegunaan |
|---|---|---|
| `level` | `info` \| `warn` \| `error` | Filtering |
| `stage` | `watcher` \| `attestation-waiter` \| `prover` \| `submitter` | Sumber log |
| `chainKey` | `3` | Konteks chain |
| `protocol` | `Aave V3` | Konteks protokol |
| `eventId` | uuid baris `observed_events` | Korelasi lintas-tahap untuk satu event |
| `txHash` | `0x38e9...` | Korelasi ke Etherscan |
| `factId` | `0xa680...` | Korelasi ke `GET /v1/facts/:factId` |
| `blockHeight` | `25808842` | Debug rentang blok |
| `ageSeconds` | `840` | Umur event saat log ditulis — dipakai untuk audit SLA eager-proving (§4.2) |
| `attempt` | `2` | Nomor percobaan retry saat ini |
| `durationMs` | `184` | Latensi operasi (panggilan RPC/prover/submit) |

Contoh baris log nyata:

```json
{"level":"info","stage":"prover","chainKey":3,"protocol":"Aave V3","eventId":"7c1e...","txHash":"0x38e9d082a240e6bffdaf1591a753de71ce386ab30bbe1ad338de5edb6f92e939","blockHeight":25808842,"batchId":"batch-25808800-25808842-0","batchSize":6,"ageSeconds":840,"attempt":1,"durationMs":612,"msg":"batch proof fetched"}
```

### 12.2 Metrik

Diekspos lewat endpoint `/metrics` (format Prometheus) di proses indexer, dan
sebagian direfleksikan ke `GET /v1/indexer/status` (`docs/api.md` §3) untuk
konsumsi frontend:

| Metrik | Tipe | Arti |
|---|---|---|
| `indexer_oldest_unproven_age_seconds` | Gauge | **Metrik paling penting** — umur event tertua yang belum `recorded`/`skipped`. Ambang §4.2 dipantau dari sini |
| `indexer_queue_size{status="pending\|awaiting_attestation\|proving\|submitting\|failed"}` | Gauge | Ukuran antrean per status |
| `indexer_events_recorded_total{protocol}` | Counter | Fakta berhasil tercatat, per protokol |
| `indexer_events_skipped_total{reason="reverted\|unregistered_emitter\|replay"}` | Counter | Event yang sengaja ditolak, per alasan |
| `indexer_events_failed_total{stage}` | Counter | Kegagalan teknis persisten, per tahap |
| `indexer_rpc_call_duration_seconds{provider,method}` | Histogram | Latensi panggilan RPC Ethereum/Creditcoin/prover |
| `indexer_rpc_errors_total{provider,code}` | Counter | Error RPC per kode (429, timeout, dst.) |
| `indexer_batch_size` | Histogram | Distribusi ukuran batch aktual vs `MAX_BATCH_SIZE=10` — indikator efisiensi batching |
| `indexer_cursor_lag_blocks{protocol}` | Gauge | `finalized_height - last_scanned_block` per protokol — indikator watcher tertinggal |
| `indexer_submitter_nonce_gap` | Gauge | `next_nonce - onchain_nonce`; nilai besar & persisten menandakan tx macet berkepanjangan |

### 12.3 Alerting (ambang minimal untuk demo/produksi awal)

| Kondisi | Level | Aksi |
|---|---|---|
| `indexer_oldest_unproven_age_seconds >= 20h` | Kritikal | Cek §4.2 — kemungkinan backlog proving/submitting |
| `indexer_events_failed_total` naik dalam 5 menit terakhir | Kritikal | Cek `last_error` di baris `failed` terbaru |
| Saldo CTC dompet submitter di bawah ambang (mis. cukup untuk < 50 tx) | Kritikal | Top-up manual sebelum kehabisan (§8.2) |
| `indexer_cursor_lag_blocks > CHUNK_SIZE * 5` | Warning | Watcher mungkin tertinggal RPC lambat/rate limit |

---

## 13. Backfill Riwayat vs Mode Live

### 13.1 Mode Live

Loop watcher default (§6.2) — memindai maju dari cursor tersimpan ke `finalized`,
tiap event baru langsung masuk pipeline eager-proving. Ini mode operasional normal
setelah indexer "mengejar" (`caught up`).

### 13.2 Mode Backfill

Dijalankan **satu kali** saat pertama kali men-deploy sebuah protokol baru (mis.
menambah Compound V3 setelah Aave V3 & Morpho Blue sudah berjalan), atau untuk
mengisi riwayat dari `genesisBlock` protokol sampai sekarang demi demo yang punya
kedalaman riwayat (skor kredit butuh `historyDuration` — `architecture.md` §8.3 —
yang tidak berarti apa-apa tanpa data lama).

```bash
pnpm --filter services/indexer run backfill \
  --protocol aave-v3 \
  --from-block 16291127 \
  --to-block 25810648
```

Secara internal, backfill memakai **loop `watchOnce` yang sama** (§6.2) dipanggil
berulang dalam skrip terpisah dari daemon utama, dengan `CHUNK_SIZE` yang sama —
tidak ada jalur kode kedua untuk "mengambil log", hanya orkestrasi start/stop
berbeda. Ini mencegah drift logika antara mode live dan backfill.

### 13.2b Mode Backfill per-SUBJEK (yang sebenarnya dipakai)

Diimplementasikan 2026-08-25 di `services/indexer/src/backfill/`.

```bash
pnpm --filter @corolary/indexer backfill --subject 0x… [--months 6] \
     [--protocol aave-v3,spark] [--dry-run]
```

**Kenapa bukan mode rentang blok di §13.2.** Aritmetika, bukan selera. Riwayat
enam bulan adalah ~1,3 juta blok. Dipindai tanpa filter subjek, Aave saja
menghasilkan ratusan ribu log, dan **setiap** transaksi di dalamnya akan
dibuktikan pada tarif lazy 3,13×10⁻⁴ CTC — puluhan ribu CTC untuk riwayat yang
99,99%-nya milik dompet yang tidak ditampilkan di mana pun.

Yang membuat mode per-subjek mungkin: **subjek adalah parameter ber-`indexed` di
keempat protokol**, jadi RPC bisa menyaringnya di sisi server. Riwayat enam bulan
satu dompet menyusut jadi beberapa puluh log, dan biayanya sebanding dengan
aktivitas dompet itu — bukan dengan aktivitas seluruh chain.

Mode §13.2 tetap benar untuk tujuan aslinya (menambahkan protokol baru). Yang
dilakukan di sini tujuannya berbeda: memberi kedalaman `historyDuration` pada
dompet demo.

**Jalur insert-nya sama persis dengan watcher live.** `watchOnce` dan backfill
sama-sama memanggil `insertLogs()` di `watcher/watch.ts`; yang berbeda hanya cara
log ditemukan dan bendera `backfill = true`. Tidak ada jalur kode kedua yang bisa
menyimpang — dan kalau ada, yang menyimpang selalu jalur yang lebih jarang dipakai.

#### Posisi subjek di `topics` (wajib cocok dengan adapter)

| Protokol | Event | Subjek |
|---|---|---|
| Aave V3 / Spark | Borrow, Repay, Supply, Withdraw | `topics[2]` |
| Aave V3 / Spark | LiquidationCall | `topics[3]` |
| Morpho Blue | Borrow, WithdrawCollateral | `topics[2]` |
| Morpho Blue | Repay, Liquidate, SupplyCollateral | `topics[3]` |
| Compound V3 | WithdrawCollateral | `topics[1]` |
| Compound V3 | SupplyCollateral, AbsorbDebt | `topics[2]` |

Salah posisi **tidak** menghasilkan data salah — adapter tetap mencatat subjek
yang benar. Yang terjadi lebih halus: filter memanen log milik dompet LAIN (mis.
`repayer` alih-alih `user`), lalu kita **membayar proof untuk riwayat orang lain**.

#### Batas RPC

drpc free menolak rentang > **10.000 blok**, bahkan dengan filter topic — jadi
`CHUNK = 10_000`, dan enam bulan = ~130 potongan × 2 filter per protokol.

Jeda `PACE_MS = 250` dipertahankan sebagai kehati-hatian, bukan sebagai
tanggapan atas ban yang terbukti.

> **Koreksi 2026-08-25.** Versi awal paragraf ini menyatakan bahwa 780 panggilan
> paralel memicu ban 403 dari drpc, dan menyimpulkan backfill tidak boleh jalan
> bersamaan dengan indexer. **Keduanya keliru.** 403 itu ternyata blokir
> **User-Agent**: permintaan yang identik dijawab 403 untuk UA `Python-urllib`,
> 429 untuk `curl`, dan dilayani normal untuk `Mozilla/5.0`. Skrip pengukuran
> yang dipakai saat itu memakai Python tanpa UA eksplisit, jadi ia tidak pernah
> berhasil sekali pun — dan nolnya terbaca seperti akibat beban.
>
> Yang benar-benar terukur soal beban hanyalah `"Request timeout on the free
> plan"` untuk rentang lebar dan `"Batch of more than 3 requests"` untuk batch
> JSON-RPC. Klaim "jangan jalankan bersamaan" tidak punya bukti dan dicabut.

#### `--dry-run` menghitung batch SUNGGUHAN

Perkiraan biaya tidak memakai `ceil(tx / 10)`. Batas span 999 blok berarti
transaksi yang terpisah berbulan-bulan **tidak bisa** satu batch: riwayat 20
transaksi yang tersebar merata membentuk ~20 batch berisi satu, bukan 2 batch
berisi sepuluh. Efisiensi batching — inti model biaya untuk lalu lintas live —
praktis **hilang** di backfill, dan perkiraan `ceil(tx/10)` meleset sepuluh kali
lipat ke arah yang salah. Karena itu `--dry-run` menjalankan `buildBatches()`
yang sama dengan prover, atas tinggi blok yang sungguhan.

`--dry-run` juga mengecualikan transaksi yang sudah ada di `observed_events`:
keduanya tidak akan dibayar dua kali (`observed_events_unique_log` di sisi DB,
`_markProcessed` di sisi kontrak), jadi memasukkannya ke perkiraan akan
melebih-lebihkan biaya.

#### Ketahanan: tulis per potongan, pecah rentang saat gagal

Percobaan pertama menjalankan pemindaian 12 bulan × 4 protokol dan **gagal total
di menit ke-3**, kehilangan seluruh pekerjaan. Penyebabnya dua hal yang keduanya
salah desain, bukan nasib buruk:

1. **Penulisan menunggu akhir.** Seluruh log dikumpulkan lebih dulu lalu di-insert
   setelah keempat protokol selesai. Pemindaian setahun adalah ~2.100 panggilan
   RPC dan ~20 menit; satu kegagalan di protokol keempat membuang semuanya.
   Sekarang insert terjadi **per potongan 10.000 blok**. Idempoten lewat
   `observed_events_unique_log`, jadi menjalankan ulang melanjutkan, bukan
   menduplikasi.

2. **Klasifikasi retry terlalu sempit.** drpc membalas
   `-32000 "method handler crashed"` — bukan 403, bukan 429, bukan timeout —
   sehingga daftar kata kunci melewatkannya dan error dilempar sampai atas.
   Sekarang **semua** error RPC diperlakukan transien di `getLogsWithRetry`, dan
   kegagalan struktural (rentang terlalu lebar) ditangani terpisah dengan
   **memecah rentang jadi dua** sampai batas bawah 500 blok.

Rentang yang tetap gagal setelah dipecah **tidak dilewati diam-diam**: ia dicatat
dan dilaporkan di akhir pada level `error` dengan instruksi menjalankan ulang.
Riwayat tidak lengkap tanpa ada yang tahu adalah kegagalan terburuk di sini —
skornya akan tampak sah, hanya lebih rendah dari seharusnya.

#### Cursor tidak disentuh

Backfill **tidak** memundurkan `source_cursors`. Cursor menandai sampai mana
watcher live sudah memindai MAJU; memundurkannya akan membuat watcher memindai
ulang berbulan-bulan sebagai lalu lintas live, pada tarif eager, untuk seluruh
chain.

---

### 13.3 Trade-off Biaya

Backfill **secara inheren melanggar jendela eager-proving** untuk data lama —
`observedAt` transaksi lama sudah jauh melewati 24 jam saat diproses, jadi proof-nya
otomatis kena tarif "lazy" (~3,13×10⁻⁴ CTC/tx, §4.1), bukan pilihan desain yang bisa
dihindari.

| Pertimbangan | Live | Backfill |
|---|---|---|
| Biaya proof per tx | ~2,59×10⁻⁵ CTC (eager) | ~3,13×10⁻⁴ CTC (lazy, ~12x lebih mahal) |
| Kedalaman riwayat untuk skor | Hanya sejak indexer mulai berjalan | Sedalam `--from-block` yang dipilih |
| Kapan dijalankan | Selalu (daemon utama) | Sekali per protokol baru, terkontrol manual |
| Batching | Batch kecil (event datang perlahan) | Batch besar (10 tx penuh) — memaksimalkan efisiensi continuity proof yang dibagi meski tarifnya lazy |
| Dampak `oldest_unproven_age_seconds` | Metrik ini relevan | Diabaikan sengaja untuk data backfill — event backfill ditandai `backfill: true` di `observed_events` dan **dikecualikan** dari metrik/alert §12, karena umurnya memang akan selalu > 24 jam by design |

**Keputusan operasional:** batasi `--from-block` secukupnya untuk memberi
`historyDuration` yang meyakinkan (mis. 6–12 bulan ke belakang) tanpa membebani
biaya CTC secara tidak proporsional — bukan menarik seluruh riwayat sejak deploy
protokol (Aave V3 sudah berjalan sejak 2023).

---

## 14. Skema Database Relevan

Tiga tabel inti dari `architecture.md` §10, dengan DDL lengkap untuk kebutuhan
indexer.

> **Implementasi memakai `postgres.js` + SQL mentah, bukan Drizzle.** DDL di
> bawah sudah mengunci skemanya, sehingga ORM hanya menambah `drizzle-kit`
> untuk migrasi plus satu lapis API yang bisa bergeser antar versi tanpa
> memberi manfaat nyata di sini. Migrasi dijalankan dari file `.sql` berurutan
> di `services/indexer/src/db/migrations/`, dicatat di tabel `schema_migrations`.
>
> Implementasi menambah satu tabel yang tidak ada di daftar ini: **`proof_batches`**
> (migrasi `0003`). Alasannya: proof yang sudah DIBAYAR harus selamat dari
> restart. Kalau prover menyerahkan proof ke submitter hanya lewat memori,
> proses yang mati di antara keduanya membuang CTC dan memaksa proving ulang.

```sql
CREATE TABLE source_cursors (
  chain_key          BIGINT NOT NULL,
  protocol           TEXT   NOT NULL,
  last_scanned_block BIGINT NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_key, protocol)
);

CREATE TABLE observed_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_key     BIGINT NOT NULL,
  block_height  BIGINT NOT NULL,
  tx_hash       TEXT   NOT NULL,
  tx_index      INTEGER NOT NULL,
  log_index     INTEGER NOT NULL,
  topic0        TEXT   NOT NULL,
  protocol      TEXT   NOT NULL,
  raw_log       JSONB  NOT NULL,
  status        TEXT   NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','awaiting_attestation','proving',
                                    'submitting','recorded','failed','skipped')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  run_after     TIMESTAMPTZ,          -- jadwal retry berikutnya (§8.1)
  backfill      BOOLEAN NOT NULL DEFAULT false,  -- dikecualikan dari SLA §4.2/§12
  batch_id      TEXT,                  -- diisi saat masuk batch proving (§5.2)
  fact_id       TEXT,                  -- diisi saat status = recorded
  observed_at   BIGINT NOT NULL,       -- unix seconds, block.timestamp Ethereum
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT observed_events_unique_log
    UNIQUE (chain_key, block_height, tx_index, log_index)
);

CREATE INDEX observed_events_status_observed_at_idx
  ON observed_events (status, observed_at ASC);   -- untuk ORDER BY observed_at ASC per tahap (§4.2, §5)

CREATE INDEX observed_events_run_after_idx
  ON observed_events (run_after)
  WHERE run_after IS NOT NULL;                     -- untuk poller retry (§8.1)

CREATE TABLE jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       TEXT   NOT NULL,           -- mis. 'eager_prove' untuk POST /v1/prove
  payload    JSONB  NOT NULL,
  status     TEXT   NOT NULL DEFAULT 'pending',
  attempts   INTEGER NOT NULL DEFAULT 0,
  run_after  TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE submitter_state (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- satu baris saja (§9)
  next_nonce  BIGINT NOT NULL
);
```

`jobs` (kind = `'eager_prove'`) adalah antrean **request eksplisit** dari
`POST /v1/prove` (`docs/api.md` §12) — terpisah secara logis dari `observed_events`
(hasil pemindaian otomatis watcher), meski keduanya bisa berujung pada baris
`observed_events`/`facts` yang sama lewat dedup §7. `submitter_state` adalah
tabel pendukung §9 yang tidak disebut eksplisit di `architecture.md` §10 tapi
diperlukan untuk manajemen nonce yang tahan-restart.

---

## 14b. Jalur Harga Chainlink (`prices` loop)

Diimplementasikan 2026-08-25 di `services/indexer/src/prices/`. Loop **kelima**,
dan satu-satunya yang tidak memakai `observed_events`.

### 14b.1 Kenapa terpisah dari pipeline fakta

| | Pipeline fakta | Jalur harga |
|---|---|---|
| Tujuan | KELENGKAPAN — tiap log harus tercatat, skor dihitung dari himpunan penuh | KESEGARAN — hanya ronde terbaru per aset yang berlaku |
| Kontrak | `FactRegistry.recordFactBatch` (≤10 tx) | `PriceRegistry.recordPrice` (tunggal) |
| State | `observed_events` + `proof_batches` + cursor | **tidak ada** |

Mengalirkan harga lewat pipeline fakta berarti membeli proof untuk **setiap ronde
setiap feed selamanya** — terukur ~18 ronde ETH/USD per 3.000 blok — lalu membuang
hampir semuanya, karena `recordPrice` sendiri melewati `roundId <= p.roundId`.

Karena hanya ronde terbaru yang penting, loop ini tanpa state: tiap putaran
membaca `priceDataOf(asset)` dari chain, lalu memindai mundur dari `finalized`
untuk ronde yang lebih baru. Restart di titik mana pun aman, dan database yang
di-reset disamakan lagi dengan chain saat `initPrices()`.

### 14b.2 Konstanta

| Konstanta | Nilai | Kenapa |
|---|---|---|
| `REFRESH_AFTER_SECONDS` | 3.600 | jauh di bawah `maxPriceAge` on-chain (86.400), memberi 23 jam ruang pemulihan sebelum pasar membeku |
| `MAX_LOOKBACK_BLOCKS` | 6.000 (~20 jam) | menjaga seluruh jalur harga di dalam jendela eager-proving 24 jam |
| `SCAN_CHUNK_BLOCKS` | 3.000 | aggregator jarang memancarkan log; terukur <500 ms per 3.000 blok di drpc — bandingkan Aave yang harus dipotong ke 500 |
| `STALE_CONCERN_SECONDS` | 43.200 | di bawah ini "tidak ada ronde baru" adalah keadaan NORMAL, bukan alarm |
| `PRICE_INTERVAL_MS` | 120.000 | satu `eth_call` per feed per putaran; tidak ada gunanya lebih cepat dari ambang 1 jam |

### 14b.3 Nonce dipakai bersama submitter fakta

Loop harga memakai kunci yang **sama** dengan submitter fakta, jadi ia mengklaim
nonce dari `submitter_state` yang sama dan **wajib hidup di proses yang sama**.
Dua proses yang mengklaim nonce dari satu kunci akan saling menimpa transaksi.
Karena itu `initPrices()` dipanggil di blok `try` yang sama dengan
`initSubmitter()` di `main.ts` — kalau alamat kontrak belum ada, keduanya mati
bersama, bukan salah satu saja.

Diverifikasi live: setelah 25 batch fakta dan 3 harga, nonce on-chain (36) sama
persis dengan `submitter_state.next_nonce` (36).

### 14b.4 Tiga pemeriksaan saat start

`initPrices()` memeriksa hal yang semuanya gagal **secara senyap**:

1. **aggregator dipercaya kontrak?** Kalau tidak, `recordPrice` melewatinya tanpa
   revert — biaya proof terbayar, nol harga tercatat, nol error.
2. **dipetakan ke aset yang benar?** Salah petakan = harga benar di aset salah.
3. **`proxy.aggregator()` masih sama?** Ini deteksi rotasi feed (T5).

Ketiganya di-log level `error` dan menyebutkan panggilan kurator yang diperlukan.

### 14b.5 Tabel `prices`

```sql
-- migrasi 0004, diubah oleh 0006 dan 0007
CREATE TABLE prices (
  asset              TEXT PRIMARY KEY,
  aggregator         TEXT NOT NULL,
  pair               TEXT,             -- nama feed Chainlink, BUKAN simbol+"/USD"
  answer             NUMERIC(78,0) NOT NULL,
  decimals           SMALLINT NOT NULL,
  round_id           NUMERIC(78,0) NOT NULL,
  updated_at         BIGINT NOT NULL,  -- waktu Ethereum, TERBUKTI
  source_block       BIGINT NOT NULL,
  source_tx_hash     TEXT,             -- transaksi Ethereum pemuat AnswerUpdated
  creditcoin_tx_hash TEXT,             -- transaksi recordPrice
  recorded_at        BIGINT
);
```

`fact_id` di migrasi `0004` **diganti nama** jadi `source_tx_hash` oleh `0006`:
harga bukan Fact, `PriceRegistry` tidak menurunkan `factId`, dan kolom itu
menjanjikan sesuatu yang tidak pernah ada.

`pair` disimpan, tidak disusun dari simbol aset: WBTC dihargai feed **BTC/USD**,
dan "WBTC/USD" adalah feed Chainlink lain yang tidak pernah kita baca.

### 14b.6 Menjalankan satu putaran manual

```bash
pnpm --filter @corolary/indexer prices:once
```

Mengisi harga pertama kali tanpa menjalankan seluruh indexer. **Jangan** dijalankan
bersamaan dengan indexer — keduanya mengklaim nonce dari kunci yang sama.

---

## 15. Mode Kegagalan & Penanganan

| Mode kegagalan | Deteksi | Penanganan |
|---|---|---|
| RPC Ethereum turun/lambat berkepanjangan | `indexer_rpc_errors_total{provider="ethereum"}` naik terus, `indexer_cursor_lag_blocks` naik | Retry backoff (§8.1); kalau > 30 menit, alert kritikal — pertimbangkan failover ke RPC provider cadangan (`ETHEREUM_RPC_URL` kedua, dikonfigurasi manual) |
| Prover API (`PROOF_BUILDER_URL`) turun | `indexer_rpc_errors_total{provider="prover"}` naik, antrean `proving` menumpuk | Retry backoff; karena ini infrastruktur bersama Creditcoin (bukan milik Corolary), tidak ada failover — hanya tunggu dan alert |
| RPC Creditcoin turun | `submitting` menumpuk, gagal baca `ChainInfo`/kirim tx | Retry backoff; blocking untuk seluruh pipeline karena semua tahap setelah `pending` bergantung padanya |
| Dompet submitter kehabisan CTC | Tx `submitting` gagal terus dengan `insufficient funds` | Non-retryable → `failed` segera (§8.2), alert kritikal, perlu top-up manual — **bukan** kesalahan kode |
| Postgres turun | Semua tahap gagal total, watcher tidak bisa insert | Proses harus **crash dan restart** (lewat process manager/orkestrator), bukan retry in-memory — state harus selalu berasal dari DB, tidak ada buffer in-memory yang berisiko hilang |
| Reorg Ethereum dangkal (sebelum `finalized`) | Watcher hanya memindai sampai tag `finalized` (§6.2) | **Dihindari secara desain**, bukan ditangani setelah terjadi — blok yang belum `finalized` tidak pernah masuk `observed_events`. Trade-off: watcher tertinggal head Ethereum ~12–19 menit (2 epoch), yang jauh di bawah anggaran 24 jam eager-proving (§4) |
| Dua instance indexer berjalan bersamaan (mis. deploy ganda) | `indexer_submitter_nonce_gap` tidak nol/naik aneh, error nonce di log | Lapis dedup §7 (DB unique constraint + `processedQueries` on-chain) mencegah duplikasi data; tapi ini kondisi yang harus diperbaiki di level deploy (pastikan `replicas: 1`), bukan sesuatu yang didesain untuk ditoleransi permanen |
| Chainlink aggregator berganti di balik proxy | Event `AnswerUpdated` datang dari alamat baru yang belum ada di himpunan tepercaya | `ChainlinkAdapter` (`packages/contracts`) me-resolve `aggregator()` dari proxy secara berkala dan memperbarui himpunan tepercaya — sisi indexer memantau event dari **kedua** aggregator (lama & baru) selama masa transisi supaya tidak ada gap harga (lihat `architecture.md` §11) |
| Adapter decode gagal (ABI mismatch/bug) | Exception saat decode log jenis event yang seharusnya dikenali | Non-retryable → `failed`, alert kritikal — ini bug kode, retry tidak akan memperbaikinya |

---

## 16. Dompet Demo (terverifikasi on-chain 2026-08-25)

Dompet yang dipakai untuk demo skor dan efisiensi kolateral:

**`0x94963B928498bE7f06637C3D57ea1E74D7f73423`**

| Komponen | Poin | Maks |
|---|---|---|
| repaymentVolume | 297 | 300 |
| repaymentCount | 171 | 200 |
| historyDuration | 95 | 200 |
| liquidationPenalty | 0 | −300 |
| protocolDiversity | 50 | 100 |
| activeStanding | 200 | 200 |
| **Skor** | **813** | 1000 |

Tier **4**, `collateralRatioBpsOf` = **11000** (110%). Dibaca dari
`CreditGraph.componentsOf` / `scoreOf` di CC3 Testnet, bukan dihitung off-chain.

### Bagaimana ia sampai ke sana

| Langkah | Skor | Tier |
|---|---|---|
| Riwayat live saja | 763 | 3 |
| + 127 tx Aave (24→6 bulan) | 797 | 3 |
| + 2 tx Morpho (24→9 bulan) | **813** | **4** |

Perhatikan langkah terakhir: **dua** transaksi, 0,000626 CTC, memindahkan 16 poin
dan menembus ambang tier 4. Bukan karena volumenya, melainkan karena keduanya
tertanggal **2025-09-23** — lebih tua dari fakta Aave mana pun yang kita punya —
sehingga `firstFactAt` mundur 91 hari dan `historyDuration` naik 80 → 95.

### Kenapa dompet ini, bukan yang lebih besar

Kandidat pembanding `0x65c4C0517025Ec0843C9146aF266A2C5a2D148A2` punya riwayat
jauh lebih panjang (`historyDuration` 133) dan ribuan transaksi, tapi hanya aktif
di **satu** protokol. Karena `protocolDiversity` linear —
`popcount(bitmap) * 100 / 4`, tepat 25 poin per protokol — plafonnya bisa dihitung
tanpa memindai apa pun: **759**, bahkan bila ketiga protokol sisanya terisi penuh.

Pelajaran yang lebih umum: **riwayat panjang dihargai paling sedikit.**
`historyDuration` hanya bernilai 200 poin dan setengah-jenuh di 365 hari, jadi
menggandakan kedalaman waktu memberi jauh lebih sedikit daripada yang terlihat.
Yang menentukan adalah `repaymentVolume` (300 poin) dan cakupan protokol.

### Reproduksi

```bash
pnpm --filter @corolary/indexer backfill -- \
  --subject 0x94963B928498bE7f06637C3D57ea1E74D7f73423 \
  --months 24 --until-months 6 --protocol aave-v3 --priority 10

pnpm --filter @corolary/indexer backfill -- \
  --subject 0x94963B928498bE7f06637C3D57ea1E74D7f73423 \
  --months 24 --until-months 9 --protocol morpho-blue --priority 10
```

`--priority 10` menaruhnya di depan antrean latar; tanpa itu hasilnya baru
terbaca berjam-jam kemudian. Exit code **2** berarti ada rentang yang tidak
terbaca — riwayatnya berlubang, jalankan ulang perintah yang sama.

Spark dan Compound V3 **kosong** untuk dompet ini (dipindai 9 bulan, nol log),
jadi `protocolDiversity` 50 adalah plafonnya. Tidak perlu dipindai ulang.
