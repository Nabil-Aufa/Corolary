// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";

/// @notice Menyusun `encodedTransaction` berformat EvmV1 untuk keperluan tes.
/// @dev Ini perkakas TES, bukan data produk. Ia hanya membangun amplop transaksi
///      supaya `FactRegistry` bisa dijalankan tanpa jaringan; isi log-nya tetap
///      dipancarkan EVM sungguhan lewat `vm.recordLogs`.
///
///      Formatnya disalin dari `EvmV1Decoder._decodeReceiptChunk`:
///        abi.encode(uint8 txType, bytes[3] chunks)
///        chunks[2] = abi.encode(uint8 status, uint64 gasUsed, LogEntryTuple[], bytes bloom)
///
///      `EvmV1RoundTripTest` membuktikan keluaran builder ini benar-benar bisa
///      dibaca decoder resmi - kalau formatnya meleset, tes itu gagal.
library EvmV1TxBuilder {
    function build(uint8 txType, uint8 receiptStatus, EvmV1Decoder.LogEntry[] memory logs)
        internal
        pure
        returns (bytes memory)
    {
        EvmV1Decoder.LogEntryTuple[] memory tuples = new EvmV1Decoder.LogEntryTuple[](logs.length);
        for (uint256 i; i < logs.length; ++i) {
            tuples[i] = EvmV1Decoder.LogEntryTuple({
                address_: logs[i].address_, topics: logs[i].topics, data: logs[i].data
            });
        }

        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(
            uint64(0), uint64(21000), address(0), false, address(0), uint256(0), bytes("")
        );
        chunks[1] = "";
        chunks[2] = abi.encode(receiptStatus, uint64(100000), tuples, bytes(""));

        return abi.encode(txType, chunks);
    }
}
