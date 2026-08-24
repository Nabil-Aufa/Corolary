// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {
    INativeQueryVerifier
} from "@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {PriceRegistry} from "../src/PriceRegistry.sol";
import {AttestcoinReader} from "../src/AttestcoinReader.sol";
import {ChainlinkDecoder} from "../src/libraries/ChainlinkDecoder.sol";
import {EvmV1TxBuilder} from "./helpers/EvmV1TxBuilder.sol";

/// @notice Deklarasi IDENTIK dengan Chainlink AggregatorInterface.
contract ChainlinkEmitter {
    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt);

    function push(int256 current, uint256 roundId, uint256 updatedAt) external {
        emit AnswerUpdated(current, roundId, updatedAt);
    }
}

contract PriceRegistryTest is Test {
    address internal constant PRECOMPILE = 0x0000000000000000000000000000000000000FD2;
    uint64 internal constant ETH_MAINNET = 3;
    uint64 internal constant SEPOLIA = 1;
    uint64 internal constant HEIGHT = 25_795_652;

    // Alamat asli dari architecture.md (terverifikasi live).
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant ETH_USD_AGG = 0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5;
    address internal constant USDC_USD_AGG = 0xc9E1a09622afdB659913fefE800fEaE5DBbFe9d7;

    // latestAnswer yang benar-benar terbaca saat verifikasi jaringan 2026-08-22.
    int256 internal constant ETH_USD_ANSWER = 242_933_000_000; // $2.429,33
    int256 internal constant USDC_USD_ANSWER = 99_994_251; // $0,99994251

    PriceRegistry internal registry;
    ChainlinkEmitter internal feed;

    address internal admin = address(0xA11CE);
    address internal recorder = address(0xB0B);
    address internal curator = address(0xC0FFEE);
    address internal outsider = address(0xDEAD);

    function setUp() public {
        vm.chainId(102031);
        vm.warp(1_800_000_000);

        registry = new PriceRegistry(admin);
        feed = new ChainlinkEmitter();

        bytes32 recorderRole = registry.PRICE_RECORDER_ROLE();
        bytes32 curatorRole = registry.CURATOR_ROLE();
        vm.startPrank(admin);
        registry.grantRole(recorderRole, recorder);
        registry.grantRole(curatorRole, curator);
        registry.setChainKeyAllowed(ETH_MAINNET, true);
        vm.stopPrank();

        vm.startPrank(curator);
        registry.registerAsset(WETH, 18);
        registry.registerAsset(USDC, 6);
        registry.trustAggregator(WETH, ETH_USD_AGG, 8);
        registry.trustAggregator(USDC, USDC_USD_AGG, 8);
        vm.stopPrank();

        _mockPrecompile(true);
    }

    // ─────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────

    bytes4 internal constant VERIFY_SINGLE = bytes4(
        keccak256(
            "verifyAndEmit(uint64,uint64,bytes,(bytes32,(bytes32,bool)[]),(bytes32,bytes32[]))"
        )
    );

    function _mockPrecompile(bool verified) internal {
        vm.mockCall(
            PRECOMPILE,
            abi.encodeWithSelector(INativeQueryVerifier.calculateTxIndex.selector),
            abi.encode(uint64(5))
        );
        vm.mockCall(PRECOMPILE, abi.encodeWithSelector(VERIFY_SINGLE), abi.encode(verified));
    }

    function _bundle(uint64 chainKey, uint64 height)
        internal
        pure
        returns (AttestcoinReader.ProofBundle memory b)
    {
        b.chainKey = chainKey;
        b.blockHeight = height;
        b.merkleRoot = bytes32(uint256(1));
        b.siblings = new INativeQueryVerifier.MerkleProofEntry[](1);
        b.siblings[0] =
            INativeQueryVerifier.MerkleProofEntry({hash: bytes32(uint256(2)), isLeft: true});
        b.lowerEndpointDigest = bytes32(uint256(3));
        b.continuityRoots = new bytes32[](1);
        b.continuityRoots[0] = bytes32(uint256(4));
    }

    /// @dev Pancarkan AnswerUpdated sungguhan, lalu paksa emitter-nya ke alamat
    ///      aggregator asli — EVM yang menghasilkan tata letak topic/data.
    function _priceTx(address aggregator, int256 answer, uint256 roundId, uint256 updatedAt)
        internal
        returns (bytes memory)
    {
        vm.recordLogs();
        feed.push(answer, roundId, updatedAt);
        Vm.Log[] memory raw = vm.getRecordedLogs();
        EvmV1Decoder.LogEntry[] memory logs = new EvmV1Decoder.LogEntry[](raw.length);
        for (uint256 i; i < raw.length; ++i) {
            logs[i] = EvmV1Decoder.LogEntry({
                address_: aggregator, topics: raw[i].topics, data: raw[i].data
            });
        }
        return EvmV1TxBuilder.build(2, 1, logs);
    }

    function _record(address aggregator, int256 answer, uint256 roundId, uint256 updatedAt)
        internal
        returns (uint256)
    {
        bytes memory encoded = _priceTx(aggregator, answer, roundId, updatedAt);
        vm.prank(recorder);
        return registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT), encoded);
    }

    // ─────────────────────────────────────────────────────────────
    // Jalur bahagia + tata letak log
    // ─────────────────────────────────────────────────────────────

    function test_RecordsProvenPrice() public {
        uint256 n = _record(ETH_USD_AGG, ETH_USD_ANSWER, 100, block.timestamp - 60);
        assertEq(n, 1);

        (bool ok, uint256 answer, uint8 dec) = registry.tryGetPrice(WETH);
        assertTrue(ok);
        assertEq(answer, uint256(ETH_USD_ANSWER));
        assertEq(dec, 8);
        assertEq(registry.priceDataOf(WETH).sourceBlock, HEIGHT);
    }

    /// @notice INI TES PALING PENTING DI FILE INI.
    ///
    ///         Di `AnswerUpdated`, `current` adalah parameter INDEXED — harganya
    ///         ada di topic, bukan di `data`. Ini kebalikan dari pola Aave/Morpho
    ///         di mana jumlah selalu non-indexed, jadi mudah sekali salah.
    ///
    ///         Kalau seseorang membaca `data[0]`, yang ia dapat adalah `updatedAt`
    ///         — angka sekitar 1,8x10^9. Pada feed berdesimal 8 itu terbaca sebagai
    ///         **$18**, harga yang sepenuhnya masuk akal untuk banyak token.
    ///         Kesalahannya tidak akan terlihat seperti kesalahan.
    function test_PriceComesFromTopicNotData() public {
        uint256 updatedAt = block.timestamp - 60;
        _record(ETH_USD_AGG, ETH_USD_ANSWER, 100, updatedAt);

        (, uint256 answer,) = registry.tryGetPrice(WETH);
        assertEq(answer, uint256(ETH_USD_ANSWER), "harga dari topics[1]");
        assertTrue(answer != updatedAt, "BUKAN updatedAt dari data[0]");
        assertEq(registry.priceDataOf(WETH).updatedAt, uint64(updatedAt), "updatedAt dari data[0]");
    }

    function test_MultipleFeedsInOneTransaction() public {
        vm.recordLogs();
        feed.push(ETH_USD_ANSWER, 100, block.timestamp - 60);
        feed.push(USDC_USD_ANSWER, 200, block.timestamp - 30);
        Vm.Log[] memory raw = vm.getRecordedLogs();

        EvmV1Decoder.LogEntry[] memory logs = new EvmV1Decoder.LogEntry[](2);
        logs[0] = EvmV1Decoder.LogEntry({
            address_: ETH_USD_AGG, topics: raw[0].topics, data: raw[0].data
        });
        logs[1] = EvmV1Decoder.LogEntry({
            address_: USDC_USD_AGG, topics: raw[1].topics, data: raw[1].data
        });

        vm.prank(recorder);
        uint256 n =
            registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT), EvmV1TxBuilder.build(2, 1, logs));
        assertEq(n, 2, "kedua feed tercatat sekaligus");

        (bool okEth,,) = registry.tryGetPrice(WETH);
        (bool okUsdc,,) = registry.tryGetPrice(USDC);
        assertTrue(okEth && okUsdc);
    }

    // ─────────────────────────────────────────────────────────────
    // Aritmetika USD — desimal adalah tempat bug paling senyap
    // ─────────────────────────────────────────────────────────────

    /// @notice 1.000 USDC (6 desimal) pada $0,99994251 (feed 8 desimal).
    function test_UsdConversionUsdc() public {
        _record(USDC_USD_AGG, USDC_USD_ANSWER, 1, block.timestamp - 10);

        (uint256 usdWad, bool ok) = registry.tryToUsd1e18(USDC, 1000e6);
        assertTrue(ok);
        // 1000 x 0,99994251 = 999,94251
        assertEq(usdWad, 999_942_510_000_000_000_000);
    }

    /// @notice 1 WETH (18 desimal) pada $2.429,33 (feed 8 desimal).
    function test_UsdConversionWeth() public {
        _record(ETH_USD_AGG, ETH_USD_ANSWER, 1, block.timestamp - 10);

        (uint256 usdWad, bool ok) = registry.tryToUsd1e18(WETH, 1e18);
        assertTrue(ok);
        assertEq(usdWad, 2429_330_000_000_000_000_000);
    }

    /// @notice Desimal token dan desimal feed TIDAK boleh tertukar.
    /// @dev Kalau USDC diperlakukan berdesimal 18, nilainya meleset 10^12 kali.
    function test_TokenDecimalsAndFeedDecimalsAreNotConfused() public {
        _record(USDC_USD_AGG, USDC_USD_ANSWER, 1, block.timestamp - 10);
        (uint256 oneUsdc,) = registry.tryToUsd1e18(USDC, 1e6);
        // 1 USDC harus bernilai ~$1, bukan ~$1e-12 maupun ~$1e12.
        assertGt(oneUsdc, 0.9e18);
        assertLt(oneUsdc, 1.1e18);
    }

    // ─────────────────────────────────────────────────────────────
    // Kesegaran
    // ─────────────────────────────────────────────────────────────

    function test_StalePriceIsUnavailable() public {
        _record(ETH_USD_AGG, ETH_USD_ANSWER, 1, block.timestamp - 60);
        vm.warp(block.timestamp + 25 hours);

        (bool ok,,) = registry.tryGetPrice(WETH);
        assertFalse(ok, "lewat 24 jam = basi");

        (, bool usdOk) = registry.tryToUsd1e18(WETH, 1e18);
        assertFalse(usdOk, "harga basi tidak boleh dipakai menilai apa pun");

        vm.expectPartialRevert(PriceRegistry.PriceStale.selector);
        registry.getPrice(WETH);
    }

    /// @notice Kesegaran diukur dari `updatedAt` Ethereum yang TERBUKTI,
    ///         bukan dari kapan kita kebetulan mencatatnya.
    /// @dev Kalau dipakai `recordedAt`, harga berumur seminggu yang baru saja
    ///      di-backfill akan terlihat segar sempurna.
    function test_FreshnessUsesProvenEthereumTimeNotRecordTime() public {
        _record(ETH_USD_AGG, ETH_USD_ANSWER, 1, block.timestamp - 30 hours);

        assertEq(registry.priceDataOf(WETH).recordedAt, uint64(block.timestamp), "baru dicatat");
        (bool ok,,) = registry.tryGetPrice(WETH);
        assertFalse(ok, "harganya sendiri sudah berumur 30 jam");
    }

    function test_UnknownAssetIsUnavailable() public {
        (bool ok,,) = registry.tryGetPrice(address(0xBEEF));
        assertFalse(ok);
        vm.expectPartialRevert(PriceRegistry.PriceUnavailable.selector);
        registry.getPrice(address(0xBEEF));
    }

    // ─────────────────────────────────────────────────────────────
    // Gerbang keamanan
    // ─────────────────────────────────────────────────────────────

    /// @notice Aggregator tak tepercaya tidak menghasilkan harga apa pun.
    /// @dev Tanpa gerbang ini, siapa pun bisa men-deploy kontrak yang memancarkan
    ///      `AnswerUpdated` palsu, membuktikannya secara sah, lalu menetapkan
    ///      harga sesuka hati — dan seluruh pasar dinilai dengan harga itu.
    function test_UntrustedAggregatorProducesNothing() public {
        bytes memory encoded = _priceTx(address(0x1A905), ETH_USD_ANSWER, 1, block.timestamp - 10);
        vm.prank(recorder);
        vm.expectRevert(PriceRegistry.NoPriceLogs.selector);
        registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT), encoded);

        (bool ok,,) = registry.tryGetPrice(WETH);
        assertFalse(ok);
    }

    /// @notice Harga non-positif ditolak KERAS.
    /// @dev `answer` bertipe int256. Meng-cast -1 ke uint256 menghasilkan 2^256-1 —
    ///      harga tak berhingga yang membuat setiap posisi terlihat sehat sempurna
    ///      dan tidak ada yang bisa dilikuidasi.
    function test_NegativeAnswerIsRejected() public {
        bytes memory encoded = _priceTx(ETH_USD_AGG, -1, 1, block.timestamp - 10);
        vm.prank(recorder);
        vm.expectPartialRevert(PriceRegistry.NonPositiveAnswer.selector);
        registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT), encoded);
    }

    function test_ZeroAnswerIsRejected() public {
        bytes memory encoded = _priceTx(ETH_USD_AGG, 0, 1, block.timestamp - 10);
        vm.prank(recorder);
        vm.expectPartialRevert(PriceRegistry.NonPositiveAnswer.selector);
        registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT), encoded);
    }

    /// @notice Ronde lama tidak boleh menimpa harga baru.
    /// @dev Indexer memproses backfill SETELAH data segar, jadi ini bukan
    ///      skenario teoretis.
    function test_OlderRoundIsIgnored() public {
        _record(ETH_USD_AGG, ETH_USD_ANSWER, 200, block.timestamp - 10);

        bytes memory older = _priceTx(ETH_USD_AGG, 1, 100, block.timestamp - 10_000);
        vm.prank(recorder);
        vm.expectRevert(PriceRegistry.NoPriceLogs.selector);
        registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT + 1), older);

        (, uint256 answer,) = registry.tryGetPrice(WETH);
        assertEq(answer, uint256(ETH_USD_ANSWER), "harga baru dipertahankan");
    }

    function test_DisallowedChainKeyIsRejected() public {
        bytes memory encoded = _priceTx(ETH_USD_AGG, ETH_USD_ANSWER, 1, block.timestamp - 10);
        vm.prank(recorder);
        vm.expectPartialRevert(AttestcoinReader.ChainKeyNotAllowed.selector);
        registry.recordPrice(_bundle(SEPOLIA, HEIGHT), encoded);
    }

    function test_ReplayIsRejected() public {
        _record(ETH_USD_AGG, ETH_USD_ANSWER, 100, block.timestamp - 10);
        bytes memory again = _priceTx(ETH_USD_AGG, ETH_USD_ANSWER, 101, block.timestamp - 5);
        vm.prank(recorder);
        vm.expectPartialRevert(AttestcoinReader.QueryAlreadyProcessed.selector);
        registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT), again);
    }

    function test_RevertedSourceTransactionIsRejected() public {
        vm.recordLogs();
        feed.push(ETH_USD_ANSWER, 1, block.timestamp - 10);
        Vm.Log[] memory raw = vm.getRecordedLogs();
        EvmV1Decoder.LogEntry[] memory logs = new EvmV1Decoder.LogEntry[](1);
        logs[0] = EvmV1Decoder.LogEntry({
            address_: ETH_USD_AGG, topics: raw[0].topics, data: raw[0].data
        });

        vm.prank(recorder);
        vm.expectRevert(AttestcoinReader.SourceTransactionReverted.selector);
        registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT), EvmV1TxBuilder.build(2, 0, logs));
    }

    // ─────────────────────────────────────────────────────────────
    // Janji "tidak pernah revert"
    // ─────────────────────────────────────────────────────────────

    /// @notice `tryToUsd1e18` tidak boleh revert untuk input seekstrem apa pun.
    /// @dev Ia dipanggil dari `CreditGraph.applyFact`, yang dipanggil dari
    ///      `FactRegistry.recordFact`. Satu revert di sini = fakta sah HILANG
    ///      PERMANEN, karena queryId-nya sudah tertandai.
    function test_TryToUsdNeverRevertsOnAbsurdInput() public {
        _record(ETH_USD_AGG, ETH_USD_ANSWER, 1, block.timestamp - 10);

        (uint256 v1, bool ok1) = registry.tryToUsd1e18(WETH, type(uint256).max);
        assertFalse(ok1, "jumlah absurd: tidak tersedia, bukan revert");
        assertEq(v1, 0);

        (uint256 v2, bool ok2) = registry.tryToUsd1e18(address(0xDEAD), 1e18);
        assertFalse(ok2, "aset tak dikenal");
        assertEq(v2, 0);

        (, bool ok3) = registry.tryToUsd1e18(WETH, 0);
        assertTrue(ok3, "jumlah nol tetap valid");
    }

    /// @notice Aset tanpa desimal terdaftar TIDAK diasumsikan 18.
    function test_UnregisteredAssetDecimalsAreNotAssumed() public {
        address mystery = address(0xAA11);
        vm.prank(curator);
        vm.expectPartialRevert(PriceRegistry.AssetNotRegistered.selector);
        registry.trustAggregator(mystery, address(0xA66), 8);
    }

    // ─────────────────────────────────────────────────────────────
    // Kontrol akses
    // ─────────────────────────────────────────────────────────────

    function test_OutsiderCannotRecordPrice() public {
        bytes memory encoded = _priceTx(ETH_USD_AGG, ETH_USD_ANSWER, 1, block.timestamp - 10);
        vm.prank(outsider);
        vm.expectPartialRevert(IAccessControl.AccessControlUnauthorizedAccount.selector);
        registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT), encoded);
    }

    function test_OutsiderCannotTrustAggregator() public {
        vm.prank(outsider);
        vm.expectPartialRevert(IAccessControl.AccessControlUnauthorizedAccount.selector);
        registry.trustAggregator(WETH, address(0xA66), 8);
    }

    // ─────────────────────────────────────────────────────────────
    // Rotasi aggregator (open-issues T5)
    // ─────────────────────────────────────────────────────────────

    /// @notice Beberapa aggregator boleh melayani aset yang sama, supaya upgrade
    ///         feed Chainlink tidak membuat harga berhenti terbarui secara senyap.
    function test_TwoAggregatorsCanServeTheSameAsset() public {
        address newAgg = address(0xA662);
        vm.prank(curator);
        registry.trustAggregator(WETH, newAgg, 8);

        _record(ETH_USD_AGG, ETH_USD_ANSWER, 100, block.timestamp - 60);

        bytes memory encoded = _priceTx(newAgg, 250_000_000_000, 101, block.timestamp - 5);
        vm.prank(recorder);
        registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT + 1), encoded);

        (, uint256 answer,) = registry.tryGetPrice(WETH);
        assertEq(answer, 250_000_000_000, "aggregator baru mengambil alih mulus");
    }

    function test_UntrustedAggregatorStopsBeingAccepted() public {
        vm.prank(curator);
        registry.untrustAggregator(ETH_USD_AGG);

        bytes memory encoded = _priceTx(ETH_USD_AGG, ETH_USD_ANSWER, 1, block.timestamp - 10);
        vm.prank(recorder);
        vm.expectRevert(PriceRegistry.NoPriceLogs.selector);
        registry.recordPrice(_bundle(ETH_MAINNET, HEIGHT), encoded);
    }
}
