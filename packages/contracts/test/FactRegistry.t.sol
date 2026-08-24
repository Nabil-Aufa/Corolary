// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {
    INativeQueryVerifier
} from "@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {FactRegistry} from "../src/FactRegistry.sol";
import {AttestcoinReader} from "../src/AttestcoinReader.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";
import {Fact, FactKind} from "../src/libraries/FactTypes.sol";
import {IProtocolAdapter} from "../src/interfaces/IProtocolAdapter.sol";
import {ICreditGraph} from "../src/interfaces/ICreditGraph.sol";
import {EvmV1TxBuilder} from "./helpers/EvmV1TxBuilder.sol";

// ─── Test double ──────────────────────────────────────────────────

/// @dev Graph yang mencoba masuk kembali ke registry saat menerima fakta.
contract ReentrantGraph is ICreditGraph {
    FactRegistry public registry;
    bool public attempted;
    bool public succeeded;
    bytes public lastRevert;

    function setRegistry(FactRegistry r) external {
        registry = r;
    }

    function applyFact(bytes32) external {
        if (attempted) return;
        attempted = true;
        AttestcoinReader.ProofBundle memory b;
        try registry.recordFact(b, "", 0) {
            succeeded = true;
        } catch (bytes memory reason) {
            lastRevert = reason;
        }
    }
}

contract CountingGraph is ICreditGraph {
    uint256 public applied;

    function applyFact(bytes32) external {
        ++applied;
    }
}

/// @dev Adapter yang mengaku bersumber dari alamat lain.
contract LyingAdapter is IProtocolAdapter {
    function sourceContract() external pure returns (address) {
        return address(0xBAD);
    }

    function protocolName() external pure returns (string memory) {
        return "Liar";
    }

    function decodeLog(EvmV1Decoder.LogEntry calldata)
        external
        pure
        returns (bool, FactKind, address, address, uint256)
    {
        return (false, FactKind.LoanRepaid, address(0), address(0), 0);
    }
}

/// @dev Adapter yang mengembalikan subjek nol - simulasi adapter rusak.
contract ZeroSubjectAdapter is IProtocolAdapter {
    address public immutable SRC;

    constructor(address src) {
        SRC = src;
    }

    function sourceContract() external view returns (address) {
        return SRC;
    }

    function protocolName() external pure returns (string memory) {
        return "Broken";
    }

    function decodeLog(EvmV1Decoder.LogEntry calldata)
        external
        pure
        returns (bool, FactKind, address, address, uint256)
    {
        return (true, FactKind.LoanRepaid, address(0), address(1), 1);
    }
}

/// @dev Adapter dengan logika Aave tapi alamat sumber berbeda - berdiri sebagai
///      protokol kedua di tes multi-protokol.
contract AliasAdapter is IProtocolAdapter {
    AaveV3Adapter internal immutable INNER = new AaveV3Adapter();
    address public immutable SRC;

    constructor(address src) {
        SRC = src;
    }

    function sourceContract() external view returns (address) {
        return SRC;
    }

    function protocolName() external pure returns (string memory) {
        return "Alias";
    }

    function decodeLog(EvmV1Decoder.LogEntry calldata log)
        external
        view
        returns (bool, FactKind, address, address, uint256)
    {
        return INNER.decodeLog(log);
    }
}

contract AaveEmitter {
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

    function repay(address reserve, address user, address repayer, uint256 amount) external {
        emit Repay(reserve, user, repayer, amount, false);
    }

    function borrow(address reserve, address user, address onBehalfOf, uint256 amount) external {
        emit Borrow(reserve, user, onBehalfOf, amount, 2, 1e25, 0);
    }
}

// ─── Suite ────────────────────────────────────────────────────────

contract FactRegistryTest is Test {
    address internal constant PRECOMPILE = 0x0000000000000000000000000000000000000FD2;
    address internal constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    uint64 internal constant ETH_MAINNET = 3;
    uint64 internal constant SEPOLIA = 1;
    uint64 internal constant HEIGHT = 25_795_652;
    uint32 internal constant TX_INDEX = 5;

    address internal admin = address(0xA11CE);
    address internal recorder = address(0xB0B);
    address internal curator = address(0xC0FFEE);
    address internal outsider = address(0xDEAD);
    address internal debtor = address(0xDEB7);
    address internal thirdParty = address(0x3D);

    FactRegistry internal registry;
    AaveV3Adapter internal adapter;
    AaveEmitter internal aave;

    bytes4 internal constant VERIFY_SINGLE = bytes4(
        keccak256(
            "verifyAndEmit(uint64,uint64,bytes,(bytes32,(bytes32,bool)[]),(bytes32,bytes32[]))"
        )
    );
    bytes4 internal constant VERIFY_BATCH = bytes4(
        keccak256(
            "verifyAndEmit(uint64,uint64[],bytes[],(bytes32,(bytes32,bool)[])[],(bytes32,bytes32[]))"
        )
    );

    function setUp() public {
        // hasPrecompile() memakai chainid untuk mengenali Creditcoin.
        vm.chainId(102031);

        registry = new FactRegistry(admin);
        adapter = new AaveV3Adapter();
        aave = new AaveEmitter();

        vm.startPrank(admin);
        registry.grantRole(registry.RECORDER_ROLE(), recorder);
        registry.grantRole(registry.CURATOR_ROLE(), curator);
        registry.setChainKeyAllowed(ETH_MAINNET, true);
        vm.stopPrank();

        vm.prank(curator);
        registry.registerAdapter(AAVE_POOL, address(adapter));

        _mockPrecompile(TX_INDEX, true);
    }

    function _mockPrecompile(uint32 txIndex, bool verified) internal {
        vm.mockCall(
            PRECOMPILE,
            abi.encodeWithSelector(INativeQueryVerifier.calculateTxIndex.selector),
            abi.encode(uint64(txIndex))
        );
        vm.mockCall(PRECOMPILE, abi.encodeWithSelector(VERIFY_SINGLE), abi.encode(verified));
        vm.mockCall(PRECOMPILE, abi.encodeWithSelector(VERIFY_BATCH), abi.encode(verified));
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

    function _capture() internal returns (EvmV1Decoder.LogEntry[] memory out) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        out = new EvmV1Decoder.LogEntry[](logs.length);
        for (uint256 i; i < logs.length; ++i) {
            out[i] = EvmV1Decoder.LogEntry({
                address_: logs[i].emitter, topics: logs[i].topics, data: logs[i].data
            });
        }
    }

    /// @dev Bangun tx berisi satu Repay Aave, dengan emitter dipaksa ke alamat Pool.
    function _repayTx(address emitter, uint8 status) internal returns (bytes memory) {
        vm.recordLogs();
        aave.repay(USDC, debtor, thirdParty, 1000e6);
        EvmV1Decoder.LogEntry[] memory logs = _capture();
        logs[0].address_ = emitter;
        return EvmV1TxBuilder.build(2, status, logs);
    }

    // ─────────────────────────────────────────────────────────────
    // Jalur bahagia
    // ─────────────────────────────────────────────────────────────

    function test_RecordsAaveRepayFact() public {
        bytes memory encoded = _repayTx(AAVE_POOL, 1);

        vm.prank(recorder);
        bytes32[] memory ids = registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);

        assertEq(ids.length, 1);
        Fact memory f = registry.getFact(ids[0]);
        assertEq(uint256(f.kind), uint256(FactKind.LoanRepaid));
        assertEq(f.subject, debtor);
        assertEq(f.asset, USDC);
        assertEq(f.amount, 1000e6);
        assertEq(f.blockHeight, HEIGHT);
        assertEq(f.txIndex, TX_INDEX);
        assertEq(f.txLogIndex, 0);
        assertEq(registry.totalFacts(), 1);
        assertEq(registry.factCountOf(debtor), 1);
    }

    function test_MultiEventTxProducesDistinctFacts() public {
        vm.recordLogs();
        aave.repay(USDC, debtor, thirdParty, 1000e6);
        aave.borrow(USDC, thirdParty, debtor, 500e6);
        EvmV1Decoder.LogEntry[] memory logs = _capture();
        logs[0].address_ = AAVE_POOL;
        logs[1].address_ = AAVE_POOL;

        vm.prank(recorder);
        bytes32[] memory ids = registry.recordFact(
            _bundle(ETH_MAINNET, HEIGHT), EvmV1TxBuilder.build(2, 1, logs), 111
        );

        assertEq(ids.length, 2);
        assertTrue(ids[0] != ids[1], "factId harus berbeda per log");
        assertEq(registry.getFact(ids[0]).txLogIndex, 0);
        assertEq(registry.getFact(ids[1]).txLogIndex, 1);
    }

    /// @notice Log dari kontrak lain di transaksi yang sama harus dilewati diam-diam.
    function test_ForeignLogsAreSkippedNotReverted() public {
        vm.recordLogs();
        aave.repay(USDC, debtor, thirdParty, 1000e6); // akan jadi log Pool
        aave.repay(USDC, debtor, thirdParty, 999e6); // tetap sebagai kontrak lain
        EvmV1Decoder.LogEntry[] memory logs = _capture();
        logs[0].address_ = AAVE_POOL;
        logs[1].address_ = USDC; // token, bukan pool

        vm.prank(recorder);
        bytes32[] memory ids = registry.recordFact(
            _bundle(ETH_MAINNET, HEIGHT), EvmV1TxBuilder.build(2, 1, logs), 111
        );

        assertEq(ids.length, 1, "hanya log Pool yang jadi fakta");
        assertEq(registry.getFact(ids[0]).amount, 1000e6);
    }

    function test_WorksWithoutCreditGraph() public {
        bytes memory encoded = _repayTx(AAVE_POOL, 1);
        vm.prank(recorder);
        bytes32[] memory ids = registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);
        assertEq(ids.length, 1);
    }

    function test_NotifiesCreditGraphWhenSet() public {
        CountingGraph graph = new CountingGraph();
        vm.prank(admin);
        registry.setCreditGraph(address(graph));

        bytes memory encoded = _repayTx(AAVE_POOL, 1);
        vm.prank(recorder);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);
        assertEq(graph.applied(), 1);
    }

    // ─────────────────────────────────────────────────────────────
    // GERBANG 2 - transaksi sumber harus sukses
    // ─────────────────────────────────────────────────────────────

    /// @notice Lubang keamanan #1: precompile membuktikan INKLUSI, bukan SUKSES.
    function test_RevertedSourceTransactionIsRejected() public {
        bytes memory encoded = _repayTx(AAVE_POOL, 0); // receiptStatus = 0

        vm.prank(recorder);
        vm.expectRevert(AttestcoinReader.SourceTransactionReverted.selector);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);
    }

    // ─────────────────────────────────────────────────────────────
    // GERBANG 3 - emitter
    // ─────────────────────────────────────────────────────────────

    /// @notice Kontrak peniru memancarkan event Aave bersignature identik.
    ///         Proof-nya sah sempurna. Hanya gerbang emitter yang menahannya.
    function test_ImpostorContractCannotForgeReputation() public {
        address impostor = address(0x1A905A70);
        bytes memory encoded = _repayTx(impostor, 1);

        vm.prank(recorder);
        vm.expectRevert(FactRegistry.NoRelevantLogs.selector);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);

        assertEq(registry.factCountOf(debtor), 0, "tidak ada reputasi yang tercipta");
    }

    // ─────────────────────────────────────────────────────────────
    // Replay
    // ─────────────────────────────────────────────────────────────

    function test_SameTransactionTwiceReverts() public {
        bytes memory encoded = _repayTx(AAVE_POOL, 1);

        vm.prank(recorder);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);

        vm.prank(recorder);
        vm.expectPartialRevert(AttestcoinReader.QueryAlreadyProcessed.selector);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);

        assertEq(registry.totalFacts(), 1);
    }

    // ─────────────────────────────────────────────────────────────
    // Chain key
    // ─────────────────────────────────────────────────────────────

    function test_DisallowedChainKeyIsRejected() public {
        bytes memory encoded = _repayTx(AAVE_POOL, 1);

        vm.prank(recorder);
        vm.expectPartialRevert(AttestcoinReader.ChainKeyNotAllowed.selector);
        registry.recordFact(_bundle(SEPOLIA, HEIGHT), encoded, 111);
    }

    // ─────────────────────────────────────────────────────────────
    // Kontrol akses
    // ─────────────────────────────────────────────────────────────

    function test_OutsiderCannotRecord() public {
        bytes memory encoded = _repayTx(AAVE_POOL, 1);

        vm.prank(outsider);
        vm.expectPartialRevert(IAccessControl.AccessControlUnauthorizedAccount.selector);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);
    }

    function test_OutsiderCannotRegisterAdapter() public {
        vm.prank(outsider);
        vm.expectPartialRevert(IAccessControl.AccessControlUnauthorizedAccount.selector);
        registry.registerAdapter(address(0xFEED), address(adapter));
    }

    // ─────────────────────────────────────────────────────────────
    // Kurasi
    // ─────────────────────────────────────────────────────────────

    /// @notice Adapter wajib menyetujui alamat sumbernya sendiri.
    function test_AdapterMustAgreeOnItsSourceContract() public {
        LyingAdapter liar = new LyingAdapter();
        vm.prank(curator);
        vm.expectPartialRevert(FactRegistry.AdapterSourceMismatch.selector);
        registry.registerAdapter(address(0xFEED), address(liar));
    }

    /// @notice Log dari kontrak tanpa adapter terdaftar dilewati diam-diam.
    ///         Kalau transaksi itu TIDAK punya log terdaftar sama sekali, tidak
    ///         ada fakta yang tercipta.
    function test_UnregisteredEmitterProducesNoFacts() public {
        bytes memory encoded = _repayTx(address(0xFEED), 1);
        vm.prank(recorder);
        vm.expectRevert(FactRegistry.NoRelevantLogs.selector);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);
    }

    /// @notice Satu transaksi Ethereum yang menyentuh DUA protokol menghasilkan
    ///         fakta dari keduanya dalam sekali panggil.
    /// @dev Desain lama (`sourceContract` sebagai parameter) hanya sanggup
    ///      mencatat protokol pertama: `queryId` dikunci per transaksi sumber,
    ///      jadi panggilan kedua untuk protokol lain kena QueryAlreadyProcessed
    ///      dan faktanya hilang PERMANEN. Aggregator dan migrasi posisi rutin
    ///      menyentuh beberapa protokol dalam satu transaksi.
    function test_SingleTxTouchingTwoProtocolsRecordsBoth() public {
        // Protokol kedua, memakai adapter Aave di bawah alamat sumber berbeda.
        address secondPool = address(0x5EC0);
        AliasAdapter second = new AliasAdapter(secondPool);
        vm.prank(curator);
        registry.registerAdapter(secondPool, address(second));

        vm.recordLogs();
        aave.repay(USDC, debtor, thirdParty, 1000e6);
        aave.repay(USDC, debtor, thirdParty, 2000e6);
        EvmV1Decoder.LogEntry[] memory logs = _capture();
        logs[0].address_ = AAVE_POOL;
        logs[1].address_ = secondPool;

        vm.prank(recorder);
        bytes32[] memory ids = registry.recordFact(
            _bundle(ETH_MAINNET, HEIGHT), EvmV1TxBuilder.build(2, 1, logs), 111
        );

        assertEq(ids.length, 2, "kedua protokol tercatat dalam satu panggilan");
        assertEq(registry.getFact(ids[0]).protocol, AAVE_POOL);
        assertEq(registry.getFact(ids[1]).protocol, secondPool);
        assertEq(registry.factCountOf(debtor), 2);
    }

    function test_RemoveAdapterKeepsProtocolListConsistent() public {
        assertEq(registry.protocolCount(), 1);
        vm.prank(curator);
        registry.removeAdapter(AAVE_POOL);
        assertEq(registry.protocolCount(), 0);
        assertEq(registry.adapterOf(AAVE_POOL), address(0));
    }

    // ─────────────────────────────────────────────────────────────
    // Adapter rusak
    // ─────────────────────────────────────────────────────────────

    function test_ZeroSubjectFailsLoudly() public {
        ZeroSubjectAdapter broken = new ZeroSubjectAdapter(address(0xFEED));
        vm.prank(curator);
        registry.registerAdapter(address(0xFEED), address(broken));

        bytes memory encoded = _repayTx(address(0xFEED), 1);
        vm.prank(recorder);
        vm.expectRevert(FactRegistry.InvalidSubject.selector);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);
    }

    // ─────────────────────────────────────────────────────────────
    // Reentrancy
    // ─────────────────────────────────────────────────────────────

    function test_MaliciousCreditGraphCannotReenter() public {
        ReentrantGraph graph = new ReentrantGraph();
        graph.setRegistry(registry);
        vm.startPrank(admin);
        registry.setCreditGraph(address(graph));
        // Skenario TERBURUK: graph yang jahat juga memegang RECORDER_ROLE.
        // Tanpa ini, yang menahan adalah AccessControl dan `nonReentrant` tidak
        // pernah benar-benar diuji - tes akan tetap hijau meski guard-nya dicopot.
        registry.grantRole(registry.RECORDER_ROLE(), address(graph));
        vm.stopPrank();

        bytes memory encoded = _repayTx(AAVE_POOL, 1);
        vm.prank(recorder);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), encoded, 111);

        assertTrue(graph.attempted(), "graph memang mencoba masuk kembali");
        assertFalse(graph.succeeded(), "reentrancy harus gagal");

        // Penting: pastikan yang menahan adalah GUARD-nya, bukan kebetulan gagal
        // di validasi lain. Tanpa cek ini, tes tetap hijau meski nonReentrant dicopot.
        assertEq(
            graph.lastRevert(),
            abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector),
            "harus ditahan ReentrancyGuard, bukan validasi lain"
        );
        assertEq(registry.totalFacts(), 1);
    }

    // ─────────────────────────────────────────────────────────────
    // Tanpa log relevan
    // ─────────────────────────────────────────────────────────────

    function test_NoRelevantLogsReverts() public {
        EvmV1Decoder.LogEntry[] memory none = new EvmV1Decoder.LogEntry[](0);
        vm.prank(recorder);
        vm.expectRevert(FactRegistry.NoRelevantLogs.selector);
        registry.recordFact(_bundle(ETH_MAINNET, HEIGHT), EvmV1TxBuilder.build(2, 1, none), 111);
    }
}
