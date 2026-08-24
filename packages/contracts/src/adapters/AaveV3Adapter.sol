// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AaveV3StyleAdapter} from "./AaveV3StyleAdapter.sol";

/// @title AaveV3Adapter
/// @notice Aave V3 Pool di Ethereum mainnet.
contract AaveV3Adapter is AaveV3StyleAdapter {
    address public constant POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    constructor() AaveV3StyleAdapter(POOL, "Aave V3") {}
}
