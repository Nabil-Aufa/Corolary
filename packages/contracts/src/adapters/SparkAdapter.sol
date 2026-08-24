// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AaveV3StyleAdapter} from "./AaveV3StyleAdapter.sol";

/// @title SparkAdapter
/// @notice SparkLend Pool di Ethereum mainnet - fork Aave V3.
///
/// @dev ⚠️ Deklarasi event Spark DIASUMSIKAN identik dengan Aave V3 karena ia
///      fork langsung; topic0 keduanya karena itu sama persis. Asumsi ini belum
///      diverifikasi terhadap log Spark sungguhan dari mainnet - lakukan itu
///      sebelum submit. Kalau Spark ternyata mem-fork versi Aave yang lebih tua
///      dengan tanda tangan berbeda, adapter ini akan diam saja mengembalikan
///      `ok == false` untuk semua log: tidak berbahaya, tapi juga tidak ada
///      fakta Spark yang pernah tercatat. Gagal senyap, jadi harus dicek aktif.
contract SparkAdapter is AaveV3StyleAdapter {
    address public constant POOL = 0xC13e21B648A5Ee794902342038FF3aDAB66BE987;

    constructor() AaveV3StyleAdapter(POOL, "Spark") {}
}
