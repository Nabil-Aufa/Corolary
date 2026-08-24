// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ScoreMath} from "./libraries/ScoreMath.sol";
import {Fact, FactKind} from "./libraries/FactTypes.sol";
import {IFactRegistry} from "./interfaces/IFactRegistry.sol";
import {IPriceRegistry} from "./interfaces/IPriceRegistry.sol";
import {ICreditGraph} from "./interfaces/ICreditGraph.sol";

/// @title CreditGraph
/// @notice Skor kredit 0..1000 yang diturunkan HANYA dari fakta terbukti.
///
/// @dev Dua aturan yang membentuk seluruh kontrak ini:
///
///      1. `applyFact` HARUS O(1). Ia dipanggil di dalam `FactRegistry.recordFact`,
///         dan jumlah fakta per subjek tidak terbatas. Mengiterasi riwayat akan
///         mengunci pencatatan ke kegagalan gas permanen begitu seseorang punya
///         cukup banyak fakta - artinya justru pengguna TERBAIK yang lebih dulu
///         rusak. Karena itu state diakumulasi saat tulis; poin dihitung saat baca.
///
///      2. `applyFact` TIDAK BOLEH revert. Kalau ia revert, `recordFact` ikut
///         revert - dan fakta yang sah hilang PERMANEN, karena `queryId` sudah
///         tertandai dan tidak bisa diproses ulang. Setiap panggilan eksternal di
///         sini dibungkus `try/catch`, dan kondisi tak terduga menjadi no-op,
///         bukan lemparan.
contract CreditGraph is AccessControl, ICreditGraph {
    using ScoreMath for uint256;

    bytes32 public constant FACT_CONSUMER_ROLE = keccak256("FACT_CONSUMER_ROLE");
    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");

    // --- Konstanta kalibrasi (docs/scoring.md §3) ---
    uint256 internal constant K_VOLUME_USD_1E18 = 50_000 * 1e18;
    uint256 internal constant MIN_MATERIAL_USD_1E18 = 10 * 1e18;
    uint256 internal constant K_COUNT = 12;
    uint256 internal constant K_DURATION_DAYS = 365;
    uint256 internal constant BASE_PENALTY_PTS = 40;
    uint256 internal constant K_SEV_USD_1E18 = 5_000 * 1e18;
    uint256 internal constant TARGET_DIVERSITY_PROTOCOLS = 4;
    uint256 internal constant TARGET_PAIR_DIVERSITY = 6;
    uint256 internal constant RECENCY_FULL_DAYS = 90;
    uint256 internal constant RECENCY_ZERO_DAYS = 720;
    uint256 internal constant STANDING_LOOKBACK_DAYS = 365;
    uint64 internal constant MIN_MEANINGFUL_DAYS = 7;
    uint64 internal constant CLOSE_GAP = 30 days;

    uint256 internal constant MAX_SCORE = 1000;
    uint256 internal constant MAX_LIQUIDATION_PENALTY = 300;

    struct SubjectState {
        uint256 weightedRepaidUsd1e18;
        uint256 liquidationPenaltyPts;
        uint64 firstFactAt;
        uint64 lastFactAt;
        uint64 lastPositiveFactAt;
        uint64 lastLiquidationAt;
        uint32 qualifyingRepaymentCount;
        uint32 liquidationCount;
        uint32 originatedCount;
        uint32 factCount;
        uint8 protocolBitmap;
        uint8 assetDiversityCount;
        mapping(address => bool) seenAsset;
        mapping(bytes32 => uint64) openLoanOriginatedAt;
    }

    /// @notice Salinan datar untuk dibaca API - struct ber-mapping tidak bisa
    ///         dikembalikan utuh oleh fungsi view eksternal.
    struct SubjectSnapshot {
        uint256 weightedRepaidUsd1e18;
        uint256 liquidationPenaltyPts;
        uint64 firstFactAt;
        uint64 lastFactAt;
        uint64 lastPositiveFactAt;
        uint64 lastLiquidationAt;
        uint32 qualifyingRepaymentCount;
        uint32 liquidationCount;
        uint32 originatedCount;
        uint32 factCount;
        uint8 protocolBitmap;
        uint8 assetDiversityCount;
    }

    IFactRegistry public immutable REGISTRY;
    IPriceRegistry public priceRegistry;

    mapping(address => SubjectState) internal _subjects;

    /// @notice Fakta yang sudah diterapkan. Mencegah penghitungan ganda.
    mapping(bytes32 => bool) public factApplied;

    /// @notice protokol => nomor bit (1-based; 0 berarti belum ditetapkan).
    /// @dev Bitmap-nya `uint8`, jadi plafonnya 8 protokol. Cukup untuk Aave V3,
    ///      Morpho Blue, Compound V3, Spark, plus ruang tumbuh.
    mapping(address => uint8) public protocolBitOf;

    event ScoreUpdated(address indexed subject, uint16 oldScore, uint16 newScore, uint8 tier);
    event FactApplied(bytes32 indexed factId, address indexed subject, FactKind kind);
    event FactSkipped(bytes32 indexed factId, string reason);
    event PriceRegistryUpdated(address indexed priceRegistry);
    event ProtocolBitAssigned(address indexed protocol, uint8 bit);

    error ZeroAddress();
    error BitOutOfRange(uint8 bit);
    error BitAlreadyTaken(uint8 bit);

    constructor(address admin, address registry) {
        if (admin == address(0) || registry == address(0)) revert ZeroAddress();
        REGISTRY = IFactRegistry(registry);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------
    // Tulis
    // -------------------------------------------------------------

    /// @inheritdoc ICreditGraph
    function applyFact(bytes32 factId) external onlyRole(FACT_CONSUMER_ROLE) {
        // Idempoten. BUKAN revert: kalau ini revert, `recordFact` ikut revert dan
        // fakta yang sah hilang permanen.
        //
        // Ini juga membatasi kerusakan bila FACT_CONSUMER_ROLE bocor: pemegang
        // role tidak bisa menggelembungkan skor dengan menerapkan ulang fakta
        // yang sama berulang kali. Ia tetap hanya bisa menerapkan fakta yang
        // BENAR-BENAR ada di registry, dan tepat sekali.
        if (factApplied[factId]) {
            emit FactSkipped(factId, "already applied");
            return;
        }

        if (!REGISTRY.factExists(factId)) {
            emit FactSkipped(factId, "unknown fact");
            return;
        }

        Fact memory f = REGISTRY.getFact(factId);
        factApplied[factId] = true;

        SubjectState storage s = _subjects[f.subject];
        uint16 oldScore = _score(s);

        // `observedAt` adalah satu-satunya field yang tidak dibuktikan kriptografis
        // (receipt Ethereum tidak memuat timestamp). Ia dijepit ke waktu sekarang
        // supaya operator tidak bisa memberi tanggal MASA DEPAN, yang akan membuat
        // aritmetika `now - observedAt` underflow dan mengunci pembacaan skor.
        // Backdating tetap mungkin - itu batas kepercayaan yang kita nyatakan
        // terbuka, bukan yang kita sembunyikan.
        uint64 observedAt = f.observedAt;
        // forge-lint: disable-next-line(block-timestamp)
        if (observedAt == 0 || observedAt > uint64(block.timestamp)) {
            observedAt = uint64(block.timestamp);
        }

        _touchCommon(s, f, observedAt);

        if (f.kind == FactKind.LoanRepaid) {
            _applyLoanRepaid(s, f, observedAt);
        } else if (f.kind == FactKind.LoanOriginated) {
            _applyLoanOriginated(s, f, observedAt);
        } else if (f.kind == FactKind.Liquidated) {
            _applyLiquidated(s, f, observedAt);
        } else if (f.kind == FactKind.CollateralSupplied) {
            _bumpLastPositive(s, observedAt);
        }
        // CollateralWithdrawn: hanya bookkeeping umum. Menarik kolateral bukan
        // sinyal positif maupun negatif.

        uint16 newScore = _score(s);
        emit FactApplied(factId, f.subject, f.kind);
        if (newScore != oldScore) {
            (uint8 tier,) = _tierOf(newScore);
            emit ScoreUpdated(f.subject, oldScore, newScore, tier);
        }
    }

    function _touchCommon(SubjectState storage s, Fact memory f, uint64 observedAt) private {
        unchecked {
            ++s.factCount;
        }
        if (s.firstFactAt == 0 || observedAt < s.firstFactAt) s.firstFactAt = observedAt;
        if (observedAt > s.lastFactAt) s.lastFactAt = observedAt;

        // `1 << (bit - 1)` memetakan bit 1..8 ke posisi 0..7. Urutan argumennya
        // memang begini - forge-lint menandainya sebagai false positive; perilakunya
        // dikunci oleh `test_ProtocolBitmapMapsBitsCorrectly`.
        uint8 bit = protocolBitOf[f.protocol];
        // Protokol tanpa nomor bit tetap dicatat sebagai fakta; ia hanya tidak
        // menyumbang diversity. Melewatkan diam-diam jauh lebih baik daripada
        // revert - kurator bisa menetapkan bit-nya nanti tanpa kehilangan fakta.
        // forge-lint: disable-next-line(incorrect-shift)
        if (bit != 0) s.protocolBitmap |= uint8(1 << (bit - 1));

        if (!s.seenAsset[f.asset]) {
            s.seenAsset[f.asset] = true;
            if (s.assetDiversityCount < type(uint8).max) {
                unchecked {
                    ++s.assetDiversityCount;
                }
            }
        }
    }

    function _applyLoanRepaid(SubjectState storage s, Fact memory f, uint64 observedAt) private {
        (uint256 amountUsd, bool priceOk) = _tryUsd(f.asset, f.amount);

        bytes32 key = keccak256(abi.encodePacked(f.protocol, f.asset));
        uint64 openedAt = s.openLoanOriginatedAt[key];

        // Posisi yang dibuka sebelum Corolary mulai mengindeks tidak punya
        // `LoanOriginated` berpasangan. Beri keuntungan keraguan (faktor penuh)
        // alih-alih menghukum orang karena riwayatnya mendahului kita.
        uint256 durationFactor;
        if (openedAt == 0 || observedAt <= openedAt) {
            durationFactor = 1e18;
        } else {
            uint256 held = uint256(observedAt - openedAt);
            durationFactor =
                ScoreMath.minU(1e18, (held * 1e18) / (uint256(MIN_MEANINGFUL_DAYS) * 1 days));
        }

        uint256 diversityFactor = _counterpartyDiversityFactor(s);
        uint256 w = Math.mulDiv(Math.mulDiv(amountUsd, durationFactor, 1e18), diversityFactor, 1e18);

        s.weightedRepaidUsd1e18 = _satAdd(s.weightedRepaidUsd1e18, w);

        // Harga tidak tersedia TIDAK boleh menguntungkan subjek: tanpa harga,
        // pelunasan ini tidak dihitung sebagai bermateri dan tidak menambah volume.
        if (priceOk && amountUsd >= MIN_MATERIAL_USD_1E18) {
            unchecked {
                ++s.qualifyingRepaymentCount;
            }
        }
        _bumpLastPositive(s, observedAt);
    }

    function _applyLoanOriginated(SubjectState storage s, Fact memory f, uint64 observedAt)
        private
    {
        bytes32 key = keccak256(abi.encodePacked(f.protocol, f.asset));
        uint64 openedAt = s.openLoanOriginatedAt[key];

        // Attestcoin hanya membuktikan EVENT, bukan STATE - kita tidak pernah tahu
        // sisa utang suatu posisi. Penyederhanaan yang disengaja dan dinyatakan
        // terbuka (docs/scoring.md §8.1):
        //   - pinjaman tambahan di atas posisi terbuka TIDAK me-reset jam
        //   - `LoanOriginated` yang muncul > CLOSE_GAP setelah aktivitas positif
        //     terakhir dianggap posisi BARU, jadi jamnya di-reset
        if (openedAt == 0) {
            s.openLoanOriginatedAt[key] = observedAt;
        } else if (
            s.lastPositiveFactAt != 0 && observedAt > s.lastPositiveFactAt
                && observedAt - s.lastPositiveFactAt > CLOSE_GAP
        ) {
            s.openLoanOriginatedAt[key] = observedAt;
        }

        unchecked {
            ++s.originatedCount;
        }
        _bumpLastPositive(s, observedAt);
    }

    function _applyLiquidated(SubjectState storage s, Fact memory f, uint64 observedAt) private {
        (uint256 amountUsd, bool priceOk) = _tryUsd(f.asset, f.amount);

        unchecked {
            ++s.liquidationCount;
        }

        // Asimetri yang DISENGAJA: harga hilang saat repay -> kontribusi 0
        // (tidak menguntungkan subjek); harga hilang saat likuidasi -> severity
        // maksimum (tetap tidak menguntungkan subjek). Ketidaktersediaan data
        // tidak boleh bisa dipakai untuk memutihkan riwayat buruk.
        uint256 severityFactor =
            priceOk ? Math.mulDiv(amountUsd, 1e18, amountUsd + K_SEV_USD_1E18) : 1e18;

        uint256 penalty = (BASE_PENALTY_PTS * uint256(s.liquidationCount) * severityFactor) / 1e18;
        s.liquidationPenaltyPts = _satAdd(s.liquidationPenaltyPts, penalty);
        // Hanya maju, tidak pernah mundur - alasan sama seperti _bumpLastPositive.
        if (observedAt > s.lastLiquidationAt) s.lastLiquidationAt = observedAt;
    }

    /// @dev Waktu aktivitas positif hanya boleh MAJU.
    ///
    ///      Backfill ("Claim your history") menerapkan fakta LAMA setelah fakta
    ///      baru sudah masuk. Menugaskan `lastPositiveFactAt = observedAt` begitu
    ///      saja akan memundurkan jam recency, sehingga mengklaim riwayat justru
    ///      MENURUNKAN skor seseorang - kebalikan persis dari maksudnya.
    function _bumpLastPositive(SubjectState storage s, uint64 observedAt) private {
        if (observedAt > s.lastPositiveFactAt) s.lastPositiveFactAt = observedAt;
    }

    /// @dev Penjumlahan jenuh. Overflow di sini akan me-revert `applyFact`, yang
    ///      me-revert `recordFact`, yang membuat fakta sah HILANG PERMANEN karena
    ///      `queryId` sudah tertandai. Menjenuh di batas atas jauh lebih baik:
    ///      kedua nilai ini toh sudah di-clamp saat dibaca.
    function _satAdd(uint256 a, uint256 b) private pure returns (uint256) {
        unchecked {
            uint256 c = a + b;
            return c < a ? type(uint256).max : c;
        }
    }

    /// @dev Dibungkus try/catch: PriceRegistry adalah kontrak yang bisa diganti
    ///      admin. Kalau ia revert, kehabisan gas, atau belum di-set, pencatatan
    ///      fakta tetap harus jalan.
    function _tryUsd(address asset, uint256 amount) private view returns (uint256, bool) {
        if (address(priceRegistry) == address(0)) return (0, false);
        try priceRegistry.tryToUsd1e18(asset, amount) returns (uint256 usdWad, bool ok) {
            return (usdWad, ok);
        } catch {
            return (0, false);
        }
    }

    function _counterpartyDiversityFactor(SubjectState storage s) private view returns (uint256) {
        uint256 d = ScoreMath.popcount8(s.protocolBitmap) + s.assetDiversityCount;
        uint256 raw = Math.mulDiv(d, 1e18, TARGET_PAIR_DIVERSITY);
        return ScoreMath.maxU(5e17, ScoreMath.minU(1e18, raw));
    }

    // -------------------------------------------------------------
    // Kurasi
    // -------------------------------------------------------------

    /// @param bit 1..8. Ditetapkan eksplisit, bukan diurutkan otomatis, supaya
    ///        bit satu protokol tidak pernah bergeser saat protokol lain dihapus -
    ///        pergeseran akan menulis ulang diversity setiap subjek yang sudah ada.
    function assignProtocolBit(address protocol, uint8 bit) external onlyRole(CURATOR_ROLE) {
        if (protocol == address(0)) revert ZeroAddress();
        if (bit == 0 || bit > 8) revert BitOutOfRange(bit);
        protocolBitOf[protocol] = bit;
        emit ProtocolBitAssigned(protocol, bit);
    }

    function setPriceRegistry(address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        priceRegistry = IPriceRegistry(registry);
        emit PriceRegistryUpdated(registry);
    }

    // -------------------------------------------------------------
    // Baca
    // -------------------------------------------------------------

    function scoreOf(address subject) external view returns (uint16 score, uint8 tier) {
        score = _score(_subjects[subject]);
        (tier,) = _tierOf(score);
    }

    function collateralRatioBpsOf(address subject) external view returns (uint16 bps) {
        (, bps) = _tierOf(_score(_subjects[subject]));
    }

    /// @notice Enam komponen, urutan tetap sesuai `ScoreComponentKey`:
    ///         repaymentVolume, repaymentCount, historyDuration,
    ///         liquidationPenalty, protocolDiversity, activeStanding.
    function componentsOf(address subject) external view returns (int32[6] memory points) {
        SubjectState storage s = _subjects[subject];
        points[0] = int32(uint32(_repaymentVolumePoints(s)));
        points[1] = int32(uint32(_repaymentCountPoints(s)));
        points[2] = int32(uint32(_historyDurationPoints(s)));
        points[3] = -int32(uint32(_liquidationPenaltyPoints(s)));
        points[4] = int32(uint32(_protocolDiversityPoints(s)));
        points[5] = int32(uint32(_activeStandingPoints(s)));
    }

    function snapshotOf(address subject) external view returns (SubjectSnapshot memory snap) {
        SubjectState storage s = _subjects[subject];
        snap = SubjectSnapshot({
            weightedRepaidUsd1e18: s.weightedRepaidUsd1e18,
            liquidationPenaltyPts: s.liquidationPenaltyPts,
            firstFactAt: s.firstFactAt,
            lastFactAt: s.lastFactAt,
            lastPositiveFactAt: s.lastPositiveFactAt,
            lastLiquidationAt: s.lastLiquidationAt,
            qualifyingRepaymentCount: s.qualifyingRepaymentCount,
            liquidationCount: s.liquidationCount,
            originatedCount: s.originatedCount,
            factCount: s.factCount,
            protocolBitmap: s.protocolBitmap,
            assetDiversityCount: s.assetDiversityCount
        });
    }

    // -------------------------------------------------------------
    // Komponen skor
    // -------------------------------------------------------------

    function _repaymentVolumePoints(SubjectState storage s) private view returns (uint256) {
        return ScoreMath.saturating(s.weightedRepaidUsd1e18, K_VOLUME_USD_1E18, 300);
    }

    function _repaymentCountPoints(SubjectState storage s) private view returns (uint256) {
        return ScoreMath.saturating(uint256(s.qualifyingRepaymentCount) * 1e18, K_COUNT * 1e18, 200);
    }

    /// @dev `block.timestamp` memang dipakai di sini dan di `_activeStandingPoints`.
    ///      Itu disengaja: kedua komponen mengukur waktu berjalan. Validator bisa
    ///      menggeser timestamp beberapa detik; ambang kita berskala HARI, jadi
    ///      manipulasi seukuran itu tidak bisa memindahkan tier. Yang tidak boleh
    ///      terjadi adalah underflow, dan itu dijaga perbandingan di bawah.
    function _historyDurationPoints(SubjectState storage s) private view returns (uint256) {
        uint64 first = s.firstFactAt;
        // forge-lint: disable-next-line(block-timestamp)
        if (first == 0 || first >= block.timestamp) return 0;
        uint256 durationDays = (block.timestamp - first) / 1 days;
        return ScoreMath.saturating(durationDays * 1e18, K_DURATION_DAYS * 1e18, 200);
    }

    function _liquidationPenaltyPoints(SubjectState storage s) private view returns (uint256) {
        return ScoreMath.minU(MAX_LIQUIDATION_PENALTY, s.liquidationPenaltyPts);
    }

    function _protocolDiversityPoints(SubjectState storage s) private view returns (uint256) {
        uint256 d = ScoreMath.popcount8(s.protocolBitmap);
        return ScoreMath.minU(100, (d * 100) / TARGET_DIVERSITY_PROTOCOLS);
    }

    function _activeStandingPoints(SubjectState storage s) private view returns (uint256) {
        uint64 lastPositive = s.lastPositiveFactAt;
        if (lastPositive == 0) return 0;

        uint256 nowTs = block.timestamp;
        uint256 recencyDays = lastPositive >= nowTs ? 0 : (nowTs - lastPositive) / 1 days;

        uint256 recencyPts;
        if (recencyDays <= RECENCY_FULL_DAYS) {
            recencyPts = 100;
        } else if (recencyDays >= RECENCY_ZERO_DAYS) {
            recencyPts = 0;
        } else {
            recencyPts =
                (100 * (RECENCY_ZERO_DAYS - recencyDays)) / (RECENCY_ZERO_DAYS - RECENCY_FULL_DAYS);
        }

        uint256 standingPts;
        uint64 lastLiq = s.lastLiquidationAt;
        if (lastLiq == 0) {
            standingPts = 100;
        } else {
            uint256 daysSince = lastLiq >= nowTs ? 0 : (nowTs - lastLiq) / 1 days;
            standingPts = daysSince >= STANDING_LOOKBACK_DAYS
                ? 100
                : (100 * daysSince) / STANDING_LOOKBACK_DAYS;
        }

        return recencyPts + standingPts;
    }

    function _score(SubjectState storage s) private view returns (uint16) {
        uint256 positive = _repaymentVolumePoints(s) + _repaymentCountPoints(s)
            + _historyDurationPoints(s) + _protocolDiversityPoints(s) + _activeStandingPoints(s);

        uint256 penalty = _liquidationPenaltyPoints(s);

        // Lima komponen positif berjumlah maksimum TEPAT 1000, jadi `positive`
        // tidak pernah melebihi MAX_SCORE dan penalti murni mengurangi dari
        // kondisi "sempurna" - tidak perlu renormalisasi.
        uint256 raw = positive > penalty ? positive - penalty : 0;
        return uint16(ScoreMath.minU(MAX_SCORE, raw));
    }

    /// @notice Pemetaan skor -> tier -> rasio kolateral. Dikunci di
    ///         docs/scoring.md §10.
    /// @dev Publik dengan sengaja: kalau ia privat, tes batas tier hanya bisa
    ///      menyalin ulang tabelnya dan menguji salinan itu terhadap dirinya
    ///      sendiri - tes tautologi yang tetap hijau meski kontraknya salah.
    function tierOf(uint16 score) public pure returns (uint8 tier, uint16 bps) {
        return _tierOf(score);
    }

    function _tierOf(uint16 score) private pure returns (uint8 tier, uint16 bps) {
        if (score >= 800) return (4, 11000);
        if (score >= 600) return (3, 12000);
        if (score >= 400) return (2, 13000);
        if (score >= 200) return (1, 14000);
        return (0, 15000);
    }
}
