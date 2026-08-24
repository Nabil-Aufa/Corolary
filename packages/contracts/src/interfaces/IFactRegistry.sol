// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Fact} from "../libraries/FactTypes.sol";

/// @title IFactRegistry
/// @notice Permukaan baca yang dipakai CreditGraph.
interface IFactRegistry {
    function getFact(bytes32 factId) external view returns (Fact memory);
    function factExists(bytes32 factId) external view returns (bool);
}
