// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";

import {MorphoBlueAdapter} from "../src/adapters/MorphoBlueAdapter.sol";
import {CompoundV3Adapter} from "../src/adapters/CompoundV3Adapter.sol";
import {SparkAdapter} from "../src/adapters/SparkAdapter.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";
import {FactKind} from "../src/libraries/FactTypes.sol";

/// @notice Deklarasi IDENTIK dengan morpho-blue EventsLib.sol.
/// @dev `Id` adalah `type Id is bytes32`, jadi di sini ia ditulis `bytes32` -
///      tanda tangan ABI-nya sama persis.
contract MorphoEmitter {
    event Borrow(
        bytes32 indexed id,
        address caller,
        address indexed onBehalf,
        address indexed receiver,
        uint256 assets,
        uint256 shares
    );
    event Repay(
        bytes32 indexed id,
        address indexed caller,
        address indexed onBehalf,
        uint256 assets,
        uint256 shares
    );
    event Liquidate(
        bytes32 indexed id,
        address indexed caller,
        address indexed borrower,
        uint256 repaidAssets,
        uint256 repaidShares,
        uint256 seizedAssets,
        uint256 badDebtAssets,
        uint256 badDebtShares
    );
    event SupplyCollateral(
        bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets
    );
    event WithdrawCollateral(
        bytes32 indexed id,
        address caller,
        address indexed onBehalf,
        address indexed receiver,
        uint256 assets
    );

    function borrow(bytes32 id, address caller, address onBehalf, uint256 assets) external {
        emit Borrow(id, caller, onBehalf, address(0xAAAA), assets, assets * 2);
    }

    function repay(bytes32 id, address caller, address onBehalf, uint256 assets) external {
        emit Repay(id, caller, onBehalf, assets, assets * 2);
    }

    function liquidate(
        bytes32 id,
        address caller,
        address borrower,
        uint256 repaidAssets,
        uint256 seizedAssets
    ) external {
        emit Liquidate(id, caller, borrower, repaidAssets, 1, seizedAssets, 0, 0);
    }

    function supplyCollateral(bytes32 id, address caller, address onBehalf, uint256 assets)
        external
    {
        emit SupplyCollateral(id, caller, onBehalf, assets);
    }

    function withdrawCollateral(bytes32 id, address caller, address onBehalf, uint256 assets)
        external
    {
        emit WithdrawCollateral(id, caller, onBehalf, address(0xBBBB), assets);
    }
}

/// @notice Deklarasi IDENTIK dengan comet CometMainInterface.sol.
contract CometEmitter {
    event Supply(address indexed from, address indexed dst, uint256 amount);
    event Withdraw(address indexed src, address indexed to, uint256 amount);
    event SupplyCollateral(
        address indexed from, address indexed dst, address indexed asset, uint256 amount
    );
    event WithdrawCollateral(
        address indexed src, address indexed to, address indexed asset, uint256 amount
    );
    event AbsorbDebt(
        address indexed absorber, address indexed borrower, uint256 basePaidOut, uint256 usdValue
    );

    function supply(address from, address dst, uint256 amount) external {
        emit Supply(from, dst, amount);
    }

    function withdraw(address src, address to, uint256 amount) external {
        emit Withdraw(src, to, amount);
    }

    function supplyCollateral(address from, address dst, address asset, uint256 amount) external {
        emit SupplyCollateral(from, dst, asset, amount);
    }

    function withdrawCollateral(address src, address to, address asset, uint256 amount) external {
        emit WithdrawCollateral(src, to, asset, amount);
    }

    function absorbDebt(address absorber, address borrower, uint256 basePaidOut) external {
        emit AbsorbDebt(absorber, borrower, basePaidOut, basePaidOut);
    }
}

contract AaveStyleEmitter {
    event Repay(
        address indexed reserve,
        address indexed user,
        address indexed repayer,
        uint256 amount,
        bool useATokens
    );

    function repay(address reserve, address user, address repayer, uint256 amount) external {
        emit Repay(reserve, user, repayer, amount, false);
    }
}

contract AdaptersTest is Test {
    MorphoBlueAdapter internal morpho;
    CompoundV3Adapter internal compound;
    SparkAdapter internal spark;

    address internal admin = address(0xA11CE);
    address internal curator = address(0xC0FFEE);

    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant COMET_USDC = 0xc3d688B66703497DAA19211EEdff47f25384cdc3;

    address internal constant EXECUTOR = address(0xE0);
    address internal constant DEBTOR = address(0xDEB7);
    address internal constant THIRD_PARTY = address(0x3D);
    bytes32 internal constant MARKET_ID = keccak256("wstETH/USDC");
    uint256 internal constant AMOUNT = 12_345_678_901;

    MorphoEmitter internal morphoSrc;
    CometEmitter internal cometSrc;

    function setUp() public {
        morpho = new MorphoBlueAdapter(admin);
        compound = new CompoundV3Adapter(COMET_USDC, USDC);
        spark = new SparkAdapter();
        morphoSrc = new MorphoEmitter();
        cometSrc = new CometEmitter();

        // `morpho.CURATOR_ROLE()` dievaluasi sebagai argumen dan MEMAKAN prank-nya,
        // sehingga grantRole berjalan sebagai alamat tes, bukan admin. Ambil dulu
        // nilainya, baru prank.
        bytes32 curatorRole = morpho.CURATOR_ROLE();
        vm.prank(admin);
        morpho.grantRole(curatorRole, curator);
        vm.prank(curator);
        morpho.setMarket(MARKET_ID, USDC, WETH);
    }

    function _lastLog() private returns (EvmV1Decoder.LogEntry memory entry) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1, "harus tepat satu log");
        entry = EvmV1Decoder.LogEntry({
            address_: logs[0].emitter, topics: logs[0].topics, data: logs[0].data
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Morpho Blue
    // ─────────────────────────────────────────────────────────────

    /// @notice Borrow: subjek `onBehalf`, dan `assets` ada di word 1 - bukan
    ///         `caller` yang menempati word 0.
    function test_MorphoBorrow() public {
        vm.recordLogs();
        morphoSrc.borrow(MARKET_ID, EXECUTOR, DEBTOR, AMOUNT);
        EvmV1Decoder.LogEntry memory log = _lastLog();

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            morpho.decodeLog(log);

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.LoanOriginated));
        assertEq(subject, DEBTOR, "subjek adalah onBehalf, bukan caller");
        assertTrue(subject != EXECUTOR);
        assertEq(asset, USDC, "loanToken dari tabel pasar");
        assertEq(amount, AMOUNT, "assets di word 1");

        uint256 word0 = uint256(bytes32(_slice(log.data, 0)));
        assertEq(word0, uint256(uint160(EXECUTOR)), "word 0 memang alamat caller");
        assertTrue(amount != word0, "adapter TIDAK boleh membaca word 0");
    }

    /// @notice Repay: subjek `onBehalf` (topic 3), BUKAN `caller` (topic 2).
    /// @dev Kalau kredit jatuh ke `caller`, siapa pun bisa membeli reputasi
    ///      dengan melunasi utang orang lain.
    function test_MorphoRepaySubjectIsOnBehalfNotCaller() public {
        vm.recordLogs();
        morphoSrc.repay(MARKET_ID, THIRD_PARTY, DEBTOR, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            morpho.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.LoanRepaid));
        assertEq(subject, DEBTOR, "reputasi milik pemilik utang");
        assertTrue(subject != THIRD_PARTY);
        assertEq(asset, USDC);
        assertEq(amount, AMOUNT);
    }

    /// @notice Liquidate: subjek `borrower`, jumlah `repaidAssets` bukan `seizedAssets`.
    function test_MorphoLiquidateUsesRepaidAssets() public {
        uint256 seized = 999e18;
        vm.recordLogs();
        morphoSrc.liquidate(MARKET_ID, THIRD_PARTY, DEBTOR, AMOUNT, seized);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            morpho.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.Liquidated));
        assertEq(subject, DEBTOR, "yang dilikuidasi, bukan likuidatornya");
        assertEq(asset, USDC, "token utang");
        assertEq(amount, AMOUNT, "repaidAssets, BUKAN seizedAssets");
        assertTrue(amount != seized);
    }

    function test_MorphoSupplyCollateralUsesCollateralToken() public {
        vm.recordLogs();
        morphoSrc.supplyCollateral(MARKET_ID, EXECUTOR, DEBTOR, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            morpho.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.CollateralSupplied));
        assertEq(subject, DEBTOR);
        assertEq(asset, WETH, "collateralToken, bukan loanToken");
        assertEq(amount, AMOUNT);
    }

    /// @notice WithdrawCollateral: `assets` di word 1, sama seperti Borrow.
    function test_MorphoWithdrawCollateralAmountIsAtWordOne() public {
        vm.recordLogs();
        morphoSrc.withdrawCollateral(MARKET_ID, EXECUTOR, DEBTOR, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            morpho.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.CollateralWithdrawn));
        assertEq(subject, DEBTOR);
        assertEq(asset, WETH);
        assertEq(amount, AMOUNT, "assets di word 1, bukan 0");
    }

    /// @notice Pasar yang belum didaftarkan kurator dilewati - tidak menebak token.
    function test_MorphoUnregisteredMarketIsSkipped() public {
        vm.recordLogs();
        morphoSrc.repay(keccak256("pasar asing"), THIRD_PARTY, DEBTOR, AMOUNT);
        (bool ok,,,,) = morpho.decodeLog(_lastLog());
        assertFalse(ok, "tanpa tabel pasar, token tidak bisa diketahui");
    }

    function test_MorphoMetadata() public view {
        assertEq(morpho.sourceContract(), 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb);
        assertEq(morpho.protocolName(), "Morpho Blue");
    }

    // ─────────────────────────────────────────────────────────────
    // Compound V3
    // ─────────────────────────────────────────────────────────────

    /// @notice INI TES KEAMANAN PALING PENTING DI FILE INI.
    ///
    ///         `docs/contracts.md` §7c mengarahkan memetakan `Supply` pada aset
    ///         dasar menjadi `LoanRepaid`. Kalau itu diikuti, siapa pun bisa
    ///         menyetor USDC ke Compound V3 dan langsung memperoleh fakta
    ///         pelunasan bernilai besar - REPUTASI GRATIS tanpa pernah meminjam.
    ///
    ///         Saldo aset dasar Comet bertanda: `Supply` bisa berarti melunasi
    ///         utang ATAU sekadar menyetor sebagai pemberi pinjaman, dan satu log
    ///         tidak memuat apa pun yang membedakan keduanya.
    function test_CompoundBaseSupplyIsNotTreatedAsRepayment() public {
        vm.recordLogs();
        cometSrc.supply(THIRD_PARTY, THIRD_PARTY, 1_000_000e6);
        (bool ok,,,,) = compound.decodeLog(_lastLog());
        assertFalse(ok, "menyetor bukan melunasi - reputasi tidak boleh gratis");
    }

    /// @notice Sisi sebaliknya: `Withdraw` juga tidak boleh dianggap meminjam.
    function test_CompoundBaseWithdrawIsNotTreatedAsBorrow() public {
        vm.recordLogs();
        cometSrc.withdraw(THIRD_PARTY, THIRD_PARTY, 1_000_000e6);
        (bool ok,,,,) = compound.decodeLog(_lastLog());
        assertFalse(ok, "menarik simpanan sendiri bukan meminjam");
    }

    function test_CompoundSupplyCollateral() public {
        vm.recordLogs();
        cometSrc.supplyCollateral(EXECUTOR, DEBTOR, WETH, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            compound.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.CollateralSupplied));
        assertEq(subject, DEBTOR, "dst - akun yang menerima kolateral");
        assertEq(asset, WETH);
        assertEq(amount, AMOUNT);
    }

    function test_CompoundWithdrawCollateralSubjectIsSource() public {
        vm.recordLogs();
        cometSrc.withdrawCollateral(DEBTOR, THIRD_PARTY, WETH, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            compound.decodeLog(_lastLog());

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.CollateralWithdrawn));
        assertEq(subject, DEBTOR, "src - akun yang kolateralnya berkurang");
        assertTrue(subject != THIRD_PARTY);
        assertEq(asset, WETH);
        assertEq(amount, AMOUNT);
    }

    /// @notice AbsorbDebt adalah likuidasi Comet - dan ia TIDAK ambigu.
    /// @dev Perhatikan event ini hanya punya 3 topic, bukan 4.
    function test_CompoundAbsorbDebtIsLiquidation() public {
        vm.recordLogs();
        cometSrc.absorbDebt(THIRD_PARTY, DEBTOR, AMOUNT);
        EvmV1Decoder.LogEntry memory log = _lastLog();
        assertEq(log.topics.length, 3, "AbsorbDebt hanya 2 parameter indexed");

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            compound.decodeLog(log);

        assertTrue(ok);
        assertEq(uint256(kind), uint256(FactKind.Liquidated));
        assertEq(subject, DEBTOR, "borrower, bukan absorber");
        assertEq(asset, USDC, "aset dasar pasar ini");
        assertEq(amount, AMOUNT, "basePaidOut");
    }

    function test_CompoundMetadata() public view {
        assertEq(compound.sourceContract(), COMET_USDC);
        assertEq(compound.protocolName(), "Compound V3");
    }

    // ─────────────────────────────────────────────────────────────
    // Spark
    // ─────────────────────────────────────────────────────────────

    /// @notice Spark memakai decoder Aave V3 tapi alamat sumber sendiri.
    function test_SparkDecodesAaveStyleLogs() public {
        AaveStyleEmitter emitter = new AaveStyleEmitter();
        vm.recordLogs();
        emitter.repay(USDC, DEBTOR, THIRD_PARTY, AMOUNT);

        (bool ok, FactKind kind, address subject, address asset, uint256 amount) =
            spark.decodeLog(_lastLog());

        assertTrue(ok, "Spark adalah fork Aave V3 - tanda tangan identik");
        assertEq(uint256(kind), uint256(FactKind.LoanRepaid));
        assertEq(subject, DEBTOR);
        assertEq(asset, USDC);
        assertEq(amount, AMOUNT);
    }

    function test_SparkHasItsOwnPoolAddress() public {
        assertEq(spark.sourceContract(), 0xC13e21B648A5Ee794902342038FF3aDAB66BE987);
        assertEq(spark.protocolName(), "Spark");

        AaveV3Adapter aave = new AaveV3Adapter();
        assertTrue(
            spark.sourceContract() != aave.sourceContract(),
            "dua protokol berbeda, dua alamat sumber berbeda"
        );
    }

    function _slice(bytes memory data, uint256 index) private pure returns (bytes memory out) {
        out = new bytes(32);
        for (uint256 i; i < 32; ++i) {
            out[i] = data[index * 32 + i];
        }
    }
}
