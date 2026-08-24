// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {InterestRateModel} from "./libraries/InterestRateModel.sol";
import {ICreditGraph} from "./interfaces/ICreditGraph.sol";
import {IPriceRegistry} from "./interfaces/IPriceRegistry.sol";

interface ICreditGraphRatio {
    function collateralRatioBpsOf(address subject) external view returns (uint16);
    function scoreOf(address subject) external view returns (uint16 score, uint8 tier);
}

interface IPriceRegistryFull is IPriceRegistry {
    function tryGetPrice(address asset)
        external
        view
        returns (bool ok, uint256 answer, uint8 decimals);
    function assetDecimals(address asset) external view returns (uint8);
}

/// @title EfficiencyMarket
/// @notice Pasar pinjam-meminjam di Creditcoin di mana rasio kolateral ditentukan
///         riwayat kredit yang TERBUKTI.
///
/// @dev **Ini bukan pinjaman tanpa jaminan.** Setiap pinjaman tetap over-kolateral;
///      lantainya 110% untuk tier tertinggi, bukan 0% atau di bawah 100%. Yang
///      berubah hanya BERAPA BANYAK kolateral berlebih yang dibutuhkan, bukan
///      APAKAH kolateral dibutuhkan. Protokol tetap solven secara matematis tanpa
///      bergantung sama sekali pada identitas atau jalur hukum recourse.
///
///      Ini pembeda yang menyelamatkan model ini dari kuburan proyek
///      credit-scoring on-chain sebelumnya: mereka menjanjikan pinjaman tanpa
///      jaminan ke dompet anonim, dan insentif rasional peminjam selalu kabur.
contract EfficiencyMarket is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using InterestRateModel for InterestRateModel.Params;

    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");

    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    /// @notice Rasio dasar untuk dompet tanpa riwayat terbukti.
    uint16 public constant BASELINE_RATIO_BPS = 15_000;

    /// @notice Masa tenggang sebelum rasio yang MEMBURUK berlaku (open-issues B3).
    uint64 public constant RATIO_GRACE_PERIOD = 7 days;

    struct Reserve {
        uint256 totalSuppliedScaled;
        uint256 totalBorrowedScaled;
        uint256 liquidityIndex;
        uint256 borrowIndex;
        uint64 lastUpdated;
        uint16 reserveFactorBps;
        bool active;
        bool borrowEnabled;
        InterestRateModel.Params irm;
    }

    struct Position {
        mapping(address => uint256) suppliedScaled;
        mapping(address => uint256) collateral;
        mapping(address => uint256) debtScaled;
    }

    /// @notice Rasio yang dikunci saat pinjam, plus antrean penurunan.
    /// @dev Lihat `effectiveRatioBps` untuk aturan lengkapnya.
    struct RatioLock {
        uint16 lockedBps;
        uint16 pendingBps;
        uint64 pendingFrom;
    }

    mapping(address => Reserve) internal _reserves;
    address[] public reserveList;
    mapping(address => Position) internal _positions;
    mapping(address => RatioLock) internal _ratioLocks;

    ICreditGraphRatio public creditGraph;
    IPriceRegistryFull public priceRegistry;

    uint16 public liquidationBonusBps = 500; // 5%
    uint16 public closeFactorBps = 5_000; // 50%

    event ReserveAdded(address indexed asset, uint16 reserveFactorBps);
    event ReserveConfigured(address indexed asset, bool active, bool borrowEnabled);
    event Supplied(address indexed user, address indexed asset, uint256 amount);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount);
    event CollateralDeposited(address indexed user, address indexed asset, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, address indexed asset, uint256 amount, uint16 ratioBps);
    event Repaid(address indexed user, address indexed asset, uint256 amount);
    event PositionLiquidated(
        address indexed user,
        address indexed liquidator,
        address debtAsset,
        address collateralAsset,
        uint256 debtCovered,
        uint256 collateralSeized
    );
    event RatioLocked(address indexed user, uint16 ratioBps);
    event RatioDegradationScheduled(
        address indexed user, uint16 fromBps, uint16 toBps, uint64 effectiveFrom
    );
    event RatioImproved(address indexed user, uint16 fromBps, uint16 toBps);

    error ReserveInactive(address asset);
    error ReserveAlreadyExists(address asset);
    error BorrowDisabled(address asset);
    error MarketFrozenStalePrice(address asset);
    error InsufficientCollateral(uint256 requiredUsdWad, uint256 availableUsdWad);
    error HealthFactorTooLow(uint256 hf);
    error PositionHealthy(uint256 hf);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error NothingToRepay();
    error ZeroAmount();
    error ZeroAddress();
    error UnsupportedToken(address asset);
    error CloseFactorExceeded(uint256 requested, uint256 maxAllowed);

    constructor(address admin, address graph, address prices) {
        if (admin == address(0) || graph == address(0) || prices == address(0)) {
            revert ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        creditGraph = ICreditGraphRatio(graph);
        priceRegistry = IPriceRegistryFull(prices);
    }

    // -------------------------------------------------------------
    // Rasio kolateral - open-issues B3
    // -------------------------------------------------------------

    /// @notice Rasio kolateral yang berlaku untuk `user` SAAT INI.
    ///
    /// @dev Asimetri yang disengaja, dan reviewer pasti menanyakannya:
    ///
    ///      **Perbaikan berlaku SEGERA.** Skor naik menguntungkan pengguna dan
    ///      aman bagi protokol (kolateral yang sudah terkunci jadi lebih dari
    ///      cukup), jadi tidak ada alasan menahannya.
    ///
    ///      **Penurunan menunggu masa tenggang 7 hari.** Tanpa ini, satu likuidasi
    ///      di Ethereum akan menaikkan rasio yang dipersyaratkan dan membuat posisi
    ///      yang tadinya sehat **langsung dapat dilikuidasi tanpa pengguna
    ///      melakukan apa pun**. Itu benar secara ekonomi tapi kejam, dan tidak
    ///      ada pemberi pinjaman di dunia nyata yang berperilaku begitu.
    ///
    ///      Penurunan harus didorong lewat `refreshRatio` karena fungsi `view`
    ///      tidak bisa mencatat KAPAN penurunan mulai terjadi. Itu bukan celah:
    ///      likuidator punya insentif langsung memanggilnya, karena itulah yang
    ///      membuat sebuah posisi bisa dilikuidasi. Pasar mengoreksi dirinya.
    function effectiveRatioBps(address user) public view returns (uint16) {
        uint16 current = creditGraph.collateralRatioBpsOf(user);
        RatioLock memory lock = _ratioLocks[user];

        if (lock.lockedBps == 0) return current; // belum pernah pinjam

        uint16 base = lock.lockedBps;
        // forge-lint: disable-next-line(block-timestamp)
        if (lock.pendingFrom != 0 && block.timestamp >= lock.pendingFrom) {
            base = lock.pendingBps;
        }

        // bps lebih KECIL berarti lebih baik bagi pengguna.
        return current < base ? current : base;
    }

    /// @notice Dorong perubahan rasio ke dalam antrean. Permissionless.
    function refreshRatio(address user) public {
        uint16 current = creditGraph.collateralRatioBpsOf(user);
        RatioLock storage lock = _ratioLocks[user];
        if (lock.lockedBps == 0) return;

        if (current <= lock.lockedBps) {
            // Perbaikan: langsung berlaku, dan antrean penurunan dibatalkan.
            if (current < lock.lockedBps) emit RatioImproved(user, lock.lockedBps, current);
            lock.lockedBps = current;
            lock.pendingBps = 0;
            lock.pendingFrom = 0;
            return;
        }

        // forge-lint: disable-next-line(block-timestamp)
        if (lock.pendingFrom != 0 && block.timestamp >= lock.pendingFrom) {
            // Masa tenggang sebelumnya sudah lewat - kunci nilainya, lalu antrekan
            // penurunan berikutnya kalau masih lebih buruk lagi.
            lock.lockedBps = lock.pendingBps;
            lock.pendingBps = 0;
            lock.pendingFrom = 0;
            if (current <= lock.lockedBps) return;
        }

        if (lock.pendingFrom == 0 || current > lock.pendingBps) {
            lock.pendingBps = current;
            lock.pendingFrom = uint64(block.timestamp) + RATIO_GRACE_PERIOD;
            emit RatioDegradationScheduled(user, lock.lockedBps, current, lock.pendingFrom);
        }
    }

    // -------------------------------------------------------------
    // Suplai / tarik (sisi pemberi pinjaman)
    // -------------------------------------------------------------

    function supply(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Reserve storage r = _requireActive(asset);
        _accrue(asset);

        uint256 received = _pullExact(asset, amount);
        uint256 scaled = Math.mulDiv(received, WAD, r.liquidityIndex);
        _positions[msg.sender].suppliedScaled[asset] += scaled;
        r.totalSuppliedScaled += scaled;

        emit Supplied(msg.sender, asset, received);
    }

    function withdraw(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Reserve storage r = _requireActive(asset);
        _accrue(asset);

        uint256 scaled = Math.mulDiv(amount, WAD, r.liquidityIndex);
        Position storage p = _positions[msg.sender];
        if (scaled > p.suppliedScaled[asset]) {
            scaled = p.suppliedScaled[asset];
            amount = Math.mulDiv(scaled, r.liquidityIndex, WAD);
        }

        uint256 available = _availableLiquidity(asset);
        if (amount > available) revert InsufficientLiquidity(amount, available);

        p.suppliedScaled[asset] -= scaled;
        r.totalSuppliedScaled -= scaled;

        IERC20(asset).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, asset, amount);
    }

    // -------------------------------------------------------------
    // Kolateral (sisi peminjam)
    // -------------------------------------------------------------

    function depositCollateral(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _requireActive(asset);

        uint256 received = _pullExact(asset, amount);
        _positions[msg.sender].collateral[asset] += received;

        emit CollateralDeposited(msg.sender, asset, received);
    }

    function withdrawCollateral(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _requireActive(asset);
        _accrueAll();

        Position storage p = _positions[msg.sender];
        if (amount > p.collateral[asset]) amount = p.collateral[asset];
        p.collateral[asset] -= amount;

        // Tanpa utang, menarik kolateral tidak menambah risiko apa pun - dan
        // memaksa harga segar di sini berarti feed yang mati akan MENYANDERA
        // dana pengguna yang tidak meminjam sepeser pun. Pembekuan pasar
        // ditujukan untuk yang menambah risiko, bukan untuk semua orang.
        if (_hasDebt(msg.sender)) {
            uint256 hf = _healthFactor(msg.sender, true);
            if (hf < WAD) {
                p.collateral[asset] += amount; // pulihkan sebelum melempar
                revert HealthFactorTooLow(hf);
            }
        }

        IERC20(asset).safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, asset, amount);
    }

    // -------------------------------------------------------------
    // Pinjam / lunasi
    // -------------------------------------------------------------

    function borrow(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Reserve storage r = _requireActive(asset);
        if (!r.borrowEnabled) revert BorrowDisabled(asset);
        _accrueAll();

        uint256 available = _availableLiquidity(asset);
        if (amount > available) revert InsufficientLiquidity(amount, available);

        // Kunci rasio pada saat pinjam. Ini yang membuat posisi tidak bisa
        // tiba-tiba dapat dilikuidasi karena skor berubah (B3).
        refreshRatio(msg.sender);
        uint16 ratio = effectiveRatioBps(msg.sender);

        Position storage p = _positions[msg.sender];
        uint256 scaled = Math.mulDiv(amount, WAD, r.borrowIndex);
        p.debtScaled[asset] += scaled;
        r.totalBorrowedScaled += scaled;

        RatioLock storage lock = _ratioLocks[msg.sender];
        if (lock.lockedBps == 0 || ratio < lock.lockedBps) {
            lock.lockedBps = ratio;
            emit RatioLocked(msg.sender, ratio);
        }

        (uint256 collateralUsd, uint256 debtUsd,,) = _accountData(msg.sender, ratio, true);
        uint256 requiredUsd = Math.mulDiv(debtUsd, ratio, BPS);
        if (collateralUsd < requiredUsd) {
            revert InsufficientCollateral(requiredUsd, collateralUsd);
        }

        IERC20(asset).safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, asset, amount, ratio);
    }

    function repay(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Reserve storage r = _requireActive(asset);
        _accrue(asset);

        Position storage p = _positions[msg.sender];
        uint256 debt = Math.mulDiv(p.debtScaled[asset], r.borrowIndex, WAD);
        if (debt == 0) revert NothingToRepay();
        if (amount > debt) amount = debt;

        uint256 received = _pullExact(asset, amount);

        // Pelunasan penuh HARUS membersihkan utang sampai nol. Menghitung ulang
        // scaled dari `received` bisa menyisakan debu 1-wei akibat pembulatan,
        // dan debu itu terus berbunga selamanya.
        uint256 scaled =
            received >= debt ? p.debtScaled[asset] : Math.mulDiv(received, WAD, r.borrowIndex);
        if (scaled > p.debtScaled[asset]) scaled = p.debtScaled[asset];

        p.debtScaled[asset] -= scaled;
        r.totalBorrowedScaled -= scaled;

        emit Repaid(msg.sender, asset, received);
    }

    // -------------------------------------------------------------
    // Likuidasi
    // -------------------------------------------------------------

    function liquidate(
        address user,
        address debtAsset,
        address collateralAsset,
        uint256 debtToCover
    ) external nonReentrant {
        if (debtToCover == 0) revert ZeroAmount();
        Reserve storage rd = _requireActive(debtAsset);
        _requireActive(collateralAsset);
        _accrueAll();

        // Penurunan rasio yang masa tenggangnya sudah lewat baru berlaku setelah
        // didorong. Likuidator berkepentingan memanggil ini - itulah yang membuat
        // pasar mengoreksi dirinya tanpa keeper khusus.
        refreshRatio(user);

        uint256 hf = _healthFactor(user, true);
        if (hf >= WAD) revert PositionHealthy(hf);

        Position storage p = _positions[user];
        uint256 debt = Math.mulDiv(p.debtScaled[debtAsset], rd.borrowIndex, WAD);
        uint256 maxCover = Math.mulDiv(debt, closeFactorBps, BPS);
        if (debtToCover > maxCover) revert CloseFactorExceeded(debtToCover, maxCover);

        uint256 debtUsd = _usdOrRevert(debtAsset, debtToCover);
        uint256 seizeUsd = Math.mulDiv(debtUsd, BPS + liquidationBonusBps, BPS);
        uint256 seize = _tokensForUsd(collateralAsset, seizeUsd);
        if (seize > p.collateral[collateralAsset]) seize = p.collateral[collateralAsset];

        uint256 received = _pullExact(debtAsset, debtToCover);
        uint256 scaled = Math.mulDiv(received, WAD, rd.borrowIndex);
        if (scaled > p.debtScaled[debtAsset]) scaled = p.debtScaled[debtAsset];

        p.debtScaled[debtAsset] -= scaled;
        rd.totalBorrowedScaled -= scaled;
        p.collateral[collateralAsset] -= seize;

        IERC20(collateralAsset).safeTransfer(msg.sender, seize);
        emit PositionLiquidated(user, msg.sender, debtAsset, collateralAsset, received, seize);
    }

    // -------------------------------------------------------------
    // Bunga
    // -------------------------------------------------------------

    /// @notice Akumulasikan bunga untuk satu reserve. Aman dipanggil siapa pun.
    function accrue(address asset) external {
        _accrue(asset);
    }

    function _accrue(address asset) internal {
        Reserve storage r = _reserves[asset];
        if (r.lastUpdated == 0) return;

        // forge-lint: disable-next-line(block-timestamp)
        uint256 dt = block.timestamp - r.lastUpdated;
        if (dt == 0) return;
        r.lastUpdated = uint64(block.timestamp);

        uint256 borrowedBefore = Math.mulDiv(r.totalBorrowedScaled, r.borrowIndex, WAD);
        if (borrowedBefore == 0) return;

        uint256 suppliedBefore = Math.mulDiv(r.totalSuppliedScaled, r.liquidityIndex, WAD);
        uint256 u = InterestRateModel.utilization(suppliedBefore, borrowedBefore);
        uint256 rate = InterestRateModel.borrowRate(r.irm, u);

        // Bunga sederhana per periode - konvensi yang sama dengan Aave/Compound.
        uint256 factor = Math.mulDiv(rate, dt, SECONDS_PER_YEAR);
        if (factor == 0) return;

        r.borrowIndex = Math.mulDiv(r.borrowIndex, WAD + factor, WAD);

        uint256 interest = Math.mulDiv(borrowedBefore, factor, WAD);
        uint256 toSuppliers = Math.mulDiv(interest, BPS - r.reserveFactorBps, BPS);
        if (toSuppliers != 0 && suppliedBefore != 0) {
            r.liquidityIndex =
                Math.mulDiv(r.liquidityIndex, suppliedBefore + toSuppliers, suppliedBefore);
        }
    }

    function _accrueAll() internal {
        uint256 n = reserveList.length;
        for (uint256 i; i < n; ++i) {
            _accrue(reserveList[i]);
        }
    }

    // -------------------------------------------------------------
    // Baca
    // -------------------------------------------------------------

    function collateralRatioBpsOf(address user) external view returns (uint16) {
        return effectiveRatioBps(user);
    }

    function accountData(address user)
        external
        view
        returns (
            uint256 totalCollateralUsdWad,
            uint256 totalDebtUsdWad,
            uint256 availableBorrowUsdWad,
            uint256 healthFactorWad
        )
    {
        return _accountData(user, effectiveRatioBps(user), false);
    }

    /// @notice Berapa banyak modal yang TIDAK perlu dikunci pengguna ini
    ///         dibandingkan baseline 150%.
    /// @dev Ini angka utama yang dijual produk. Ia harus dihitung dari state
    ///      nyata, bukan diilustrasikan.
    function capitalSavedUsdWad(address user) external view returns (uint256) {
        uint16 ratio = effectiveRatioBps(user);
        if (ratio >= BASELINE_RATIO_BPS) return 0;
        (, uint256 debtUsd,,) = _accountData(user, ratio, false);
        return Math.mulDiv(debtUsd, BASELINE_RATIO_BPS - ratio, BPS);
    }

    function healthFactor(address user) external view returns (uint256) {
        return _healthFactor(user, false);
    }

    function supplyBalanceOf(address user, address asset) external view returns (uint256) {
        return
            Math.mulDiv(
                _positions[user].suppliedScaled[asset], _reserves[asset].liquidityIndex, WAD
            );
    }

    function collateralBalanceOf(address user, address asset) external view returns (uint256) {
        return _positions[user].collateral[asset];
    }

    function debtBalanceOf(address user, address asset) external view returns (uint256) {
        return Math.mulDiv(_positions[user].debtScaled[asset], _reserves[asset].borrowIndex, WAD);
    }

    function reserveData(address asset) external view returns (Reserve memory) {
        return _reserves[asset];
    }

    function reserveCount() external view returns (uint256) {
        return reserveList.length;
    }

    function currentBorrowRate(address asset) external view returns (uint256) {
        Reserve storage r = _reserves[asset];
        uint256 supplied = Math.mulDiv(r.totalSuppliedScaled, r.liquidityIndex, WAD);
        uint256 borrowed = Math.mulDiv(r.totalBorrowedScaled, r.borrowIndex, WAD);
        return
            InterestRateModel.borrowRate(r.irm, InterestRateModel.utilization(supplied, borrowed));
    }

    // -------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------

    function _accountData(address user, uint16 ratio, bool requireFresh)
        internal
        view
        returns (
            uint256 totalCollateralUsdWad,
            uint256 totalDebtUsdWad,
            uint256 availableBorrowUsdWad,
            uint256 healthFactorWad
        )
    {
        Position storage p = _positions[user];
        uint256 n = reserveList.length;

        for (uint256 i; i < n; ++i) {
            address asset = reserveList[i];

            uint256 col = p.collateral[asset];
            if (col != 0) {
                totalCollateralUsdWad += requireFresh
                    ? _usdOrRevert(asset, col)
                    : _usdOrZero(asset, col);
            }

            uint256 debtScaled = p.debtScaled[asset];
            if (debtScaled != 0) {
                uint256 debt = Math.mulDiv(debtScaled, _reserves[asset].borrowIndex, WAD);
                totalDebtUsdWad += requireFresh
                    ? _usdOrRevert(asset, debt)
                    : _usdOrZero(asset, debt);
            }
        }

        uint256 capacity = ratio == 0 ? 0 : Math.mulDiv(totalCollateralUsdWad, BPS, ratio);
        availableBorrowUsdWad = capacity > totalDebtUsdWad ? capacity - totalDebtUsdWad : 0;
        healthFactorWad =
            totalDebtUsdWad == 0 ? type(uint256).max : Math.mulDiv(capacity, WAD, totalDebtUsdWad);
    }

    function _healthFactor(address user, bool requireFresh) internal view returns (uint256 hf) {
        (,,, hf) = _accountData(user, effectiveRatioBps(user), requireFresh);
    }

    /// @dev Harga basi MEMBEKUKAN pasar, bukan dipakai apa adanya. Ini mengubah
    ///      keterbatasan protokol - lag attestation ~8 menit, indexer bisa mati -
    ///      menjadi properti keamanan: lebih baik tidak bisa meminjam daripada
    ///      meminjam dengan harga yang sudah tidak benar.
    function _usdOrRevert(address asset, uint256 amount) internal view returns (uint256) {
        (uint256 usdWad, bool ok) = priceRegistry.tryToUsd1e18(asset, amount);
        if (!ok) revert MarketFrozenStalePrice(asset);
        return usdWad;
    }

    function _usdOrZero(address asset, uint256 amount) internal view returns (uint256) {
        (uint256 usdWad, bool ok) = priceRegistry.tryToUsd1e18(asset, amount);
        return ok ? usdWad : 0;
    }

    function _tokensForUsd(address asset, uint256 usdWad) internal view returns (uint256) {
        (bool ok, uint256 answer, uint8 feedDec) = priceRegistry.tryGetPrice(asset);
        if (!ok || answer == 0) revert MarketFrozenStalePrice(asset);
        uint8 tokenDec = priceRegistry.assetDecimals(asset);
        // tokens = usdWad * 10^tokenDec * 10^feedDec / (answer * 1e18)
        uint256 numerator = 10 ** uint256(tokenDec) * 10 ** uint256(feedDec);
        return Math.mulDiv(usdWad, numerator, answer * WAD);
    }

    function _availableLiquidity(address asset) internal view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    /// @dev Menegakkan "tanpa fee-on-transfer / rebasing" secara langsung, bukan
    ///      hanya lewat allowlist kurator. Token yang memotong biaya transfer
    ///      membuat akuntansi internal menyimpang dari saldo nyata, dan
    ///      penyimpangan itu berakhir sebagai kekurangan dana saat penarikan.
    function _pullExact(address asset, uint256 amount) internal returns (uint256) {
        IERC20 token = IERC20(asset);
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received != amount) revert UnsupportedToken(asset);
        return received;
    }

    function _hasDebt(address user) internal view returns (bool) {
        uint256 n = reserveList.length;
        for (uint256 i; i < n; ++i) {
            if (_positions[user].debtScaled[reserveList[i]] != 0) return true;
        }
        return false;
    }

    function _requireActive(address asset) internal view returns (Reserve storage r) {
        r = _reserves[asset];
        if (!r.active) revert ReserveInactive(asset);
    }

    // -------------------------------------------------------------
    // Kurasi
    // -------------------------------------------------------------

    function addReserve(address asset, uint16 reserveFactorBps_, bool borrowEnabled)
        external
        onlyRole(CURATOR_ROLE)
    {
        if (asset == address(0)) revert ZeroAddress();
        if (_reserves[asset].lastUpdated != 0) revert ReserveAlreadyExists(asset);
        if (reserveFactorBps_ >= BPS) revert ReserveAlreadyExists(asset);

        _reserves[asset] = Reserve({
            totalSuppliedScaled: 0,
            totalBorrowedScaled: 0,
            liquidityIndex: WAD,
            borrowIndex: WAD,
            lastUpdated: uint64(block.timestamp),
            reserveFactorBps: reserveFactorBps_,
            active: true,
            borrowEnabled: borrowEnabled,
            irm: InterestRateModel.defaultParams()
        });
        reserveList.push(asset);
        emit ReserveAdded(asset, reserveFactorBps_);
    }

    function configureReserve(address asset, bool active, bool borrowEnabled)
        external
        onlyRole(CURATOR_ROLE)
    {
        Reserve storage r = _reserves[asset];
        if (r.lastUpdated == 0) revert ReserveInactive(asset);
        r.active = active;
        r.borrowEnabled = borrowEnabled;
        emit ReserveConfigured(asset, active, borrowEnabled);
    }

    function setLiquidationParams(uint16 bonusBps, uint16 closeBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        liquidationBonusBps = bonusBps;
        closeFactorBps = closeBps;
    }
}
