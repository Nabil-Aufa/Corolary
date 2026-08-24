// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title InterestRateModel
/// @notice Model bunga "linear kink" gaya Aave/Compound.
///
/// @dev Sengaja TIDAK inovatif (open-issues B4). Model bunga bukan bagian yang
///      dibedakan Corolary — yang dibedakan adalah rasio kolateralnya. Memakai
///      kurva yang sudah teruji bertahun-tahun jauh lebih baik daripada
///      menciptakan sendiri sesuatu yang harus dipertahankan di depan auditor.
///
///        u <= kink :  rate = base + slope1 x (u / kink)
///        u >  kink :  rate = base + slope1 + slope2 x ((u - kink) / (1 - kink))
///
///      Di atas `kink`, kurvanya menanjak tajam supaya likuiditas terakhir tidak
///      pernah habis: peminjam terakhir membayar sangat mahal, dan penyuplai
///      dibayar sangat baik untuk masuk.
library InterestRateModel {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;

    struct Params {
        uint64 baseRateWad; // suku bunga saat utilisasi 0
        uint64 slope1Wad; // kenaikan sampai kink
        uint64 slope2Wad; // kenaikan setelah kink
        uint64 kinkWad; // titik belok utilisasi
    }

    /// @notice Parameter awal dari open-issues B4: base 0%, slope1 4%, slope2 60%,
    ///         kink 80%.
    function defaultParams() internal pure returns (Params memory) {
        return Params({baseRateWad: 0, slope1Wad: 0.04e18, slope2Wad: 0.6e18, kinkWad: 0.8e18});
    }

    /// @param totalSupplied dan @param totalBorrowed dalam satuan token yang sama.
    /// @return utilizationWad rasio pemakaian, dijepit ke [0, WAD]
    function utilization(uint256 totalSupplied, uint256 totalBorrowed)
        internal
        pure
        returns (uint256 utilizationWad)
    {
        if (totalSupplied == 0) return 0;
        utilizationWad = Math.mulDiv(totalBorrowed, WAD, totalSupplied);
        // Utilisasi bisa melewati 100% sesaat kalau bunga terakumulasi melebihi
        // likuiditas yang tersisa. Dijepit supaya kurvanya tidak meledak.
        if (utilizationWad > WAD) utilizationWad = WAD;
    }

    /// @notice Suku bunga pinjam tahunan dalam WAD.
    function borrowRate(Params memory p, uint256 utilizationWad)
        internal
        pure
        returns (uint256 rateWad)
    {
        if (utilizationWad <= p.kinkWad) {
            if (p.kinkWad == 0) return p.baseRateWad;
            return p.baseRateWad + Math.mulDiv(p.slope1Wad, utilizationWad, p.kinkWad);
        }
        uint256 excess = utilizationWad - p.kinkWad;
        uint256 span = WAD - p.kinkWad;
        if (span == 0) return p.baseRateWad + p.slope1Wad + p.slope2Wad;
        return p.baseRateWad + p.slope1Wad + Math.mulDiv(p.slope2Wad, excess, span);
    }

    /// @notice Suku bunga yang diterima penyuplai, setelah dipotong reserve factor.
    function supplyRate(Params memory p, uint256 utilizationWad, uint16 reserveFactorBps)
        internal
        pure
        returns (uint256 rateWad)
    {
        uint256 borrow = borrowRate(p, utilizationWad);
        uint256 toSuppliers = Math.mulDiv(borrow, BPS - reserveFactorBps, BPS);
        return Math.mulDiv(toSuppliers, utilizationWad, WAD);
    }
}
