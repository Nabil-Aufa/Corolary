// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {FactRegistry} from "../src/FactRegistry.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";

/// @notice Deploy FactRegistry + AaveV3Adapter ke Creditcoin CC3 Testnet.
///
/// @dev Menjalankan seluruh konfigurasi wajib dalam satu transaksi berurutan,
///      supaya tidak ada jendela waktu di mana registry hidup tapi belum aman:
///      - chainKey 3 (Ethereum mainnet) diizinkan secara EKSPLISIT. Registry
///        sengaja lahir tanpa chain key apa pun; lupa mengonfigurasi harus gagal
///        keras, bukan menerima chain sembarangan.
///      - chainKey 1 (Sepolia) TIDAK PERNAH diizinkan di sini. Data Sepolia
///        adalah token karangan dan akan melanggar aturan nol-mock.
contract Deploy is Script {
    uint64 internal constant ETHEREUM_MAINNET_CHAIN_KEY = 3;

    function run() external {
        address admin = vm.envAddress("DEPLOYER_ADDRESS");
        address recorder = vm.envAddress("SUBMITTER_ADDRESS");

        vm.startBroadcast();

        FactRegistry registry = new FactRegistry(admin);
        AaveV3Adapter aaveAdapter = new AaveV3Adapter();

        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.grantRole(registry.RECORDER_ROLE(), recorder);
        registry.registerAdapter(aaveAdapter.sourceContract(), address(aaveAdapter));
        registry.setChainKeyAllowed(ETHEREUM_MAINNET_CHAIN_KEY, true);

        vm.stopBroadcast();

        console.log("FACT_REGISTRY_ADDRESS =", address(registry));
        console.log("AAVE_V3_ADAPTER_ADDRESS =", address(aaveAdapter));
        console.log("");
        console.log("Salin kedua alamat di atas ke .env");
    }
}
