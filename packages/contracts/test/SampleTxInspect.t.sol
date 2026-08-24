// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";

contract SampleTxInspectTest is Test {
    function test_Dump() public view {
        bytes memory encodedTx = vm.parseJsonBytes(
            vm.readFile("../../docs/samples/proof-ethereum-mainnet.json"), ".txBytes"
        );
        EvmV1Decoder.ReceiptFields memory r = EvmV1Decoder.decodeReceiptFields(encodedTx);
        for (uint256 i; i < r.receiptLogs.length; ++i) {
            console.log("--- log", i);
            console.log("  emitter :", r.receiptLogs[i].address_);
            console.log("  topics  :", r.receiptLogs[i].topics.length);
            if (r.receiptLogs[i].topics.length > 0) {
                console.logBytes32(r.receiptLogs[i].topics[0]);
            }
            console.log("  dataLen :", r.receiptLogs[i].data.length);
        }
    }
}
