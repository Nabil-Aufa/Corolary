// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {EvmV1Decoder} from
    "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";

/// @notice Profil gas jalur decode receipt — menjawab open-issues T2 dengan
///         pengukuran, bukan tebakan. Input: tx Ethereum mainnet nyata.
contract ReceiptGasProfileTest is Test {
    bytes internal encodedTx;

    function setUp() public {
        encodedTx = vm.parseJsonBytes(
            vm.readFile("../../docs/samples/proof-ethereum-mainnet.json"), ".txBytes"
        );
    }

    function test_ProfileDecodeAndIterate() public view {
        uint256 g0 = gasleft();
        EvmV1Decoder.ReceiptFields memory r = EvmV1Decoder.decodeReceiptFields(encodedTx);
        uint256 decodeGas = g0 - gasleft();

        uint256 g1 = gasleft();
        uint256 topicCount;
        for (uint256 i; i < r.receiptLogs.length; ++i) {
            topicCount += r.receiptLogs[i].topics.length;
        }
        uint256 iterGas = g1 - gasleft();

        console.log("tx type          :", EvmV1Decoder.getTransactionType(encodedTx));
        console.log("encodedTx bytes  :", encodedTx.length);
        console.log("receiptStatus    :", r.receiptStatus);
        console.log("log count        :", r.receiptLogs.length);
        console.log("total topics     :", topicCount);
        console.log("decode gas       :", decodeGas);
        console.log("iterate logs gas :", iterGas);
        console.log("SUM              :", decodeGas + iterGas);
    }
}
