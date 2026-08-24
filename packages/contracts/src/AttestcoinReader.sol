// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";

/// @title AttestcoinReader
/// @notice Satu-satunya tempat di Corolary yang berbicara dengan precompile Attestcoin.
///         Tidak ada kontrak lain yang boleh memanggil `0x...0FD2` langsung.
///
/// @dev Tiga gerbang keamanan hidup di sini. Melewati salah satunya meracuni registry
///      secara permanen, dan registry adalah produk sesungguhnya:
///
///      Gerbang 1 - INKLUSI. Precompile membuktikan transaksi ada di blok Ethereum
///        yang sah. Ini satu-satunya hal yang dibuktikannya.
///
///      Gerbang 2 - SUKSES. Precompile TIDAK mengecek transaksi sumber berhasil atau
///        revert. Tanpa `receiptStatus == 1`, transaksi Aave yang GAGAL tetap punya
///        proof yang sepenuhnya sah dan akan tercatat sebagai pelunasan nyata.
///
///      Gerbang 3 - EMITTER. "Log ini ada di transaksi ini" bukan berarti "log ini
///        dari Aave". Siapa pun bisa men-deploy kontrak peniru yang memancarkan event
///        bersignature identik; proof-nya akan sah sempurna. Gerbang ini ditegakkan
///        di FactRegistry per log, memakai `_requireEmitter`.
///
///      Ditambah replay protection lewat `queryId` per transaksi sumber.
abstract contract AttestcoinReader {
    /// @notice Batas protokol Attestcoin: maksimum transaksi per batch proof.
    uint256 internal constant MAX_BATCH_SIZE = 10;

    /// @notice Batas protokol Attestcoin: rentang blok maksimum dalam satu batch.
    uint64 internal constant MAX_BATCH_BLOCK_RANGE = 1000;

    INativeQueryVerifier public immutable VERIFIER;

    /// @notice queryId => sudah diproses. Satu transaksi sumber hanya sekali,
    ///         berapa pun jumlah log yang dikandungnya.
    mapping(bytes32 => bool) public processedQueries;

    /// @notice chainKey => diizinkan. Produksi: hanya 3 (Ethereum mainnet).
    ///         Sengaja kosong saat deploy - harus di-set eksplisit, supaya
    ///         "lupa mengonfigurasi" gagal keras, bukan menerima chain apa pun.
    mapping(uint64 => bool) public allowedChainKeys;

    error QueryAlreadyProcessed(bytes32 queryId);
    error ProofVerificationFailed();
    error SourceTransactionReverted();
    error UnsupportedTransactionType(uint8 txType);
    error ChainKeyNotAllowed(uint64 chainKey);
    error EmitterNotAuthorized(address emitter, address expected);
    error PrecompileUnavailable();
    error BatchTooLarge(uint256 size, uint256 maxSize);
    error BatchEmpty();
    error BatchLengthMismatch();
    error BatchBlockRangeExceeded(uint64 span, uint64 maxSpan);
    error TxIndexOutOfRange(uint64 txIndex);

    constructor() {
        // Gagal cepat kalau di-deploy ke chain tanpa precompile Block Prover.
        // Tanpa guard ini, kegagalannya tertunda sampai fakta pertama masuk -
        // yaitu saat demo, bukan saat deploy.
        if (!NativeQueryVerifierLib.hasPrecompile()) revert PrecompileUnavailable();
        VERIFIER = NativeQueryVerifierLib.getVerifier();
    }

    struct ProofBundle {
        uint64 chainKey;
        uint64 blockHeight;
        bytes32 merkleRoot;
        INativeQueryVerifier.MerkleProofEntry[] siblings;
        bytes32 lowerEndpointDigest;
        bytes32[] continuityRoots;
    }

    struct BatchProofBundle {
        uint64 chainKey;
        uint64[] heights;
        INativeQueryVerifier.MerkleProof[] merkleProofs;
        INativeQueryVerifier.ContinuityProof sharedContinuityProof;
    }

    // -------------------------------------------------------------
    // Jalur tunggal
    // -------------------------------------------------------------

    /// @notice Gerbang tunggal: verifikasi proof + validasi receipt + replay protection.
    /// @return receipt field receipt yang sudah didecode, siap dipakai pemanggil
    /// @return txIndex indeks transaksi dalam blok, diturunkan dari merkle proof
    function _verifyAndDecode(ProofBundle calldata bundle, bytes calldata encodedTransaction)
        internal
        returns (EvmV1Decoder.ReceiptFields memory receipt, uint32 txIndex)
    {
        if (!allowedChainKeys[bundle.chainKey]) revert ChainKeyNotAllowed(bundle.chainKey);

        INativeQueryVerifier.MerkleProof memory mp =
            INativeQueryVerifier.MerkleProof({root: bundle.merkleRoot, siblings: bundle.siblings});

        txIndex = _toTxIndex(VERIFIER.calculateTxIndex(mp));

        // Replay ditandai SEBELUM kerja mahal (checks-effects). Kalau verifikasi
        // di bawah gagal, transaksi revert dan tanda ini ikut ter-rollback.
        _markProcessed(bundle.chainKey, bundle.blockHeight, txIndex);

        INativeQueryVerifier.ContinuityProof memory cp = INativeQueryVerifier.ContinuityProof({
            lowerEndpointDigest: bundle.lowerEndpointDigest, roots: bundle.continuityRoots
        });

        // --- Gerbang 1: inklusi terbukti ---
        if (!VERIFIER.verifyAndEmit(
                bundle.chainKey, bundle.blockHeight, encodedTransaction, mp, cp
            )) {
            revert ProofVerificationFailed();
        }

        // --- Gerbang 2: transaksi sumber BENAR-BENAR sukses ---
        receipt = _decodeAndRequireSuccess(encodedTransaction);
    }

    // -------------------------------------------------------------
    // Jalur batch - satu continuity proof untuk hingga 10 transaksi
    // -------------------------------------------------------------

    /// @notice Verifikasi satu batch transaksi dengan SATU continuity proof bersama.
    /// @dev Di sinilah penghematan biaya terbesar Corolary berada. Precompile
    ///      mengembalikan satu `bool` untuk seluruh batch, jadi perilakunya
    ///      all-or-nothing: satu proof buruk menjatuhkan sembilan yang sehat.
    ///      Indexer harus punya fallback per-transaksi.
    /// @return txIndexes indeks transaksi per elemen batch, urutannya sejajar input
    function _verifyBatch(BatchProofBundle calldata bundle, bytes[] calldata encodedTransactions)
        internal
        returns (uint32[] memory txIndexes)
    {
        if (!allowedChainKeys[bundle.chainKey]) revert ChainKeyNotAllowed(bundle.chainKey);

        uint256 n = bundle.heights.length;
        if (n == 0) revert BatchEmpty();
        if (n > MAX_BATCH_SIZE) revert BatchTooLarge(n, MAX_BATCH_SIZE);

        // Panjang yang tidak sejajar akan memasangkan proof dengan transaksi yang
        // salah. Kalau kebetulan tetap lolos verifikasi, fakta akan tercatat dengan
        // tinggi blok yang salah - dan itu korupsi diam-diam, bukan revert.
        if (encodedTransactions.length != n || bundle.merkleProofs.length != n) {
            revert BatchLengthMismatch();
        }

        txIndexes = new uint32[](n);

        uint64 minHeight = type(uint64).max;
        uint64 maxHeight;

        for (uint256 i; i < n; ++i) {
            uint64 h = bundle.heights[i];
            if (h < minHeight) minHeight = h;
            if (h > maxHeight) maxHeight = h;

            uint32 txIndex = _toTxIndex(VERIFIER.calculateTxIndex(bundle.merkleProofs[i]));
            txIndexes[i] = txIndex;

            // Menandai setiap elemen juga menangkap batch yang memuat transaksi
            // yang sama dua kali - kemunculan kedua revert di sini.
            _markProcessed(bundle.chainKey, h, txIndex);
        }

        uint64 span = maxHeight - minHeight;
        if (span >= MAX_BATCH_BLOCK_RANGE) {
            revert BatchBlockRangeExceeded(span, MAX_BATCH_BLOCK_RANGE);
        }

        // --- Gerbang 1, sekali untuk seluruh batch ---
        if (!VERIFIER.verifyAndEmit(
                bundle.chainKey,
                bundle.heights,
                encodedTransactions,
                bundle.merkleProofs,
                bundle.sharedContinuityProof
            )) {
            revert ProofVerificationFailed();
        }
    }

    // -------------------------------------------------------------
    // Helper internal
    // -------------------------------------------------------------

    /// @dev Gerbang 2, terisolasi supaya jalur tunggal dan batch memakai kode
    ///      yang sama persis. Cek yang hanya ada di satu jalur adalah cek yang
    ///      akan lupa diperbarui di jalur lain.
    function _decodeAndRequireSuccess(bytes calldata encodedTransaction)
        internal
        pure
        returns (EvmV1Decoder.ReceiptFields memory receipt)
    {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        if (!EvmV1Decoder.isValidTransactionType(txType)) {
            revert UnsupportedTransactionType(txType);
        }

        receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert SourceTransactionReverted();
    }

    /// @dev `calculateTxIndex` mengembalikan uint64, sedangkan `queryId` dan `factId`
    ///      memakai uint32. Pemotongan diam-diam di sini akan memetakan dua transaksi
    ///      berbeda ke queryId yang SAMA - satu bisa memblokir pencatatan yang lain
    ///      secara permanen, dan `factId` pun bisa bertabrakan. Blok Ethereum nyata
    ///      tidak pernah mendekati 2^32 transaksi, jadi ini seharusnya mustahil -
    ///      justru karena itu ia harus revert, bukan dipotong.
    function _toTxIndex(uint64 raw) private pure returns (uint32) {
        if (raw > type(uint32).max) revert TxIndexOutOfRange(raw);
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(raw); // aman: batas atas sudah dicek di baris sebelumnya
    }

    function _markProcessed(uint64 chainKey, uint64 blockHeight, uint32 txIndex) private {
        bytes32 queryId = _computeQueryId(chainKey, blockHeight, txIndex);
        if (processedQueries[queryId]) revert QueryAlreadyProcessed(queryId);
        processedQueries[queryId] = true;
    }

    function _computeQueryId(uint64 chainKey, uint64 blockHeight, uint32 txIndex)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(chainKey, blockHeight, txIndex));
    }

    /// @dev Gerbang 3 - dipanggil per log oleh turunan.
    function _requireEmitter(address actual, address expected) internal pure {
        if (actual != expected) revert EmitterNotAuthorized(actual, expected);
    }

    /// @dev Turunan wajib menyediakan kontrol akses untuk ini.
    function _setChainKeyAllowed(uint64 chainKey, bool allowed) internal {
        allowedChainKeys[chainKey] = allowed;
    }
}
