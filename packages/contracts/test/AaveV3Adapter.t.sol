// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";
import {FactKind} from "../src/libraries/FactTypes.sol";

/// @notice Memancarkan event dengan deklarasi yang IDENTIK dengan Aave V3 IPool.sol
///         (diverifikasi dari aave-v3-origin, 2026-08-25).
/// @dev Kenapa memancarkan sungguhan alih-alih menyusun `data` dengan tangan:
///      kalau kita meng-encode sendiri, kita hanya menguji asumsi kita terhadap
///      asumsi kita sendiri. Dengan `emit`, ABI encoder EVM yang menghasilkan
///      layout-nya - persis seperti yang dilakukan Aave di mainnet. Kalau
///      pemahaman kita soal field mana yang `indexed` salah, tes ini GAGAL.
contract AaveEventEmitter {
    event Supply(
        address indexed reserve,
        address user,
        address indexed onBehalfOf,
        uint256 amount,
        uint16 indexed referralCode
    );
    event Withdraw(
        address indexed reserve, address indexed user, address indexed to, uint256 amount
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
    event Repay(
        address indexed reserve,
        address indexed user,
        address indexed repayer,
        uint256 amount,
        bool useATokens
    );
    event LiquidationCall(
        address indexed collateralAsset,
        address indexed debtAsset,
        address indexed user,
        uint256 debtToCover,
        uint256 liquidatedCollateralAmount,
        address liquidator,
        bool receiveAToken
    );

    function emitBorrow(address reserve, address user, address onBehalfOf, uint256 amount)
        external
    {
        emit Borrow(reserve, user, onBehalfOf, amount, 2, 1e25, 0);
    }

    function emitRepay(address reserve, address user, address repayer, uint256 amount) external {
        emit Repay(reserve, user, repayer, amount, false);
    }

    function emitSupply(address reserve, address user, address onBehalfOf, uint256 amount)
        external
    {
        emit Supply(reserve, user, onBehalfOf, amount, 0);
    }

    function emitWithdraw(address reserve, address user, address to, uint256 amount) external {
        emit Withdraw(reserve, user, to, amount);
    }

    function emitLiquidation(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        uint256 liquidatedCollateral,
        address liquidator
    ) external {
        emit LiquidationCall(
            collateralAsset, debtAsset, user, debtToCover, liquidatedCollateral, liquidator, false
        );
    }

    event Unrelated(address indexed a, address indexed b, address indexed c, uint256 d);

    function emitUnrelated() external {
        emit Unrelated(address(1), address(2), address(3), 4);
    }
}

contract AaveV3AdapterTest is Test {
    AaveV3Adapter internal adapter;
    AaveEventEmitter internal aave;

    address internal constant RESERVE = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // USDC
    address internal constant COLLATERAL = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // WETH
    address internal constant EXECUTOR = address(0xE0);
    address internal constant DEBTOR = address(0xDEB7);
    address internal constant THIRD_PARTY = address(0x3D);
    uint256 internal constant AMOUNT = 12_345_678_901;

    function setUp() public {
        adapter = new AaveV3Adapter();
        aave = new AaveEventEmitter();
    }

    // -------------------------------------------------------------
    // Helper
    // -------------------------------------------------------------

    function _lastLog() private returns (EvmV1Decoder.LogEntry memory entry) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "harus tepat satu log");
        entry = EvmV1Decoder.LogEntry({
            address_: logs[0].emitter, topics: logs[0].topics, data: logs[0].data
        });
    }

    // -------------------------------------------------------------
    // Pemilihan subjek - sumber bug paling mahal di proyek ini
    // -------------------------------------------------------------

    /// @notice Borrow: subjek adalah `onBehalfOf` (pemikul utang), BUKAN `user`.
    function test_BorrowSubjectIsOnBehalfOf() public {
        vm.recordLogs();
        aave.emitBorrow(RESERVE, EXECUTOR, DEBTOR, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            adapter.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.LoanOriginated));
        assertEq(subject, DEBTOR, "reputasi milik PEMIKUL utang, bukan eksekutor");
        assertTrue(subject != EXECUTOR);
        assertEq(asset, RESERVE);
        assertEq(amount, AMOUNT, "amount ada di data word 1, bukan 0");
    }

    /// @notice Borrow: word 0 adalah `user`, bukan `amount`.
    /// @dev Ini regresi yang paling berbahaya di seluruh proyek. Kalau adapter
    ///      membaca word 0, ia akan mencatat ALAMAT sebagai jumlah pinjaman -
    ///      angka astronomis yang meracuni repaymentVolume tanpa gejala apa pun.
    ///      docs/contracts.md sempat menyatakan offset 0 untuk kelima event.
    function test_BorrowAmountIsNotTheUserAddress() public {
        vm.recordLogs();
        aave.emitBorrow(RESERVE, EXECUTOR, DEBTOR, AMOUNT);
        EvmV1Decoder.LogEntry memory log = _lastLog();

        (,,,, uint256 amount) = adapter.decodeLog(log);

        uint256 word0 = uint256(bytes32(_slice(log.data, 0)));
        assertEq(word0, uint256(uint160(EXECUTOR)), "word 0 memang alamat user");
        assertTrue(amount != word0, "adapter TIDAK boleh membaca word 0");
    }

    /// @notice Repay: subjek adalah `user` (pemilik utang), BUKAN `repayer`.
    /// @dev Kalau kredit diberikan ke `repayer`, siapa pun bisa MEMBELI reputasi
    ///      dengan melunasi utang orang lain.
    function test_RepaySubjectIsDebtorNotRepayer() public {
        vm.recordLogs();
        aave.emitRepay(RESERVE, DEBTOR, THIRD_PARTY, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            adapter.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.LoanRepaid));
        assertEq(subject, DEBTOR, "reputasi tidak bisa dibeli dengan melunasi utang orang lain");
        assertTrue(subject != THIRD_PARTY);
        assertEq(asset, RESERVE);
        assertEq(amount, AMOUNT);
    }

    /// @notice LiquidationCall: asset = debtAsset, amount = debtToCover.
    function test_LiquidationUsesDebtAssetAndDebtToCover() public {
        uint256 collateralSeized = 999e18;
        vm.recordLogs();
        aave.emitLiquidation(COLLATERAL, RESERVE, DEBTOR, AMOUNT, collateralSeized, THIRD_PARTY);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            adapter.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.Liquidated));
        assertEq(subject, DEBTOR);
        assertEq(asset, RESERVE, "harus debtAsset, BUKAN collateralAsset");
        assertTrue(asset != COLLATERAL);
        assertEq(amount, AMOUNT, "harus debtToCover, BUKAN liquidatedCollateralAmount");
        assertTrue(amount != collateralSeized);
    }

    function test_SupplyAmountIsAtWordOne() public {
        vm.recordLogs();
        aave.emitSupply(RESERVE, EXECUTOR, DEBTOR, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            adapter.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.CollateralSupplied));
        assertEq(subject, DEBTOR);
        assertEq(asset, RESERVE);
        assertEq(amount, AMOUNT, "Supply juga menaruh amount di word 1");
    }

    function test_Withdraw() public {
        vm.recordLogs();
        aave.emitWithdraw(RESERVE, DEBTOR, THIRD_PARTY, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            adapter.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.CollateralWithdrawn));
        assertEq(subject, DEBTOR);
        assertEq(asset, RESERVE);
        assertEq(amount, AMOUNT);
    }

    // -------------------------------------------------------------
    // Log tidak relevan - ok == false, TANPA revert
    // -------------------------------------------------------------

    function test_UnknownSignatureIsSkippedNotReverted() public {
        vm.recordLogs();
        aave.emitUnrelated();
        (bool ok,,,,) = adapter.decodeLog(_lastLog());
        assertFalse(ok, "signature asing dilewati, bukan revert");
    }

    function test_WrongTopicCountIsSkipped() public view {
        bytes32[] memory topics = new bytes32[](2);
        topics[0] = keccak256("Repay(address,address,address,uint256,bool)");
        EvmV1Decoder.LogEntry memory log =
            EvmV1Decoder.LogEntry({address_: address(0xAA), topics: topics, data: ""});
        (bool ok,,,,) = adapter.decodeLog(log);
        assertFalse(ok);
    }

    /// @notice Data terpotong tidak boleh membuat adapter membaca di luar batas.
    function test_TruncatedDataIsSkipped() public view {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = keccak256("Borrow(address,address,address,uint256,uint8,uint256,uint16)");
        topics[1] = bytes32(uint256(uint160(RESERVE)));
        topics[2] = bytes32(uint256(uint160(DEBTOR)));
        topics[3] = 0;
        EvmV1Decoder.LogEntry memory log = EvmV1Decoder.LogEntry({
            address_: address(0xAA),
            topics: topics,
            data: abi.encode(EXECUTOR) // hanya 32 byte, Borrow butuh 128
        });
        (bool ok,,,,) = adapter.decodeLog(log);
        assertFalse(ok, "data terpotong harus dilewati, bukan membaca sampah");
    }

    // -------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------

    function test_SourceContractIsAaveV3Pool() public view {
        assertEq(adapter.sourceContract(), 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);
        assertEq(adapter.protocolName(), "Aave V3");
    }

    /// @notice Kelima signature dihitung ulang dari string, bukan disalin.
    function test_EventSignaturesMatchAaveDeclarations() public {
        vm.recordLogs();
        aave.emitBorrow(RESERVE, EXECUTOR, DEBTOR, AMOUNT);
        assertEq(
            _lastLog().topics[0],
            keccak256("Borrow(address,address,address,uint256,uint8,uint256,uint16)")
        );

        vm.recordLogs();
        aave.emitRepay(RESERVE, DEBTOR, THIRD_PARTY, AMOUNT);
        assertEq(_lastLog().topics[0], keccak256("Repay(address,address,address,uint256,bool)"));

        vm.recordLogs();
        aave.emitLiquidation(COLLATERAL, RESERVE, DEBTOR, AMOUNT, 1, THIRD_PARTY);
        assertEq(
            _lastLog().topics[0],
            keccak256("LiquidationCall(address,address,address,uint256,uint256,address,bool)")
        );

        vm.recordLogs();
        aave.emitSupply(RESERVE, EXECUTOR, DEBTOR, AMOUNT);
        assertEq(_lastLog().topics[0], keccak256("Supply(address,address,address,uint256,uint16)"));

        vm.recordLogs();
        aave.emitWithdraw(RESERVE, DEBTOR, THIRD_PARTY, AMOUNT);
        assertEq(_lastLog().topics[0], keccak256("Withdraw(address,address,address,uint256)"));
    }

    function _slice(bytes memory data, uint256 index) private pure returns (bytes memory out) {
        out = new bytes(32);
        for (uint256 i; i < 32; ++i) {
            out[i] = data[index * 32 + i];
        }
    }
}
