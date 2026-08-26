// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {EfficiencyMarket} from "../src/EfficiencyMarket.sol";
import {InterestRateModel} from "../src/libraries/InterestRateModel.sol";

// ─── Test double ──────────────────────────────────────────────────

contract MockToken is ERC20 {
    uint8 private immutable _DEC;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _DEC = d;
    }

    function decimals() public view override returns (uint8) {
        return _DEC;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Token yang memotong 1% setiap transfer.
contract FeeToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xFEE), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract StubGraph {
    mapping(address => uint16) public ratio;

    function setRatio(address user, uint16 bps) external {
        ratio[user] = bps;
    }

    function collateralRatioBpsOf(address user) external view returns (uint16) {
        uint16 r = ratio[user];
        return r == 0 ? 15000 : r;
    }

    function scoreOf(address) external pure returns (uint16, uint8) {
        return (0, 0);
    }
}

contract StubPrices {
    mapping(address => uint256) public priceWad; // USD per token, WAD
    mapping(address => uint8) public assetDecimals;
    mapping(address => bool) public fresh;

    function set(address asset, uint256 usdPerTokenWad, uint8 dec) external {
        priceWad[asset] = usdPerTokenWad;
        assetDecimals[asset] = dec;
        fresh[asset] = true;
    }

    function setFresh(address asset, bool v) external {
        fresh[asset] = v;
    }

    function tryToUsd1e18(address asset, uint256 amount) external view returns (uint256, bool) {
        if (!fresh[asset]) return (0, false);
        return ((amount * priceWad[asset]) / (10 ** assetDecimals[asset]), true);
    }

    function tryGetPrice(address asset) external view returns (bool, uint256, uint8) {
        if (!fresh[asset]) return (false, 0, 0);
        // Dinyatakan sebagai feed berdesimal 8, seperti Chainlink.
        return (true, (priceWad[asset] * 1e8) / 1e18, 8);
    }
}

/// @dev Token yang memanggil balik ke pasar saat mentransfer keluar - persis
///      perilaku ERC-777 dan token ber-hook lainnya. Ini vektor reentrancy
///      sungguhan, bukan simulasi.
contract CallbackToken is ERC20 {
    EfficiencyMarket public market;
    bool public attempted;
    bool public succeeded;
    bytes public lastRevert;

    constructor() ERC20("Callback", "CB") {}

    function setMarket(EfficiencyMarket m) external {
        market = m;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        // Panggil balik hanya saat pasar mengirim keluar, dan hanya sekali.
        if (address(market) != address(0) && from == address(market) && !attempted) {
            attempted = true;
            try market.withdraw(address(this), 1) {
                succeeded = true;
            } catch (bytes memory reason) {
                lastRevert = reason;
            }
        }
    }
}

// ─── Suite ────────────────────────────────────────────────────────

contract EfficiencyMarketTest is Test {
    EfficiencyMarket internal market;
    StubGraph internal graph;
    StubPrices internal prices;
    MockToken internal usdc;
    MockToken internal weth;

    address internal admin = address(0xA11CE);
    address internal curator = address(0xC0FFEE);
    address internal lender = address(0x1E4D);
    address internal borrower = address(0xB0110);
    address internal liquidator = address(0x11D);
    address internal outsider = address(0xDEAD);

    function setUp() public {
        vm.warp(1_800_000_000);

        graph = new StubGraph();
        prices = new StubPrices();
        usdc = new MockToken("USD Coin", "USDC", 6);
        weth = new MockToken("Wrapped Ether", "WETH", 18);

        market = new EfficiencyMarket(admin, address(graph), address(prices));

        bytes32 curatorRole = market.CURATOR_ROLE();
        vm.prank(admin);
        market.grantRole(curatorRole, curator);

        vm.startPrank(curator);
        market.addReserve(address(usdc), 1000, true); // reserveFactor 10%
        market.addReserve(address(weth), 1000, false); // WETH kolateral saja
        vm.stopPrank();

        prices.set(address(usdc), 1e18, 6); // $1
        prices.set(address(weth), 2000e18, 18); // $2.000

        usdc.mint(lender, 1_000_000e6);
        usdc.mint(borrower, 100_000e6);
        usdc.mint(liquidator, 100_000e6);
        weth.mint(borrower, 100e18);

        vm.prank(lender);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(borrower);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(borrower);
        weth.approve(address(market), type(uint256).max);
        vm.prank(liquidator);
        usdc.approve(address(market), type(uint256).max);

        vm.prank(lender);
        market.supply(address(usdc), 500_000e6);
    }

    function _postCollateral(uint256 amountWeth) internal {
        vm.prank(borrower);
        market.depositCollateral(address(weth), amountWeth);
    }

    // ─────────────────────────────────────────────────────────────
    // Rasio kolateral berbasis skor — inti produk
    // ─────────────────────────────────────────────────────────────

    /// @notice Tier 0 meminjam pada 150%: $20.000 kolateral -> maks $13.333.
    function test_Tier0BorrowsAtBaselineRatio() public {
        _postCollateral(10e18); // $20.000

        vm.prank(borrower);
        market.borrow(address(usdc), 13_000e6);

        assertEq(market.debtBalanceOf(borrower, address(usdc)), 13_000e6);
        assertEq(market.effectiveRatioBps(borrower), 15000);
    }

    function test_Tier0CannotBorrowBeyondBaselineCapacity() public {
        _postCollateral(10e18); // $20.000 -> kapasitas $13.333 pada 150%

        vm.prank(borrower);
        vm.expectPartialRevert(EfficiencyMarket.InsufficientCollateral.selector);
        market.borrow(address(usdc), 14_000e6);
    }

    /// @notice INI PUNCHLINE PRODUKNYA.
    ///         Kolateral yang SAMA PERSIS, skor berbeda, daya pinjam jauh lebih besar.
    function test_Tier4BorrowsFarMoreWithIdenticalCollateral() public {
        _postCollateral(10e18); // $20.000

        // Tier 0: kapasitas $20.000 / 1,5 = $13.333
        vm.prank(borrower);
        vm.expectPartialRevert(EfficiencyMarket.InsufficientCollateral.selector);
        market.borrow(address(usdc), 17_000e6);

        // Riwayat terbukti mengubahnya jadi 110%: kapasitas $20.000 / 1,1 = $18.181
        graph.setRatio(borrower, 11000);

        vm.prank(borrower);
        market.borrow(address(usdc), 17_000e6);

        assertEq(market.debtBalanceOf(borrower, address(usdc)), 17_000e6);
        assertEq(market.effectiveRatioBps(borrower), 11000);

        // Dan itu bisa dinyatakan sebagai angka konkret ke pengguna.
        uint256 saved = market.capitalSavedUsdWad(borrower);
        // $17.000 x (150% - 110%) = $6.800 modal yang tidak perlu dikunci.
        assertApproxEqAbs(saved, 6_800e18, 1e18);
    }

    // ─────────────────────────────────────────────────────────────
    // open-issues B3 — asimetri rasio
    // ─────────────────────────────────────────────────────────────

    /// @notice Skor NAIK berlaku SEGERA.
    function test_ScoreImprovementAppliesImmediately() public {
        _postCollateral(10e18);
        vm.prank(borrower);
        market.borrow(address(usdc), 10_000e6);
        assertEq(market.effectiveRatioBps(borrower), 15000);

        graph.setRatio(borrower, 12000);
        assertEq(market.effectiveRatioBps(borrower), 12000, "perbaikan langsung berlaku");
    }

    /// @notice Skor TURUN menunggu masa tenggang 7 hari.
    /// @dev Tanpa ini, satu likuidasi di Ethereum membuat posisi yang tadinya
    ///      sehat LANGSUNG dapat dilikuidasi tanpa pengguna melakukan apa pun.
    function test_ScoreDegradationWaitsForGracePeriod() public {
        graph.setRatio(borrower, 11000);
        _postCollateral(10e18);
        vm.prank(borrower);
        market.borrow(address(usdc), 17_000e6);
        assertEq(market.effectiveRatioBps(borrower), 11000);

        // Kena likuidasi di Ethereum: rasio memburuk ke 150%.
        graph.setRatio(borrower, 15000);
        market.refreshRatio(borrower);

        assertEq(market.effectiveRatioBps(borrower), 11000, "masih dilindungi masa tenggang");
        assertGe(market.healthFactor(borrower), 1e18, "belum bisa dilikuidasi");

        // Enam hari kemudian: masih terlindungi.
        vm.warp(block.timestamp + 6 days);
        assertEq(market.effectiveRatioBps(borrower), 11000);

        // Hari kedelapan: rasio baru berlaku.
        vm.warp(block.timestamp + 2 days);
        assertEq(market.effectiveRatioBps(borrower), 15000, "masa tenggang habis");
        assertLt(market.healthFactor(borrower), 1e18, "sekarang baru bisa dilikuidasi");
    }

    /// @notice Masa tenggang tidak bisa diperpanjang tanpa batas dengan memanggil
    ///         `refreshRatio` berulang kali.
    function test_GracePeriodCannotBeExtendedByRepeatedRefresh() public {
        graph.setRatio(borrower, 11000);
        _postCollateral(10e18);
        vm.prank(borrower);
        market.borrow(address(usdc), 17_000e6);

        graph.setRatio(borrower, 15000);
        market.refreshRatio(borrower);

        // Waktu dilacak di variabel lokal, BUKAN dibaca ulang dari
        // `block.timestamp` tiap iterasi: dengan `via_ir`, optimizer meng-hoist
        // TIMESTAMP keluar dari loop, sehingga setiap `vm.warp` menuju detik yang
        // sama dan loopnya diam-diam tidak memajukan waktu sama sekali.
        uint256 t = block.timestamp;
        for (uint256 i; i < 6; ++i) {
            t += 1 days;
            vm.warp(t);
            market.refreshRatio(borrower); // spam
        }
        vm.warp(t + 2 days);
        market.refreshRatio(borrower);
        assertEq(market.effectiveRatioBps(borrower), 15000, "tenggang tetap 7 hari sejak awal");
    }

    // ─────────────────────────────────────────────────────────────
    // Likuidasi
    // ─────────────────────────────────────────────────────────────

    function test_HealthyPositionCannotBeLiquidated() public {
        _postCollateral(10e18);
        vm.prank(borrower);
        market.borrow(address(usdc), 10_000e6);

        vm.prank(liquidator);
        vm.expectPartialRevert(EfficiencyMarket.PositionHealthy.selector);
        market.liquidate(borrower, address(usdc), address(weth), 1000e6);
    }

    function test_UnhealthyPositionIsLiquidated() public {
        _postCollateral(10e18); // $20.000
        vm.prank(borrower);
        market.borrow(address(usdc), 13_000e6);

        // Harga ETH jatuh: kolateral jadi $12.000, kapasitas $8.000 < utang.
        prices.set(address(weth), 1200e18, 18);
        assertLt(market.healthFactor(borrower), 1e18);

        uint256 wethBefore = weth.balanceOf(liquidator);
        vm.prank(liquidator);
        market.liquidate(borrower, address(usdc), address(weth), 6000e6);

        assertGt(weth.balanceOf(liquidator), wethBefore, "likuidator menerima kolateral + bonus");
        assertEq(market.debtBalanceOf(borrower, address(usdc)), 7000e6, "utang berkurang");
    }

    function test_CloseFactorIsEnforced() public {
        _postCollateral(10e18);
        vm.prank(borrower);
        market.borrow(address(usdc), 13_000e6);
        prices.set(address(weth), 1200e18, 18);

        vm.prank(liquidator);
        vm.expectPartialRevert(EfficiencyMarket.CloseFactorExceeded.selector);
        market.liquidate(borrower, address(usdc), address(weth), 7000e6); // > 50%
    }

    // ─────────────────────────────────────────────────────────────
    // Pembekuan harga basi
    // ─────────────────────────────────────────────────────────────

    /// @notice Harga basi MEMBEKUKAN pasar, tidak memakai angka lama.
    /// @dev Ini mengubah keterbatasan protokol - lag attestation 8 menit,
    ///      indexer bisa mati - menjadi properti keamanan.
    function test_StalePriceFreezesBorrowing() public {
        _postCollateral(10e18);
        prices.setFresh(address(weth), false);

        vm.prank(borrower);
        vm.expectPartialRevert(EfficiencyMarket.MarketFrozenStalePrice.selector);
        market.borrow(address(usdc), 1000e6);
    }

    /// @notice Tapi pengguna tanpa utang tetap bisa menarik kolateralnya.
    /// @dev Pembekuan ditujukan untuk yang MENAMBAH risiko. Feed yang mati tidak
    ///      boleh menyandera dana orang yang tidak meminjam sepeser pun.
    function test_StalePriceDoesNotTrapCollateralOfDebtFreeUsers() public {
        _postCollateral(10e18);
        prices.setFresh(address(weth), false);

        vm.prank(borrower);
        market.withdrawCollateral(address(weth), 10e18);
        assertEq(market.collateralBalanceOf(borrower, address(weth)), 0);
    }

    function test_StalePriceBlocksCollateralWithdrawalWhenInDebt() public {
        _postCollateral(10e18);
        vm.prank(borrower);
        market.borrow(address(usdc), 5000e6);

        prices.setFresh(address(weth), false);
        vm.prank(borrower);
        vm.expectPartialRevert(EfficiencyMarket.MarketFrozenStalePrice.selector);
        market.withdrawCollateral(address(weth), 1e18);
    }

    // ─────────────────────────────────────────────────────────────
    // Bunga
    // ─────────────────────────────────────────────────────────────

    /// @notice Indeks naik monoton dan utang bertambah seiring waktu.
    function test_InterestAccruesAndIndexIsMonotonic() public {
        _postCollateral(10e18);
        vm.prank(borrower);
        market.borrow(address(usdc), 10_000e6);

        uint256 debt0 = market.debtBalanceOf(borrower, address(usdc));
        uint256 index0 = market.reserveData(address(usdc)).borrowIndex;

        vm.warp(block.timestamp + 365 days);
        market.accrue(address(usdc));

        uint256 debt1 = market.debtBalanceOf(borrower, address(usdc));
        uint256 index1 = market.reserveData(address(usdc)).borrowIndex;

        assertGt(index1, index0, "borrowIndex naik monoton");
        assertGt(debt1, debt0, "utang bertambah bunga");
        // Utilisasi 2% -> jauh di bawah kink -> bunga kecil tapi positif.
        assertLt(debt1, debt0 * 2, "bunga wajar, bukan meledak");
    }

    function test_SupplierEarnsInterest() public {
        _postCollateral(100e18); // $200.000 -> kapasitas $133.333 pada 150%
        vm.prank(borrower);
        market.borrow(address(usdc), 100_000e6);

        uint256 before = market.supplyBalanceOf(lender, address(usdc));
        vm.warp(block.timestamp + 365 days);
        market.accrue(address(usdc));

        assertGt(market.supplyBalanceOf(lender, address(usdc)), before, "penyuplai dibayar");
    }

    /// @notice Kurva bunga naik monoton terhadap utilisasi, dan menanjak setelah kink.
    function test_InterestCurveIsMonotonicAndKinks() public pure {
        InterestRateModel.Params memory p = InterestRateModel.defaultParams();
        uint256 prev;
        for (uint256 u; u <= 1e18; u += 0.05e18) {
            uint256 rate = InterestRateModel.borrowRate(p, u);
            assertGe(rate, prev, "kurva tidak boleh turun");
            prev = rate;
        }
        assertEq(InterestRateModel.borrowRate(p, 0), 0, "base 0%");
        assertEq(InterestRateModel.borrowRate(p, 0.8e18), 0.04e18, "4% di kink");
        assertEq(InterestRateModel.borrowRate(p, 1e18), 0.64e18, "4% + 60% di 100%");
    }

    // ─────────────────────────────────────────────────────────────
    // Pelunasan
    // ─────────────────────────────────────────────────────────────

    /// @notice Pelunasan penuh membersihkan utang sampai NOL.
    /// @dev Debu 1-wei akibat pembulatan akan terus berbunga selamanya dan
    ///      membuat posisi tidak pernah benar-benar bisa ditutup.
    function test_FullRepaymentClearsDebtToZero() public {
        _postCollateral(10e18);
        vm.prank(borrower);
        market.borrow(address(usdc), 10_000e6);

        vm.warp(block.timestamp + 90 days);
        market.accrue(address(usdc));

        uint256 owed = market.debtBalanceOf(borrower, address(usdc));
        usdc.mint(borrower, owed);

        vm.prank(borrower);
        market.repay(address(usdc), owed);

        assertEq(market.debtBalanceOf(borrower, address(usdc)), 0, "tanpa sisa debu");
    }

    function test_OverpaymentIsCappedAtDebt() public {
        _postCollateral(10e18);
        vm.prank(borrower);
        market.borrow(address(usdc), 10_000e6);

        uint256 balBefore = usdc.balanceOf(borrower);
        vm.prank(borrower);
        market.repay(address(usdc), 50_000e6);

        assertEq(market.debtBalanceOf(borrower, address(usdc)), 0);
        assertEq(balBefore - usdc.balanceOf(borrower), 10_000e6, "hanya utangnya yang diambil");
    }

    // ─────────────────────────────────────────────────────────────
    // Keamanan token
    // ─────────────────────────────────────────────────────────────

    /// @notice Token fee-on-transfer ditolak di titik masuk.
    /// @dev Kalau lolos, akuntansi internal menyimpang dari saldo nyata - dan
    ///      penyimpangan itu berakhir sebagai kekurangan dana saat penarikan
    ///      terakhir, yang ditanggung pengguna terakhir.
    function test_FeeOnTransferTokenIsRejected() public {
        FeeToken fee = new FeeToken();
        vm.prank(curator);
        market.addReserve(address(fee), 1000, true);

        fee.mint(borrower, 1000e18);
        vm.startPrank(borrower);
        fee.approve(address(market), type(uint256).max);
        vm.expectPartialRevert(EfficiencyMarket.UnsupportedToken.selector);
        market.supply(address(fee), 1000e18);
        vm.stopPrank();
    }

    /// @notice Token yang memanggil balik saat transfer tidak bisa masuk kembali.
    /// @dev Vektor nyata: ERC-777 dan token ber-hook lain memanggil penerima di
    ///      tengah transfer. Tanpa guard, `withdraw` bisa dipanggil ulang sebelum
    ///      saldo pemanggil dikurangi - pola penarikan ganda klasik.
    function test_ReentrancyOnWithdrawIsBlocked() public {
        CallbackToken cb = new CallbackToken();
        cb.setMarket(market);
        vm.prank(curator);
        market.addReserve(address(cb), 1000, true);

        cb.mint(lender, 10_000e18);
        vm.startPrank(lender);
        cb.approve(address(market), type(uint256).max);
        market.supply(address(cb), 10_000e18);
        market.withdraw(address(cb), 1000e18);
        vm.stopPrank();

        assertTrue(cb.attempted(), "token memang mencoba masuk kembali");
        assertFalse(cb.succeeded(), "reentrancy harus gagal");
        assertEq(
            cb.lastRevert(),
            abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector),
            "harus ditahan ReentrancyGuard, bukan kebetulan gagal di tempat lain"
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Reserve & akses
    // ─────────────────────────────────────────────────────────────

    function test_InactiveReserveIsRejected() public {
        vm.prank(curator);
        market.configureReserve(address(usdc), false, false);

        vm.prank(lender);
        vm.expectPartialRevert(EfficiencyMarket.ReserveInactive.selector);
        market.supply(address(usdc), 1000e6);
    }

    function test_BorrowDisabledAssetCannotBeBorrowed() public {
        _postCollateral(10e18);
        vm.prank(borrower);
        vm.expectPartialRevert(EfficiencyMarket.BorrowDisabled.selector);
        market.borrow(address(weth), 1e18);
    }

    function test_OutsiderCannotAddReserve() public {
        vm.prank(outsider);
        vm.expectPartialRevert(IAccessControl.AccessControlUnauthorizedAccount.selector);
        market.addReserve(address(0xFEED), 1000, true);
    }

    function test_CannotBorrowMoreThanAvailableLiquidity() public {
        _postCollateral(100e18); // $200.000
        graph.setRatio(borrower, 11000);

        vm.prank(borrower);
        vm.expectPartialRevert(EfficiencyMarket.InsufficientLiquidity.selector);
        market.borrow(address(usdc), 600_000e6); // pool hanya punya 500.000
    }
    // ─────────────────────────────────────────────────────────────
    // Registry harga bisa diganti (open-issues B6)
    // ─────────────────────────────────────────────────────────────

    /// @notice Ketiadaan setter ini pernah mahal.
    /// @dev `priceRegistry` semula hanya di-set di konstruktor, sehingga
    ///      memperbaiki apa pun di PriceRegistry memaksa deploy ulang KONTRAK INI
    ///      juga - membatalkan alamat yang sudah dipublikasikan beserta verifikasi
    ///      explorer-nya, dan menelantarkan likuiditas yang tersimpan di sini.
    function test_AdminCanRepointPriceRegistry() public {
        StubPrices replacement = new StubPrices();
        assertEq(address(market.priceRegistry()), address(prices));

        vm.prank(admin);
        market.setPriceRegistry(address(replacement));

        assertEq(address(market.priceRegistry()), address(replacement));
    }

    function test_PriceRegistryCannotBeSetToZero() public {
        vm.prank(admin);
        vm.expectRevert(EfficiencyMarket.ZeroAddress.selector);
        market.setPriceRegistry(address(0));
    }

    function test_OnlyAdminCanRepointPriceRegistry() public {
        StubPrices replacement = new StubPrices();
        vm.prank(address(0xDEAD));
        vm.expectPartialRevert(IAccessControl.AccessControlUnauthorizedAccount.selector);
        market.setPriceRegistry(address(replacement));
    }

}
