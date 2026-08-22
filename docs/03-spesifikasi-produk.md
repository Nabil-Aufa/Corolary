# Corolary — Spesifikasi Produk & Arsitektur


> *Solvency isn't claimed. It follows.*

Track: **RWA** · Status: **arah & nama dikunci 2 Agustus 2026**

⚠️ **`Corolary` ditulis dengan SATU huruf L. Ini disengaja, bukan salah ketik.**
Jangan pernah "mengoreksi" jadi `Corollary` di file mana pun.

Dokumen ini adalah rujukan utama saat ngoding. Ditulis agar seluruh sistem bisa
dibangun ulang dari nol tanpa melihat kode lama. Angka dan batasan berasal dari
`01-riset-mendalam.md` — jangan mengubah angka di sini tanpa mengukur ulang.

---

## 1. Produk dalam satu kalimat

> Token yang **tidak bisa dicetak melebihi cadangan yang terbukti** — bahkan oleh
> pemegang kunci admin yang sudah dibajak sepenuhnya.

## 2. Masalah

Issuer menerbitkan token dan mengklaim ada cadangan di baliknya. Buktinya laporan
berkala. Di antara dua laporan ada kegelapan, dan di kegelapan itulah orang kehilangan
uang.

Dua kejadian tahun ini, keduanya di dalam cakupan teknis produk ini:

| Tanggal | Issuer | Yang terjadi |
|---|---|---|
| 22 Mar 2026 | **Resolv (USR)** | Satu private key bocor → USR dicetak tanpa backing → depeg |
| 24 Mei 2026 | **StablR (USDR/EURR)** | Berlisensi Malta, patuh MiCA, didukung Tether. Multisig 1-of-3 dibobol; penyerang jadi admin, menghapus penanda tangan sah, mencetak **$13,5 jt tanpa backing**. EURR → **$0,548**. Mint & redemption dibekukan. |

**GENIUS Act** mewajibkan pengungkapan cadangan **bulanan**. Kedua issuer itu runtuh
**dalam hitungan jam**. Laporan bulanan adalah foto; yang dibutuhkan adalah kunci pada
pintunya.

**Inti masalahnya bukan pelaporan, tapi otorisasi.** Selama otoritas mint bisa mencetak
melebihi cadangan, transparansi sebaik apa pun cuma memberi tahu kita lebih cepat bahwa
uang sudah hilang.

## 3. Solusi

Pindahkan batas pencetakan dari **kebijakan** ke **kode**, dan sandarkan pada cadangan
yang **dibuktikan secara kriptografis**, bukan dilaporkan.

Kontrak di Creditcoin memelihara saldo cadangan sebuah alamat treasury di Ethereum.
Saldo itu **hanya** bergerak lewat event `Transfer` ERC-20 nyata yang terbukti
ter-include di blok Ethereum final, lewat Attestcoin. Lalu:

- `mint()` **revert** kalau melanggar lantai kolateral — bukan warning, bukan pause, **revert**.
- `redeem()` **selalu** diizinkan. Memblokir pintu keluar saat krisis adalah persis
  kegagalan yang produk ini cegah.
- Pembekuan terjadi **sendiri** saat penarikan terbukti mendarat. Tidak ada tombol,
  tidak ada operator, tidak ada rapat komite.

## 4. Dua mode

### 4.1 Vault mode — untuk issuer

Issuer mendaftarkan alamat treasury-nya di Ethereum dan menerbitkan token tanda terima
di Creditcoin. Pencetakan terkunci pada cadangan terbukti.

### 4.2 Observatory mode — **pembeda utama**

Siapa pun bisa men-deploy instance yang memantau treasury issuer di Ethereum mainnet,
**tanpa izin dan tanpa sepengetahuan issuer**, dan menghasilkan **feed proven-collateral**
publik yang berjalan terus.

⚠️ **Bukan "feed solvabilitas" — dikunci 7 Agt 2026 (RT11).** Solvabilitas = cadangan ÷
kewajiban. Di vault mode kewajiban = `totalSupply()` kita sendiri, eksak, jadi kata itu
sah. Di observatory mode kewajiban issuer ada di Ethereum dan **tidak kita buktikan** —
tidak ada penyebut, jadi tidak ada rasio, jadi tidak boleh ada kata *solvency*.
Yang kita buktikan di sini: **arah dan besar pergerakan kolateral** — alarm dini, bukan
peringkat. Penjelasan penuh: `07-red-team.md` RT11.

Ini yang membalik produk dari alat vendor B2B menjadi **utilitas publik untuk penabung**.
Issuer tidak punya cara mematikannya, karena kita tidak meminta apa pun dari mereka —
kita membaca rantai itu sendiri.

#### ⛔ Batas yang menentukan siapa yang boleh jadi target

**Kita hanya bisa mengaudit issuer yang kolateralnya benar-benar hidup on-chain.**

Kesalahan yang gampang sekali dibuat — dan fatal kalau masuk deck:

| Issuer | Backing sebenarnya | Bisa kita audit? |
|---|---|---|
| Circle USDC | T-bill & kas di BNY Mellon | ❌ **Tidak.** Off-chain. |
| BlackRock BUIDL | T-bill, kustodian tradisional | ❌ **Tidak.** |
| Ondo USDY / OUSG | T-bill + deposito bank | ❌ **Tidak.** |
| Paxos PAXG | Emas fisik di brankas | ❌ **Tidak.** |
| ~~Ethena USDe~~ | ⚠️ **DICABUT 9 Agt** — sebagian besar di *off-exchange custody* | ❌ **Jangan sebut** sampai diverifikasi ulang |
| **Sky USDS — LitePSM "Pocket"** | **4,25 miliar USDC mentah** di satu alamat (EOA) | ✅ **Ya — target utama, terverifikasi** |
| **Liquity LUSD** | ETH on-chain | ✅ **Ya** |
| **Resolv USR** | Kripto on-chain | ✅ **Ya — dan dia korban Maret 2026** |
| **Reserve eUSD** | Posisi Aave/Compound on-chain (dibungkus) | ⚠️ **Bersyarat** — enumerasi pembungkusnya; `cUSDC` butuh harga → tolak |
| **Fintech yang memegang USDC di treasury Ethereum** | USDC on-chain | ✅ **Ya — ini produk intinya** |
| **Aave `aUSDC`** | 8% dari suplai ada di kontrak, sisanya dipinjamkan — **by design** | ❌ **Anti-contoh.** Bukan kustodi 1:1. Menampilkannya sebagai "8% backed" adalah RT1 terbalik |

**Daftar final beserta alamat, saldo terukur, dan bahan naratifnya: `01-riset-mendalam.md`
§3.5.** Tes kelayakan tiga langkah untuk kandidat baru ada di sana — jalankan sebelum
menambahkan target apa pun.

Mengarahkan observatory ke Circle hanya menunjukkan token bergerak, **bukan** bukti
backing. Juri Creditcoin sedang mendorong RWA dan akan menangkap ini dalam satu
pertanyaan.

**Kalimat yang benar dan lebih kuat:**

> Tidak ada seorang pun on-chain yang bisa mengaudit Circle — cadangan mereka ada di bank.
> Kami mengaudit lapisan tempat kegagalan 2026 benar-benar terjadi: issuer yang
> kolateralnya hidup on-chain, yang mencetak di atasnya, dan yang bisa mencetak lebih
> banyak daripada yang mereka pegang.

**Catatan penting:** memakai **USDC sebagai aset cadangan** tetap sepenuhnya sah — kita
membuktikan *fintech X memegang N USDC di treasury-nya*, bukan membuktikan backing
Circle. Itu dua klaim yang sangat berbeda. Jangan pernah tertukar.

**Kenapa ini mustahil tanpa Attestcoin:** kita membaca event dari kontrak **milik
Circle**, di **Ethereum mainnet**, dari kontrak di **Creditcoin**. Tidak ada oracle
terpusat yang memberikan ini secara trustless. Tidak ada bridge yang relevan.

## 5. Posisi terhadap kompetitor

| | Sumber data | Perlu izin issuer? | Frekuensi |
|---|---|---|---|
| Chainlink PoR | Kustodian & auditor off-chain | **Ya** | Periodik |
| Chronicle Proof of Asset (BlackRock BUIDL, $1,7 M AUM) | Kustodian & fund administrator | **Ya** | Kontinu |
| **Corolary** | **Rantai itu sendiri, via bukti inklusi** | **Tidak** | **Per event** |

Keduanya adalah pipa terpercaya **dari pihak yang sedang kita curigai**. Kita tidak
bertanya kepada siapa pun.

**Batas cakupan yang WAJIB dinyatakan terus terang:** kita hanya melihat cadangan
**on-chain**. Kalau backing-nya T-bill di kustodian tradisional, kita buta — di sana
Chainlink/Chronicle unggul. Kita **melengkapi**, bukan menggantikan.
Tetap: Resolv dan StablR keduanya ada di dalam cakupan kita.

---

## 6. Arsitektur sistem

```
        ETHEREUM (mainnet = sumber kebenaran, Sepolia = panggung demo)
        ┌──────────────────────────────────────────────┐
        │  USDC / USDT / PYUSD  (kontrak pihak ketiga) │
        │        Transfer(from, to, value)             │
        │        menyentuh alamat TREASURY             │
        └───────────────────────┬──────────────────────┘
                                │ event log
                                ▼
        ┌──────────────────────────────────────────────┐
        │  ATTESTCOIN — jaringan attestor + validator  │
        │  konsensus atas state Ethereum → attestation │
        │  lag terukur: PITA 33–42 blok di CC3 testnet │
        │               PITA 65–73 blok di CC mainnet  │
        └───────────────────────┬──────────────────────┘
                                │
   ┌────────────────────────────┼─────────────────────────────┐
   │                            ▼                             │
   │  OFF-CHAIN WORKER (permissionless — siapa pun boleh)     │
   │  watch → tunggu attestation → build proof → submit       │
   │  persistence · catch-up · dedup · retry · batching       │
   └────────────────────────────┬─────────────────────────────┘
                                │ ingest(proof)
                                ▼
        ┌──────────────────────────────────────────────┐
        │  CREDITCOIN                                  │
        │  precompile 0x0FD2  verifyAndEmit → bool     │
        │  EvmV1Decoder      decode receipt + logs     │
        │           │                                  │
        │           ▼                                  │
        │  ReserveLedger      cadangan terbukti        │
        │           │                                  │
        │  ┌────────┴────────┐                         │
        │  ▼                 ▼                         │
        │  SolvencyLockedToken   Observatory           │
        │  (vault mode)          (read-only, siapa pun)│
        └───────────────────────┬──────────────────────┘
                                │
                                ▼
                     DASHBOARD (rasio live, feed bukti)
```

**Arah data satu arah.** Ethereum → Creditcoin. Tidak ada callback. Ini bukan batasan
yang mengganggu produk ini: seluruh aksi kita (mencetak, membekukan, menebus) terjadi
di sisi Creditcoin. Kita tidak pernah perlu menyentuh Ethereum.

---

## 7. Kontrak

### 7.1 `INativeQueryVerifier` — interface precompile `0x0FD2`

Wajib mendeklarasikan **keempat** varian. Fungsi batch adalah **overload
`verifyAndEmit`**, bukan `verifyAndEmitBatch` — memanggil nama itu menghasilkan
`execution reverted: "Unknown selector"`.

```solidity
interface INativeQueryVerifier {
    struct MerkleProofEntry { bytes32 hash; bool isLeft; }
    struct MerkleProof      { bytes32 root; MerkleProofEntry[] siblings; }
    struct ContinuityProof  { bytes32 lowerEndpointDigest; bytes32[] roots; }

    function calculateTxIndex(MerkleProof calldata) external view returns (uint64);

    function verify(uint64 chainKey, uint64 height, bytes calldata encodedTransaction,
        MerkleProof calldata, ContinuityProof calldata) external view returns (bool);

    function verify(uint64 chainKey, uint64[] calldata heights, bytes[] calldata encodedTransactions,
        MerkleProof[] calldata, ContinuityProof calldata shared) external view returns (bool);

    function verifyAndEmit(uint64 chainKey, uint64 height, bytes calldata encodedTransaction,
        MerkleProof calldata, ContinuityProof calldata) external returns (bool);

    function verifyAndEmit(uint64 chainKey, uint64[] calldata heights, bytes[] calldata encodedTransactions,
        MerkleProof[] calldata, ContinuityProof calldata shared) external returns (bool);
}

library NativeQueryVerifierLib {
    address internal constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000FD2;
}
```

Pakai `verifyAndEmit` (bukan `verify`) agar tiap attestation yang kita tindak lanjuti
meninggalkan jejak audit permanen dan independen di rantai.

### 7.2 `ReserveLedger` — inti akuntansi

Dipakai bersama oleh vault dan observatory. Ini kontrak yang paling penting benar.

**Konfigurasi (immutable saat deploy):**

| Field | Tipe | Catatan |
|---|---|---|
| `SOURCE_CHAIN_KEY` | `uint64` | **Wajib konfigurasi, jangan hardcode.** Testnet: 1=Sepolia, 3=ETH-mainnet. Creditcoin mainnet: **1=ETH-mainnet**. |
| `TREASURY` | `address` | Alamat treasury di chain sumber |
| assets terdaftar | `mapping(address ⇒ AssetConfig)` | Aset cadangan yang diakui |

```solidity
struct AssetConfig {
    bool     registered;
    uint8    decimals;      // WAJIB cocok dengan token sumber (USDC=6)
    uint16   haircutBps;    // 10_000 = dihitung penuh; 9_500 = potong 5%
}
```

**State:**

```solidity
mapping(address => uint256) public totalInflow;   // per aset, monotonik naik
mapping(address => uint256) public totalOutflow;  // per aset, monotonik naik
mapping(bytes32 => bool)    public processedQueries;
uint64 public lastIngestedHeight;
```

**Keputusan desain yang WAJIB dipertahankan — akuntansi order-independent.**
Inflow dan outflow diakumulasi ke dua penghitung monotonik terpisah, bukan satu saldo.
Konsekuensinya: worker yang memutar ulang riwayat **dalam urutan apa pun** tetap
konvergen ke angka yang sama, dan `ingest()` **tidak akan pernah revert karena
underflow**. Kalau ini diganti jadi satu saldo, sistem jadi rapuh terhadap urutan.

```solidity
function reservesOf(address asset) public view returns (uint256) {
    uint256 in_ = totalInflow[asset]; uint256 out = totalOutflow[asset];
    return in_ > out ? in_ - out : 0;          // clamp di nol, jangan revert
}
```

#### Saldo awal — keputusan desain yang menentukan seluruh sifat sistem

Attestcoin membuktikan **kejadian**, bukan **keadaan**. Tidak ada cara bertanya
*"berapa saldo alamat ini?"* — yang ada hanya *"transaksi ini terjadi."* Jadi cadangan
harus **direkonstruksi** dari aliran yang terbukti.

Konsekuensinya: **kita hanya tahu apa yang terjadi sejak ledger dipasang.** Kalau
treasury sudah memegang 5 juta USDC sebelum deploy, kita menganggapnya **nol**.

**Aturan berbeda per mode — dan ini bukan detail, ini keamanan:**

| Mode | Saldo awal | Alasan |
|---|---|---|
| **Vault** (ada minting) | **WAJIB nol. Tanpa pengecualian.** | Saldo awal yang dideklarasikan = lubang yang persis akan dipakai penyerang: klaim saldo besar, lalu cetak sepuasnya. Seluruh jaminan produk ini runtuh. |
| **Observatory** (tanpa minting) | Boleh dideklarasikan, **wajib ditandai TIDAK TERBUKTI** di semua tampilan | Tidak ada yang dicetak di atasnya — sifatnya informasional. Perubahannya tetap trustless walau titik awalnya tidak. |

**Arah kesalahannya selalu aman.** Kita bisa **kurang** menghitung cadangan → minting
membeku terlalu cepat → menyebalkan, tapi tidak ada yang rugi. Kita **tidak akan pernah
lebih** menghitung → mencetak tanpa jaminan → bencana. Sistem solvabilitas harus salah
ke arah ini.

Kalimat untuk deck:

> Kami tidak memberitahu berapa yang mereka **klaim** punya.
> Kami memberitahu berapa yang sudah kami **saksikan datang**.

⚠️ **Batas observatory yang harus diakui:** untuk protokol yang sudah lama jalan
(Sky, Liquity, Resolv), kita **tidak bisa menampilkan total kolateralnya** tanpa
membuktikan ulang seluruh riwayat — dan biaya proof naik >10× per hari umur transaksi,
jadi itu tidak realistis. Yang bisa kita berikan untuk mereka adalah **alarm aliran**:
begitu kolateral keluar, seluruh dunia tahu dalam ~9 menit, permissionless. Jangan
menjual observatory sebagai "kami tahu total cadangan mereka".

#### Risiko sisa yang WAJIB dinyatakan sendiri

Kita mewarisi kepercayaan pada aset cadangannya. Kalau **USDC sendiri** runtuh, Corolary
akan tetap melaporkan "cadangan penuh" padahal isinya sudah tak bernilai. Menjamin USDC
adalah pekerjaan Circle, regulator, dan PoR kustodian — **bukan kita**. Nyatakan di deck,
jangan menunggu juri yang menemukannya.

**Nilai cadangan gabungan (v1 — tanpa oracle harga):**

```solidity
function reserveValue() public view returns (uint256) {
    // Σ reservesOf(a) × haircutBps(a) / 10_000, dinormalisasi ke decimals unit-of-account
}
```

⚠️ **v1 hanya menerima aset yang unit-of-account-nya sama** (stablecoin USD: USDC,
USDT, PYUSD, USDS). Kita **tidak menilai harga aset**. Aset yang butuh harga (PAXG,
token RWA) **di luar cakupan v1** — memasukkannya berarti memasukkan price oracle, dan
itu membatalkan seluruh klaim "tanpa oracle". `haircutBps` adalah pengakuan risiko yang
diset saat deploy, bukan harga.

**Alur `ingest` — urutannya disengaja dan penting:**

```solidity
function ingest(
    uint64 chainKey, uint64 blockHeight, bytes calldata encodedTransaction,
    bytes32 merkleRoot, INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
    bytes32 lowerEndpointDigest, bytes32[] calldata continuityRoots
) external returns (bytes32 queryId)
```

1. **Tolak chain yang salah.** `chainKey != SOURCE_CHAIN_KEY` → revert.
2. **Tolak replay sebelum membakar gas verifikasi.**
   `queryId = keccak256(abi.encodePacked(chainKey, blockHeight, txIndex))`
   dengan `txIndex = VERIFIER.calculateTxIndex(merkleProof)`. Set flag sebelum lanjut.
3. **Buktikan inklusi** via `verifyAndEmit`. `false` → revert.
4. **Precompile TIDAK mengecek apakah tx sukses.** Tx yang revert sama "ter-include"-nya
   dengan yang sukses. Wajib: `decodeReceiptFields(...).receiptStatus == 1`, dan
   `isValidTransactionType(getTransactionType(...))`.
5. **Baru sekarang percaya log-nya**, dan hanya yang lolos tiga validasi di §7.3.

**Batch ingest** — `ingestBatch(chainKey, heights[], txs[], merkleProofs[], sharedProof)`.
Hemat terukur **21%** (37.079 vs 46.746 gas/tx). Batas `[docs]`: maks 10 proof, rentang
1000 blok. Batching hanya boleh menggabungkan tx yang **semuanya** lolos — satu revert
membatalkan seluruh batch, jadi worker harus siap fallback ke single.

### 7.3 `TransferLogParser` — tiga validasi yang menutup celah

Ini bagian yang paling mudah salah dan paling fatal kalau salah.

```solidity
bytes32 constant TRANSFER_TOPIC =
    0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

for (setiap LogEntry dengan topics[0] == TRANSFER_TOPIC) {
    // (1) EMITTER — tanpa ini, siapa pun bisa deploy ERC-20 sampah di Ethereum,
    //     kirim satu miliar ke treasury kita, dan mencetak token tanpa nilai.
    if (!assets[log.address_].registered) continue;

    // (2) BENTUK — Transfer ERC-20 kanonik: 3 topic, data tepat 32 byte.
    //     Event non-standar dengan signature sama kita tolak menafsirkan.
    if (log.topics.length != 3 || log.data.length != 32) continue;

    address from = address(uint160(uint256(log.topics[1])));
    address to   = address(uint160(uint256(log.topics[2])));

    // (3) RELEVANSI — hanya yang menyentuh treasury; self-transfer diabaikan
    //     (secara ekonomi no-op, tapi akan menggelembungkan kedua penghitung).
    bool isIn = (to == TREASURY); bool isOut = (from == TREASURY);
    if (isIn == isOut) continue;

    uint256 value = abi.decode(log.data, (uint256));
    if (value == 0) continue;
    isIn ? inflow += value : outflow += value;
}
```

Satu transaksi bisa menyentuh treasury beberapa kali (disbursement batch, hop router),
jadi **semua** log yang cocok diterapkan. Kunci replay menutup **seluruh transaksi**,
bukan tiap log.

**Catat SIAPA yang memicunya — `decodeCommonTxFields` (ditambahkan 9 Agustus 2026).**

Selain receipt dan log, decoder juga bisa membaca field transaksinya sendiri:
`from`, `to`, `value`, `nonce`, `data`. Kita cuma butuh satu — **`from`**, alamat yang
menandatangani transaksinya.

```solidity
// Bukan untuk validasi — untuk forensik. Feed yang bisa menjawab "siapa yang
// memindahkan uangnya" jauh lebih berguna daripada feed yang cuma bilang "berapa".
address initiator = DECODER.decodeCommonTxFields(txBytes).from;
emit ReserveOutflow(queryId, asset, height, amount, newReserves, initiator);
```

⚠️ **Jangan dipakai untuk memfilter.** Menolak transaksi berdasarkan `from` atau `to`
akan mematahkan kasus sah — router, multicall, Safe batch, disbursement pihak ketiga.
Tiga validasi di atas sudah cukup; `from` murni informasi tambahan.

**Nilainya ada di layar:** *"$2,1 juta keluar dari treasury — dipicu oleh `0xABC…`"*
jauh lebih kuat daripada *"$2,1 juta keluar"*. Untuk cerita bergaya Zondacrypto,
menunjukkan **siapa yang menekan tombolnya** adalah bedanya antara angka dan bukti.

**Pakai `decodeCommonTxFields` + `decodeReceiptFields` terpisah — JANGAN
`decodeTransactionType2()` dkk**, yang mendekode seluruh field termasuk tanda tangan,
`accessList`, dan parameter gas yang tidak pernah kita butuhkan. Itu gas terbuang.

**Catatan penting untuk deck:** dokumentasi Creditcoin menyarankan *"jangan pakai event
standar seperti `Transfer`"*. Kita menyimpang **secara sadar**, karena panduan itu
mengasumsikan kita memiliki kontrak sumber. Circle tidak akan menambahkan event khusus
untuk kita. Ambiguitas yang jadi alasan panduan itu ditutup oleh tiga validasi di atas.

### 7.4 `SolvencyLockedToken` — token tanda terima (vault mode)

ERC-20. `decimals` **wajib** sama dengan unit-of-account cadangan (USD stablecoin = 6),
supaya rasio kolateral tidak perlu penskalaan — menghapus satu kelas bug pembulatan.

```solidity
// ⚠️ URUTAN CEK DI SINI DISENGAJA — dikunci 7 Agustus 2026 (A3). Jangan dirapikan
// jadi `onlyIssuer` modifier; itu membalik urutannya dan merusak sifat di bawah.
//
// Lantai kolateral dicek SEBELUM otorisasi issuer. Alasannya bukan gas, tapi siapa
// yang bisa membuktikan klaim inti produk ini:
//
//   otorisasi duluan → penyerang dari wallet lain dapat `NotIssuer` = error yang SALAH.
//                      Adegan pamungkas hanya bisa direproduksi oleh pemegang kunci
//                      issuer — yaitu kita sendiri. Juri diminta percaya video.
//   lantai duluan    → SIAPA PUN bisa memanggil mint() melebihi cadangan dan mendapat
//                      `WouldBreachCollateralFloor` sungguhan dari node. Klaim berubah
//                      dari "percaya video kami" jadi "uji sendiri".
//
// Efek sampingnya penting: panel serangan di dashboard jadi permissionless, jadi
// otomatis bebas mock — tidak ada lagi godaan menganimasikan revert.
// Biayanya beberapa ribu gas pada transaksi yang toh akan revert.
function mint(address to, uint256 amount) external {
    // 1. Lantai kolateral — paling depan, disengaja. Hitung rasio PROSPEKTIF; jangan
    //    _mint lebih dulu lalu mengandalkan revert, karena urutan cek jadi kabur.
    uint256 ratio = prospectiveRatioBps(amount);
    if (ratio < minCollateralRatioBps)
        revert WouldBreachCollateralFloor(ratio, minCollateralRatioBps);

    // 2. Kesegaran (RT10 lapis 1) — pandangan kita tidak boleh basi
    if (attestedHeight() - lastIngestedHeight > maxStalenessBlocks)
        revert ReserveViewStale(lastIngestedHeight, attestedHeight());

    // 3. Batas per jendela (RT10 lapis 2)
    if (mintedThisWindow + amount > windowBudget())
        revert WindowMintCapExceeded(mintedThisWindow + amount, windowBudget());

    // 4. Otorisasi PALING AKHIR — lihat komentar di atas
    if (msg.sender != issuer) revert NotIssuer(msg.sender);

    _mint(to, amount);
    emit Minted(to, amount, ratio);
}

function prospectiveRatioBps(uint256 addedSupply) public view returns (uint256) {
    uint256 supply = totalSupply() + addedSupply;
    if (supply == 0) return type(uint256).max;
    return (reserveValue() * 10_000) / supply;
}

// ⚠️ JALUR KANONIK ISSUER — ditambahkan 9 Agustus 2026.
//
// mint() biasa bergantung pada pandangan cadangan yang SUDAH ada di ledger, lalu
// menolak kalau pandangan itu basi (gerbang kesegaran RT10 lapis 1). mintWithProof
// membalik urutannya: bukti cadangan terbaru DIINGEST DI DALAM TRANSAKSI YANG SAMA,
// baru pencetakan dievaluasi terhadap ledger yang baru saja diperbarui.
//
// Tidak ada celah antara "apa yang kami lihat" dan "apa yang kami izinkan".
//
// ⚠️ mint() BIASA TETAP ADA DAN TIDAK BOLEH DIHAPUS. Panel serangan (A3) bergantung
//    padanya: pengunjung tidak bisa membangun proof valid, jadi kalau mint() dihapus
//    klaim "siapa pun bisa mengujinya sendiri" ikut mati.
function mintWithProof(
    IngestParams calldata p,     // parameter ingest() apa adanya
    address to,
    uint256 amount
) external returns (bytes32 queryId) {
    queryId = LEDGER.ingest(p);  // revert di sini = mint tidak pernah terjadi
    mint(to, amount);            // urutan cek A3 berlaku penuh, tanpa perubahan
}

function redeem(uint256 amount) external {      // SELALU diizinkan
    _burn(msg.sender, amount);
    emit Redeemed(msg.sender, amount, collateralRatioBps());
}

function collateralRatioBps() public view returns (uint256) {
    uint256 supply = totalSupply();
    if (supply == 0) return type(uint256).max;
    return (reserveValue() * 10_000) / supply;
}

function isMintingFrozen()  external view returns (bool);   // turunan, bukan state
function mintableHeadroom() external view returns (uint256);
```

**Pembekuan adalah nilai turunan, bukan state yang harus dipicu.** Tidak ada yang perlu
menekan tombol; rasio berubah begitu penarikan terbukti mendarat. Ini penting untuk
demo dan penting untuk keamanan.

⚠️ **Dikoreksi 7 Agt 2026 (RT9).** Versi sebelumnya membolehkan `setMinCollateralRatioBps`
asal tidak bisa diset ke 0. **Itu dicabut — setter-nya tidak ada sama sekali.**
`minCollateralRatioBps` `immutable` sejak konstruktor.

Alasannya: setter yang bisa menurunkan lantai *adalah* kunci mint yang menyamar. Membatasi
"tidak boleh 0" hanya memperlambat penyerang, tidak menghentikannya — kunci yang dibajak
tinggal menurunkannya ke 1 bps. Pengaman yang bisa dimatikan pemiliknya bukan pengaman.
`InvalidRatio()` sekarang hanya dipakai sebagai validasi konstruktor.

### 7.5 `Observatory`

`ReserveLedger` tanpa token. Tidak punya owner, tidak punya mint. Deploy-able oleh siapa
pun terhadap `(chainKey, treasury, assets[])` apa pun. Mengekspos `reservesOf`,
`reserveValue`, `lastIngestedHeight`, dan event aliran untuk konsumsi dashboard.

### 7.6 `IProvenReserve` — standar publik (menggantikan A2 yang lebih kecil)

*Ditambahkan 9 Agustus 2026. Ini yang mengubah RT7 dari janji jadi infrastruktur.*

Vault **dan** observatory sama-sama mengimplementasikan antarmuka ini. Tujuannya bukan
kerapian internal — tujuannya agar **dApp Creditcoin mana pun bisa membaca cadangan
terbukti tanpa integrasi dan tanpa izin.**

```solidity
/// Cadangan yang dibuktikan lewat bukti inklusi Attestcoin.
/// Siapa pun boleh mengimplementasikan. Siapa pun boleh membaca.
interface IProvenReserve {
    /// Cadangan terbukti untuk satu aset, dalam desimal aset itu sendiri.
    function provenReserves(address asset) external view returns (uint256);

    /// Tinggi blok chain sumber terakhir yang buktinya sudah masuk.
    /// Pembaca WAJIB membandingkan ini dengan tinggi attestation dari ChainInfo 0x0fd3
    /// sebelum mempercayai angka di atas. Angka basi bukan angka salah — tapi tetap basi.
    function lastProvenHeight() external view returns (uint64);

    /// Lantai kolateral, dalam bps. type(uint256).max artinya tidak ada lantai
    /// (instance observatory — tidak ada yang dicetak di atasnya).
    function collateralFloorBps() external view returns (uint256);

    /// True kalau penerbitan sedang terkunci. Selalu false untuk observatory.
    function isIssuanceFrozen() external view returns (bool);
}
```

**Wajib ada minimal dua konsumen nyata** — satu contoh tidak cukup untuk membuktikan
sebuah standar:

| Konsumen | Yang dibuktikan |
|---|---|
| `examples/CollateralGatedVault.sol` | Menolak menerima token ini sebagai kolateral saat `isIssuanceFrozen()` atau rasio di bawah ambangnya sendiri |
| `examples/FreshnessGuard.sol` | Menolak **angka basi**: membandingkan `lastProvenHeight()` dengan ChainInfo `0x0fd3` dan revert kalau selisihnya melewati ambang. ~20 baris, dan **mengajarkan pola yang benar** ke integrator berikutnya |

⚠️ **Jangan gabungkan keduanya jadi satu contoh.** Yang kedua ada justru untuk
menunjukkan bahwa *membaca* feed ini pun punya kewajiban — dan itu sinyal kematangan
yang jarang dilihat juri.

Kalimat decknya:

> Kami tidak membangun aplikasi. Kami membangun angka yang bisa dibaca protokol lain —
> dan dua di antaranya sudah membacanya hari ini.

---

## 8. Off-chain worker

Permissionless secara desain: **keamanan datang dari proof, bukan dari siapa yang
mengirim**. Kalau worker issuer mati, siapa pun — termasuk pemegang token — bisa
menjaga angka cadangan tetap mutakhir.

### 8.1 State machine per transaksi

```
DISCOVERED ──► ATTESTED ──► PROVEN ──► SUBMITTED ──► CONFIRMED
     │             │           │           │
     └─────────────┴───────────┴───────────┴──► FAILED (retry backoff)
                                            └──► SKIPPED (permanen: NoRelevantTransfers,
                                                 receiptStatus!=1, sudah diproses on-chain)
```

### 8.2 Kewajiban (dari docs — semuanya wajib)

| Kewajiban | Implementasi |
|---|---|
| **Persistence** | Simpan tiap event yang ditemukan sebelum diproses. Tulis atomik (tmp + rename). |
| **Catch-up** | Cursor `lastScannedBlock` persisten. Saat restart, pindai dari cursor, bukan dari head. |
| **Dedup** | Kunci lokal per txHash **dan** cek `processedQueries[queryId]` on-chain sebelum submit — dedup yang selamat walau DB hilang. |
| **Retry** | Backoff eksponensial + `nextAttemptAt` per item. Jangan mengulang membabi buta. |
| **Node redundan** | Daftar RPC fallback untuk Ethereum dan Creditcoin. |

### 8.2b Jalur proof mandiri — `RawProofBuilder` *(ditambahkan 9 Agustus 2026)*

**Ini menutup satu-satunya ketergantungan server yang tersisa di seluruh sistem.**

Sampai sekarang worker memanggil **Proof Builder API milik Creditcoin**. Kalau server itu
mati atau kena rate limit (G3), pipeline berhenti, angka cadangan jadi basi — persis
kegagalan yang produk ini janji cegah. Dan klaim inti kita, *"berjalan sendiri tanpa
manusia"*, jadi bergantung pada mesin orang lain.

`RawProofBuilder` menghitung proof **secara lokal**: cukup RPC chain sumber +
`PrecompileChainInfoProvider`. **Nol server.**

```
ProofBuilder   (hosted)  → cepat, cached, tapi titik kegagalan eksternal
RawProofBuilder (lokal)  → mandiri penuh, tidak butuh siapa pun
```

**Keputusan: jalankan dua-duanya.** Hosted sebagai jalur utama (lebih cepat, ada cache),
`RawProofBuilder` sebagai **fallback otomatis** saat hosted gagal 3× berturut-turut atau
membalas 429/5xx. Worker tidak boleh pernah berhenti karena server orang lain.

Kalimat decknya — ekspresi paling murni dari tesis produk ini:

> **Kami tidak bergantung pada server siapa pun — termasuk server Creditcoin.**

⚠️ Verifikasi wajib (G4): bangun proof untuk **tx yang sama** lewat kedua jalur,
bandingkan **byte per byte**, lalu verifikasi dua-duanya on-chain. Ukur juga waktunya dan
apakah butuh archive node.

### 8.2c Perpendek continuity proof lewat ChainInfo *(ditambahkan 9 Agustus 2026)*

**Ini bukan sekadar sinyal kedalaman — ini penghematan gas yang terukur.**

Pengukuran 9 Agustus: transaksi Ethereum **yang sama persis** butuh **1 continuity root
di CC mainnet** tapi **21 di CC3 testnet**. Panjang continuity proof adalah **variabel
biaya yang dominan** (`[docs]`: biaya ≈ basis + 2,9×10⁻⁷ × jumlah continuity hash).

ChainInfo `0x0fd3` mengekspos fungsi pencari titik jangkar yang **belum kita pakai sama
sekali**:

| Fungsi | Kegunaan untuk worker |
|---|---|
| `get_attestation_bounds(chainKey, height)` | Batas bawah & atas terdekat, plus flag `parentIsAttestation` / `childIsAttestation` |
| `find_highest_attested_before(chainKey, height)` | Jangkar terdekat **sebelum** blok target |
| `find_lowest_attested_after(chainKey, height)` | Jangkar terdekat **sesudah** |
| `is_height_attested(chainKey, height)` | Cek cepat sebelum memanggil proof API sama sekali |
| `get_latest_checkpoint_height_and_hash(chainKey)` | **Checkpoint berbeda dari attestation** — jangkar alternatif yang bisa lebih dekat |

**Aturan worker:** sebelum meminta proof, panggil `is_height_attested`. Kalau `false`,
**jangan panggil proof API** — tunggu. Ini menghapus hampir semua error `BlockNotReady`
(Lampiran B.1) tanpa satu pun panggilan HTTP terbuang.

Lalu saat membangun batch, pilih rentang blok yang **jangkarnya paling dekat** — bukan
menerima apa pun yang kebetulan diberikan API. Ini langsung menyerang **G8** (biaya naik
>10× per hari umur transaksi).

⚠️ **Ukur penghematannya** dan catat angkanya. "Kami memperpendek continuity proof dari
N ke M root" adalah kalimat deck yang jauh lebih kuat daripada "kami memakai ChainInfo".

### 8.3 Detail yang akan menggigit kalau dilupakan

- **`eth_getLogs` rentang besar ditolak** banyak RPC publik. Pindai maks **20 blok**
  per permintaan di mainnet.
- **`estimateGas` pada precompile bisa gagal misterius** — `pallet-evm` tidak
  meneruskan revert reason saat mode estimasi. Pakai `sdk.utils.gas.computeGasLimit()`
  yang punya fallback heuristik berbasis panjang continuity proof.
- **Ingest cepat — dan sekarang ada angkanya (diukur 9 Agt, menggantikan klaim `[docs]`).**
  Panjang continuity proof melompat **~61×** kalau terlambat:

  ```
  ≤100 blok di belakang tinggi ter-attest  →  1 root     ← target
   150 blok                                → 11 root
  ≥200 blok, dan seterusnya SELAMANYA      → ~61 root    ← datar, tidak naik lagi
  ```

  Lag attestation 32–42 blok, jadi **jendela murahnya ~60 blok ≈ 12 menit**.
  Polling 1–2 menit aman dengan margin besar.

  ⚠️ **Tapi jangan pernah menandai transaksi lama sebagai `SKIPPED` karena biaya.**
  Biayanya **berhenti naik** — tx berumur 30 hari sama mahalnya dengan yang 40 menit.
  Aturannya: **prioritaskan yang baru, jangan buang yang lama.**

- **Beri margin ~10 blok di bawah tinggi ter-attest sebelum meminta proof.**
  Terukur: blok pada −0 dan −5 dari `get_latest_attestation_height_and_hash()` **gagal**
  dengan `BlockNotReady`; −10 berhasil. Pandangan proof API tertinggal sedikit di
  belakang ChainInfo. Tanpa margin ini: kegagalan misterius di awal tiap siklus.

- **Panggil `is_height_attested()` sebelum proof API**, bukan sesudah. Ini `eth_call`
  gratis dan menghapus hampir semua `BlockNotReady` tanpa satu pun HTTP terbuang.
- **`getBatchProof` mengembalikan `merkleProofs` kosong.** Ambil merkle proof per tx
  lewat `getProof()`, gabungkan manual dengan `continuityProof` bersama dari
  `getBatchProof`. `ContinuityProofBuilder` **tidak diekspor** — jangan mencarinya.
- **Nonce**: submit berurutan satu per satu, atau kelola nonce eksplisit.
- **Mode dry-run wajib ada**: jalankan seluruh pipeline sampai `staticCall` pada
  `ingest` tanpa membelanjakan gas. Ini yang membuat worker bisa diuji kapan saja.

### 8.4 Konfigurasi

```
CREDITCOIN_RPC, SOURCE_RPC[], SOURCE_CHAIN_KEY, LEDGER_ADDRESS,
TREASURY, ASSETS[], PROOF_API_URL, SCAN_CHUNK=20, BATCH_MAX=10,
BATCH_BLOCK_SPAN=1000, POLL_INTERVAL, DRY_RUN
```

`SOURCE_CHAIN_KEY` **harus** konfigurasi — nilainya berbeda antara CC3 testnet (3 =
ETH mainnet) dan Creditcoin mainnet (1 = ETH mainnet).

### 8.5 Deployment & operasi — worker WAJIB hidup tanpa dijaga

**Keputusan terkunci: VPS**, jalan sebagai systemd service, restart otomatis.

*GitHub Actions cron sempat dipertimbangkan dan ditolak.* Secara teknis viable (worker
kita hampir stateless, repo publik = menit gratis), tapi cron GitHub **best-effort** —
sering telat 5–30 menit, kadang di-skip, interval minimum 5 menit, dan scheduled workflow
mati sendiri setelah 60 hari repo tidak aktif. Untuk sistem yang seluruh pitch-nya
"berjalan sendiri tanpa manusia", ketidakpastian itu tidak sepadan. Jangan dibuka ulang.

#### Kenapa ini tidak bisa ditunda

Submission **6 September**, pengumuman pemenang **18 September**. Juri akan membuka
dashboard **berhari-hari sampai berminggu-minggu setelah video direkam.**

Kalau worker cuma jalan di laptop, juri melihat angka yang beku di tanggal terakhir
laptop menyala — dan klaim inti kita, *"sistem ini berjalan sendiri tanpa manusia"*,
runtuh persis di depan orang yang menilainya.

**Syarat operasional: hidup tanpa intervensi minimal 2 minggu.**

#### Desain hampir-stateless — ini yang membuat operasinya mudah

Sumber kebenaran worker **sudah ada di on-chain**:

| Yang dibutuhkan worker | Sumbernya on-chain |
|---|---|
| Sudah pernah diproses? | `processedQueries[queryId]` |
| Sampai blok berapa? | `lastIngestedHeight` |

Jadi worker **membangun ulang posisinya dari kontrak saat start**. Database lokal adalah
**optimasi kecepatan, bukan syarat kebenaran**.

Konsekuensi praktis: worker yang mati bisa dinyalakan lagi **di mesin mana pun**, tanpa
memulihkan apa pun. Tidak perlu disk persisten, tidak perlu backup, tidak perlu takut
kehilangan state.

⚠️ **Satu pengecualian:** transaksi yang di-`ingest` lalu revert `NoRelevantTransfers`
**tidak tercatat on-chain**, jadi worker stateless akan mencobanya berulang selamanya.
Karena scanner memfilter ketat (`address = aset` **dan** `topics` menyentuh treasury),
kasus ini seharusnya nyaris tidak terjadi — cukup ditangani daftar-lewat di memori.
Kalau ternyata sering muncul, filter scanner-nya yang salah, bukan worker-nya.

#### Setup VPS — RUNBOOK LENGKAP (ditulis 9 Agustus 2026, G13)

**Keputusan spesifikasi — jangan diperdebatkan lagi, langsung eksekusi:**

| Item | Nilai | Alasan |
|---|---|---|
| Provider | **Hetzner CX22** (~€4/bln) atau **DigitalOcean Basic** ($6/bln) | Dua-duanya punya IPv4, tidak tidur, dan billing per jam |
| Spesifikasi | **2 vCPU / 4 GB / 40 GB** | Jauh berlebih. Beban nyata: beberapa panggilan RPC + sesekali 1 tx |
| OS | **Ubuntu 24.04 LTS** | Node 20+ dari NodeSource, systemd standar |
| Region | mana pun yang dekat | Latensi tidak relevan — lag attestation 9 menit |
| Umur sewa | **minimal sampai 30 September 2026** | Pengumuman 18 Sept + margin |

⚠️ **Yang harus KAMU lakukan** (aku tidak bisa membuat akun atau memasukkan detail
pembayaran): daftar provider, buat server, tambahkan SSH key. Sisanya di bawah tinggal
disalin.

```bash
# ── 1. Hardening dasar (5 menit) ───────────────────────────────────────
adduser --disabled-password --gecos "" corolary
usermod -aG sudo corolary
mkdir -p /home/corolary/.ssh && cp ~/.ssh/authorized_keys /home/corolary/.ssh/
chown -R corolary:corolary /home/corolary/.ssh && chmod 700 /home/corolary/.ssh
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/;s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
ufw allow OpenSSH && ufw --force enable
timedatectl set-timezone UTC && timedatectl set-ntp true

# ── 2. Node LTS ────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

```ini
# ── 3. /etc/systemd/system/corolary-worker.service ─────────────────────
[Unit]
Description=Corolary reserve worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=corolary
WorkingDirectory=/home/corolary/corolary/packages/worker
EnvironmentFile=/etc/corolary/worker.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
# Pengaman: worker yang bocor memori tidak boleh membunuh server
MemoryMax=512M
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/corolary/corolary/packages/worker/data

[Install]
WantedBy=multi-user.target
```

```bash
# ── 4. Kunci operator — permission 600, DI LUAR repo ───────────────────
install -d -m 700 /etc/corolary
cat > /etc/corolary/worker.env <<'EOF'
OPERATOR_PRIVATE_KEY=0x...
CREDITCOIN_RPC=https://rpc.cc3-testnet.creditcoin.network
SOURCE_RPC=https://ethereum-rpc.publicnode.com,https://eth.llamarpc.com,https://1rpc.io/eth
SOURCE_CHAIN_KEY=3
POLL_INTERVAL=90
HEALTHCHECK_URL=https://hc-ping.com/<uuid>
EOF
chmod 600 /etc/corolary/worker.env

# ── 5. Rotasi log — WAJIB, ini pembunuh worker jangka panjang #1 ───────
cat > /etc/systemd/journald.conf.d/corolary.conf <<'EOF'
[Journal]
SystemMaxUse=500M
MaxRetentionSec=1month
EOF
systemctl restart systemd-journald

systemctl daemon-reload && systemctl enable --now corolary-worker
```

**Dead-man's switch (wajib, gratis, 10 menit):** buat cek di
[healthchecks.io](https://healthchecks.io) dengan **period 10 menit, grace 20 menit**,
alert ke email **dan** Telegram. Worker ping URL-nya **setiap loop yang sukses** — bukan
setiap loop. Loop yang gagal harus **diam**, karena diam itulah yang memicu alarm.

**Verifikasi setelah 48 jam** (definition-of-done G13):
```bash
systemctl status corolary-worker          # active, Restart count wajar
journalctl -u corolary-worker --since -48h | grep -ci error
df -h /                                    # disk TIDAK naik terus
cast balance <operator> --rpc-url $RPC     # gas masih cukup sampai 30 Sept
```

⚠️ **Empat pembunuh worker jangka panjang, urut kemungkinan:** disk penuh karena log ·
provider RPC mengubah rate limit · saldo gas habis · memory leak di proses Node yang
hidup berminggu-minggu. `MemoryMax` dan rotasi log di atas menutup dua yang pertama.

#### Penanganan kunci

- **Akun operator TERPISAH dari deployer.** Isi secukupnya (mis. 100 tCTC — cukup
  untuk jutaan ingest), jangan taruh 10.000 tCTC di server.
- Kunci lewat **environment variable / systemd `EnvironmentFile`** dengan permission
  `600`. **Jangan** di dalam image, repo, atau file yang ter-commit.
- Testnet-only, tapi kebiasaannya harus benar sejak awal.

#### Bagaimana kita tahu worker mati?

Karena kita memilih **VPS tunggal tanpa cadangan**, worker adalah satu-satunya titik
kegagalan. Kalau dia mati diam-diam, dashboard membeku dan juri melihat angka basi.
Jadi butuh dua lapis:

**Lapis 1 — dead-man's switch (wajib, gratis).**
Worker mengirim ping ke [healthchecks.io](https://healthchecks.io) atau sejenisnya setiap
loop yang sukses. Kalau ping berhenti melebihi ambang, kamu dapat email/Telegram otomatis.
Setup 10 menit, dan ini satu-satunya cara kamu tahu VPS mati jam 3 pagi.

**Lapis 2 — dashboard sebagai monitor publik.** Bandingkan dua angka yang keduanya publik:

```
lastIngestedHeight (dari kontrak)  vs  tinggi attestation terkini (dari ChainInfo 0x0fd3)
```

Kalau selisihnya melebihi ambang wajar (`maxStalenessBlocks` = **63** testnet / **111**
mainnet — turunan dari batas atas pita lag, `01-riset-mendalam.md` §1.5d),
berarti ada yang salah. **Tampilkan ini di dashboard sebagai indikator kesegaran**
(lihat §9.1) — dan karena kedua angkanya dibaca langsung dari chain, **siapa pun bisa
memantau kesehatan sistem kita tanpa bergantung pada kita.**

Itu bukan sekadar monitoring. Itu konsisten dengan tesis produk.

#### Kemas sebagai Docker image — ini aset submission

`ingest()` **permissionless**: keamanannya dari proof, bukan dari siapa pengirimnya.
Jadi kemas worker sebagai **Docker image + README sekali jalan**.

Ini membuktikan klaim di deck secara harfiah:

> Kalau worker issuer mati, siapa pun bisa menjaga angka cadangan tetap mutakhir —
> termasuk pemegang tokennya sendiri.

Juri bisa menjalankannya sendiri. Sedikit klaim di hackathon yang bisa diuji semudah itu.

---

## 9. Dashboard

### 9.0 Sumber data — KEPUTUSAN TERKUNCI

**Frontend membaca LANGSUNG dari chain. Tidak ada API server, tidak ada backend perantara.**

Ini bukan sekadar pilihan teknis — ini **konsekuensi dari tesis produk**. Seluruh pitch
kita adalah *"jangan percaya laporan siapa pun, baca sendiri rantainya"*. Kalau dashboard
kita sendiri membaca dari server kita, kita melakukan persis hal yang kita kritik, dan
juri bisa membunuhnya dengan satu kalimat: *"bagaimana saya tahu server kalian tidak
berbohong?"*

Efek samping yang menguntungkan: frontend dan worker jadi **benar-benar terpisah**.
Frontend hanya bergantung pada ABI + alamat kontrak. Worker boleh ditulis ulang total
tanpa menyentuh frontend.

**Pembagian, mengikuti batas RPC terukur (`01-riset-mendalam.md` §1.5c):**

| Data | Cara | Aturan |
|---|---|---|
| `reserves()`, `collateralRatioBps()`, `totalSupply()`, `mintableHeadroom()`, `isMintingFrozen()` | **`eth_call`** | **Selalu segar. Dilarang di-cache.** Ini yang menentukan kepercayaan. |
| Feed bukti | `eth_getLogs`, **maks 10.000 blok** | Satu permintaan ~3 dtk ≈ 42 jam riwayat |
| Riwayat lebih dalam | Cache inkremental `localStorage` | Cache milik pengguna atas data chain — bukan laporan server |

**Wajib ada di UI:** alamat kontrak dan endpoint RPC ditampilkan terbuka, dengan tautan
"verify yourself". Ubah keterbatasan jadi momen demo.

### 9.1 Isi halaman

Satu halaman, dibaca dari kejauhan saat demo:

1. **Rasio kolateral raksasa** + status: `TERKUNCI` / `MEMBEKU`
2. **Cadangan terbukti vs suplai beredar**, per aset
3. **Headroom minting** — berapa lagi yang boleh dicetak
4. **Feed bukti** — tiap baris satu ingest: jumlah, arah, tautan ke **Etherscan**
   (tx sumber di Ethereum) dan **Blockscout** (tx ingest di Creditcoin).
   Dua tautan ini yang membuat juri percaya ini nyata.
5. **Panel serangan** — tombol "coba cetak melebihi cadangan" → tampilkan revert
   `WouldBreachCollateralFloor` beserta pesan errornya.
   ⚠️ **Dirancang untuk wallet pengunjung, bukan wallet kita (A3).** Karena lantai
   kolateral dicek sebelum otorisasi, siapa pun mendapat error yang benar. Efek
   sampingnya: panel ini **tidak bisa jadi mock walaupun mau** — memicu revert sungguhan
   lebih mudah daripada memalsukannya.
6. **Pemilih observatory** — arahkan ke issuer mainnet sungguhan. Label: *proven
   collateral*, **bukan** solvency (RT11).
7. **Indikator kesegaran** — `lastIngestedHeight` (kontrak) vs tinggi attestation
   terkini (ChainInfo `0x0fd3`). Selisih wajar ≈ lag normal; kalau membengkak, worker
   bermasalah. **Ini sekaligus monitor kesehatan sistem** (§8.5) — dan karena kedua
   angkanya dari chain, siapa pun bisa memantaunya tanpa bergantung pada kita.
8. **Blok "jalankan worker-nya sendiri" (A4)** — perintah `docker run` sekali-jalan yang
   bisa disalin. `ingest()` permissionless, jadi klaim *"kalau worker issuer mati, siapa
   pun bisa menjaga angkanya tetap mutakhir"* bisa diuji pengunjung dalam 60 detik —
   bukan sekadar kalimat di deck.

### 9.2 Lapisan manusia — ditambahkan 9 Agustus 2026

Delapan butir di atas adalah **tampilan auditor**. Mereka benar, dan mereka dingin.
Grand prize musim 1 jatuh ke produk yang jurinya bisa **membayangkan orang memakainya**.

**Prinsip yang mengikat:** setiap permukaan ramah **wajib punya aksi on-chain nyata di
baliknya.** Kalau tidak ada, itu mock — dan mock adalah gerbang rilis yang gagal.
Empat permukaan di bawah semuanya lolos syarat itu.

**9. Holder view — halaman utama untuk manusia, bukan untuk auditor.**

Orang biasa tidak bertanya "berapa collateral ratio bps". Dia bertanya tiga hal:

| Pertanyaan | Jawaban di layar | Sumber data |
|---|---|---|
| *"Uangku masih ada?"* | **"Uangmu didukung penuh."** Setiap 1 token beredar punya $1,25 yang terbukti ada di Ethereum. Diperiksa 4 menit lalu | `eth_call` `collateralRatioBps()` + `lastIngestedHeight` |
| *"Bisa aku ambil?"* | Tombol **Tebus** yang berfungsi, dari wallet pengunjung | `redeem()` sungguhan |
| *"Dikasih tahu kalau ada apa-apa?"* | *"Kolateral terbukti X turun $2,1 juta dalam 6 menit"* — satu kalimat, bukan grafik | `eth_getLogs` `ReserveOutflow` |

**Dua lapis, bukan satu.** Kalimat manusia di atas, angka teknis **satu klik di bawahnya**.
Juri teknis tetap mendapat yang mereka mau; orang biasa mendapat jawaban.

**10. `redeem()` sebagai poros emosional — ini aset yang sudah jadi dan belum dinamai.**

Perhatikan pola setiap korban 2026: StablR → *mint dan redemption dibekukan*.
Zondacrypto → *penarikan dihentikan*. **Itu selalu momen orang kehilangan uangnya.**

`redeem()` kita tanpa syarat, di kontrak yang **tidak bisa di-upgrade** (RT9). Maka:

> **Pintu keluarnya tidak punya kunci. Tidak di tangan penerbitnya. Tidak di tangan kami.**

Tagline auditor tetap *"Solvency isn't claimed. It follows."* Kalimat di atas adalah
tagline manusianya. Dua-duanya dipakai, di tempat yang berbeda.

⚠️ **Lubang yang WAJIB dinyatakan sendiri, jangan tunggu ditanya.** Juri akan bertanya:
*"Saya `redeem()`, token saya terbakar — lalu USDC saya di Ethereum keluar dari mana?
Protokolnya satu arah."* Jawabannya:

> `Corolary` tidak menjamin issuer membayar. Yang dijamin: **klaimmu tidak pernah bisa
> diencerkan**, dan `redeem()` mencatat **permintaan tebus yang tidak bisa disangkal
> pernah diterima** — permanen, on-chain, dengan cap waktu.

Itu bukan tambalan. Itu **model asli Creditcoin**: catatan on-chain tak terbantahkan
sebagai dasar recourse dunia nyata. Dan saat writability Attestcoin rilis, instruksi
pembayarannya bisa didorong balik ke Ethereum — **sebut sebagai roadmap, bukan kemampuan.**

**11. Papan skor pembobolan — satu-satunya gamifikasi yang jujur.**

Karena lantai kolateral dicek sebelum otorisasi (A3), **siapa pun** boleh mencoba
mencetak melebihi cadangan. Dan karena kunci issuer **diterbitkan** (RT12), tidak ada
lagi alasan untuk tidak mencoba.

```
Kunci issuer: dipublikasikan di README
Percobaan pencetakan tanpa jaminan : 1.247
Berhasil                           : 0
```

Dihitung dari transaksi revert **yang benar-benar ada di Blockscout** — tidak bisa
dipalsukan bahkan kalau mau. Dan angkanya **tumbuh sendiri** selama 12 hari antara
submission (6 Sept) dan penjurian (18 Sept): saat juri membuka, angkanya lebih besar
daripada di video.

**12. Tiga hal yang DILARANG di lapisan ini.**

- ❌ **Aplikasi fintech palsu** dengan akun & saldo karangan. Itu mock, dan itu yang
  pernah menggagalkan submission sebelumnya.
- ❌ **Menyembunyikan lapisan teknis.** Jurinya teknis. Dua lapis, bukan satu.
- ❌ **Onboarding/wallet yang ribet.** Setiap langkah sebelum juri melihat angka pertama
  adalah kerugian.

### 9.3 Audit nol-mock — setiap elemen wajib punya asal-usul on-chain

Tabel ini adalah **checklist Fase 6c**. Kalau ada baris di UI yang tidak muat di sini,
baris itu **dihapus**, bukan diberi label.

| Elemen UI | Sumber on-chain | Cara memicunya secara nyata |
|---|---|---|
| Rasio raksasa + `TERKUNCI`/`MEMBEKU` | `eth_call collateralRatioBps()` | kondisi normal / tarik dana treasury Sepolia |
| Cadangan vs suplai per aset | `eth_call reservesOf()`, `totalSupply()` | ingest berjalan |
| Headroom minting | `eth_call mintableHeadroom()` | ingest berjalan |
| Feed bukti (2 tautan) | `eth_getLogs` ≤10.000 blok | ingest berjalan |
| Panel serangan + pesan revert | `mint()` sungguhan dari wallet pengunjung | klik tombol |
| **Papan skor pembobolan** | hitung revert `WouldBreachCollateralFloor` dari log Creditcoin | pengunjung mana pun |
| Pemilih observatory | instance `Observatory` terdeploy | konfigurasi target §3.5 |
| Indikator kesegaran | `lastIngestedHeight` vs ChainInfo `0x0fd3` | matikan worker sebentar |
| **Holder view: saldo & status** | `eth_call balanceOf()`, `collateralRatioBps()` | wallet pengunjung |
| **Holder view: tombol Tebus** | `redeem()` sungguhan | wallet pengunjung |
| Blok `docker run` (A4) | teks statis — **satu-satunya yang boleh statis**, dan wajib benar-benar jalan | salin & jalankan |
| Panel "verify yourself" | alamat dari `deployments/*.json` | — |
| RPC mati | state UI tersendiri: **"RPC unreachable"** | arahkan ke endpoint mati |

⚠️ **Tidak ada baris "coming soon". Tidak ada chart hiasan. Tidak ada fallback ke mock
saat RPC gagal.** Angka palsu yang terlihat sehat adalah kegagalan terburuk yang bisa
dilakukan produk yang seluruh tesisnya *"angka ini tidak bisa dikarang"*.

### 9.4 Di mana dashboard hidup — KEPUTUSAN (G21, 9 Agustus 2026)

Seluruh dokumen ini membahas VPS untuk **worker**, dan **tidak pernah** membahas di mana
**dashboard** tinggal. Itu lubang dengan mode kegagalan yang identik: juri membuka
dashboard **berminggu-minggu** setelah video direkam.

**Keputusan: host statis, bukan server.**

Frontend membaca langsung dari chain (§9.0) — **tidak ada backend sama sekali**. Jadi
outputnya berkas statis, dan berkas statis tidak bisa "tidur", tidak bisa crash, dan
tidak butuh dijaga. Ini konsekuensi arsitektur yang sudah kita pilih, bukan kebetulan.

| Syarat | Kenapa mutlak |
|---|---|
| **URL produksi tetap** — bukan preview per-deploy | Tautan di submission tidak boleh berubah setelah 6 Sept |
| **Tidak pernah tidur / tanpa cold start** | Juri tidak akan menunggu. Free tier yang tidur = halaman mati |
| **Hidup ≥ 30 September 2026** | Pengumuman 18 Sept + margin |
| **Deploy dari bundle pasca-Fase 6c** | Nol mock. Cek tanggal build sebelum submit |
| **HTTPS + custom domain opsional** | Domain sendiri terlihat matang; subdomain host juga sah |

**Pilihan yang memenuhi semuanya** (statis, tier gratis, tidak tidur):
Cloudflare Pages · Vercel · Netlify · GitHub Pages.
Ambil mana pun — ini bukan keputusan yang layak diperdebatkan.

⚠️ **Yang harus KAMU lakukan:** buat akunnya dan hubungkan repo. Aku tidak bisa membuat
akun. Sisanya di bawah adalah aturan yang mengikat.

**Empat aturan yang mengikat:**

1. **Deploy dari branch produksi**, bukan dari branch kerja. Satu deploy dari branch yang
   salah = juri melihat versi ber-mock, dan gerbang Fase 6c bocor tanpa ada yang sadar.
2. **`NEXT_PUBLIC_DATA_SOURCE` tidak boleh ada nilai `mock` di environment produksi.**
   Build wajib `throw` kalau ada (§`08-kerja-paralel.md` §5.0).
3. **Catat URL final di `deployments/<network>.json`**, bukan di kepala. Deck, README,
   video, dan form submission semuanya menunjuk ke sana.
4. **Jangan pakai preview URL di materi apa pun.** Preview berubah tiap commit.

**Uji akhir sebelum submission — wajib, dan gampang dilewatkan:**

- [ ] Buka dashboard **48 jam setelah deploy terakhir**, dari **jaringan berbeda** dan
      **mode incognito**. Angka pertama harus muncul <3 detik. Kalau lebih, hostnya
      tidur — ganti.
- [ ] Buka dari **ponsel**. Juri akan melakukannya.
- [ ] Matikan RPC di config lalu buka — harus muncul **"RPC unreachable"**, bukan angka.
- [ ] Buka lagi **H-1 pengumuman (17 September)** dan pastikan masih hidup & segar.

## 10. Alur demo

> 📌 **URUTAN DEMO PINDAH KE `09-narasi-dan-deck.md` §3.**
> Versi 5 langkah yang dulu ada di sini **sudah usang** — dia membuka dengan dashboard,
> belum memuat kunci issuer publik (RT12), holder view, maupun konsumen `IProvenReserve`.
> Alur final adalah **7 beat: korban → deteksi → pencegahan → otonomi → pengguna →
> platform → batas.** Jangan pakai dua versi; `09` §3 yang berlaku.

Yang tetap tinggal di sini adalah **batasan teknis** yang mengikat urutan apa pun:

| Batasan | Konsekuensi untuk demo |
|---|---|
| Sumber kebenaran **mainnet**, panggung terpicu **Sepolia** | Penarikan yang bisa kita kendalikan hanya di Sepolia |
| Attestation 32–42 blok (~7–9 menit) | **Picu penarikan Sepolia di detik pertama rekaman**, kerjakan beat lain sambil menunggu (RT3) |
| Token RWA institusional (BUIDL, USDY, USTB) **nol event / 20 menit** | Bagus untuk bobot naratif, **haram** jadi tulang punggung demo live. **Pacu demo dengan USDC/USDT** |
| Observatory tidak membuktikan kewajiban (RT11) | Sebut **proven collateral**, bukan *solvency* |
| Panel serangan permissionless (A3) | Juri bisa memanggil `mint()` dari wallet sendiri — **serahkan giliran ke mereka**, jangan cuma tunjukkan |
| Kunci issuer publik (RT12) | Adegan pamungkasnya bukan revert-nya, tapi kalimat *"kuncinya ada di README — coba sendiri"* |
| `redeem()` tanpa syarat | Juri bisa menebus dari wallet sendiri. Itu **aksi pengguna nyata**, bukan peragaan |

⚠️ **Jangan merekam sebelum gerbang Fase 6c lolos.** Materi juri lahir setelah nol-mock.

---

## 11. Struktur repo (scaffold dari nol)

```
corolary/
├── CLAUDE.md  PROGRESS.md  README.md      berdua · README → Inggris sebelum submit
├── .env                                    gitignored — kunci deployer
├── .gitignore                              WAJIB memuat .env*  dan  *.tar.gz
├── docs/                                   berdua
├── deployments/
│   ├── cc3-testnet.json                    ⚙️ dihasilkan backend · 🎨 dibaca frontend
│   └── cc-mainnet.json                     nanti — chainKey BEDA, jangan hardcode
├── packages/
│   ├── contracts/                 ⚙️ Foundry
│   │   ├── src/
│   │   │   ├── ReserveLedger.sol
│   │   │   ├── SolvencyLockedToken.sol            mint · mintWithProof · redeem
│   │   │   ├── Observatory.sol
│   │   │   ├── examples/CollateralGatedVault.sol   konsumen 1 — §7.6
│   │   │   ├── examples/FreshnessGuard.sol         konsumen 2 — §7.6, WAJIB ada
│   │   │   ├── interfaces/INativeQueryVerifier.sol keempat varian + overload batch
│   │   │   ├── interfaces/IProvenReserve.sol       standar publik — §7.6
│   │   │   ├── libraries/TransferLogParser.sol
│   │   │   └── babak5/                             OPSIONAL — §14, jangan di jalur kritis
│   │   │       ├── BaseStateRootRegistry.sol       versi 80/20, kerjakan ini dulu
│   │   │       └── MerklePatriciaProof.sol         hanya kalau versi penuh dikerjakan
│   │   ├── test/                  fixture tx NYATA — termasuk replay Resolv & StablR (A1)
│   │   ├── script/Deploy.s.sol
│   │   └── foundry.toml           via_ir=true · link EvmV1Decoder
│   ├── worker/                    ⚙️ Node + TypeScript
│   │   ├── src/{config,store,scanner,attest,proof,submit,pipeline}.ts
│   │   └── Dockerfile             aset submission — juri menjalankannya sendiri (A4)
│   └── web/                       🎨 Next.js
│       ├── src/abi/*.json                  disalin backend dari forge build
│       ├── src/data/source.ts              ⚠️ SATU-SATUNYA pintu data
│       └── src/mocks/**                    ⚠️ DIHAPUS di Fase 6c
└── tools/
    ├── recon/                     ⚙️ skrip pengukuran = alat regresi
    └── verify-no-mock.sh          berdua — gerbang rilis
```

⚙️ = backend · 🎨 = frontend. Batas folder **adalah** batas kepemilikan; peta lengkapnya
di `08-kerja-paralel.md` §2.

**Tiga hal yang menentukan bentuk ini, bukan selera:**

1. **Tidak ada `packages/api`.** Frontend baca langsung dari chain (§9.0, dikunci).
   Kalau suatu saat muncul folder server, ada asumsi produk yang baru saja patah.
2. **`deployments/*.json` satu-satunya sumber alamat.** Tidak pernah ada alamat kontrak
   yang ditempel di kode — dan `sourceChainKey` beda antar lingkungan, jadi hardcode
   akan pecah diam-diam saat migrasi mainnet.
3. **`src/data/source.ts` satu pintu, `src/mocks/**` satu kandang.** Ini yang membuat
   mock bisa dicabut sekali gerak di Fase 6c dan membuat `verify-no-mock.sh` berarti.

### Catatan `foundry.toml` yang menghemat berjam-jam

```toml
solc = "0.8.24"
via_ir = true          # ingest membawa 7 parameter + struct hasil decode;
                       # codegen lama kehabisan slot stack tanpa ini
evm_version = "paris"

# EvmV1Decoder punya fungsi library `public` → library EKSTERNAL, wajib di-link.
# CC3 Testnet sudah punya instance-nya; link ke sana, jangan deploy ulang 60KB.
libraries = ["…/EvmV1Decoder.sol:EvmV1Decoder:0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f"]
```

⚠️ Alamat decoder itu **hanya berlaku di CC3 testnet**. Di Creditcoin mainnet library
ini **belum ada** — harus dideploy sendiri lalu di-link ulang.

---

## 12. Jalur ke produksi (mainnet)

**Sudah diverifikasi 2 Agustus 2026: produk ini mainnet-able.** Attestcoin live di
Creditcoin mainnet (chainId 102030) dan `verifySingle` atas tx Ethereum mainnet
sungguhan mengembalikan `true`.

⚠️ **DIPERBARUI 9 Agustus 2026 — dua hambatan yang tercatat di sini ternyata tidak ada.**
Jalur produksi sekarang **bebas hambatan sepenuhnya**.

| | CC3 Testnet | Creditcoin Mainnet |
|---|---|---|
| chainKey ETH mainnet | `3` | **`1`** — satu-satunya selisih yang tersisa |
| `EvmV1Decoder` | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` | ✅ **`0x9D094C9f22B10FCf842c2fC6A0981630A4F94B5C`** — sudah ada, tidak perlu deploy |
| Proof API | `proof-gen-api.cc3-testnet…` ✅ 200, ~0,9 dtk | ✅ **`proofbuilder.cc3-mainnet-usc…`** 200, ~1,05 dtk, TLS valid |
| Lag attestation | **pita 32–42 blok** (~6,9–9,0 mnt) | **pita 65–73 blok** (~13,0–14,6 mnt) |
| Continuity roots (tx sama) | **21** | **1** → ingest mainnet justru **lebih murah** |
| `attestationWindowBlocks` / `maxStalenessBlocks` | 42 / 63 | 74 / 111 |

**Konsekuensi strategis:** klaim *"produk ini mainnet-able"* bukan lagi teoretis —
seluruh jalurnya sudah diuji hidup. Ini bahan deck, dan bahan due diligence CEIP.

## 13. Di luar cakupan v1

- **Penilaian harga aset.** Tidak ada price oracle. Hanya aset ber-unit-of-account sama.
- **Cadangan off-chain.** T-bill di kustodian tidak terlihat. Dinyatakan terus terang.
- **Likuidasi di Ethereum.** Protokol satu arah; kita tidak bisa dan tidak berpura-pura bisa.
- **Chain sumber selain Ethereum.** Jangan pernah menulis kata "omnichain".
- **Membuktikan SALDO di Ethereum.** ⚠️ Ditambahkan 9 Agt: ini bukan pilihan, ini
  **mustahil secara protokol** — attestation tidak menyentuh `stateRoot` Ethereum
  (`01-riset-mendalam.md` §1.7). Kita membuktikan **setiap pergerakan**, bukan saldo.
- **Risiko nilai kolateral.** Balance Coin (Jul 2026) dan apxUSD (Jun 2026) di luar
  cakupan. Kita menutup risiko **penerbitan**, bukan risiko **harga**.

---

## 14. Babak 5 — membuktikan SALDO lewat state root Base *(opsional, plafon ambisi)*

*Ditambahkan 9 Agustus 2026. Turunan langsung dari `01-riset-mendalam.md` §1.7.*

⚠️ **PAGAR YANG TIDAK BOLEH DILANGGAR: demo tidak boleh bergantung pada babak ini.**
Kalau jadi, dia 45 detik terakhir video dan slide terkuat di deck. Kalau tidak jadi,
tidak ada satu pun bagian lain yang goyah. Jangan pernah masuk jalur kritis.

### 14.1 Ide dalam satu kalimat

Attestcoin hanya membuktikan **kejadian**. Maka satu-satunya keadaan yang bisa dibuktikan
adalah keadaan yang **diterbitkan sebagai kejadian** — dan tepat satu kelas sistem
melakukan itu sebagai pekerjaan utamanya: **rollup**.

> **`Corolary` tidak bisa membuktikan saldo di Ethereum. `Corolary` bisa membuktikan
> saldo di Base.** Bukan karena kami menambah chain — tapi karena Base menerbitkan
> keadaannya ke Ethereum, dan Ethereum adalah yang kami baca.

### 14.2 Jalur ingest kedua

Yang lama tidak disentuh sama sekali.

| Jalur | Membaca | Menghasilkan |
|---|---|---|
| `ingest()` | event `Transfer` di Ethereum L1 | aliran masuk/keluar |
| **`ingestAnchor()`** | tx L1 yang memuat `rootClaim` Base | **saldo absolut treasury di Base** |

```solidity
function ingestAnchor(
    IngestParams calldata p,       // bukti Attestcoin atas tx L1 DisputeGameFactory
    bytes32[4] calldata preimage,  // versionByte ‖ stateRoot ‖ withdrawalRoot ‖ l2BlockHash
    bytes[]   calldata accountProof, // MPT: akun token di state trie L2
    bytes[]   calldata storageProof  // MPT: slot balanceOf[TREASURY]
) external returns (uint256 provenBalance, uint64 l2Block);
```

Tiga langkah:
1. Attestcoin membuktikan tx L1-nya. **`rootClaim` datang dari LOG, bukan calldata** —
   diukur 9 Agt, dia ada di `topic3` (indexed). Artinya jalurnya **identik dengan
   `Transfer`** yang sudah kita pakai: `getLogsByEventSignature()`, tanpa parsing calldata.
2. `keccak256(preimage) == rootClaim` → **`stateRoot` L2 terpulihkan.** Satu keccak.
3. MPT proof akun → `storageRoot` token; MPT proof slot → **saldo terbukti**.

**Konstanta hasil ukur (9 Agustus 2026) — masuk konfigurasi `immutable`:**

```
event   DisputeGameCreated(address indexed, uint32 indexed, bytes32 indexed)
topic0  0x5b565efe82411da98814f356d0e7bcb8f0219b8d970307c5afb4a6903a8b2e35
        → rootClaim = topics[3]   ·   gameType = topics[2]

factory Base di L1 : 0x43edb88c4b80fdd2adff2412a7bebf9df42cb40e
gameType Base      : 621          ⚠️ terlihat juga 1, 8, 42, 1337 dari chain lain
frekuensi usulan   : ~3/jam, jarak ~94 blok (~19 menit)

USDC di Base       : 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
slot balanceOf     : 9            ✅ diverifikasi 3/3 holder nyata
kunci storage      : keccak256( pad32(holder) ‖ pad32(9) )

ukuran bukti       : 9 node akun + 8 node storage ≈ 7.440 byte
                     ≈ 116.000 gas = 0,15% block limit → BUKAN kendala
```

⚠️ **Filter WAJIB dua-duanya, jangan salah satu:** alamat factory **dan** `gameType`.
Ada **21 factory aktif** di Ethereum L1 dalam satu jam pemindaian; sebagian besar milik
chain lain. Menerima `gameType` yang salah = menerima root dari permainan permissioned
atau uji, bukan fault proof sungguhan.

### 14.3 Akuntansi

```
reservesOf(asset) = anchorBalance[asset]
                  + inflowSince(anchorHeight) − outflowSince(anchorHeight)
```

⚠️ **`ingest()` dengan `height <= anchorHeight` WAJIB ditolak.** Order-independence
(§7.2) tetap utuh **di dalam** segmen setelah anchor, tapi tidak lagi lintas anchor.
Tulis alasannya di komentar kode — ini akan terlihat aneh tanpa penjelasan.

### 14.4 Aturan arah aman asimetris — **bagian paling penting di seluruh babak ini**

Di Base, usulan output root **permissionless** (bond 0,08 ETH, masa tantangan ~3,5 hari,
finalisasi ~7 hari). Artinya root yang salah **bisa** masuk sebelum ditantang. Juri yang
paham OP Stack akan menyerang persis di sini.

Jawabannya adalah doktrin §7.2 kita sendiri — *arah kesalahan harus selalu aman* —
diterapkan ke domain kepercayaan baru:

| Anchor yang… | Sumber yang diterima | Alasan |
|---|---|---|
| **Menurunkan** cadangan terbukti | root yang **baru diusulkan**, langsung | Kalau salah, kita cuma terlalu pelit. Tidak ada yang rugi. |
| **Menaikkan** cadangan terbukti | **hanya** setelah dispute game selesai (defender menang) | Kalau salah, kita mencetak tanpa jaminan. Haram. |

**Dan resolusi dispute game itu sendiri adalah event di Ethereum L1** — jadi bukti
finalisasinya datang lewat Attestcoin juga. **Tidak ada pihak baru yang dipercaya.
Tidak ada oracle. Tidak ada bridge.**

`mint()` memakai `finalizedReserves()`. Dashboard boleh menampilkan
`provisionalReserves()` **dengan label terpisah yang jelas**. Dua angka, dua-duanya jujur.

⚠️ **RT11 TIDAK batal.** Kita membuktikan kolateral absolut, bukan kewajiban issuer.
Tidak ada penyebut → tetap **proven collateral**, bukan *solvency*. Jangan mengendurkan
istilah hanya karena angkanya jadi lebih bagus.

### 14.5 Empat ranjau — semuanya sudah jadi gap terbuka

| Ranjau | Status 9 Agt | Sisa pekerjaan |
|---|---|---|
| Slot `balanceOf` salah = saldo salah tanpa error | ✅ **G16 ditutup** — slot **9**, cocok 3/3 holder | Ulangi di blok kedua, buat fixture test |
| Token di Base di-upgrade → layout berubah | ⚠️ risiko diterima | Konsekuensi RT9: **redeploy** |
| Salah memfilter factory / `gameType` | ✅ **G17 ditutup** — factory `0x43edb88c…`, gameType **621** | **Filter dua-duanya.** 21 factory aktif di L1 |
| Calldata MPT proof terlalu besar | ✅ **G18 ditutup** — 7.440 B ≈ 0,15% block limit | `estimateGas` nyata setelah `ingestAnchor` ada |
| **Membedakan root diusulkan vs diselesaikan** | ⏳ **belum diukur** | Pindai event resolusi + jeda nyata usulan→resolusi. **Ini yang menopang §14.4** |

### 14.6 Versi 80/20 — kerjakan ini kalau MPT terasa terlalu jauh

**`BaseStateRootRegistry`** — kontrak Creditcoin yang memelihara state root Base terbaru
yang sudah terbukti, plus statusnya (diusulkan / final), seluruhnya dibuktikan lewat
Attestcoin. **Langkah 1–2 saja, lewati proof akun/storage.**

Sekitar 1/5 pekerjaan, tapi sudah menghasilkan tiga hal:
- Klaim decknya utuh: *"Creditcoin sekarang tahu state root Base, lewat Ethereum."*
- **Primitive publik** yang bisa dipakai dApp Creditcoin lain — argumen CEIP terkuat
  yang bisa dibuat, dan pola yang sama dengan alasan SnowBall menang juara 3 musim lalu.
- Proof akun/storage jadi lanjutan yang jelas, bukan prasyarat.

**Kalau ragu, kerjakan versi ini.**

---

# Lampiran — kontrak antar-modul

Bagian ini mengunci hal-hal yang kalau dibiarkan ambigu akan menghambat saat ngoding.
Kunci dulu di sini, baru tulis kode.

## A. Katalog event

Dashboard dan worker keduanya membaca ini. **Kunci sebelum menulis kontrak** — mengubah
signature event setelah frontend jadi itu menyakitkan.

```solidity
// --- ReserveLedger ---
// `initiator` = tx.from dari transaksi sumber (decodeCommonTxFields, §7.3).
// Bukan untuk validasi — untuk forensik. Feed menampilkannya sebagai "dipicu oleh".
event ReserveInflow (bytes32 indexed queryId, address indexed asset, uint64 indexed height,
                     uint256 amount, uint256 newReserves, address initiator);
event ReserveOutflow(bytes32 indexed queryId, address indexed asset, uint64 indexed height,
                     uint256 amount, uint256 newReserves, address initiator);
event AssetRegistered(address indexed asset, uint8 decimals, uint16 haircutBps);
event QueryIngested (bytes32 indexed queryId, uint64 height, uint64 txIndex, uint16 logsApplied);

// --- SolvencyLockedToken ---
event Minted  (address indexed to,   uint256 amount, uint256 collateralRatioBps);
event Redeemed(address indexed from, uint256 amount, uint256 collateralRatioBps);

// --- Babak 5 (opsional, §14) ---
event ReserveAnchored(address indexed asset, uint64 indexed l2Block,
                      uint256 provenBalance, bool finalized);
```

⚠️ **`MinCollateralRatioUpdated` DIHAPUS 9 Agustus 2026.** Setter-nya tidak ada sama
sekali (RT9), jadi event ini tidak akan pernah bisa di-emit. Event yang tidak mungkin
terjadi di dalam ABI adalah janji palsu kepada integrator — dan kalau juri membaca ABI,
dia terbaca sebagai *"jadi ada cara mengubah lantainya?"*. Hapus dari kontrak dan dari
frontend.

**`Redeemed` adalah catatan permintaan tebus yang tidak bisa disangkal** (§9.2 no. 10).
Frontend wajib menampilkannya sebagai baris feed yang bisa ditautkan ke Blockscout —
itulah buktinya bagi pemegang token.

`QueryIngested` sengaja dipisah dari `ReserveInflow`/`Outflow`: satu transaksi bisa
menghasilkan nol, satu, atau beberapa pergerakan cadangan, dan dashboard perlu bisa
menampilkan "bukti ini sudah diproses" walau nilainya nol.

Precompile juga meng-emit `TransactionVerified(uint64 chainKey, uint64 height,
uint64 transactionIndex)` sendiri — inilah jejak audit independen yang jadi alasan kita
memakai `verifyAndEmit` dan bukan `verify`.

## B. Katalog error

Worker harus membedakan **gagal permanen** (→ `SKIPPED`, jangan retry selamanya) dari
**gagal sementara** (→ retry backoff). Salah mengklasifikasikan = worker macet atau
kehilangan data.

| Error | Arti | Aksi worker |
|---|---|---|
| `QueryAlreadyProcessed(bytes32)` | Sudah diingest | **SKIPPED** — sukses, bukan gagal |
| `WrongSourceChain(uint64,uint64)` | chainKey salah | **SKIPPED** — bug konfigurasi, hentikan & alarm |
| `SourceTransactionReverted(uint8)` | `receiptStatus != 1` | **SKIPPED** permanen |
| `NoRelevantTransfers()` | Tidak menyentuh treasury | **SKIPPED** permanen |
| `UnsupportedTransactionType(uint8)` | Tipe tx tak dikenal | **SKIPPED** permanen |
| `ProofRejected()` | Precompile menolak bukti | **RETRY** — bisa attestation belum matang |
| `WouldBreachCollateralFloor(uint256,uint256)` | Mint ditolak — melanggar lantai | Bukan jalur worker. **Dicek paling depan (A3)** → ini yang dilihat penyerang mana pun |
| `ReserveViewStale(uint64,uint64)` | Pandangan cadangan basi (RT10 lapis 1) | Bukan jalur worker. Frontend: tampilkan sebagai peringatan kesegaran |
| `WindowMintCapExceeded(uint256,uint256)` | Melebihi batas mint per jendela (RT10 lapis 2) | Bukan jalur worker — jalur issuer |
| `NotIssuer(address)` | Pemanggil bukan issuer | **Dicek paling belakang (A3)** — hanya muncul kalau ketiga cek di atas lolos |
| `InvalidRatio()` | Lantai kolateral 0 | Bug konfigurasi |
| `StaleAnchor(uint64,uint64)` | Babak 5: `ingest` di bawah `anchorHeight` (§14.3) | **SKIPPED** permanen |
| `AnchorNotFinalized()` | Babak 5: anchor menaikkan cadangan tapi dispute game belum selesai (§14.4) | **RETRY** — jadwalkan ulang setelah jendela sengketa |
| revert tanpa reason / timeout RPC | Masalah jaringan | **RETRY** backoff |

### B.1 Error Proof Builder API — bentuknya terukur, bukan ditebak

Diambil dari respons nyata 9 Agustus 2026. Worker **harus** membaca field `retriable`,
bukan menebak dari kode HTTP:

```jsonc
// HTTP 422
{
  "code": "BlockNotReady",
  "message": "The continuity proof cannot be created because block 25712295 is not
              attested to yet. Last attested block: 25712290",
  "retriable": true,
  "block_number": 25712295,
  "last_attested_block": 25712290
}
```

| Sinyal | Aksi worker |
|---|---|
| `retriable: true` | **RETRY** — dan pakai `last_attested_block` untuk menghitung jeda yang tepat, jangan backoff buta |
| `retriable: false` | **SKIPPED** permanen |
| HTTP 429 / 5xx | **RETRY** backoff eksponensial |

⚠️ **`BlockNotReady` akan sering muncul** kalau scanner memindai terlalu dekat ke kepala
rantai. Worker harus menunggu sampai tinggi blok ter-attest (ChainInfo `0x0fd3`)
**sebelum** memanggil proof API — bukan memanggil lalu menangani errornya.

⚠️ `NoRelevantTransfers` akan **sering** terjadi kalau scanner kurang ketat. Filter di
sisi worker (`eth_getLogs` dengan topic treasury) harus cukup tajam sehingga ini jarang
— kalau sering, artinya kita membakar gas untuk transaksi yang tidak relevan.

## C. Parameter deploy

| Parameter | Contoh nilai (demo CC3 testnet) | Catatan |
|---|---|---|
| `sourceChainKey` | `3` | **3 = ETH mainnet di CC3 testnet.** Di CC mainnet jadi `1`. |
| `treasury` | alamat treasury di Ethereum | Untuk observatory: alamat issuer nyata |
| `assets[]` | `[{USDC_mainnet, 6, 10000}]` | `haircutBps` 10000 = dihitung penuh |
| `name` / `symbol` | `"Corolary USD"` / `"mUSD"` | Vault mode saja |
| `decimals` | `6` | **Wajib** sama dengan unit-of-account cadangan |
| `minCollateralRatioBps` | `10000` | 100% backed. Tidak boleh 0. |
| `issuer` (owner) | **akun ketiga khusus** — BUKAN deployer, BUKAN operator | Yang boleh `mint()` — **dan tidak boleh apa pun selain itu** (RT9). ⚠️ **Kuncinya diterbitkan publik** (RT12) → wajib terisolasi. Lihat `06-akun-dan-dana.md` §3 |
| `attestationWindowBlocks` | **`42`** (CC3 testnet) / **`74`** (CC mainnet) | **RT10 · DIKUNCI 9 Agt (G14).** Ini **batas ATAS pita** lag terukur (32–42 / 65–73), bukan rata-rata. Jangan hardcode — beda antar lingkungan |
| `maxStalenessBlocks` | **`63`** (CC3 testnet) / **`111`** (CC mainnet) | **RT10 lapis 1 · DIKUNCI 9 Agt (G14).** = `attestationWindowBlocks` × 1,5. ⚠️ Nilai di sekitar 44 akan me-revert `mint()` yang sah beberapa kali per jam — lag itu **pita**, lihat `01` §1.5d |
| `maxMintPerWindowBps` | **`500`** (5%) | **RT10 lapis 2 · DIKUNCI 9 Agt (G15).** Batas atas kerugian di jendela ~9 menit; untuk treasury $1 jt = $50.000/jendela — jauh di atas penerbitan wajar. Alasan lengkap: `04-gap-dan-blocker.md` G15 |

⚠️ **RT9 — semua parameter di atas `immutable` setelah deploy.** Tidak ada setter, tidak
ada proxy. Bug = redeploy, bukan patch. Alasan lengkap: `07-red-team.md` RT9.

Simpan tiap deployment ke `deployments/<network>.json`: alamat kontrak, blok deploy,
parameter, dan hash commit. Dashboard dan worker membacanya — jangan menempel alamat
di banyak tempat.

## D. Skema persistensi worker

Satu record per transaksi sumber. Simpan sebagai JSON (tulis atomik: tmp + rename)
atau SQLite — yang penting **atomik dan bisa dibaca manusia saat debugging**.

```jsonc
{
  "txHash":       "0x…",          // kunci utama
  "chainKey":     3,
  "blockNumber":  25665308,
  "blockHash":    "0x…",          // untuk deteksi reorg (G6)
  "discoveredAt": "2026-08-02T06:00:00Z",
  "state":        "PROVEN",       // DISCOVERED|ATTESTED|PROVEN|SUBMITTED|CONFIRMED|SKIPPED|FAILED
  "queryId":      "0x…",          // ada setelah txIndex diketahui dari proof
  "txIndex":      54,
  "attempts":     2,
  "nextAttemptAt":"2026-08-02T06:05:00Z",
  "lastError":    "proof api 429",
  "creditcoinTx": "0x…",          // ada setelah SUBMITTED
  "skipReason":   null            // "NoRelevantTransfers" | "receiptStatus!=1" | "alreadyProcessed"
}
```

Plus satu record cursor terpisah:

```jsonc
{ "lastScannedBlock": 25665300, "lastAttestedHeight": 25665310, "updatedAt": "…" }
```

**`blockHash` wajib disimpan.** Sebelum membangun proof, verifikasi ulang bahwa
`txHash` masih ada di blok dengan hash yang sama. Ini penutup lubang reorg (G6) dan
biayanya cuma satu panggilan RPC.

## E. Format fixture untuk test kontrak

Test berjalan di atas transaksi Ethereum **sungguhan**, bukan mock. `tools/recon/make-fixture.mjs`
menulis ke `packages/contracts/test/fixtures/<nama>.json`:

```jsonc
{
  "label":       "usdc-mainnet-inflow",
  "chainKey":    3,
  "txHash":      "0x…",
  "headerNumber": 25665308,
  "txIndex":      54,
  "txBytes":     "0x…",
  "merkleProof":     { "root": "0x…", "siblings": [{ "hash": "0x…", "isLeft": true }] },
  "continuityProof": { "lowerEndpointDigest": "0x…", "roots": ["0x…"] },
  "expect": {
    "receiptStatus": 1,
    "transfers": [{ "asset": "0x…", "from": "0x…", "to": "0x…", "value": "1000000" }]
  }
}
```

Test membaca fixture lewat `vm.readFile`, jadi `foundry.toml` butuh:

```toml
fs_permissions = [{ access = "read", path = "./test/fixtures" }]
```

Precompile `0x0FD2` **tidak ada** di EVM lokal Foundry. Dua pilihan, keduanya sah:
1. **Fork test** terhadap RPC CC3 testnet — precompile & decoder nyata. Paling jujur, paling lambat.
2. **Mock precompile** via `vm.etch` di alamat `0x0FD2` yang mengembalikan `true`, sambil
   memakai bytecode `EvmV1Decoder` **asli** yang ditarik dari chain. Ini menguji logika
   kita di atas decoding nyata tanpa bergantung jaringan.

Pakai (2) untuk test harian, (1) untuk satu test integrasi yang dijalankan sebelum rilis.
