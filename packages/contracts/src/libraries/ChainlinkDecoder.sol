// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";

/// @title ChainlinkDecoder
/// @notice Membaca event `AnswerUpdated` dari aggregator Chainlink.
///
/// @dev Deklarasi resmi (diverifikasi 2026-08-25):
///
///        event AnswerUpdated(int256 indexed current, uint256 indexed roundId,
///                            uint256 updatedAt)
///
///      Perhatikan `current` **di-index** — harganya ada di TOPIC, bukan di `data`.
///      Ini kebalikan dari intuisi biasa dan kebalikan dari pola Aave/Morpho, di
///      mana jumlah selalu non-indexed. Membaca `data[0]` sebagai harga akan
///      menghasilkan **timestamp** `updatedAt` — angka sekitar 1,8×10⁹ yang terlihat
///      seperti harga masuk akal untuk feed berdesimal 8 (≈$18). Kesalahan itu
///      tidak akan terlihat seperti kesalahan.
///
///      Tata letaknya:
///        topics[0] = signature
///        topics[1] = current  (int256, harga)
///        topics[2] = roundId
///        data[0]   = updatedAt (waktu Ethereum, TERBUKTI — beda dari Fact.observedAt)
library ChainlinkDecoder {
    bytes32 internal constant ANSWER_UPDATED_SIG =
        0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f;

    /// @notice Decode satu log `AnswerUpdated`.
    /// @return ok false bila log ini bukan `AnswerUpdated` yang berbentuk benar
    /// @return answer harga mentah pada skala native feed, sebagai int256
    /// @return roundId nomor ronde
    /// @return updatedAt waktu Ethereum saat ronde ini selesai
    function decodeAnswerUpdated(EvmV1Decoder.LogEntry memory log)
        internal
        pure
        returns (bool ok, int256 answer, uint256 roundId, uint64 updatedAt)
    {
        // `AnswerUpdated` punya dua parameter indexed, jadi tepat 3 topic.
        if (log.topics.length != 3 || log.topics[0] != ANSWER_UPDATED_SIG) {
            return (false, 0, 0, 0);
        }
        if (log.data.length < 32) return (false, 0, 0, 0);

        answer = int256(uint256(log.topics[1]));
        roundId = uint256(log.topics[2]);

        uint256 ts;
        bytes memory data = log.data;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            ts := mload(add(data, 32))
        }
        // Timestamp Ethereum tidak akan mendekati 2^64 dalam umur alam semesta;
        // dijepit alih-alih dipotong supaya nilai rusak tidak lolos diam-diam.
        if (ts > type(uint64).max) return (false, 0, 0, 0);

        // forge-lint: disable-next-line(unsafe-typecast)
        updatedAt = uint64(ts); // aman: batas atas dicek di baris sebelumnya
        ok = true;
    }
}
