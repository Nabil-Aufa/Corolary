// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {EvmV1TxBuilder} from "./helpers/EvmV1TxBuilder.sol";

/// @notice Membuktikan perkakas tes menghasilkan format yang SAMA dengan yang
///         dibaca decoder resmi. Tanpa ini, seluruh tes FactRegistry hanya
///         menguji perkakas kita terhadap dirinya sendiri.
contract EvmV1RoundTripTest is Test {
    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    function test_BuilderOutputIsReadableByOfficialDecoder() public pure {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = keccak256("Repay(address,address,address,uint256,bool)");
        topics[1] = bytes32(uint256(uint160(address(0xA1))));
        topics[2] = bytes32(uint256(uint160(address(0xB2))));
        topics[3] = bytes32(uint256(uint160(address(0xC3))));

        EvmV1Decoder.LogEntry[] memory logs = new EvmV1Decoder.LogEntry[](1);
        logs[0] = EvmV1Decoder.LogEntry({
            address_: AAVE_POOL, topics: topics, data: abi.encode(uint256(777), false)
        });

        bytes memory encoded = EvmV1TxBuilder.build(2, 1, logs);

        assertEq(EvmV1Decoder.getTransactionType(encoded), 2);
        EvmV1Decoder.ReceiptFields memory r = EvmV1Decoder.decodeReceiptFields(encoded);
        assertEq(uint256(r.receiptStatus), 1);
        assertEq(r.receiptLogs.length, 1);
        assertEq(r.receiptLogs[0].address_, AAVE_POOL);
        assertEq(r.receiptLogs[0].topics.length, 4);
        assertEq(r.receiptLogs[0].topics[0], topics[0]);
    }

    function test_BuilderCanExpressRevertedReceipt() public pure {
        EvmV1Decoder.LogEntry[] memory none = new EvmV1Decoder.LogEntry[](0);
        bytes memory encoded = EvmV1TxBuilder.build(2, 0, none);
        assertEq(uint256(EvmV1Decoder.decodeReceiptFields(encoded).receiptStatus), 0);
    }
}
