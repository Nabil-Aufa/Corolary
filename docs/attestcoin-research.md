# Attestcoin Protocol — Riset Teknis

> Diverifikasi langsung ke jaringan pada 2026-08-22, bukan hanya dari dokumentasi.
> Semua angka di bagian "Verifikasi Live" adalah hasil panggilan nyata.

## 1. Apa yang sebenarnya dilakukan Attestcoin

Attestcoin Protocol = **oracle terdesentralisasi native** di dalam runtime Creditcoin.
Bukan bridge, bukan layanan eksternal — ini precompile di level chain.

Dua kapabilitas:

| Kapabilitas | Arah | Status |
|---|---|---|
| **Readability** | Source chain → Creditcoin | ✅ **LIVE** (mainnet & testnet) |
| **Writability** | Creditcoin → destination chain | ❌ **BELUM RILIS** — masih audit pihak ketiga |

> **Konsekuensi desain paling penting:** ide apa pun yang butuh Creditcoin menulis
> balik ke Ethereum **tidak bisa dibangun sekarang**. Semua arsitektur harus
> berbentuk: aksi/bukti terjadi di Ethereum → logika bisnis & state hidup di Creditcoin.

### Aktor protokol
- **Attestors** — node independen yang memantau blok source chain dan mencapai
  konsensus lewat BLS aggregate signature. Tidak ada satu pun yang bisa memalsukan sendiri.
- **Validators** — authority set Creditcoin; memverifikasi signature attestor dan quorum,
  lalu commit attestation ke storage on-chain.
- **Block Prover Precompile** (`0x0FD2`) — kode Rust native, memverifikasi Merkle proof
  (inklusi transaksi) + continuity proof (integritas rantai blok) secara **sinkron**.
- **ChainInfo Precompile** (`0x0fd3`) — query state attestation.
- **Relayers** — pengantar pesan (untuk writability) & opsional membantu readability.

## 2. Batasan teknis yang menentukan (WAJIB dipahami sebelum memilih ide)

### 2.1 Yang dibuktikan adalah TRANSAKSI, bukan STATE
Attestcoin membuktikan: *"transaksi X berada di blok N, dan blok N benar bagian dari
rantai source chain yang terkonfirmasi."*

Yang **BISA**: membuktikan sebuah event/transaksi terjadi.
Yang **TIDAK BISA**: menanyakan state sembarang — tidak ada storage proof.
Tidak bisa bertanya "berapa saldo USDC Alice sekarang?".

> Untuk mendapat "saldo", polanya adalah **event sourcing**: buktikan seluruh rangkaian
> event yang relevan sejak titik awal yang diketahui, lalu rekonstruksi state di Creditcoin.

### 2.2 Precompile TIDAK memvalidasi sukses/gagalnya transaksi
Docs menandai ini sebagai isu keamanan dengan tegas. ASC **WAJIB** memeriksa sendiri:

```
receipt.receiptStatus == 1   // 0x1 = success
```

Tanpa cek ini, transaksi Ethereum yang **revert** tetap lolos verifikasi inklusi.
Ini jebakan keamanan #1 dan pembeda kode "paham" vs "copy-paste tutorial".

### 2.3 Biaya proof naik ~10x setelah 24 jam  ← INSIGHT ARSITEKTUR PALING PENTING
Attestation disimpan rapat untuk blok baru, lalu **diganti checkpoint jarang
(1 per 1000 blok)** setelah sekitar sehari. Continuity proof jadi jauh lebih panjang.

| Umur transaksi | Panjang continuity proof | Biaya |
|---|---|---|
| ~10 menit | 10 hash | **2,59 × 10⁻⁵ CTC** |
| ~24 jam+ | 1000 hash | **3,13 × 10⁻⁴ CTC** |

Rumus: `CTC ≈ 2,3×10⁻⁵ + 2,9×10⁻⁷ × (jumlah hash continuity)`

> **Implikasi strategis:** membuktikan event **saat masih segar itu 10x lebih murah**.
> Arsitektur yang benar bukan "prove on demand" tapi **eager proving** — buktikan
> saat murah, lalu **simpan faktanya secara permanen di Creditcoin**.
> Ini mengubah Attestcoin dari oracle per-query menjadi lapisan data terbukti yang
> bisa dibaca berkali-kali nyaris gratis. Hampir tidak ada tim lain yang akan menyadari ini.

### 2.4 Batch proving
- Maks **10 proof per batch**, harus dalam rentang **1000 blok**
- Satu batch **berbagi satu continuity proof** → jauh lebih efisien
- Penting untuk membuktikan riwayat panjang secara ekonomis

### 2.5 Latensi
- Verifikasi selesai **dalam 1 blok Creditcoin (~15 detik)**, sinkron, tanpa callback
- Tapi harus menunggu **attestation** dulu — terukur ~8 menit untuk Ethereum mainnet

## 3. Verifikasi Live (dieksekusi 2026-08-22)

### 3.1 Endpoint
| Item | Nilai | Status |
|---|---|---|
| CC3 Testnet RPC | `https://rpc.cc3-testnet.creditcoin.network` | ✅ chainId `0x18e8f` (102031) |
| CC3 Mainnet RPC | `https://mainnet3.creditcoin.network` | ✅ chainId `0x18e8e` (102030) |
| Proof Builder (testnet) | `https://prover.cc3-testnet.creditcoin.network` | ✅ Swagger UI live |
| Dashboard testnet | `https://dashboard.cc3-testnet.creditcoin.network/` | ✅ 200 |
| BlockProver precompile | `0x0000000000000000000000000000000000000FD2` | ✅ |
| ChainInfo precompile | `0x0000000000000000000000000000000000000fd3` | ✅ |
| Decoder (testnet) | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` | |
| Decoder (mainnet) | `0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C` | |
| SDK | `@gluwa/usc-sdk` **v0.18.0** (rilis 2026-06-22) | ✅ |

### 3.2 TEMUAN TERPENTING — source chain yang didukung

Hasil `get_supported_chains()` langsung dari precompile:

**CC3 Testnet:**
```
(chainKey 3, chainId 1,        "Ethereum",         encoding 1)   ← ETHEREUM MAINNET
(chainKey 1, chainId 11155111, "Sepolia ethereum", encoding 1)
```

**CC3 Mainnet:**
```
(chainKey 1, chainId 1, "Ethereum", encoding 1)
```

> ### 🔑 Ini kunci strategisnya
> **Creditcoin TESTNET bisa membaca Ethereum MAINNET yang sungguhan (chainKey 3).**
>
> Hackathon mewajibkan deploy di **testnet**, tapi kita tidak ingin **mock data**.
> Kedua syarat itu terlihat bertentangan — ternyata tidak. Kita deploy di CC3 Testnet
> (memenuhi aturan) sambil mengonsumsi event Ethereum mainnet asli: Aave, Morpho,
> USDC, Ondo, BlackRock BUIDL. **Nol data palsu.**
>
> Mayoritas peserta akan mengikuti tutorial yang memakai **Sepolia (chainKey 1)** dan
> harus men-deploy token palsu sendiri untuk didemokan. Kita tidak.

### 3.3 Attestation memang hidup dan real-time

| Ukuran | Nilai |
|---|---|
| Head Ethereum mainnet asli | 25.810.648 |
| Attestation terakhir di CC3 Testnet (chainKey 3) | 25.810.610 |
| **Lag** | **38 blok ≈ 8 menit** |
| Checkpoint terakhir (chainKey 3) | 25.810.500 |
| Attestation terakhir Sepolia (chainKey 1) | 11.542.950 |
| Genesis height | 0 (kedua chain) |

Prover API melayani kedua chain:
```
GET /api/v1/attested-height/1  →  {"attestedHeight":11542960}
GET /api/v1/attested-height/3  →  {"attestedHeight":25810620}
```

### 3.4 Proof end-to-end untuk transaksi Ethereum mainnet ASLI — BERHASIL

```
GET /api/v1/proof-by-tx/3/0x82d8b138a95a87947891f8e4f9b0a148dd5050c8e691b2a965294178b9d7e594
→ HTTP 200
  chainKey: 3
  headerNumber: 25795652        (blok Ethereum mainnet nyata)
  txIndex: 5
  merkleProof.siblings: 9 entri
  continuityProof.roots: 49 entri
  cached: true
```

Konfirmasi: pipeline penuh (Ethereum mainnet → attestor → prover → siap diverifikasi
precompile Creditcoin) **berfungsi hari ini**. Perhatikan 49 continuity roots pada blok
yang sudah agak lama — persis sesuai penjelasan biaya di §2.3.

## 4. API Surface

### 4.1 Precompile BlockProver (`0x0FD2`)
```solidity
function verifyAndEmit(
    uint64 chainKey, uint64 height, bytes calldata encodedTransaction,
    MerkleProof calldata merkleProof, ContinuityProof calldata continuityProof
) external returns (bool);

function calculateTxIndex(MerkleProof calldata) external view returns (uint64);
```
Ada juga `verify()` (view, tanpa event).

### 4.2 Precompile ChainInfo (`0x0fd3`) — 11 fungsi
`get_supported_chains`, `get_chain_by_key`, `is_height_attested`,
`get_latest_attestation_height_and_hash`, `get_latest_checkpoint_height_and_hash`,
`get_attestation_bounds`, `find_highest_attested_before`, `find_lowest_attested_after`,
`get_attestation_genesis_height`, `get_attestation_height_for_digest`,
`get_checkpoint_for_height`

### 4.3 SDK `@gluwa/usc-sdk` v0.18.0
Modul: `chainInfo`, `blockProver`, `proofProvider` (`service.ProofBuilder` /
`raw.RawProofBuilder`), `encoding`, **`query-builder`**, `utils`.

Dependensi: ethers v6, axios, exponential-backoff, dotenv.

### 4.4 QueryBuilder — fitur kuat yang TIDAK ada di dokumentasi utama
Hanya ditemukan dengan membongkar tarball SDK:

```typescript
class QueryBuilder {
  static createFromTransactionHash(rpc, txHash, encoding?): Promise<QueryBuilder>
  addStaticField(field: QueryableFields): this
  eventBuilder(eventNameOrSig, filter, configurator): Promise<void>
  multiEventBuilder(...): Promise<void>
  addEventArgument(eventNameOrSig, argName, filter): Promise<void>
  functionBuilder(fnNameOrSig, configurator): Promise<void>
  addFunctionArgument(fnNameOrSig, argName): Promise<void>
  build(): { offset: number; size: number }[]
}
```

Menghasilkan pasangan `(offset, size)` untuk **ekstraksi field selektif** dari
transaksi terenkode — argumen event, argumen calldata fungsi, field transaksi.

> **Nilai strategis:** ini memungkinkan decoding parsial yang hemat gas, dan pola
> "hanya ambil field yang dibutuhkan". Memakai ini menunjukkan penguasaan protokol
> jauh di atas peserta yang sekadar menyalin tutorial.

## 5. Pola arsitektur wajib (dari docs)

Empat komponen:

1. **Source Chain Contract** (Ethereum) — logika seminimal mungkin, tugas utamanya
   **emit event**. Best practice: satu kontrak source, event unik dan spesifik
   (`TokensBurnedForBridging`, bukan `Transfer` generik).
2. **Attestcoin Smart Contract (ASC)** (Creditcoin) — terima proof, panggil precompile,
   decode, jalankan logika. Wajib punya **replay protection**.
3. **Business Logic Contract** (Creditcoin) — state & logika dApp. Pola terpisah
   direkomendasikan untuk dApp kompleks.
4. **Offchain Readability Worker** — pantau event → tunggu attestation → generate proof
   → panggil ASC. Ini yang membuat UX mulus (user hanya tanda tangan 1x di Ethereum).

### Contoh resmi
Repo: `gluwa/usc-testnet-bridge-examples` (push terakhir 2026-08-12, 0 star, 5 fork)

`USCBase.sol` — abstract contract yang bisa diwarisi:
- `execute(action, chainKey, blockHeight, encodedTx, merkleRoot, siblings, lowerEndpointDigest, continuityRoots)`
- `_computeQueryId(...)` → replay protection via `mapping(bytes32 => bool) processedQueries`
- Subclass mengimplementasi `_processAndEmitEvent(action, queryId, encodedTransaction)`

Tutorial resmi: 1) Hello Bridge, 2) Custom Contract Bridging, 3) Off-chain Worker,
4) Cross-Chain Loan dApp.

> **Peringatan kompetitif:** empat tutorial ini adalah yang akan dikloning mayoritas
> peserta. Token bridge dan cross-chain loan sederhana = wilayah paling ramai
> sekaligus paling mudah dinilai "dangkal" oleh juri.

## 6. Konteks bisnis Creditcoin (menentukan selera juri)

Juri = **Credit Labs**, yang menjalankan CEIP — program investasi **$10 juta**,
tiket **$25.000–$250.000**. Mereka menilai sebagai **investor**, bukan sekadar juri.

**DNA Creditcoin:**
- Dibangun Gluwa, live sejak 2017/2019 — infrastruktur **kredit RWA untuk emerging market**
- **Credal**: on-chain credit API mereka untuk lender fintech
- Traksi nyata: **4,27 juta transaksi kredit, $79,7 juta, 337.000 nasabah**
- Partner: **Aella** (fintech Nigeria, $100 juta+ pinjaman), MoU dengan **Bank Sentral Nigeria** (eNaira CBDC)
- Positioning sekarang: *"The Layer 1 Built for Cross-Chain Builders"*

**Ekosistem saat ini sangat tipis** — praktis hanya: PenguinSwap (DEX),
PenguinBase (hub), PenguinBridge, Credit Wallet. Ini berarti ruang kosong sangat besar.

**Token ATC** (Attestcoin): suplai tetap 10 juta, deflasioner — sebagian biaya
transaksi cross-chain dibakar. Aplikasi membayar ATC untuk **messaging**; **membaca gratis**.
Distribusi awal lewat launchpad PenguinSwap.

**Hashtag tersembunyi per track** (diekstrak dari data DoraHacks — sinyal langsung
apa yang panitia cari):

| Track | Hashtag |
|---|---|
| DeFi | #Perpetuals #Derivatives #Bridges #Liquid staking |
| RWA | #Tokenization #Treasury #Stablecoin #Real estate #Commodities |
| DePIN | #IoT #Space #Telecom #Storage #Sensor |
| Gaming | #In-Game crypto #Social platforms |
| **AI** | **#AI Agents #Onchain Decisioning #Verified Data** |

**Track AI adalah baru.** Edisi sebelumnya (deadline diperpanjang ke 7 Maret 2026,
demo day Seoul) hanya punya 4 track. AI ditambahkan untuk edisi Fall ini
→ paling sedikit pesaing, dan menandakan arah yang sedang mereka kejar.

## 7. Ringkasan risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Writability belum rilis | Tinggi | Desain hanya searah: Ethereum → Creditcoin |
| Hanya Ethereum yang didukung | Sedang | Jangan janjikan multi-chain; posisikan sebagai siap-ekspansi |
| Tidak ada storage proof | Tinggi | Pakai pola event sourcing untuk merekonstruksi state |
| Biaya proof 10x untuk data lama | Sedang | **Eager proving** + simpan fakta permanen (justru jadi keunggulan) |
| Lag attestation ~8 menit | Rendah | Jangan bangun sesuatu yang butuh sub-menit |
| Dokumentasi menyesatkan (path lama `creditcoin-usc` → 404) | Rendah | Pakai `docs.creditcoin.org/attestcoin-protocol` |
| Precompile tidak cek status tx | **Kritis (keamanan)** | Selalu `require(receiptStatus == 1)` |
| Banyak tim mengkloning tutorial bridge | Tinggi | Hindari bridge/loan sederhana |
