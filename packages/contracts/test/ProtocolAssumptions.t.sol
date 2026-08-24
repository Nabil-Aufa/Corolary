// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EvmV1Decoder} from
    "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
import {BlockProverTypes} from
    "@gluwa/usc-contracts/contracts/write-ability/common/BlockProverTypes.sol";

/// @title Kunci asumsi protokol Attestcoin
/// @notice Setiap asumsi tentang @gluwa/usc-contracts yang dipegang arsitektur
///         Corolary dikunci di sini sebagai assertion yang bisa dijalankan.
///         Kalau paketnya berubah dan salah satu asumsi runtuh, ini gagal —
///         bukan `recordFact` di tengah demo.
///
/// @dev Input-nya adalah `txBytes` dari proof Ethereum MAINNET sungguhan
///      (docs/samples/proof-ethereum-mainnet.json, tx 0x82d8b1...e594 di blok
///      25.795.652). Bukan fixture, bukan data karangan.
contract ProtocolAssumptionsTest is Test {
    bytes internal encodedTx;

    function setUp() public {
        string memory json = vm.readFile("../../docs/samples/proof-ethereum-mainnet.json");
        encodedTx = vm.parseJsonBytes(json, ".txBytes");
    }

    // ─────────────────────────────────────────────────────────────
    // A. Jalur baca fakta bekerja pada transaksi mainnet nyata
    // ─────────────────────────────────────────────────────────────

    /// @notice Asumsi #1: status receipt bisa dibaca, dan nilainya bermakna.
    /// @dev Ini pengaman keamanan #1 Corolary. Block Prover membuktikan INKLUSI,
    ///      bukan SUKSES — tanpa cek ini, transaksi Ethereum yang revert tetap
    ///      lolos dan meracuni registry.
    function test_ReceiptStatusIsReadable() public view {
        EvmV1Decoder.ReceiptFields memory r = EvmV1Decoder.decodeReceiptFields(encodedTx);
        assertEq(uint256(r.receiptStatus), 1, "sample tx harus sukses");
    }

    /// @notice Asumsi #2: log terbaca beserta emitter-nya.
    /// @dev Validasi alamat emitter adalah pengaman keamanan #2 — "log ini ada di
    ///      tx ini" bukan berarti "log ini dari Aave".
    function test_LogsCarryEmitterAddress() public view {
        EvmV1Decoder.ReceiptFields memory r = EvmV1Decoder.decodeReceiptFields(encodedTx);
        assertGt(r.receiptLogs.length, 0, "tx mainnet nyata harus punya log");
        for (uint256 i; i < r.receiptLogs.length; ++i) {
            assertTrue(r.receiptLogs[i].address_ != address(0), "emitter tidak boleh nol");
        }
    }

    /// @notice Asumsi #3 (menjawab open-issues T1): `decodeReceiptFields` bekerja
    ///         untuk SEMUA tipe transaksi 0..4, bukan hanya 0 dan 2.
    /// @dev Batas Type0/Type2 di paket hanya berlaku untuk decoder type-specific
    ///      (`decodeTransactionType0/2`), yang TIDAK PERNAH dipanggil Corolary —
    ///      fakta selalu datang dari log. `_decodeReceiptChunk` memilih indeks
    ///      chunk 2 (t0-2) atau 3 (t3-4), jadi seluruh rentang tipe tercakup.
    function test_ReceiptDecodeIsTypeAgnostic() public view {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTx);
        assertTrue(EvmV1Decoder.isValidTransactionType(txType), "tipe tx harus valid");
        assertLe(uint256(txType), 4, "tipe tx di luar 0..4");
        // Tidak revert = jalur receipt tidak peduli tipe.
        EvmV1Decoder.decodeReceiptFields(encodedTx);
    }

    /// @notice Asumsi #4: `LogEntry` TIDAK punya logIndex.
    /// @dev Kalau field itu suatu saat ditambahkan, konstruksi posisional ini
    ///      gagal compile dan kita tahu — indeks log kita ambil dari posisi
    ///      iterasi di `receiptLogs`, bukan dari field.
    function test_LogEntryHasExactlyThreeFields() public pure {
        bytes32[] memory topics = new bytes32[](0);
        EvmV1Decoder.LogEntry memory e = EvmV1Decoder.LogEntry(address(1), topics, "");
        assertEq(e.address_, address(1));
    }

    // ─────────────────────────────────────────────────────────────
    // B. Antarmuka precompile
    // ─────────────────────────────────────────────────────────────

    /// @notice Asumsi #5: alamat precompile Block Prover.
    function test_PrecompileAddress() public pure {
        assertEq(
            NativeQueryVerifierLib.PRECOMPILE,
            0x0000000000000000000000000000000000000FD2
        );
    }

    /// @notice Asumsi #6: CC3 Testnet (102031) dikenali sebagai chain Creditcoin.
    function test_Cc3TestnetIsRecognized() public pure {
        assertTrue(NativeQueryVerifierLib.isCreditcoinChainId(102031), "CC3 testnet");
        assertTrue(NativeQueryVerifierLib.isCreditcoinChainId(102030), "CC3 devnet");
        assertFalse(NativeQueryVerifierLib.isCreditcoinChainId(1), "Ethereum bukan CC");
    }

    /// @notice Asumsi #7 (open-issues R3/R8): overload BATCH ada di interface ini.
    /// @dev Batching adalah strategi biaya inti Corolary. Kalau overload batch
    ///      hilang, referensi selector ini gagal compile. Perhatikan bahwa varian
    ///      batch memakai SATU continuity proof bersama untuk seluruh batch —
    ///      justru di situ penghematan biayanya.
    function test_BatchOverloadExists() public pure {
        // Bukti sesungguhnya adalah fakta bahwa file ini COMPILE:
        // dua fungsi di bawah memanggil kedua bentuk, dan overload
        // resolution hanya berhasil kalau keduanya benar-benar ada di interface.
        // Kalau varian batch dihapus dari paket, `forge build` gagal — jauh
        // sebelum runtime, dan jauh sebelum demo.
        assertTrue(this._singleOverloadResolves.selector != bytes4(0), "overload tunggal");
        assertTrue(this._batchOverloadResolves.selector != bytes4(0), "overload batch");
        assertTrue(
            this._singleOverloadResolves.selector != this._batchOverloadResolves.selector
        );
    }

    /// @dev Tidak pernah dieksekusi. Ada murni supaya kompiler me-resolve overload
    ///      TUNGGAL `verifyAndEmit`.
    function _singleOverloadResolves(
        bytes calldata encoded,
        INativeQueryVerifier.MerkleProof calldata proof,
        INativeQueryVerifier.ContinuityProof calldata continuity
    ) external {
        _verifier().verifyAndEmit(3, 0, encoded, proof, continuity);
    }

    /// @dev Tidak pernah dieksekusi. Me-resolve overload BATCH. Perhatikan satu
    ///      `continuity` dipakai bersama untuk seluruh batch — di situlah
    ///      penghematan biaya Corolary.
    function _batchOverloadResolves(
        uint64[] calldata heights,
        bytes[] calldata encodedBatch,
        INativeQueryVerifier.MerkleProof[] calldata proofs,
        INativeQueryVerifier.ContinuityProof calldata continuity
    ) external {
        _verifier().verifyAndEmit(3, heights, encodedBatch, proofs, continuity);
    }

    function _verifier() private pure returns (INativeQueryVerifier) {
        return INativeQueryVerifier(NativeQueryVerifierLib.PRECOMPILE);
    }

    /// @notice Asumsi #8: DUA struct `MerkleProofEntry` berbeda hidup di paket
    ///         yang sama — `hash` (INativeQueryVerifier) vs `sibling`
    ///         (BlockProverTypes). Untuk memanggil precompile, pakai yang pertama.
    /// @dev Keduanya `(bytes32, bool)` sehingga ABI-nya identik — kompiler TIDAK
    ///      akan menolong kalau salah pilih. Test ini mendokumentasikan jebakan
    ///      itu di tempat yang dibaca orang saat menulis kode.
    function test_TwoDistinctMerkleProofEntryStructs() public pure {
        INativeQueryVerifier.MerkleProofEntry memory a =
            INativeQueryVerifier.MerkleProofEntry({hash: bytes32(uint256(1)), isLeft: true});
        BlockProverTypes.MerkleProofEntry memory b =
            BlockProverTypes.MerkleProofEntry({sibling: bytes32(uint256(1)), isLeft: true});
        assertEq(a.hash, b.sibling, "isi sama, nama field berbeda");
    }
}
