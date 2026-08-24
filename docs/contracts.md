# Spesifikasi Smart Contract — Corolary

> Turunan dari `docs/architecture.md` (tulang punggung). Kalau ada konflik, spine yang menang.
> Baca juga `docs/attestcoin-research.md` §2 (batasan protokol) dan `docs/scoring.md` (rumus skor).
>
> Pemilik: **Dev A**. Path: `packages/contracts/`

---

## 0. Prinsip

1. **Verifikasi dulu, baru percaya.** Tidak ada state yang berubah sebelum proof
   Attestcoin lolos DAN isi transaksi divalidasi.
2. **Tiga gerbang keamanan wajib** di setiap jalur konsumsi fakta:
   inklusi terbukti → `receiptStatus == 1` → alamat emitter terdaftar.
3. **Adapter terisolasi.** Logika decoding per protokol tidak boleh mencemari registry.
   Menambah protokol baru = deploy satu adapter, tanpa menyentuh `FactRegistry`.
4. **Registry tidak bisa diubah.** Fakta yang sudah tercatat tidak punya jalur edit
   atau hapus. Itulah yang membuatnya bernilai.

---

## 1. Konvensi

| Aspek | Aturan |
|---|---|
| Versi | `pragma solidity ^0.8.28;` — **dipaksa `@gluwa/usc-contracts` v0.2.0**. Contoh tutorial memakai 0.8.23 dan akan gagal compile. |
| Error | **Custom error**, bukan string `require` |
| Library | OpenZeppelin Contracts v5, `@gluwa/usc-contracts` **v0.2.0** |
| Import decoder | `@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol` — **path di dokumentasi resmi salah** |
| Precompile BlockProver | `0x0000000000000000000000000000000000000FD2` |
| Precompile ChainInfo | `0x0000000000000000000000000000000000000fd3` |
| Fixed-point | WAD `1e18` untuk matematika internal; **bps** untuk rasio; integer polos untuk poin skor |
| Akses | `AccessControl` OpenZeppelin, bukan `Ownable`, kecuali disebut lain |

**Layout direktori:**
```
packages/contracts/src/
├── AttestcoinReader.sol
├── FactRegistry.sol
├── PriceRegistry.sol
├── CreditGraph.sol
├── EfficiencyMarket.sol
├── adapters/
│   ├── AaveV3Adapter.sol
│   ├── MorphoBlueAdapter.sol
│   ├── CompoundV3Adapter.sol
│   └── ChainlinkAdapter.sol
├── interfaces/
│   ├── INativeQueryVerifier.sol
│   ├── IChainInfo.sol
│   ├── IProtocolAdapter.sol
│   ├── IPriceRegistry.sol
│   └── ICreditGraph.sol
└── libraries/
    ├── FactTypes.sol
    └── ScoreMath.sol
```

---

## 2. Tipe Bersama — `libraries/FactTypes.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum FactKind {
    LoanOriginated,      // 0
    LoanRepaid,          // 1
    Liquidated,          // 2
    CollateralSupplied,  // 3
    CollateralWithdrawn  // 4
}

struct Fact {
    bytes32  factId;
    uint64   chainKey;
    uint64   blockHeight;
    uint32   txIndex;
    uint32   txLogIndex;   // posisi di receipt.receiptLogs (intra-transaksi)
    FactKind kind;
    address  subject;
    address  protocol;
    address  asset;
    uint256  amount;
    uint64   observedAt;
    uint64   recordedAt;
}

library FactTypes {
    /// @dev factId is derived, never supplied by the caller.
    function computeFactId(
        uint64 chainKey,
        uint64 blockHeight,
        uint32 txIndex,
        uint32 txLogIndex
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(chainKey, blockHeight, txIndex, txLogIndex));
    }
}
```

**Semantik `amount` (dikunci di `architecture.md` §8.1 — adapter WAJIB patuh):**

| FactKind | `amount` | `asset` |
|---|---|---|
| `LoanOriginated` | pokok dipinjam | token utang |
| `LoanRepaid` | jumlah dilunasi | token utang |
| `Liquidated` | **`debtToCover`** | **token utang (`debtAsset`)** |
| `CollateralSupplied` | kolateral disetor | token kolateral |
| `CollateralWithdrawn` | kolateral ditarik | token kolateral |

> ⚠️ Untuk `Liquidated`, **jangan** pakai `liquidatedCollateralAmount` maupun
> `collateralAsset`. Salah di sini meracuni `liquidationPenalty` tanpa gejala apa pun
> sampai skor sudah salah berminggu-minggu.

---

## 3. `INativeQueryVerifier` — JANGAN tulis ulang

**Jangan salin `VerifierInterface.sol` dari repo tutorial.** Versinya tertinggal dan
hanya memuat `verifyAndEmit` tunggal + `calculateTxIndex` — **tanpa overload batch**.
Batching adalah strategi biaya inti Corolary, jadi memakai interface lama akan
mematikan penghematan terbesar yang tersedia.

Impor yang benar, langsung dari paket resmi:

```solidity
import {INativeQueryVerifier, NativeQueryVerifierLib}
    from "@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
```

Permukaan sebenarnya (v0.2.0, terverifikasi dari sumber paket):

```solidity
interface INativeQueryVerifier {
    struct MerkleProofEntry { bytes32 hash; bool isLeft; }
    struct MerkleProof      { bytes32 root; MerkleProofEntry[] siblings; }
    struct ContinuityProof  { bytes32 lowerEndpointDigest; bytes32[] roots; }

    event TransactionVerified(uint64 indexed chainKey, uint64 indexed height, uint64 transactionIndex);

    // --- tunggal ---
    function verifyAndEmit(uint64 chainKey, uint64 height, bytes calldata encodedTransaction,
        MerkleProof calldata, ContinuityProof calldata) external returns (bool);
    function verify(uint64 chainKey, uint64 height, bytes calldata encodedTransaction,
        MerkleProof calldata, ContinuityProof calldata) external view returns (bool);

    // --- BATCH: continuity proof dipakai bersama ---
    function verifyAndEmit(uint64 chainKey, uint64[] calldata heights, bytes[] calldata encodedTransactions,
        MerkleProof[] calldata merkleProofs, ContinuityProof calldata sharedContinuityProof)
        external returns (bool);
    function verify(uint64 chainKey, uint64[] calldata heights, bytes[] calldata encodedTransactions,
        MerkleProof[] calldata merkleProofs, ContinuityProof calldata sharedContinuityProof)
        external view returns (bool);

    function calculateTxIndex(MerkleProof calldata) external view returns (uint64);
}
```

`NativeQueryVerifierLib` juga menyediakan `hasPrecompile()` dan
`isCreditcoinChainId(uint256)` (mengenali 102030 mainnet / 102031 testnet / 102032 devnet).
Pakai `hasPrecompile()` sebagai guard di konstruktor agar deploy ke chain yang salah
gagal cepat, bukan gagal senyap saat fakta pertama masuk.

> ⚠️ **Ada dua struct `MerkleProofEntry` berbeda di paket yang sama.**
> `INativeQueryVerifier.MerkleProofEntry` memakai field **`hash`**;
> `BlockProverTypes.MerkleProofEntry` memakai field **`sibling`**.
> Untuk memanggil precompile, pakai yang dari `INativeQueryVerifier`.

## 3b. `interfaces/IChainInfo.sol`

Dipakai `PriceRegistry` dan monitoring kesegaran attestation.

```solidity
interface IChainInfo {
    struct ChainInfo { uint64 chainKey; uint64 chainId; bytes chainName; uint8 chainEncoding; }
    struct HeightHashResult { uint64 height; bytes32 hash; bool isAttestation; bool exists; }

    function get_supported_chains() external view returns (ChainInfo[] memory);
    function is_height_attested(uint64 chainKey, uint64 targetHeight) external view returns (bool);
    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external view returns (HeightHashResult memory);
}

library ChainInfoLib {
    address constant PRECOMPILE_ADDRESS =
        0x0000000000000000000000000000000000000fd3;
    function get() internal pure returns (IChainInfo) {
        return IChainInfo(PRECOMPILE_ADDRESS);
    }
}
```

---

## 4. `AttestcoinReader.sol` — abstract

**Tujuan.** Menyatukan seluruh interaksi dengan Attestcoin di satu tempat: verifikasi
proof, replay protection, dan **ketiga gerbang keamanan**. Tidak ada kontrak lain yang
boleh memanggil precompile langsung.

### Storage
```solidity
INativeQueryVerifier public immutable VERIFIER;
mapping(bytes32 => bool) public processedQueries;   // queryId => sudah diproses
mapping(uint64 => bool)  public allowedChainKeys;   // chainKey => diizinkan
```

### Error
```solidity
error QueryAlreadyProcessed(bytes32 queryId);
error ProofVerificationFailed();
error SourceTransactionReverted();
error UnsupportedTransactionType(uint8 txType);
error ChainKeyNotAllowed(uint64 chainKey);
error EmitterNotAuthorized(address emitter, address expected);
```

### Fungsi
```solidity
constructor() {
    VERIFIER = NativeQueryVerifierLib.getVerifier();
}

struct ProofBundle {
    uint64  chainKey;
    uint64  blockHeight;
    bytes32 merkleRoot;
    INativeQueryVerifier.MerkleProofEntry[] siblings;
    bytes32 lowerEndpointDigest;
    bytes32[] continuityRoots;
}

/// @notice Gerbang tunggal: verifikasi proof + validasi receipt + replay protection.
/// @return receipt  Field receipt yang sudah didecode, siap dipakai pemanggil.
/// @return txIndex  Indeks transaksi dalam blok, diturunkan dari merkle proof.
function _verifyAndDecode(
    ProofBundle calldata bundle,
    bytes calldata encodedTransaction
) internal returns (EvmV1Decoder.ReceiptFields memory receipt, uint32 txIndex) {
    if (!allowedChainKeys[bundle.chainKey]) revert ChainKeyNotAllowed(bundle.chainKey);

    INativeQueryVerifier.MerkleProof memory mp = INativeQueryVerifier.MerkleProof({
        root: bundle.merkleRoot,
        siblings: bundle.siblings
    });

    txIndex = uint32(VERIFIER.calculateTxIndex(mp));

    // --- Gerbang 3: replay protection (sebelum kerja mahal) ---
    bytes32 queryId = _computeQueryId(bundle.chainKey, bundle.blockHeight, txIndex);
    if (processedQueries[queryId]) revert QueryAlreadyProcessed(queryId);
    processedQueries[queryId] = true;

    // --- Gerbang 1: inklusi terbukti ---
    INativeQueryVerifier.ContinuityProof memory cp = INativeQueryVerifier.ContinuityProof({
        lowerEndpointDigest: bundle.lowerEndpointDigest,
        roots: bundle.continuityRoots
    });
    if (!VERIFIER.verifyAndEmit(bundle.chainKey, bundle.blockHeight, encodedTransaction, mp, cp)) {
        revert ProofVerificationFailed();
    }

    // --- Gerbang 2: transaksi sumber BENAR-BENAR sukses ---
    uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
    if (!EvmV1Decoder.isValidTransactionType(txType)) revert UnsupportedTransactionType(txType);

    receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
    if (receipt.receiptStatus != 1) revert SourceTransactionReverted();
}

function _computeQueryId(uint64 chainKey, uint64 blockHeight, uint32 txIndex)
    internal pure returns (bytes32)
{
    return keccak256(abi.encodePacked(chainKey, blockHeight, txIndex));
}

/// @dev Gerbang emitter — dipanggil per log oleh turunan.
function _requireEmitter(address actual, address expected) internal pure {
    if (actual != expected) revert EmitterNotAuthorized(actual, expected);
}
```

### Catatan keamanan

- **Precompile TIDAK mengecek sukses/gagal transaksi.** Ia hanya membuktikan inklusi.
  Tanpa gerbang 2, transaksi Aave yang **revert** akan lolos dan tercatat sebagai
  pelunasan yang sah. Ini lubang #1 di proyek ini.
- **Terbukti "log ini ada di transaksi" ≠ "log ini dari Aave".** Siapa pun bisa
  men-deploy kontrak peniru yang memancarkan event dengan signature identik, lalu
  transaksinya akan punya proof yang sepenuhnya sah. Gerbang 3 (`_requireEmitter`)
  yang mencegah pemalsuan reputasi massal.
- **Replay protection ditandai sebelum verifikasi**, mengikuti pola checks-effects.
  `queryId` berbasis `(chainKey, blockHeight, txIndex)` — satu transaksi sumber hanya
  boleh diproses sekali, berapa pun log yang dikandungnya.
- **`allowedChainKeys` harus di-set eksplisit** saat deploy. Produksi: hanya `3`
  (Ethereum mainnet). Jangan biarkan kosong dan jangan izinkan `1` (Sepolia) di rilis akhir.
- **`calculateTxIndex` mengembalikan `uint64`, `queryId`/`factId` memakai `uint32`.**
  Pemotongan diam-diam akan memetakan dua transaksi berbeda ke `queryId` yang sama —
  satu bisa memblokir pencatatan yang lain secara permanen. `_toTxIndex` me-revert
  dengan `TxIndexOutOfRange` alih-alih memotong. Blok nyata tidak pernah mendekati
  2³² transaksi; justru karena itu ia harus revert, bukan dipotong.
- **`nonReentrant` di semua entrypoint pencatatan.** `creditGraph.applyFact` adalah
  panggilan eksternal ke kontrak yang bisa diganti admin. Fakta sudah tersimpan
  sebelum panggilan itu (checks-effects-interactions), dan guard menutup sisanya.
  Catatan urutan modifier: `onlyRole` berjalan **sebelum** `nonReentrant`, jadi
  pemanggil tanpa `RECORDER_ROLE` tertahan lebih dulu oleh kontrol akses. Tes
  reentrancy harus memberi penyerang `RECORDER_ROLE`, kalau tidak ia menguji
  gerbang yang salah dan tetap hijau meski guard-nya dicopot.
- **Adapter di-`staticcall`.** `IProtocolAdapter.decodeLog` dideklarasikan `view`,
  sehingga kompiler memancarkan STATICCALL — adapter tidak bisa menulis state
  maupun masuk kembali, bahkan kalau kurator salah mendaftarkan kontrak jahat.
- **`registerAdapter` memaksa adapter menyetujui alamat sumbernya sendiri.**
  Tanpa itu, kurator yang salah ketik memasang adapter di bawah alamat sumber lain,
  dan gerbang emitter kemudian membandingkan log terhadap alamat yang salah.

### Kasus uji
| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | Proof valid, receipt sukses, emitter benar | lolos |
| 2 | Proof valid, **receipt status 0** | revert `SourceTransactionReverted` |
| 3 | Merkle proof rusak | revert `ProofVerificationFailed` |
| 4 | Continuity proof rusak | revert `ProofVerificationFailed` |
| 5 | Transaksi sama dikirim dua kali | revert `QueryAlreadyProcessed` |
| 6 | Log dari kontrak peniru | revert `EmitterNotAuthorized` |
| 7 | `chainKey` tidak diizinkan | revert `ChainKeyNotAllowed` |
| 8 | Tipe transaksi tak didukung | revert `UnsupportedTransactionType` |

---

## 5. `interfaces/IProtocolAdapter.sol`

**Tujuan.** Kontrak antara `FactRegistry` dan pengetahuan spesifik protokol.
Menambah protokol = deploy adapter baru + daftarkan. Registry tidak berubah.

```solidity
interface IProtocolAdapter {
    /// @notice Alamat kontrak sumber di Ethereum yang sah untuk adapter ini.
    function sourceContract() external view returns (address);

    /// @notice Nama protokol untuk keperluan tampilan, mis. "Aave V3".
    function protocolName() external view returns (string memory);

    /// @notice Terjemahkan satu log yang SUDAH terverifikasi menjadi Fact.
    /// @dev Pemanggil (FactRegistry) sudah menjamin: proof sah, receipt sukses,
    ///      dan log.emitter == sourceContract(). Adapter TIDAK perlu mengulang itu.
    /// @return ok    false bila log ini tidak relevan (bukan error).
    /// @return kind  jenis fakta
    /// @return subject dompet yang direputasikan
    /// @return asset token
    /// @return amount jumlah, sesuai tabel semantik di §2
    function decodeLog(EvmV1Decoder.LogEntry calldata log)
        external view
        returns (bool ok, FactKind kind, address subject, address asset, uint256 amount);
}
```

> Adapter **view-only dan stateless**. Ia tidak boleh menyimpan state maupun memanggil
> kontrak eksternal — itu menjaga `recordFact` deterministik dan murah.

---

## 6. `FactRegistry.sol`

**Tujuan.** Menyimpan fakta terverifikasi secara permanen. Ini **inti produk** dan
lapisan yang dApp Creditcoin lain akan konsumsi.

### Storage
```solidity
bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
bytes32 public constant CURATOR_ROLE  = keccak256("CURATOR_ROLE");

mapping(bytes32 => Fact)     private _facts;          // factId => Fact
mapping(address => bytes32[]) private _factsBySubject; // subject => factId[]
mapping(address => address)  public adapterOf;         // sourceContract => adapter
address[] public registeredProtocols;

ICreditGraph public creditGraph;
uint256 public totalFacts;
```

### Event & error
```solidity
event FactRecorded(
    bytes32 indexed factId,
    address indexed subject,
    FactKind indexed kind,
    address protocol,
    address asset,
    uint256 amount,
    uint64  blockHeight
);
event AdapterRegistered(address indexed sourceContract, address indexed adapter, string protocolName);
event AdapterRemoved(address indexed sourceContract);
event CreditGraphUpdated(address indexed creditGraph);

error NoAdapterForProtocol(address sourceContract);
error NoRelevantLogs();
error AdapterAlreadyRegistered(address sourceContract);
error ZeroAddress();
```

### Fungsi
```solidity
/// @notice Catat semua fakta relevan dari SATU transaksi Ethereum terbukti.
/// @param bundle proof Attestcoin
/// @param encodedTransaction transaksi terenkode dari Proof Builder
/// @param observedAt waktu Ethereum saat event terjadi — lihat catatan kepercayaan
/// @return factIds fakta yang berhasil dicatat
function recordFact(
    ProofBundle calldata bundle,
    bytes calldata encodedTransaction,
    uint64 observedAt
) external onlyRole(RECORDER_ROLE) nonReentrant returns (bytes32[] memory factIds);

/// @notice Versi batch — beberapa transaksi berbagi SATU continuity proof.
/// @dev Memakai overload batch precompile:
///      verifyAndEmit(chainKey, heights[], encodedTxs[], merkleProofs[], sharedContinuityProof)
///      Batas protokol: maksimum 10 transaksi, rentang 1000 blok.
///      Ini penghematan gas terbesar yang tersedia — satu continuity proof untuk 10 tx.
struct BatchProofBundle {
    uint64 chainKey;
    uint64[] heights;
    INativeQueryVerifier.MerkleProof[] merkleProofs;
    INativeQueryVerifier.ContinuityProof sharedContinuityProof;
}

function recordFactBatch(
    BatchProofBundle calldata bundle,
    bytes[] calldata encodedTransactions,
    uint64[] calldata observedAts
) external onlyRole(RECORDER_ROLE) nonReentrant returns (bytes32[] memory factIds);

// --- Kurasi ---
function registerAdapter(address sourceContract, address adapter) external onlyRole(CURATOR_ROLE);
function removeAdapter(address sourceContract) external onlyRole(CURATOR_ROLE);
function setCreditGraph(address graph) external onlyRole(DEFAULT_ADMIN_ROLE);
function setChainKeyAllowed(uint64 chainKey, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE);

// --- Baca (dipakai dApp lain — ini nilai infrastrukturnya) ---
function getFact(bytes32 factId) external view returns (Fact memory);
function factExists(bytes32 factId) external view returns (bool);
function factCountOf(address subject) external view returns (uint256);
function factsOf(address subject, uint256 offset, uint256 limit)
    external view returns (Fact[] memory);
function protocolCount() external view returns (uint256);
```

### Alur `recordFact` (urutan wajib)
```
1. (receipt, txIndex) = _verifyAndDecode(bundle, encodedTransaction)
      → gerbang 1 (inklusi) + gerbang 2 (receiptStatus) + replay
2. untuk i = 0 .. receipt.receiptLogs.length - 1:      ← ITERASI LANGSUNG
      a. log = receipt.receiptLogs[i];  txLogIndex = uint32(i)
      b. adapter = adapterOf[log.address_]        ← GERBANG 3, dipilih OLEH emitter
         jika adapter == 0 → lewati (BUKAN revert;
         satu transaksi wajar memuat log dari banyak kontrak)
      c. (ok, kind, subject, asset, amount) = adapter.decodeLog(log)
      d. jika !ok → lewati
      e. jika subject == 0 → revert InvalidSubject (adapter rusak — gagal keras)
      f. factId = FactTypes.computeFactId(chainKey, blockHeight, txIndex, txLogIndex)
      g. jika _facts[factId].subject != 0 → lewati (idempoten di level log)
      h. simpan Fact; push ke _factsBySubject[subject]; ++totalFacts
      i. emit FactRecorded
      j. jika creditGraph != 0 → creditGraph.applyFact(factId)   ← panggilan eksternal TERAKHIR
3. jika factIds kosong → revert NoRelevantLogs
```

> **Kenapa iterasi manual, bukan `getLogsByEventSignature`:** helper itu mengembalikan
> array **terfilter**, sehingga posisi asli tiap log hilang. Karena `LogEntry` sendiri
> tidak memuat `logIndex`, satu-satunya sumber indeks yang deterministik adalah posisi
> iterasi di `receipt.receiptLogs`. Memakai helper itu di sini akan menghasilkan
> `factId` yang bertabrakan antar log dalam satu transaksi. Helper tetap berguna untuk
> pembacaan view yang tidak butuh indeks.
>
> **Kenapa 3a "lewati" bukan "revert":** transaksi Ethereum nyata memuat log dari banyak
> kontrak (token, router, pool). Revert akan menolak transaksi yang sah. Gerbang emitter
> tetap ditegakkan — hanya log dari `sourceContract` yang diterima menjadi fakta.
>
> **Kenapa 3e "lewati" bukan "revert":** replay per-transaksi sudah dijaga di langkah 2.
> Cek per-log ini adalah pertahanan berlapis untuk kasus batch yang tumpang tindih.

> **PERUBAHAN 2026-08-25 — `sourceContract` tidak lagi jadi parameter.**
> Adapter dipilih **oleh alamat emitter log**, bukan oleh pemanggil. Dua alasan:
>
> 1. **Cacat korektness nyata pada desain lama.** `queryId` dikunci per transaksi
>    sumber, sementara `recordFact` hanya menerima SATU `sourceContract`. Transaksi
>    Ethereum yang menyentuh Aave **dan** Morpho — aggregator, migrasi posisi,
>    kontrak strategi — hanya bisa dicatat untuk protokol pertama; panggilan kedua
>    kena `QueryAlreadyProcessed` dan fakta protokol kedua **hilang permanen**.
> 2. **Gerbang emitter jadi lebih kuat.** Kalau adapter dipilih oleh emitter,
>    "adapter salah dipasangkan dengan log" bukan sekadar tercegah — ia tidak bisa
>    diungkapkan sama sekali. Tidak ada lagi parameter yang bisa salah diisi.
>
> Biayanya satu SLOAD dingin per log (~2.100 gas × 10 log ≈ 5% dari biaya decode
> 375k gas). Dikunci sebagai tes: `test_SingleTxTouchingTwoProtocolsRecordsBoth`.

> ⚠️ **`observedAt` adalah SATU-SATUNYA field yang tidak dibuktikan kriptografis.**
> Receipt Ethereum tidak memuat timestamp blok, jadi waktu tidak bisa diturunkan
> on-chain dari proof. Ia diisi operator dan **hanya untuk tampilan**.
>
> Apa pun yang security-relevant — urutan kejadian, durasi riwayat, kesegaran —
> **HARUS** memakai `blockHeight`, yang dibuktikan. `CreditGraph` tidak boleh
> menurunkan `historyDuration` dari `observedAt`.
>
> Ini harus dinyatakan terbuka di submission, sama seperti B2 soal token testnet.
> Juri akan menemukannya sendiri kalau kita diam.

### Kasus uji
| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | Transaksi Aave `Repay` nyata dari mainnet | 1 fakta tercatat, `kind == LoanRepaid` |
| 2 | Transaksi dengan log dari token + pool | hanya log pool jadi fakta |
| 3 | Transaksi tanpa log relevan | revert `NoRelevantLogs` |
| 4 | `sourceContract` tak terdaftar | revert `NoAdapterForProtocol` |
| 5 | Pemanggil tanpa `RECORDER_ROLE` | revert `AccessControlUnauthorizedAccount` |
| 6 | Transaksi sama dua kali | revert `QueryAlreadyProcessed` |
| 7 | Transaksi multi-event (borrow + supply) | 2 fakta, `logIndex` berbeda |
| 8 | Batch 10 transaksi | 10 diproses, gas terukur |
| 9 | Batch > 10 transaksi | revert (batas protokol) |
| 10 | `creditGraph` belum di-set | fakta tetap tercatat, tanpa update skor |

---

## 7. Adapter Protokol

### 7a. `adapters/AaveV3Adapter.sol`

**Sumber:** `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` (Ethereum mainnet, terverifikasi)

```solidity
bytes32 constant BORROW_SIG = 0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0;
bytes32 constant REPAY_SIG  = 0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051;
bytes32 constant LIQ_SIG    = 0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286;
bytes32 constant SUPPLY_SIG = 0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61;
bytes32 constant WITHDRAW_SIG = 0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7;
```

**Pemetaan — perhatikan pemilihan subjek, ini sumber bug paling mahal:**

| Event | topics | subject | asset | amount | kind |
|---|---|---|---|---|---|
| `Borrow(reserve, user, onBehalfOf, amount, rateMode, rate, referral)` | `t1=reserve`, `t2=onBehalfOf`, `t3=referral` | **`onBehalfOf`** (t2) | `reserve` (t1) | **`data[1]`** ⚠️ | `LoanOriginated` |
| `Repay(reserve, user, repayer, amount, useATokens)` | `t1=reserve`, `t2=user`, `t3=repayer` | **`user`** (t2) | `reserve` (t1) | `data[0]` | `LoanRepaid` |
| `LiquidationCall(collateralAsset, debtAsset, user, debtToCover, liqCollateral, liquidator, receiveAToken)` | `t1=collateralAsset`, `t2=debtAsset`, `t3=user` | `user` (t3) | **`debtAsset` (t2)** | **`debtToCover` = `data[0]`** | `Liquidated` |
| `Supply(reserve, user, onBehalfOf, amount, referral)` | `t1=reserve`, `t2=onBehalfOf`, `t3=referral` | `onBehalfOf` (t2) | `reserve` (t1) | **`data[1]`** ⚠️ | `CollateralSupplied` |
| `Withdraw(reserve, user, to, amount)` | `t1=reserve`, `t2=user`, `t3=to` | `user` (t2) | `reserve` (t1) | `data[0]` | `CollateralWithdrawn` |

> **Kenapa `Borrow` memakai `onBehalfOf` tapi `Repay` memakai `user`:**
> Pada `Borrow`, `user` adalah yang mengeksekusi transaksi sedangkan `onBehalfOf`
> adalah pemikul utang — reputasi milik pemikul utang. Pada `Repay`, `user` adalah
> pemilik utang sedangkan `repayer` boleh siapa saja (mis. likuidator atau pihak ketiga).
> Memberi kredit ke `repayer` akan membiarkan orang membeli reputasi dengan melunasi
> utang orang lain. Salah satu dari dua pilihan ini meracuni seluruh sistem skor.

> ⚠️ **KOREKSI 2026-08-25 — offset `amount` TIDAK sama untuk kelima event.**
> Versi sebelumnya dokumen ini menyatakan `data[0]` untuk semuanya. Itu **salah
> untuk `Borrow` dan `Supply`**, dan mengikutinya secara harfiah akan mencatat
> **alamat dompet sebagai jumlah pinjaman** — angka astronomis yang meracuni
> `repaymentVolume` tanpa gejala apa pun sampai skor sudah salah berminggu-minggu.
>
> Sebabnya: pada `Borrow` dan `Supply`, parameter `user` **tidak** di-index,
> sehingga ia menempati word 0 dari `data` dan `amount` bergeser ke word 1.
> Diverifikasi langsung dari `aave-v3-origin/IPool.sol`:

| Event | non-indexed `data`, berurutan | offset `amount` |
|---|---|---|
| `Borrow` | `user`, `amount`, `interestRateMode`, `borrowRate` | **1** |
| `Supply` | `user`, `amount` | **1** |
| `Repay` | `amount`, `useATokens` | 0 |
| `Withdraw` | `amount` | 0 |
| `LiquidationCall` | `debtToCover`, `liquidatedCollateralAmount`, `liquidator`, `receiveAToken` | 0 |

Dikunci sebagai tes di `packages/contracts/test/AaveV3Adapter.t.sol`. Tes itu
**memancarkan event Aave sungguhan** lewat kontrak dengan deklarasi identik lalu
membaca hasilnya dengan `vm.recordLogs`, jadi yang menghasilkan layout adalah ABI
encoder EVM — bukan asumsi kita. `test_BorrowAmountIsNotTheUserAddress` secara
eksplisit menegaskan adapter TIDAK membaca word 0.

### 7b. `adapters/MorphoBlueAdapter.sol`
**Sumber:** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`

Morpho memakai `Id marketParams` alih-alih alamat reserve. Adapter harus memetakan
`Id` → `loanToken` lewat tabel yang di-set kurator saat registrasi, karena `Id` adalah
hash parameter pasar dan tidak bisa didekode menjadi alamat token dari log saja.
Event: `Borrow`, `Repay`, `Liquidate`, `SupplyCollateral`, `WithdrawCollateral`.

### 7c. `adapters/CompoundV3Adapter.sol`
**Sumber:** `0xc3d688B66703497DAA19211EEdff47f25384cdc3` (cUSDCv3)

Compound V3 tidak punya event `Borrow` terpisah — meminjam adalah `Withdraw` pada aset
dasar ketika saldo menjadi negatif. Adapter memetakan `Withdraw` → `LoanOriginated` dan
`Supply` → `LoanRepaid` **hanya untuk aset dasar**, dan
`SupplyCollateral`/`WithdrawCollateral` → fakta kolateral. Aset dasar di-set saat konstruksi.

> Nuansa ini harus didokumentasikan di komentar kode. Tanpa itu, pembaca berikutnya
> akan menyangka pemetaannya terbalik.

### Kasus uji adapter
| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | `Borrow` nyata dari mainnet | subject == `onBehalfOf`, bukan `user` |
| 2 | `Repay` oleh pihak ketiga | subject == `user`, bukan `repayer` |
| 3 | `LiquidationCall` | asset == `debtAsset`, amount == `debtToCover` |
| 4 | Signature event tak dikenal | `ok == false`, tanpa revert |
| 5 | Log dengan jumlah topics salah | `ok == false`, tanpa revert |

---

## 8. Harga — `ChainlinkAdapter.sol` + `PriceRegistry.sol`

**Tujuan.** Menilai kolateral **tanpa satu pun oracle terpusat.** Harga dibuktikan dari
event Chainlink `AnswerUpdated` di Ethereum, lewat jalur Attestcoin yang sama.

`AnswerUpdated(int256 current, uint256 indexed roundId, uint256 updatedAt)`
topic0 = `0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f`

### Feed (terverifikasi live)
| Pasangan | Proxy | Aggregator (emitter) |
|---|---|---|
| ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | `0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5` |
| BTC/USD | `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c` | `0x4a3411ac2948B33c69666B35cc6d055B27Ea84f1` |
| USDC/USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | `0xc9E1a09622afdB659913fefE800fEaE5DBbFe9d7` |

Semua feed berdesimal **8**.

### Storage `PriceRegistry`
```solidity
bytes32 public constant PRICE_RECORDER_ROLE = keccak256("PRICE_RECORDER_ROLE");

struct PriceData {
    uint256 answer;      // skala native feed (8 desimal)
    uint8   decimals;
    uint256 roundId;
    uint64  updatedAt;   // dari payload event
    uint64  recordedAt;  // block.timestamp Creditcoin
    uint64  sourceBlock;
}

mapping(address => PriceData) private _prices;         // asset  => harga
mapping(address => address)   public aggregatorOf;     // asset  => aggregator dipercaya
mapping(address => address)   public assetOfAggregator;// aggregator => asset
uint64 public maxPriceAge;                             // default 24 jam
```

### Fungsi
```solidity
function recordPrice(ProofBundle calldata bundle, bytes calldata encodedTransaction, address aggregator)
    external onlyRole(PRICE_RECORDER_ROLE);

/// @notice Harga; revert bila basi atau tidak ada.
function getPrice(address asset) external view returns (uint256 answer, uint8 decimals);

/// @notice Varian non-revert untuk pemanggil yang menangani ketidaktersediaan sendiri.
function tryGetPrice(address asset) external view returns (bool ok, uint256 answer, uint8 decimals);

/// @notice Nilai USD dalam WAD (1e18).
function toUsd1e18(address asset, uint256 amount, uint8 assetDecimals)
    external view returns (uint256);

function setAggregator(address asset, address aggregator, uint8 decimals) external onlyRole(CURATOR_ROLE);
function setMaxPriceAge(uint64 seconds_) external onlyRole(DEFAULT_ADMIN_ROLE);

error PriceUnavailable(address asset);
error PriceStale(address asset, uint64 recordedAt, uint64 maxAge);
error AggregatorNotTrusted(address aggregator);
error NegativeAnswer(int256 answer);
```

### Catatan keamanan

- **Aggregator Chainlink berganti saat upgrade feed.** Simpan **himpunan** aggregator
  tepercaya per aset dan sediakan `setAggregator`; jangan hardcode satu alamat.
  Indexer harus memanggil `aggregator()` pada proxy secara berkala dan memberi tahu
  kurator bila berubah. Tanpa ini, feed akan diam-diam berhenti terbarui saat Chainlink
  melakukan upgrade — gagal senyap, jenis kegagalan paling berbahaya.
- **`answer` bertipe `int256`.** Tolak nilai negatif — jangan cast ke `uint256` begitu saja.
- **Kesegaran wajib ditegakkan di titik baca**, bukan hanya saat tulis. Attestation lag
  ~8 menit dan indexer bisa mati; `EfficiencyMarket` harus membeku, bukan memakai harga basi.

### Kasus uji
| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | `AnswerUpdated` nyata dari mainnet | harga tercatat |
| 2 | Aggregator tak tepercaya | revert `AggregatorNotTrusted` |
| 3 | Baca harga umur > `maxPriceAge` | revert `PriceStale` |
| 4 | Aset tanpa feed | revert `PriceUnavailable` / `tryGetPrice` → false |
| 5 | Answer negatif | revert `NegativeAnswer` |
| 6 | Round lebih lama dari yang tersimpan | diabaikan (monoton) |

---

## 9. `CreditGraph.sol`

**Tujuan.** Memelihara skor 0..1000 per subjek, diperbarui **inkremental O(1)** setiap
satu fakta masuk. Rumus lengkap ada di `docs/scoring.md` — di sini hanya bentuk kontraknya.

### Storage
```solidity
bytes32 public constant FACT_CONSUMER_ROLE = keccak256("FACT_CONSUMER_ROLE");

struct SubjectState {
    uint256 repaidVolumeUsdWad;      // akumulasi USD (WAD) yang dilunasi, sudah dibobot
    uint256 liquidatedVolumeUsdWad;
    uint32  repaidCount;
    uint32  liquidationCount;
    uint32  originatedCount;
    uint64  firstFactAt;
    uint64  lastFactAt;
    uint64  protocolBitmap;          // bit per protokol terdaftar → diversity
    uint256 activeDebtUsdWad;
    uint256 activeCollateralUsdWad;
}

mapping(address => SubjectState) public stateOf;
IFactRegistry public immutable REGISTRY;
IPriceRegistry public priceRegistry;
```

### Fungsi
```solidity
/// @notice Dipanggil FactRegistry setiap satu fakta tercatat. HARUS O(1).
function applyFact(bytes32 factId) external onlyRole(FACT_CONSUMER_ROLE);

/// @notice Skor dan tier saat ini.
function scoreOf(address subject) external view returns (uint16 score, uint8 tier);

/// @notice Rincian enam komponen (urutan tetap sesuai ScoreComponentKey).
function componentsOf(address subject) external view returns (int32[6] memory points);

/// @notice Rasio kolateral yang berhak didapat, dalam bps.
function collateralRatioBpsOf(address subject) external view returns (uint16);

function setPriceRegistry(address registry) external onlyRole(DEFAULT_ADMIN_ROLE);

event ScoreUpdated(address indexed subject, uint16 oldScore, uint16 newScore, uint8 tier);
```

### Pemetaan tier (dikunci)
```solidity
function _tierOf(uint16 score) internal pure returns (uint8 tier, uint16 bps) {
    if (score >= 800) return (4, 11000);
    if (score >= 600) return (3, 12000);
    if (score >= 400) return (2, 13000);
    if (score >= 200) return (1, 14000);
    return (0, 15000);
}
```

### Catatan keamanan
- **`applyFact` wajib O(1).** Jangan pernah mengiterasi seluruh fakta subjek — jumlahnya
  tak terbatas dan akan mengunci `recordFact` ke kegagalan gas permanen.
- **Harga tidak tersedia tidak boleh menguntungkan subjek.** Bila harga hilang saat
  memproses `LoanRepaid`, kontribusi volume = 0. Bila hilang saat `Liquidated`, pakai
  penalti kasus terburuk. Asimetri ini disengaja (lihat `scoring.md` §2).
- **`applyFact` tidak boleh revert karena harga.** Kalau ia revert, `recordFact` ikut
  revert dan fakta yang sah jadi hilang. Tangani ketidaktersediaan harga, jangan lempar.
- **Fakta wajib idempoten (`factApplied`).** Tanpa dedupe, pemegang
  `FACT_CONSUMER_ROLE` bisa menggelembungkan skor siapa pun sampai 1000 hanya
  dengan menerapkan ulang SATU fakta yang sah berulang kali. Dengan dedupe, ia
  tetap hanya bisa menerapkan fakta yang benar-benar ada di registry, tepat sekali.
  Duplikat menjadi **no-op**, bukan revert — revert akan menjatuhkan `recordFact`.
- **Timestamp hanya boleh MAJU.** `lastPositiveFactAt` dan `lastLiquidationAt`
  wajib memakai `max(lama, baru)`, bukan penugasan langsung. Alur backfill
  "Claim your history" (B1) menerapkan fakta **lama setelah** fakta baru, jadi
  penugasan langsung akan:
  1. memundurkan jam recency, sehingga **mengklaim riwayat justru menurunkan
     skor** — kebalikan persis dari maksud fiturnya; dan
  2. yang jauh lebih buruk — likuidasi lama yang di-backfill akan **memutihkan**
     likuidasi baru. Pengguna yang dilikuidasi kemarin bisa memulihkan
     `standingPts` penuh hanya dengan mengklaim riwayat lama yang memuat
     likuidasi yang lebih tua.

  Dikunci sebagai tes (`test_BackfillingOldLiquidationDoesNotResetRecovery`) dan
  diverifikasi lewat mutation test: mencopot penjagaannya membuat tes gagal.
- **Akumulator memakai penjumlahan JENUH.** `weightedRepaidUsd1e18` dan
  `liquidationPenaltyPts` tumbuh tanpa batas. Overflow akan me-revert `applyFact`
  → me-revert `recordFact` → fakta hilang permanen. Keduanya toh di-clamp saat
  dibaca, jadi menjenuh di batas atas tidak mengubah apa pun yang terlihat.
- **`observedAt` dijepit ke `block.timestamp`.** Ia tidak dibuktikan kriptografis;
  tanggal MASA DEPAN akan membuat `now - observedAt` underflow dan **mengunci
  pembacaan skor subjek itu ke revert selamanya**. Backdating tetap mungkin — itu
  batas kepercayaan yang dinyatakan terbuka, bukan yang disembunyikan.
- **`tierOf` dibuat publik dengan sengaja.** Kalau ia privat, tes batas tier hanya
  bisa menyalin ulang tabelnya ke file tes lalu membandingkannya dengan dirinya
  sendiri — tautologi yang tetap hijau meski kontraknya salah.
- **Nomor bit protokol ditetapkan eksplisit, bukan diurutkan otomatis.** Kalau bit
  diturunkan dari posisi array, menghapus satu protokol akan menggeser bit
  protokol lain — dan itu diam-diam menulis ulang `protocolDiversity` setiap
  subjek yang sudah ada. Bitmap `uint8` memberi plafon 8 protokol.
- **`IPriceRegistry.toUsd1e18` di §8 tidak bisa dipakai apa adanya.** Ia meminta
  `assetDecimals` sebagai parameter, padahal struct `Fact` on-chain **tidak
  memuat** desimal aset — jadi `CreditGraph`, satu-satunya pemanggil, tidak punya
  nilai itu. Bentuk yang dipakai: `tryToUsd1e18(asset, amount) -> (usdWad, ok)`;
  registry menyimpan sendiri desimal per aset. §8 perlu diselaraskan saat
  `PriceRegistry` diimplementasikan.

### Kasus uji
| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | Alamat tanpa fakta | skor 0, tier 0, 15000 bps |
| 2 | Menambah `LoanRepaid` | skor naik, tak pernah turun |
| 3 | Menambah `Liquidated` | skor turun, tak pernah di bawah 0 |
| 4 | Skor tidak pernah > 1000 | clamp teruji |
| 5 | Harga tidak tersedia saat repay | tidak revert, kontribusi 0 |
| 6 | Batas tier tepat (199/200, 799/800) | bps benar |
| 7 | Gas `applyFact` konstan pada 1 vs 1000 fakta | selisih dalam toleransi |

---

## 10. `EfficiencyMarket.sol`

**Tujuan.** Pasar pinjam-meminjam di Creditcoin di mana rasio kolateral ditentukan
`CreditGraph`. **Semua pinjaman tetap over-kolateral** — ini bukan pinjaman tanpa jaminan.

### Storage
```solidity
struct Reserve {
    address asset;
    uint256 totalSupplied;
    uint256 totalBorrowed;
    uint256 liquidityIndex;      // WAD
    uint256 borrowIndex;         // WAD
    uint64  lastUpdated;
    uint16  reserveFactorBps;
    bool    active;
    bool    borrowEnabled;
}

struct Position {
    mapping(address => uint256) supplied;    // asset => scaled
    mapping(address => uint256) collateral;  // asset => raw
    mapping(address => uint256) debt;        // asset => scaled
}

mapping(address => Reserve)  public reserves;
address[] public reserveList;
mapping(address => Position) internal _positions;

ICreditGraph  public creditGraph;
IPriceRegistry public priceRegistry;
uint16 public liquidationBonusBps;   // mis. 500 = 5%
uint16 public closeFactorBps;        // mis. 5000 = 50%
```

### Fungsi
```solidity
function supply(address asset, uint256 amount) external nonReentrant;
function withdraw(address asset, uint256 amount) external nonReentrant;
function depositCollateral(address asset, uint256 amount) external nonReentrant;
function withdrawCollateral(address asset, uint256 amount) external nonReentrant;
function borrow(address asset, uint256 amount) external nonReentrant;
function repay(address asset, uint256 amount) external nonReentrant;
function liquidate(address user, address debtAsset, address collateralAsset, uint256 debtToCover)
    external nonReentrant;

// --- Baca ---
function collateralRatioBpsOf(address user) external view returns (uint16);
function accountData(address user) external view returns (
    uint256 totalCollateralUsdWad,
    uint256 totalDebtUsdWad,
    uint256 availableBorrowUsdWad,
    uint256 healthFactorWad
);
function capitalSavedUsdWad(address user) external view returns (uint256);

event Supplied(address indexed user, address indexed asset, uint256 amount);
event Borrowed(address indexed user, address indexed asset, uint256 amount, uint16 ratioBps);
event Repaid(address indexed user, address indexed asset, uint256 amount);
event Liquidated_(address indexed user, address indexed liquidator, address debtAsset, uint256 debtCovered);

error InsufficientCollateral(uint256 required, uint256 available);
error HealthFactorTooLow(uint256 hf);
error PositionHealthy(uint256 hf);
error ReserveInactive(address asset);
error BorrowDisabled(address asset);
error MarketFrozenStalePrice(address asset);
```

### Health factor
```
healthFactorWad = (totalCollateralUsdWad × 10000 / collateralRatioBps) / totalDebtUsdWad
```
`healthFactor < 1e18` → dapat dilikuidasi.

`collateralRatioBps` diambil dari `CreditGraph.collateralRatioBpsOf(user)` **pada saat
pinjam dan saat evaluasi kesehatan**.

> **Keputusan desain yang harus disengaja:** kalau skor user turun (misalnya kena
> likuidasi di Ethereum), rasio yang dipersyaratkan naik dan posisi yang tadinya sehat
> bisa langsung dapat dilikuidasi. Ini benar secara ekonomi tapi kasar bagi pengguna.
> **Mitigasi yang dipilih:** kunci rasio saat pinjam (`ratioAtBorrow` disimpan di posisi),
> dan terapkan rasio baru hanya pada pinjaman baru, plus masa tenggang untuk yang lama.
> Catat pilihan ini di kode — reviewer pasti menanyakannya.

### Catatan keamanan
- **`nonReentrant` di semua fungsi yang memindahkan token.** Pakai `SafeERC20`.
- **Bekukan pasar bila harga basi.** Kalau `PriceRegistry` menolak karena `PriceStale`,
  `borrow` dan `liquidate` harus revert, bukan memakai harga terakhir. Sirkuit ini
  mengubah keterbatasan protokol (lag 8 menit, indexer bisa mati) menjadi properti keamanan.
- **Token fee-on-transfer dan rebasing tidak didukung.** Tegakkan lewat allowlist aset kurator.
- **Checks-effects-interactions** di semua jalur.

### Kasus uji
| # | Skenario | Ekspektasi |
|---|---|---|
| 1 | Tier 0 pinjam pada 150% | sukses |
| 2 | Tier 0 mencoba pinjam pada 110% | revert `InsufficientCollateral` |
| 3 | Tier 4 pinjam pada 110% | sukses |
| 4 | Pinjam melebihi kapasitas tier | revert |
| 5 | Health factor turun < 1 | dapat dilikuidasi |
| 6 | Likuidasi posisi sehat | revert `PositionHealthy` |
| 7 | Harga basi | `borrow` revert `MarketFrozenStalePrice` |
| 8 | Serangan reentrancy pada `withdraw` | revert |
| 9 | Bunga terakumulasi antar blok | indeks naik monoton |
| 10 | Repay penuh membersihkan utang | debt == 0 |

---

## 11. Diagram Dependensi

```
                    ┌──────────────────────┐
                    │  Precompile 0x0FD2   │  (runtime Creditcoin)
                    │  Precompile 0x0fd3   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  AttestcoinReader    │  abstract
                    └──────┬───────┬───────┘
                           │       │
              ┌────────────▼──┐ ┌──▼──────────────┐
              │ FactRegistry  │ │ PriceRegistry   │
              └───┬────────┬──┘ └──┬──────────────┘
                  │        │       │
        ┌─────────▼──┐  ┌──▼───────▼──┐
        │  Adapters  │  │ CreditGraph │
        │ Aave/Morpho│  └──────┬──────┘
        │ Compound   │         │
        │ Chainlink  │  ┌──────▼───────────┐
        └────────────┘  │ EfficiencyMarket │
                        └──────────────────┘
```

`FactRegistry` dan `PriceRegistry` sama-sama mewarisi `AttestcoinReader` — keduanya
mengonsumsi transaksi Ethereum terbukti lewat gerbang yang sama.

---

## 12. Urutan Deploy & Konfigurasi

```
1. PriceRegistry
2. FactRegistry
3. CreditGraph(REGISTRY = FactRegistry)
4. Adapter: AaveV3Adapter, MorphoBlueAdapter, CompoundV3Adapter, ChainlinkAdapter
5. EfficiencyMarket
```

**Konfigurasi pasca-deploy (wajib, urut):**
```
FactRegistry.setChainKeyAllowed(3, true)          // Ethereum mainnet SAJA
PriceRegistry.setChainKeyAllowed(3, true)
FactRegistry.setCreditGraph(CreditGraph)
FactRegistry.registerAdapter(0x8787...4E2, AaveV3Adapter)
FactRegistry.registerAdapter(0xBBBB...FCb, MorphoBlueAdapter)
FactRegistry.registerAdapter(0xc3d6...dc3, CompoundV3Adapter)
PriceRegistry.setAggregator(WETH, 0x7d4E...Fb5, 8)
PriceRegistry.setAggregator(WBTC, 0x4a34...4f1, 8)
PriceRegistry.setAggregator(USDC, 0xc9E1...9d7, 8)
PriceRegistry.setMaxPriceAge(86400)
CreditGraph.setPriceRegistry(PriceRegistry)
CreditGraph.grantRole(FACT_CONSUMER_ROLE, FactRegistry)
FactRegistry.grantRole(RECORDER_ROLE, indexerWallet)
PriceRegistry.grantRole(PRICE_RECORDER_ROLE, indexerWallet)
EfficiencyMarket.setCreditGraph(CreditGraph)
EfficiencyMarket.setPriceRegistry(PriceRegistry)
```

> **Jangan lupa `setChainKeyAllowed`.** Tanpa itu setiap `recordFact` akan revert
> `ChainKeyNotAllowed`, dan gejalanya mudah disalahartikan sebagai proof rusak.
> Verifikasi konfigurasi dengan skrip cek sebelum menyalakan indexer.

---

## 13. Matriks Kontrol Akses

| Fungsi | DEFAULT_ADMIN | CURATOR | RECORDER | PRICE_RECORDER | FACT_CONSUMER | Publik |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `FactRegistry.recordFact` | | | ✅ | | | |
| `FactRegistry.recordFactBatch` | | | ✅ | | | |
| `FactRegistry.registerAdapter` | | ✅ | | | | |
| `FactRegistry.setCreditGraph` | ✅ | | | | | |
| `FactRegistry.setChainKeyAllowed` | ✅ | | | | | |
| `FactRegistry.getFact` / `factsOf` | | | | | | ✅ |
| `PriceRegistry.recordPrice` | | | | ✅ | | |
| `PriceRegistry.setAggregator` | | ✅ | | | | |
| `PriceRegistry.getPrice` | | | | | | ✅ |
| `CreditGraph.applyFact` | | | | | ✅ | |
| `CreditGraph.scoreOf` | | | | | | ✅ |
| `EfficiencyMarket.*` (user) | | | | | | ✅ |

**Pemegang peran:** `RECORDER_ROLE` dan `PRICE_RECORDER_ROLE` → dompet indexer.
`FACT_CONSUMER_ROLE` → kontrak `FactRegistry`. `DEFAULT_ADMIN_ROLE` → multisig
(untuk hackathon boleh EOA, tapi catat sebagai utang teknis di deck).

---

## 14. Pertimbangan Gas

| Operasi | Pendorong biaya | Mitigasi |
|---|---|---|
| Verifikasi proof | **Panjang continuity proof** — dominan | **Eager proving** (<24 jam): 10 hash vs 1000 |
| Merkle proof | Ukuran blok, ~11 hash untuk 1024 tx | tak signifikan |
| Decoding transaksi | Ukuran transaksi | hindari tx L2-batch raksasa |
| Penyimpanan fakta | ~5 slot per fakta | struct dikemas rapat (`uint32`/`uint64`) |
| `factsBySubject` push | 1 slot per fakta | dapat diterima; paginasi saat baca |
| `applyFact` | wajib O(1) | jangan pernah iterasi riwayat |
| Batch | 10 tx berbagi 1 continuity proof | penghematan terbesar yang tersedia |

Biaya referensi (dari tabel resmi Creditcoin):
`CTC ≈ 2,3×10⁻⁵ + 2,9×10⁻⁷ × (jumlah hash continuity)`
→ segar **2,59×10⁻⁵ CTC** · lewat 24 jam **3,13×10⁻⁴ CTC** (**~12x lebih mahal**)

**Konsekuensi:** biaya on-chain Corolary praktis nol selama indexer mengikuti secara
eager. Kalau indexer tertinggal lebih dari sehari, biaya melonjak sepuluh kali lipat —
itulah alasan alert keterlambatan indexer di `docs/indexer.md` bersifat operasional,
bukan sekadar kosmetik.

---

## 15. Ringkasan Kasus Uji

| Kontrak | Uji | Fokus |
|---|---|---|
| `AttestcoinReader` | 8 | tiga gerbang keamanan, replay |
| `FactRegistry` | 10 | pencatatan, multi-log, akses, batch |
| Adapter | 5 per adapter | pemilihan subjek, semantik amount |
| `PriceRegistry` | 6 | kepercayaan aggregator, kesegaran |
| `CreditGraph` | 7 | batas skor, tier, gas O(1) |
| `EfficiencyMarket` | 10 | kolateral per tier, likuidasi, reentrancy |

**Uji integrasi wajib (fork mainnet — data nyata, bukan karangan):**
1. Ambil transaksi Aave V3 `Repay` **nyata** dari Ethereum mainnet
2. Ambil proof asli dari Proof Builder CC3 Testnet (`chainKey 3`)
3. Panggil `FactRegistry.recordFact` dengan proof itu
4. Pastikan fakta tercatat dengan `subject` == `user` dari log
5. Pastikan `CreditGraph.scoreOf` naik
6. Pastikan `EfficiencyMarket.collateralRatioBpsOf` mencerminkan tier baru

> Uji ini **adalah milestone M1** di `docs/workstreams.md`. Kejar ini lebih dulu
> sebelum melengkapi kelima kontrak — kalau ada asumsi yang salah soal format proof
> atau decoding, kamu ingin menemukannya di hari pertama.
>
> Sampel proof nyata untuk referensi bentuk data ada di
> `docs/samples/proof-ethereum-mainnet.json`.
