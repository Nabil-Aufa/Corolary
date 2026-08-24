// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {
    INativeQueryVerifier
} from "@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {FactRegistry} from "../src/FactRegistry.sol";
import {CreditGraph} from "../src/CreditGraph.sol";
import {PriceRegistry} from "../src/PriceRegistry.sol";
import {AttestcoinReader} from "../src/AttestcoinReader.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";
import {Fact, FactKind} from "../src/libraries/FactTypes.sol";
import {EvmV1TxBuilder} from "./helpers/EvmV1TxBuilder.sol";

contract AavePool {
    event Repay(
        address indexed reserve,
        address indexed user,
        address indexed repayer,
        uint256 amount,
        bool useATokens
    );
    event Borrow(
        address indexed reserve,
        address user,
        address indexed onBehalfOf,
        uint256 amount,
        uint8 interestRateMode,
        uint256 borrowRate,
        uint16 indexed referralCode
    );

    function repay(address reserve, address user, uint256 amount) external {
        emit Repay(reserve, user, address(0x999), amount, false);
    }

    function borrow(address reserve, address onBehalfOf, uint256 amount) external {
        emit Borrow(reserve, address(0x888), onBehalfOf, amount, 2, 1e25, 0);
    }
}

contract ChainlinkFeed {
    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt);

    function push(int256 current, uint256 roundId, uint256 updatedAt) external {
        emit AnswerUpdated(current, roundId, updatedAt);
    }
}

/// @notice Ketiga lapis dijalankan bersama, dirangkai persis seperti
///         `script/Deploy.s.sol`.
///
/// @dev Tes unit membuktikan tiap lapis benar sendiri-sendiri. Tes ini
///      membuktikan mereka benar-benar TERSAMBUNG: satu pelunasan Aave yang
///      terbukti plus satu harga Chainlink yang terbukti menghasilkan skor
///      nyata dan rasio kolateral nyata. Kalau salah satu peran, urutan
///      pemasangan, atau bentuk data meleset, di sinilah ketahuan.
contract IntegrationTest is Test {
    address internal constant PRECOMPILE = 0x0000000000000000000000000000000000000FD2;
    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant USDC_USD_AGG = 0xc9E1a09622afdB659913fefE800fEaE5DBbFe9d7;
    int256 internal constant USDC_USD_ANSWER = 99_994_251; // $0,99994251
    uint64 internal constant ETH_MAINNET = 3;

    FactRegistry internal facts;
    CreditGraph internal graph;
    PriceRegistry internal prices;
    AaveV3Adapter internal adapter;
    AavePool internal aave;
    ChainlinkFeed internal feed;

    address internal admin = address(0xA11CE);
    address internal recorder = address(0xB0B);
    address internal borrower = address(0xDEB7);

    uint64 internal height = 25_795_652;
    uint32 internal txIndex = 1;

    bytes4 internal constant VERIFY_SINGLE = bytes4(
        keccak256(
            "verifyAndEmit(uint64,uint64,bytes,(bytes32,(bytes32,bool)[]),(bytes32,bytes32[]))"
        )
    );

    function setUp() public {
        vm.chainId(102031);
        vm.warp(1_800_000_000);

        aave = new AavePool();
        feed = new ChainlinkFeed();

        // --- Rangkaian identik dengan Deploy.s.sol ---
        facts = new FactRegistry(admin);
        graph = new CreditGraph(admin, address(facts));
        prices = new PriceRegistry(admin);
        adapter = new AaveV3Adapter();

        vm.startPrank(admin);
        facts.grantRole(facts.CURATOR_ROLE(), admin);
        facts.grantRole(facts.RECORDER_ROLE(), recorder);
        facts.setChainKeyAllowed(ETH_MAINNET, true);
        facts.registerAdapter(AAVE_POOL, address(adapter));

        graph.grantRole(graph.FACT_CONSUMER_ROLE(), address(facts));
        graph.grantRole(graph.CURATOR_ROLE(), admin);
        graph.assignProtocolBit(AAVE_POOL, 1);

        prices.grantRole(prices.CURATOR_ROLE(), admin);
        prices.grantRole(prices.PRICE_RECORDER_ROLE(), recorder);
        prices.setChainKeyAllowed(ETH_MAINNET, true);
        prices.registerAsset(USDC, 6);
        prices.trustAggregator(USDC, USDC_USD_AGG, 8);

        graph.setPriceRegistry(address(prices));
        facts.setCreditGraph(address(graph));
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────

    function _mock(uint32 idx) internal {
        vm.mockCall(
            PRECOMPILE,
            abi.encodeWithSelector(INativeQueryVerifier.calculateTxIndex.selector),
            abi.encode(uint64(idx))
        );
        vm.mockCall(PRECOMPILE, abi.encodeWithSelector(VERIFY_SINGLE), abi.encode(true));
    }

    function _bundle(uint64 h) internal pure returns (AttestcoinReader.ProofBundle memory b) {
        b.chainKey = ETH_MAINNET;
        b.blockHeight = h;
        b.merkleRoot = bytes32(uint256(1));
        b.siblings = new INativeQueryVerifier.MerkleProofEntry[](1);
        b.siblings[0] =
            INativeQueryVerifier.MerkleProofEntry({hash: bytes32(uint256(2)), isLeft: true});
        b.lowerEndpointDigest = bytes32(uint256(3));
        b.continuityRoots = new bytes32[](1);
        b.continuityRoots[0] = bytes32(uint256(4));
    }

    function _capture(address emitter) internal returns (EvmV1Decoder.LogEntry[] memory out) {
        Vm.Log[] memory raw = vm.getRecordedLogs();
        out = new EvmV1Decoder.LogEntry[](raw.length);
        for (uint256 i; i < raw.length; ++i) {
            out[i] = EvmV1Decoder.LogEntry({
                address_: emitter, topics: raw[i].topics, data: raw[i].data
            });
        }
    }

    function _recordPrice(int256 answer, uint256 roundId) internal {
        vm.recordLogs();
        feed.push(answer, roundId, block.timestamp - 60);
        bytes memory encoded = EvmV1TxBuilder.build(2, 1, _capture(USDC_USD_AGG));
        _mock(++txIndex);
        vm.prank(recorder);
        prices.recordPrice(_bundle(++height), encoded);
    }

    function _recordRepay(uint256 amount, uint64 observedAt) internal returns (bytes32) {
        vm.recordLogs();
        aave.repay(USDC, borrower, amount);
        bytes memory encoded = EvmV1TxBuilder.build(2, 1, _capture(AAVE_POOL));
        _mock(++txIndex);
        vm.prank(recorder);
        bytes32[] memory ids = facts.recordFact(_bundle(++height), encoded, observedAt);
        return ids[0];
    }

    function _recordBorrow(uint256 amount, uint64 observedAt) internal {
        vm.recordLogs();
        aave.borrow(USDC, borrower, amount);
        bytes memory encoded = EvmV1TxBuilder.build(2, 1, _capture(AAVE_POOL));
        _mock(++txIndex);
        vm.prank(recorder);
        facts.recordFact(_bundle(++height), encoded, observedAt);
    }

    // ─────────────────────────────────────────────────────────────
    // Jalur penuh
    // ─────────────────────────────────────────────────────────────

    /// @notice Ethereum -> proof -> fakta -> harga -> skor -> rasio kolateral.
    function test_FullStack_ProvenRepaymentBecomesCollateralEfficiency() public {
        // Titik awal jujur: belum ada apa-apa, jadi 150%.
        assertEq(graph.collateralRatioBpsOf(borrower), 15000, "cold start = 150%");
        (uint16 s0,) = graph.scoreOf(borrower);
        assertEq(s0, 0);

        // Harga USDC yang terbukti masuk lebih dulu - tanpa harga, pelunasan
        // tidak punya nilai USD dan volume tidak pernah terbentuk.
        _recordPrice(USDC_USD_ANSWER, 1);

        // Riwayat: buka posisi 2 tahun lalu, lalu lunasi berkali-kali.
        _recordBorrow(50_000e6, uint64(block.timestamp - 730 days));
        for (uint256 i; i < 25; ++i) {
            _recordRepay(40_000e6, uint64(block.timestamp - (700 - i * 20) * 1 days));
        }

        // Fakta benar-benar tersimpan permanen dan bisa dibaca siapa pun.
        assertEq(facts.factCountOf(borrower), 26, "25 pelunasan + 1 pinjaman");
        assertEq(facts.totalFacts(), 26);

        // Skor terbentuk dari fakta itu, bukan dari mana pun.
        (uint16 score, uint8 tier) = graph.scoreOf(borrower);
        assertGt(score, 0, "skor harus terbentuk dari fakta terbukti");

        int32[6] memory c = graph.componentsOf(borrower);
        assertGt(c[0], 0, "repaymentVolume terbentuk - artinya harga tersambung");
        assertGt(c[1], 0, "repaymentCount terbentuk");
        assertGt(c[2], 0, "historyDuration terbentuk");
        assertEq(c[3], 0, "belum pernah dilikuidasi");
        assertEq(c[4], 25, "satu protokol dari target empat");
        assertGt(c[5], 0, "activeStanding terbentuk");

        // Dan itu benar-benar menghasilkan kolateral yang lebih efisien.
        uint16 bps = graph.collateralRatioBpsOf(borrower);
        assertLt(bps, 15000, "riwayat terbukti = modal terkunci lebih sedikit");
        (, uint16 expected) = graph.tierOf(score);
        assertEq(bps, expected, "rasio konsisten dengan tier");

        emit log_named_uint("skor akhir", score);
        emit log_named_uint("tier", tier);
        emit log_named_uint("rasio kolateral (bps)", bps);
    }

    /// @notice Tanpa harga, fakta TETAP tercatat - hanya volumenya nol.
    /// @dev Ini pemisahan yang paling penting di seluruh sistem: registry adalah
    ///      infrastruktur dan tidak boleh bergantung pada ketersediaan harga.
    ///      Kalau feed mati, fakta tetap masuk permanen dan skornya menyusul
    ///      begitu harga pulih - bukan hilang selamanya.
    function test_FactsSurviveWhenPricesAreUnavailable() public {
        _recordRepay(40_000e6, uint64(block.timestamp - 100 days));

        assertEq(facts.factCountOf(borrower), 1, "fakta tetap tercatat permanen");
        assertEq(graph.componentsOf(borrower)[0], 0, "tanpa harga, volume nol");
        assertGt(graph.componentsOf(borrower)[2], 0, "durasi riwayat tetap terhitung");
    }

    /// @notice Setiap poin skor bisa ditelusuri balik ke fakta spesifik.
    /// @dev Ini janji "tidak ada kotak hitam" di architecture.md §2.
    function test_EveryFactIsTraceableToItsProof() public {
        _recordPrice(USDC_USD_ANSWER, 1);
        bytes32 factId = _recordRepay(40_000e6, uint64(block.timestamp - 10 days));

        Fact memory f = facts.getFact(factId);
        assertEq(f.subject, borrower);
        assertEq(f.protocol, AAVE_POOL, "menunjuk ke kontrak Aave yang nyata");
        assertEq(f.asset, USDC);
        assertEq(f.amount, 40_000e6);
        assertEq(uint256(f.kind), uint256(FactKind.LoanRepaid));
        assertGt(f.blockHeight, 0, "tinggi blok Ethereum yang dibuktikan");
        assertTrue(facts.factExists(factId));

        // Dan harga yang menilainya juga punya asal-usul yang bisa dicek.
        assertGt(prices.priceDataOf(USDC).sourceBlock, 0, "harga punya blok sumber");
        assertEq(prices.priceDataOf(USDC).answer, uint256(USDC_USD_ANSWER));
    }

    /// @notice Harga yang basi membekukan penilaian, tidak memakai angka lama.
    function test_StalePriceFreezesValuationInsteadOfLying() public {
        _recordPrice(USDC_USD_ANSWER, 1);
        _recordRepay(40_000e6, uint64(block.timestamp - 10 days));
        int32 volumeWithPrice = graph.componentsOf(borrower)[0];
        assertGt(volumeWithPrice, 0);

        // Feed mati selama dua hari.
        vm.warp(block.timestamp + 2 days);
        (, bool ok) = prices.tryToUsd1e18(USDC, 1e6);
        assertFalse(ok, "harga basi = tidak tersedia");

        // Fakta baru tidak menambah volume - tapi juga tidak me-revert.
        _recordRepay(40_000e6, uint64(block.timestamp - 1 days));
        assertEq(facts.factCountOf(borrower), 2, "fakta kedua tetap tercatat");
        assertEq(
            graph.componentsOf(borrower)[0],
            volumeWithPrice,
            "volume tidak bertambah tanpa harga segar"
        );
    }
}
