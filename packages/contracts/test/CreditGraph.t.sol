// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {CreditGraph} from "../src/CreditGraph.sol";
import {IFactRegistry} from "../src/interfaces/IFactRegistry.sol";
import {IPriceRegistry} from "../src/interfaces/IPriceRegistry.sol";
import {Fact, FactKind} from "../src/libraries/FactTypes.sol";

/// @dev Registry palsu yang HANYA menyimpan fakta - CreditGraph tidak peduli
///      bagaimana fakta terbukti, itu urusan FactRegistry. Ini test double untuk
///      mengisolasi logika skor, bukan data produk.
contract StubRegistry is IFactRegistry {
    mapping(bytes32 => Fact) internal _facts;

    function put(Fact memory f) external {
        _facts[f.factId] = f;
    }

    function getFact(bytes32 id) external view returns (Fact memory) {
        return _facts[id];
    }

    function factExists(bytes32 id) external view returns (bool) {
        return _facts[id].subject != address(0);
    }
}

contract StubPrices is IPriceRegistry {
    mapping(address => uint256) public usdPerToken1e18;
    mapping(address => bool) public available;
    bool public shouldRevert;

    function set(address asset, uint256 usdPerTokenWad) external {
        usdPerToken1e18[asset] = usdPerTokenWad;
        available[asset] = true;
    }

    function unset(address asset) external {
        available[asset] = false;
    }

    function setRevert(bool v) external {
        shouldRevert = v;
    }

    function tryToUsd1e18(address asset, uint256 amount) external view returns (uint256, bool) {
        require(!shouldRevert, "boom");
        if (!available[asset]) return (0, false);
        return ((amount * usdPerToken1e18[asset]) / 1e18, true);
    }
}

contract CreditGraphTest is Test {
    CreditGraph internal graph;
    StubRegistry internal registry;
    StubPrices internal prices;

    address internal admin = address(0xA11CE);
    address internal consumer = address(0xFAC7);
    address internal curator = address(0xC0FFEE);
    address internal outsider = address(0xDEAD);
    address internal subject = address(0x5057);

    address internal constant AAVE = address(0xAAAA);
    address internal constant MORPHO = address(0xB0B0);
    address internal constant USDC = address(0x5DC);
    address internal constant WETH = address(0x3E7);

    uint256 internal nonce;

    function setUp() public {
        // Waktu awal yang jauh dari 0 supaya aritmetika "N hari lalu" tidak underflow.
        vm.warp(4000 days);

        registry = new StubRegistry();
        prices = new StubPrices();
        graph = new CreditGraph(admin, address(registry));

        vm.startPrank(admin);
        graph.grantRole(graph.FACT_CONSUMER_ROLE(), consumer);
        graph.grantRole(graph.CURATOR_ROLE(), curator);
        graph.setPriceRegistry(address(prices));
        vm.stopPrank();

        vm.startPrank(curator);
        graph.assignProtocolBit(AAVE, 1);
        graph.assignProtocolBit(MORPHO, 2);
        vm.stopPrank();

        // 1 token = 1 USD, jadi angka di tes terbaca langsung sebagai dolar.
        prices.set(USDC, 1e18);
        prices.set(WETH, 1e18);
    }

    // -------------------------------------------------------------
    // Helper
    // -------------------------------------------------------------

    function _apply(FactKind kind, address protocol, address asset, uint256 amount, uint64 at)
        internal
        returns (bytes32 id)
    {
        id = keccak256(abi.encodePacked("fact", ++nonce));
        Fact memory f;
        f.factId = id;
        f.chainKey = 3;
        // forge-lint: disable-next-line(unsafe-typecast)
        f.blockHeight = uint64(nonce); // aman: nonce tes tidak pernah melewati puluhan
        f.kind = kind;
        f.subject = subject;
        f.protocol = protocol;
        f.asset = asset;
        f.amount = amount;
        f.observedAt = at;
        registry.put(f);

        vm.prank(consumer);
        graph.applyFact(id);
    }

    function _daysAgo(uint256 d) internal view returns (uint64) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(block.timestamp - d * 1 days); // aman: timestamp jauh di bawah 2^64
    }

    function _score() internal view returns (uint16 s) {
        (s,) = graph.scoreOf(subject);
    }

    // -------------------------------------------------------------
    // Cold start
    // -------------------------------------------------------------

    /// @notice Dompet tanpa fakta: skor 0, tier 0, 150%. Tanpa skor rekaan.
    function test_ColdStartIsHonest() public view {
        (uint16 score, uint8 tier) = graph.scoreOf(address(0xE0E0));
        assertEq(score, 0);
        assertEq(tier, 0);
        assertEq(graph.collateralRatioBpsOf(address(0xE0E0)), 15000);
    }

    // -------------------------------------------------------------
    // Golden vector - contoh end-to-end docs/scoring.md §11
    // -------------------------------------------------------------

    /// @notice Mereplikasi Subjek X dari docs/scoring.md §11 dan menuntut angka
    ///         yang sama persis: 724 poin, Tier 3, 12000 bps.
    /// @dev Kalau salah satu konstanta kalibrasi bergeser, tes ini gagal dengan
    ///      angka konkret - bukan "kira-kira turun sedikit".
    function test_GoldenVector_SubjectX() public {
        // Riwayat 1.095 hari: fakta pertama 3 tahun lalu.
        // 2 protokol + 2 aset -> counterpartyDiversityFactor = 4/6 = 0,667
        // Semua posisi ditahan > 7 hari -> durationFactor = 1.
        // Target volume terbobot $180.000 -> nominal 180.000/0,667 = 270.000.

        // Buka posisi lama di dua protokol/aset supaya diversity terbentuk dulu.
        _apply(FactKind.LoanOriginated, AAVE, USDC, 1, _daysAgo(1095));
        _apply(FactKind.LoanOriginated, MORPHO, WETH, 1, _daysAgo(1090));

        // 18 pelunasan bermateri. Bobot: 270.000 nominal -> 180.000 terbobot.
        uint256 perRepay = (270_000e18) / 18;
        for (uint256 i; i < 18; ++i) {
            address proto = i % 2 == 0 ? AAVE : MORPHO;
            address asset = i % 2 == 0 ? USDC : WETH;
            _apply(FactKind.LoanRepaid, proto, asset, perRepay, _daysAgo(1000 - i));
        }

        // Satu likuidasi $15.000, 730 hari lalu.
        _apply(FactKind.Liquidated, AAVE, USDC, 15_000e18, _daysAgo(730));

        // Aktivitas positif terakhir 10 hari lalu.
        _apply(FactKind.CollateralSupplied, AAVE, USDC, 1e18, _daysAgo(10));

        int32[6] memory c = graph.componentsOf(subject);
        assertEq(c[0], 234, "repaymentVolume");
        assertEq(c[1], 120, "repaymentCount");
        assertEq(c[2], 150, "historyDuration");
        assertEq(c[3], -30, "liquidationPenalty");
        assertEq(c[4], 50, "protocolDiversity");
        assertEq(c[5], 200, "activeStanding");

        (uint16 score, uint8 tier) = graph.scoreOf(subject);
        assertEq(score, 724, "skor total docs/scoring.md 11");
        assertEq(tier, 3);
        assertEq(graph.collateralRatioBpsOf(subject), 12000);
    }

    // -------------------------------------------------------------
    // Properti wajib - docs/scoring.md 12
    // -------------------------------------------------------------

    /// @notice Fakta positif tidak pernah menurunkan skor.
    function test_PositiveFactsAreMonotonic() public {
        _apply(FactKind.LoanOriginated, AAVE, USDC, 1000e18, _daysAgo(400));
        uint16 s0 = _score();

        for (uint256 i; i < 8; ++i) {
            _apply(FactKind.LoanRepaid, AAVE, USDC, 5_000e18, _daysAgo(300 - i * 10));
            uint16 s1 = _score();
            assertGe(s1, s0, "fakta positif tidak boleh menurunkan skor");
            s0 = s1;
        }
    }

    /// @notice Likuidasi tidak pernah menaikkan skor.
    function test_LiquidationIsAntiMonotonic() public {
        _apply(FactKind.LoanOriginated, AAVE, USDC, 1000e18, _daysAgo(400));
        _apply(FactKind.LoanRepaid, AAVE, USDC, 50_000e18, _daysAgo(300));
        uint16 before = _score();

        _apply(FactKind.Liquidated, AAVE, USDC, 20_000e18, _daysAgo(200));
        assertLe(_score(), before, "likuidasi tidak boleh menaikkan skor");
    }

    /// @notice Input adversarial: amount = uint256 maksimum harus saturasi rapi,
    ///         bukan revert karena overflow.
    function test_ExtremeAmountSaturatesInsteadOfOverflowing() public {
        prices.set(USDC, 1e18);
        _apply(FactKind.LoanRepaid, AAVE, USDC, type(uint128).max, _daysAgo(100));

        int32[6] memory c = graph.componentsOf(subject);
        assertLe(c[0], 300, "repaymentVolume tidak boleh melewati 300");
        assertGe(c[0], 0);
        assertLe(_score(), 1000);
    }

    /// @notice Skor tidak pernah keluar dari [0, 1000] betapa pun ekstremnya input.
    function test_ScoreStaysWithinBounds() public {
        _apply(FactKind.LoanOriginated, AAVE, USDC, 1, _daysAgo(2000));
        for (uint256 i; i < 30; ++i) {
            _apply(FactKind.LoanRepaid, AAVE, USDC, 100_000e18, _daysAgo(1000 - i * 10));
        }
        assertLe(_score(), 1000);

        for (uint256 i; i < 12; ++i) {
            _apply(FactKind.Liquidated, AAVE, USDC, 500_000e18, _daysAgo(300 - i * 10));
        }
        assertGe(_score(), 0);
        assertLe(_score(), 1000);
    }

    /// @notice Batas tier tepat di setiap ambang, diuji lewat fungsi KONTRAK.
    /// @dev Versi sebelumnya tes ini menyalin ulang tabel tier ke dalam file tes
    ///      lalu membandingkannya dengan dirinya sendiri - tautologi yang tetap
    ///      hijau meski kontraknya salah. `tierOf` kini publik supaya yang diuji
    ///      benar-benar kode produksi.
    function test_TierBoundariesAreExact() public view {
        uint16[5] memory thresholds = [uint16(0), 200, 400, 600, 800];
        uint16[5] memory expectedBps = [uint16(15000), 14000, 13000, 12000, 11000];

        for (uint256 t; t < 5; ++t) {
            (uint8 tier, uint16 bps) = graph.tierOf(thresholds[t]);
            // forge-lint: disable-next-line(unsafe-typecast)
            assertEq(tier, uint8(t), "tier tepat di ambang"); // t < 5
            assertEq(bps, expectedBps[t], "bps tepat di ambang");

            if (t > 0) {
                (uint8 below, uint16 bpsBelow) = graph.tierOf(thresholds[t] - 1);
                // forge-lint: disable-next-line(unsafe-typecast)
                assertEq(below, uint8(t - 1), "satu poin di bawah ambang"); // t < 5
                assertEq(bpsBelow, expectedBps[t - 1]);
            }
        }

        (uint8 maxTier, uint16 maxBps) = graph.tierOf(1000);
        assertEq(maxTier, 4);
        assertEq(maxBps, 11000);
    }

    /// @notice Skor sungguhan yang melewati ambang benar-benar mengubah rasio.
    function test_RealScoreCrossingThresholdChangesRatio() public {
        assertEq(graph.collateralRatioBpsOf(subject), 15000, "mulai dari 150%");

        _apply(FactKind.LoanOriginated, AAVE, USDC, 1, _daysAgo(1500));
        for (uint256 i; i < 20; ++i) {
            _apply(FactKind.LoanRepaid, AAVE, USDC, 40_000e18, _daysAgo(1000 - i * 10));
        }

        (uint16 score,) = graph.scoreOf(subject);
        (, uint16 expected) = graph.tierOf(score);
        assertEq(graph.collateralRatioBpsOf(subject), expected, "rasio mengikuti skor nyata");
        assertLt(graph.collateralRatioBpsOf(subject), 15000, "skor tinggi = kolateral lebih rendah");
    }

    // -------------------------------------------------------------
    // Harga tidak tersedia - asimetri yang disengaja
    // -------------------------------------------------------------

    /// @notice Harga hilang saat repay: TIDAK revert, kontribusi 0.
    function test_MissingPriceOnRepayContributesNothing() public {
        prices.unset(USDC);
        _apply(FactKind.LoanRepaid, AAVE, USDC, 100_000e18, _daysAgo(100));

        int32[6] memory c = graph.componentsOf(subject);
        assertEq(c[0], 0, "tanpa harga, volume tidak bertambah");
        assertEq(c[1], 0, "tanpa harga, pelunasan tidak dihitung bermateri");
    }

    /// @notice Harga hilang saat likuidasi: severity MAKSIMUM, bukan diampuni.
    /// @dev Asimetri disengaja - ketidaktersediaan data tidak boleh bisa dipakai
    ///      untuk memutihkan riwayat buruk.
    function test_MissingPriceOnLiquidationUsesWorstCase() public {
        prices.unset(USDC);
        _apply(FactKind.Liquidated, AAVE, USDC, 1, _daysAgo(100));

        int32[6] memory c = graph.componentsOf(subject);
        assertEq(c[3], -40, "severity penuh: 40 x 1 x 1,0");
    }

    /// @notice PriceRegistry yang revert TIDAK boleh menjatuhkan applyFact.
    /// @dev Kalau applyFact revert, recordFact ikut revert dan faktanya HILANG
    ///      PERMANEN - queryId sudah tertandai dan tidak bisa diproses ulang.
    function test_RevertingPriceRegistryDoesNotBreakApplyFact() public {
        prices.setRevert(true);
        _apply(FactKind.LoanRepaid, AAVE, USDC, 100_000e18, _daysAgo(100));
        assertEq(graph.snapshotOf(subject).factCount, 1, "fakta tetap tercatat");
    }

    function test_UnsetPriceRegistryDoesNotBreakApplyFact() public {
        vm.prank(admin);
        graph.setPriceRegistry(address(0));
        _apply(FactKind.LoanRepaid, AAVE, USDC, 100_000e18, _daysAgo(100));
        assertEq(graph.snapshotOf(subject).factCount, 1);
    }

    // -------------------------------------------------------------
    // Idempotensi & kontrol akses
    // -------------------------------------------------------------

    /// @notice Fakta yang sama diterapkan dua kali tidak menggandakan skor.
    /// @dev Tanpa ini, pemegang FACT_CONSUMER_ROLE bisa menggelembungkan skor
    ///      siapa pun sampai 1000 hanya dengan mengulang satu fakta yang sah.
    function test_ApplyingSameFactTwiceIsNoOp() public {
        bytes32 id = _apply(FactKind.LoanRepaid, AAVE, USDC, 50_000e18, _daysAgo(100));
        uint16 once = _score();
        uint32 countOnce = graph.snapshotOf(subject).factCount;

        vm.prank(consumer);
        graph.applyFact(id);

        assertEq(_score(), once, "skor tidak boleh berubah");
        assertEq(graph.snapshotOf(subject).factCount, countOnce, "factCount tidak boleh naik");
    }

    function test_UnknownFactIsNoOpNotRevert() public {
        vm.prank(consumer);
        graph.applyFact(keccak256("tidak ada"));
        assertEq(graph.snapshotOf(subject).factCount, 0);
    }

    function test_OutsiderCannotApplyFacts() public {
        vm.prank(outsider);
        vm.expectPartialRevert(IAccessControl.AccessControlUnauthorizedAccount.selector);
        graph.applyFact(keccak256("x"));
    }

    function test_OutsiderCannotAssignProtocolBits() public {
        vm.prank(outsider);
        vm.expectPartialRevert(IAccessControl.AccessControlUnauthorizedAccount.selector);
        graph.assignProtocolBit(AAVE, 3);
    }

    // -------------------------------------------------------------
    // Bitmap protokol
    // -------------------------------------------------------------

    function test_ProtocolBitmapMapsBitsCorrectly() public {
        address p8 = address(0x8888);
        vm.prank(curator);
        graph.assignProtocolBit(p8, 8);

        _apply(FactKind.LoanRepaid, AAVE, USDC, 1e18, _daysAgo(10)); // bit 1 -> 0b00000001
        assertEq(graph.snapshotOf(subject).protocolBitmap, 1);

        _apply(FactKind.LoanRepaid, MORPHO, WETH, 1e18, _daysAgo(10)); // bit 2 -> 0b00000011
        assertEq(graph.snapshotOf(subject).protocolBitmap, 3);

        _apply(FactKind.LoanRepaid, p8, USDC, 1e18, _daysAgo(10)); // bit 8 -> 0b10000011
        assertEq(graph.snapshotOf(subject).protocolBitmap, 131);

        int32[6] memory c = graph.componentsOf(subject);
        assertEq(c[4], 75, "3 protokol berbeda -> 3 x 100 / 4 = 75");
    }

    /// @notice Protokol tanpa nomor bit tetap dicatat, hanya tidak menambah diversity.
    function test_UnassignedProtocolStillRecordsFact() public {
        address unknown = address(0x9999);
        _apply(FactKind.LoanRepaid, unknown, USDC, 50_000e18, _daysAgo(10));

        assertEq(graph.snapshotOf(subject).factCount, 1);
        assertEq(graph.snapshotOf(subject).protocolBitmap, 0);
        assertEq(graph.componentsOf(subject)[4], 0);
    }

    // -------------------------------------------------------------
    // observedAt tidak tepercaya
    // -------------------------------------------------------------

    /// @notice `observedAt` bertanggal MASA DEPAN dijepit ke sekarang.
    /// @dev Tanpa penjepitan, `now - observedAt` underflow dan pembacaan skor
    ///      terkunci revert selamanya untuk subjek itu.
    function test_FutureObservedAtIsClamped() public {
        _apply(FactKind.LoanRepaid, AAVE, USDC, 1e18, uint64(block.timestamp + 365 days));

        // Tidak revert, dan riwayat tidak jadi "negatif".
        assertEq(graph.componentsOf(subject)[2], 0, "historyDuration = 0, bukan revert");
        assertLe(graph.snapshotOf(subject).firstFactAt, uint64(block.timestamp));
    }

    function test_ZeroObservedAtIsClamped() public {
        _apply(FactKind.LoanRepaid, AAVE, USDC, 1e18, 0);
        assertEq(graph.snapshotOf(subject).firstFactAt, uint64(block.timestamp));
    }

    // -------------------------------------------------------------
    // Backfill - fakta lama diterapkan SETELAH fakta baru
    // -------------------------------------------------------------

    /// @notice Mengklaim riwayat lama tidak boleh MENURUNKAN skor.
    /// @dev Ini alur "Claim your history" (open-issues B1): pengguna datang,
    ///      indexer membuktikan fakta berusia dua tahun, lalu menerapkannya
    ///      setelah fakta segar sudah masuk. Kalau `lastPositiveFactAt` ditugaskan
    ///      begitu saja alih-alih hanya maju, jam recency mundur dan skor turun -
    ///      kebalikan persis dari maksud fiturnya.
    function test_BackfillingOldFactsNeverLowersScore() public {
        _apply(FactKind.LoanRepaid, AAVE, USDC, 30_000e18, _daysAgo(5));
        uint16 scoreBefore = _score();
        assertEq(graph.componentsOf(subject)[5], 200, "recency penuh, baru 5 hari");

        _apply(FactKind.LoanRepaid, AAVE, USDC, 30_000e18, _daysAgo(900));

        assertEq(graph.componentsOf(subject)[5], 200, "recency tidak boleh mundur");
        assertGe(_score(), scoreBefore, "mengklaim riwayat tidak boleh menurunkan skor");
    }

    /// @notice Likuidasi LAMA yang di-backfill tidak me-reset jam pemulihan.
    function test_BackfillingOldLiquidationDoesNotResetRecovery() public {
        _apply(FactKind.LoanRepaid, AAVE, USDC, 30_000e18, _daysAgo(5));
        _apply(FactKind.Liquidated, AAVE, USDC, 10_000e18, _daysAgo(10));
        int32 standingAfterRecent = graph.componentsOf(subject)[5];

        _apply(FactKind.Liquidated, AAVE, USDC, 10_000e18, _daysAgo(1000));
        assertLe(
            graph.componentsOf(subject)[5],
            standingAfterRecent,
            "likuidasi lama tidak boleh memutihkan standing"
        );
    }

    // -------------------------------------------------------------
    // O(1)
    // -------------------------------------------------------------

    /// @notice Gas applyFact harus konstan - fakta ke-1 vs ke-200.
    /// @dev Kalau applyFact tumbuh seiring riwayat, justru pengguna TERBAIK yang
    ///      lebih dulu rusak: pencatatan mereka akan menabrak batas gas permanen.
    function test_ApplyFactGasIsConstant() public {
        bytes32 id1 = keccak256("first");
        Fact memory f;
        f.factId = id1;
        f.kind = FactKind.LoanRepaid;
        f.subject = subject;
        f.protocol = AAVE;
        f.asset = USDC;
        f.amount = 1000e18;
        f.observedAt = _daysAgo(500);
        registry.put(f);

        vm.prank(consumer);
        uint256 g0 = gasleft();
        graph.applyFact(id1);
        uint256 firstGas = g0 - gasleft();

        for (uint256 i; i < 200; ++i) {
            _apply(FactKind.LoanRepaid, AAVE, USDC, 1000e18, _daysAgo(400));
        }

        bytes32 idN = keccak256("last");
        f.factId = idN;
        f.observedAt = _daysAgo(100);
        registry.put(f);

        vm.prank(consumer);
        uint256 g1 = gasleft();
        graph.applyFact(idN);
        uint256 lastGas = g1 - gasleft();

        // Fakta pertama menulis slot kosong (SSTORE mahal), yang ke-201 menimpa
        // slot hangat - jadi yang terakhir seharusnya LEBIH murah, tidak pernah
        // tumbuh signifikan.
        assertLe(lastGas, firstGas + 5000, "applyFact tidak boleh tumbuh seiring riwayat");
    }
}
