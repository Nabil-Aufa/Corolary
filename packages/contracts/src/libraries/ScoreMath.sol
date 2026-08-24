// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title ScoreMath
/// @notice Primitif aritmetika untuk credit scoring. Integer murni, tanpa aproksimasi.
///
/// @dev Kenapa kurva saturasi rasional `M·x/(x+K)` dan bukan logaritma: keenam
///      komponen butuh diminishing returns, yang biasanya didekati `log(x)`. Tapi
///      `log2` fixed-point di Solidity butuh aproksimasi bit-shift + interpolasi
///      pecahan yang sulit diaudit dan rawan galat di tepi rentang.
///      `M·x/(x+K)` memberi bentuk kualitatif yang sama dengan aritmetika EKSAK -
///      hanya kali dan bagi bulat. Satu primitif dipakai ulang di 4 dari 6
///      komponen, jadi auditor cukup memahami satu fungsi.
library ScoreMath {
    uint256 internal constant WAD = 1e18;

    /// @notice Kurva saturasi rasional: `maxPoints * value / (value + half)`.
    /// @dev `value` dan `half` harus dalam basis yang sama - rasio membatalkan
    ///      basis, jadi hasilnya benar selama keduanya konsisten.
    ///      `Math.mulDiv` mengalikan dulu baru membagi lewat 512-bit intermediate,
    ///      jadi presisi tidak hilang dan tidak ada overflow diam-diam.
    function saturating(uint256 value, uint256 half, uint256 maxPoints)
        internal
        pure
        returns (uint256)
    {
        if (value == 0) return 0;
        return Math.mulDiv(maxPoints, value, value + half);
    }

    function clampInt(int256 x, int256 lo, int256 hi) internal pure returns (int256) {
        if (x < lo) return lo;
        if (x > hi) return hi;
        return x;
    }

    function minU(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function maxU(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /// @dev Kernighan popcount - iterasinya sebanyak bit yang menyala, bukan 8.
    function popcount8(uint8 x) internal pure returns (uint256 c) {
        for (; x != 0; x &= x - 1) {
            unchecked {
                ++c;
            }
        }
    }
}
