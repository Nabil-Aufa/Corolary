// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";

import {AttestcoinReader} from "./AttestcoinReader.sol";
import {Fact, FactKind, FactTypes} from "./libraries/FactTypes.sol";
import {IProtocolAdapter} from "./interfaces/IProtocolAdapter.sol";
import {ICreditGraph} from "./interfaces/ICreditGraph.sol";

/// @title FactRegistry
/// @notice Fakta terverifikasi dari Ethereum mainnet, disimpan permanen di Creditcoin.
///
/// @dev Ini inti produk Corolary. Yang membedakannya dari ZK-coprocessor
///      (Axiom/Herodotus/Brevis) bukan cara membuktikan, melainkan bahwa bukti
///      dibayar SEKALI lalu faktanya bisa dibaca gratis selamanya oleh dApp mana pun.
///      Biaya berbanding lurus dengan jumlah FAKTA, bukan jumlah PEMBACAAN.
///
///      Model kepercayaan, dinyatakan terbuka:
///      - `RECORDER_ROLE` tidak bisa memalsukan fakta. Setiap fakta harus lolos
///        proof precompile, cek receiptStatus, dan cek alamat emitter. Recorder
///        hanya memutuskan APA yang dicatat, bukan APAKAH itu benar.
///      - `CURATOR_ROLE` memutuskan protokol mana yang diakui. Ini kepercayaan
///        yang nyata: kurator jahat bisa mendaftarkan adapter yang menunjuk ke
///        kontrak peniru. Karena itu `registerAdapter` memaksa adapter menyetujui
///        alamat sumbernya sendiri, dan setiap registrasi memancarkan event.
contract FactRegistry is AccessControl, ReentrancyGuard, AttestcoinReader {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");

    mapping(bytes32 => Fact) private _facts;
    mapping(address => bytes32[]) private _factsBySubject;

    /// @notice sourceContract (di Ethereum) => adapter (di Creditcoin)
    mapping(address => address) public adapterOf;

    address[] public registeredProtocols;
    /// @dev posisi+1 di `registeredProtocols`; 0 berarti tidak terdaftar.
    mapping(address => uint256) private _protocolIndex;

    ICreditGraph public creditGraph;
    uint256 public totalFacts;

    event FactRecorded(
        bytes32 indexed factId,
        address indexed subject,
        FactKind indexed kind,
        address protocol,
        address asset,
        uint256 amount,
        uint64 blockHeight
    );
    event AdapterRegistered(
        address indexed sourceContract, address indexed adapter, string protocolName
    );
    event AdapterRemoved(address indexed sourceContract);
    event CreditGraphUpdated(address indexed creditGraph);
    event ChainKeyAllowanceUpdated(uint64 indexed chainKey, bool allowed);

    error NoAdapterForProtocol(address sourceContract);
    error NoRelevantLogs();
    error AdapterAlreadyRegistered(address sourceContract);
    error ZeroAddress();
    error AdapterSourceMismatch(address declared, address actual);
    error InvalidSubject();
    error FactNotFound(bytes32 factId);

    /// @dev Parameter `_harvest` dipadatkan jadi satu struct memory. Tujuh
    ///      parameter terpisah menabrak "stack too deep" bahkan dengan via_ir,
    ///      dan struct memory jauh lebih murah dibanding memecah loop.
    struct HarvestContext {
        uint64 chainKey;
        uint64 blockHeight;
        uint64 observedAt;
        uint32 txIndex;
    }

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------
    // Pencatatan
    // -------------------------------------------------------------

    /// @notice Catat semua fakta relevan dari SATU transaksi Ethereum terbukti.
    /// @param observedAt Waktu Ethereum saat event terjadi.
    ///        PERINGATAN: ini SATU-SATUNYA field yang tidak dibuktikan kriptografis —
    ///        receipt Ethereum tidak memuat timestamp, jadi ia tidak bisa diturunkan
    ///        on-chain. Ia diisi operator dan hanya untuk tampilan. Apa pun yang
    ///        security-relevant (urutan, durasi riwayat, kesegaran) HARUS memakai
    ///        `blockHeight`, yang dibuktikan. Lihat catatan di docs/contracts.md.
    function recordFact(
        ProofBundle calldata bundle,
        bytes calldata encodedTransaction,
        uint64 observedAt
    ) external onlyRole(RECORDER_ROLE) nonReentrant returns (bytes32[] memory factIds) {
        (EvmV1Decoder.ReceiptFields memory receipt, uint32 txIndex) =
            _verifyAndDecode(bundle, encodedTransaction);

        factIds = _harvest(
            receipt,
            HarvestContext({
                chainKey: bundle.chainKey,
                blockHeight: bundle.blockHeight,
                observedAt: observedAt,
                txIndex: txIndex
            })
        );
        if (factIds.length == 0) revert NoRelevantLogs();
    }

    /// @notice Versi batch - beberapa transaksi berbagi SATU continuity proof.
    /// @dev Penghematan biaya terbesar yang tersedia. Batas protokol: 10 transaksi,
    ///      rentang 1000 blok, ditegakkan di `_verifyBatch`.
    ///
    ///      Berbeda dari jalur tunggal, transaksi yang tidak menghasilkan fakta di
    ///      sini TIDAK me-revert batch. Satu transaksi tanpa log relevan tidak boleh
    ///      menjatuhkan sembilan yang sehat - itu justru mengalahkan tujuan batching.
    ///      Batch hanya revert kalau SELURUHNYA tidak menghasilkan apa pun.
    function recordFactBatch(
        BatchProofBundle calldata bundle,
        bytes[] calldata encodedTransactions,
        uint64[] calldata observedAts
    ) external onlyRole(RECORDER_ROLE) nonReentrant returns (bytes32[] memory factIds) {
        uint256 n = bundle.heights.length;
        if (observedAts.length != n) revert BatchLengthMismatch();

        uint32[] memory txIndexes = _verifyBatch(bundle, encodedTransactions);

        bytes32[] memory collected = new bytes32[](0);

        for (uint256 i; i < n; ++i) {
            EvmV1Decoder.ReceiptFields memory receipt =
                _decodeAndRequireSuccess(encodedTransactions[i]);

            bytes32[] memory part = _harvest(
                receipt,
                HarvestContext({
                    chainKey: bundle.chainKey,
                    blockHeight: bundle.heights[i],
                    observedAt: observedAts[i],
                    txIndex: txIndexes[i]
                })
            );
            collected = _concat(collected, part);
        }

        if (collected.length == 0) revert NoRelevantLogs();
        factIds = collected;
    }

    /// @dev Iterasi LANGSUNG atas `receipt.receiptLogs`, bukan
    ///      `getLogsByEventSignature`. Helper itu mengembalikan array TERFILTER
    ///      sehingga posisi asli tiap log hilang - dan karena `LogEntry` tidak
    ///      memuat `logIndex`, posisi iterasi adalah satu-satunya sumber indeks
    ///      yang deterministik. Memakai helper di sini akan membuat `factId`
    ///      bertabrakan antar log dalam satu transaksi yang sama.
    function _harvest(EvmV1Decoder.ReceiptFields memory receipt, HarvestContext memory ctx)
        private
        returns (bytes32[] memory factIds)
    {
        // `logCount` berasal dari receipt yang sudah didecode, jadi ia dibatasi
        // ukuran calldata transaksi - tidak mungkin mendekati 2^32. Cast `uint32(i)`
        // di bawah aman secara struktural, bukan secara harapan.
        uint256 logCount = receipt.receiptLogs.length;
        bytes32[] memory buffer = new bytes32[](logCount);
        uint256 found;

        for (uint256 i; i < logCount; ++i) {
            EvmV1Decoder.LogEntry memory log = receipt.receiptLogs[i];

            // GERBANG 3 - EMITTER, dalam bentuk terkuatnya.
            //
            // Adapter dipilih OLEH alamat emitter, bukan oleh parameter pemanggil.
            // Konsekuensinya, "adapter yang salah dipasangkan dengan log" bukan
            // sekadar tercegah - ia tidak bisa diungkapkan sama sekali. Log dari
            // kontrak peniru tidak punya adapter terdaftar, jadi ia dilewati.
            //
            // Ini juga memperbaiki cacat nyata: satu transaksi Ethereum bisa
            // menyentuh BEBERAPA protokol (aggregator, migrasi posisi). Karena
            // `queryId` dikunci per transaksi sumber, versi berparameter
            // `sourceContract` hanya sanggup mencatat protokol PERTAMA - panggilan
            // kedua kena QueryAlreadyProcessed dan fakta protokol kedua hilang
            // permanen. Memilih adapter per log menangkap semuanya dalam sekali jalan.
            //
            // Log yang tidak dikenali dilewati diam-diam, BUKAN revert: transaksi
            // nyata selalu memuat log token/router yang bukan urusan kita.
            address adapter = adapterOf[log.address_];
            if (adapter == address(0)) continue;

            (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
                IProtocolAdapter(adapter).decodeLog(log);
            if (!ok) continue;

            // Subjek nol berarti adapter rusak. Fatal, bukan dilewati: `_facts`
            // memakai `subject != 0` sebagai penanda keberadaan, jadi fakta
            // bersubjek nol akan tersimpan tapi terbaca "tidak ada" - lalu bisa
            // ditimpa diam-diam. Gagal keras di sini.
            if (subject == address(0)) revert InvalidSubject();

            // forge-lint: disable-next-line(unsafe-typecast)
            uint32 logIndex = uint32(i); // aman: lihat catatan pada logCount
            bytes32 factId =
                FactTypes.computeFactId(ctx.chainKey, ctx.blockHeight, ctx.txIndex, logIndex);

            // Pertahanan berlapis. Replay per-transaksi sudah dijaga `queryId`;
            // cek ini menangkap batch yang tumpang tindih.
            if (_facts[factId].subject != address(0)) continue;

            _facts[factId] = Fact({
                factId: factId,
                chainKey: ctx.chainKey,
                blockHeight: ctx.blockHeight,
                txIndex: ctx.txIndex,
                txLogIndex: logIndex,
                kind: kind,
                subject: subject,
                protocol: log.address_,
                asset: asset,
                amount: amount,
                observedAt: ctx.observedAt,
                recordedAt: uint64(block.timestamp)
            });
            _factsBySubject[subject].push(factId);
            unchecked {
                ++totalFacts;
                buffer[found++] = factId;
            }

            emit FactRecorded(factId, subject, kind, log.address_, asset, amount, ctx.blockHeight);

            // Panggilan eksternal TERAKHIR, setelah fakta tersimpan permanen
            // (checks-effects-interactions). Ditambah `nonReentrant` di entrypoint,
            // graph yang jahat pun tidak bisa masuk kembali.
            if (address(creditGraph) != address(0)) {
                creditGraph.applyFact(factId);
            }
        }

        factIds = new bytes32[](found);
        for (uint256 i; i < found; ++i) {
            factIds[i] = buffer[i];
        }
    }

    function _concat(bytes32[] memory a, bytes32[] memory b)
        private
        pure
        returns (bytes32[] memory out)
    {
        out = new bytes32[](a.length + b.length);
        for (uint256 i; i < a.length; ++i) {
            out[i] = a[i];
        }
        for (uint256 i; i < b.length; ++i) {
            out[a.length + i] = b[i];
        }
    }

    // -------------------------------------------------------------
    // Kurasi
    // -------------------------------------------------------------

    /// @dev Adapter harus MENYETUJUI alamat sumbernya sendiri. Tanpa cek ini,
    ///      kurator yang salah ketik akan memasang adapter Aave di bawah alamat
    ///      sumber lain - dan gerbang emitter kemudian membandingkan log terhadap
    ///      alamat yang salah, sehingga log peniru bisa lolos.
    function registerAdapter(address sourceContract, address adapter)
        external
        onlyRole(CURATOR_ROLE)
    {
        if (sourceContract == address(0) || adapter == address(0)) revert ZeroAddress();
        if (adapterOf[sourceContract] != address(0)) {
            revert AdapterAlreadyRegistered(sourceContract);
        }

        address declared = IProtocolAdapter(adapter).sourceContract();
        if (declared != sourceContract) revert AdapterSourceMismatch(declared, sourceContract);

        adapterOf[sourceContract] = adapter;
        registeredProtocols.push(sourceContract);
        _protocolIndex[sourceContract] = registeredProtocols.length;

        emit AdapterRegistered(sourceContract, adapter, IProtocolAdapter(adapter).protocolName());
    }

    function removeAdapter(address sourceContract) external onlyRole(CURATOR_ROLE) {
        if (adapterOf[sourceContract] == address(0)) revert NoAdapterForProtocol(sourceContract);

        delete adapterOf[sourceContract];

        // swap-and-pop supaya `registeredProtocols` tidak menyimpan lubang.
        uint256 idx = _protocolIndex[sourceContract];
        uint256 last = registeredProtocols.length;
        if (idx != last) {
            address moved = registeredProtocols[last - 1];
            registeredProtocols[idx - 1] = moved;
            _protocolIndex[moved] = idx;
        }
        registeredProtocols.pop();
        delete _protocolIndex[sourceContract];

        emit AdapterRemoved(sourceContract);
    }

    function setCreditGraph(address graph) external onlyRole(DEFAULT_ADMIN_ROLE) {
        creditGraph = ICreditGraph(graph);
        emit CreditGraphUpdated(graph);
    }

    function setChainKeyAllowed(uint64 chainKey, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setChainKeyAllowed(chainKey, allowed);
        emit ChainKeyAllowanceUpdated(chainKey, allowed);
    }

    // -------------------------------------------------------------
    // Baca - ini nilai infrastrukturnya, dan gratis selamanya
    // -------------------------------------------------------------

    function getFact(bytes32 factId) external view returns (Fact memory fact) {
        fact = _facts[factId];
        if (fact.subject == address(0)) revert FactNotFound(factId);
    }

    function factExists(bytes32 factId) external view returns (bool) {
        return _facts[factId].subject != address(0);
    }

    function factCountOf(address subject) external view returns (uint256) {
        return _factsBySubject[subject].length;
    }

    function factIdsOf(address subject, uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory page)
    {
        bytes32[] storage all = _factsBySubject[subject];
        (uint256 start, uint256 count) = _pageBounds(all.length, offset, limit);
        page = new bytes32[](count);
        for (uint256 i; i < count; ++i) {
            page[i] = all[start + i];
        }
    }

    function factsOf(address subject, uint256 offset, uint256 limit)
        external
        view
        returns (Fact[] memory page)
    {
        bytes32[] storage all = _factsBySubject[subject];
        (uint256 start, uint256 count) = _pageBounds(all.length, offset, limit);
        page = new Fact[](count);
        for (uint256 i; i < count; ++i) {
            page[i] = _facts[all[start + i]];
        }
    }

    function protocolCount() external view returns (uint256) {
        return registeredProtocols.length;
    }

    /// @dev Offset di luar batas mengembalikan halaman kosong, bukan revert -
    ///      pemanggil yang melakukan paginasi tidak boleh gagal di ujung data.
    function _pageBounds(uint256 total, uint256 offset, uint256 limit)
        private
        pure
        returns (uint256 start, uint256 count)
    {
        if (offset >= total) return (0, 0);
        start = offset;
        count = total - offset;
        if (count > limit) count = limit;
    }
}
