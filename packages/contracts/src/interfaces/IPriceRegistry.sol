// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IPriceRegistry
/// @notice Harga terbukti dari event Chainlink `AnswerUpdated` di Ethereum mainnet.
///
/// @dev Catatan bentuk API - ada konflik antar dokumen yang diselesaikan di sini:
///      `docs/contracts.md` §8 menuliskan `toUsd1e18(asset, amount, assetDecimals)`
///      dengan `assetDecimals` sebagai parameter. Itu **tidak bisa dipakai**:
///      struct `Fact` on-chain tidak memuat `assetDecimals` (lihat FactTypes.sol),
///      jadi `CreditGraph` - satu-satunya pemanggil - tidak punya nilai itu.
///      Bentuk yang dipakai mengikuti `docs/scoring.md` §3.1/§3.4: registry
///      menyimpan sendiri desimal per aset dan mengembalikan flag ketersediaan.
interface IPriceRegistry {
    /// @notice Nilai USD dalam WAD (1e18), non-reverting.
    /// @dev HARUS tidak pernah revert. `CreditGraph.applyFact` dipanggil dari dalam
    ///      `FactRegistry.recordFact`; kalau harga bisa me-revert, satu feed basi
    ///      akan menjatuhkan pencatatan fakta yang sepenuhnya sah - dan fakta itu
    ///      hilang permanen karena `queryId` sudah tertandai.
    /// @return usdWad nilai USD dalam WAD, 0 bila tidak tersedia
    /// @return ok false bila harga tidak ada atau basi
    function tryToUsd1e18(address asset, uint256 amount)
        external
        view
        returns (uint256 usdWad, bool ok);
}
