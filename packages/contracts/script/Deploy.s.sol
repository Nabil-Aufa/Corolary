// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {FactRegistry} from "../src/FactRegistry.sol";
import {CreditGraph} from "../src/CreditGraph.sol";
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
        CreditGraph graph = new CreditGraph(admin, address(registry));

        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.grantRole(registry.RECORDER_ROLE(), recorder);
        registry.registerAdapter(aaveAdapter.sourceContract(), address(aaveAdapter));
        registry.setChainKeyAllowed(ETHEREUM_MAINNET_CHAIN_KEY, true);

        // Hanya FactRegistry yang boleh menyuapi graph. Fakta hanya bisa masuk
        // lewat jalur yang sudah melewati ketiga gerbang keamanan.
        graph.grantRole(graph.FACT_CONSUMER_ROLE(), address(registry));
        graph.grantRole(graph.CURATOR_ROLE(), admin);
        graph.assignProtocolBit(aaveAdapter.sourceContract(), 1);

        // Terakhir: mulai alirkan fakta ke graph. Sebelum baris ini registry
        // tetap berfungsi, hanya belum memperbarui skor - jadi tidak ada jendela
        // waktu di mana graph menerima fakta tanpa role yang benar.
        registry.setCreditGraph(address(graph));

        vm.stopBroadcast();

        console.log("FACT_REGISTRY_ADDRESS =", address(registry));
        console.log("AAVE_V3_ADAPTER_ADDRESS =", address(aaveAdapter));
        console.log("CREDIT_GRAPH_ADDRESS =", address(graph));
        console.log("");
        console.log("Salin ketiga alamat di atas ke .env");
    }
}
