// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ICreditGraph
/// @notice Permukaan minimal yang dipanggil FactRegistry saat fakta baru masuk.
interface ICreditGraph {
    /// @notice Beri tahu graph bahwa satu fakta baru tercatat.
    /// @dev Dipanggil SETELAH fakta tersimpan permanen, mengikuti checks-effects.
    function applyFact(bytes32 factId) external;
}
