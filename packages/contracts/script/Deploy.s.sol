// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {FactRegistry} from "../src/FactRegistry.sol";
import {CreditGraph} from "../src/CreditGraph.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";
import {SparkAdapter} from "../src/adapters/SparkAdapter.sol";
import {MorphoBlueAdapter} from "../src/adapters/MorphoBlueAdapter.sol";
import {CompoundV3Adapter} from "../src/adapters/CompoundV3Adapter.sol";

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

    /// @dev Comet cUSDCv3 dan aset dasarnya di Ethereum mainnet.
    address internal constant COMET_USDC = 0xc3d688B66703497DAA19211EEdff47f25384cdc3;
    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function run() external {
        address admin = vm.envAddress("DEPLOYER_ADDRESS");
        address recorder = vm.envAddress("SUBMITTER_ADDRESS");

        vm.startBroadcast();

        FactRegistry registry = new FactRegistry(admin);
        CreditGraph graph = new CreditGraph(admin, address(registry));

        AaveV3Adapter aaveAdapter = new AaveV3Adapter();
        SparkAdapter sparkAdapter = new SparkAdapter();
        MorphoBlueAdapter morphoAdapter = new MorphoBlueAdapter(admin);
        CompoundV3Adapter compoundAdapter = new CompoundV3Adapter(COMET_USDC, USDC);

        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.grantRole(registry.RECORDER_ROLE(), recorder);
        registry.setChainKeyAllowed(ETHEREUM_MAINNET_CHAIN_KEY, true);

        registry.registerAdapter(aaveAdapter.sourceContract(), address(aaveAdapter));
        registry.registerAdapter(sparkAdapter.sourceContract(), address(sparkAdapter));
        registry.registerAdapter(morphoAdapter.sourceContract(), address(morphoAdapter));
        registry.registerAdapter(compoundAdapter.sourceContract(), address(compoundAdapter));

        // Hanya FactRegistry yang boleh menyuapi graph. Fakta hanya bisa masuk
        // lewat jalur yang sudah melewati ketiga gerbang keamanan.
        graph.grantRole(graph.FACT_CONSUMER_ROLE(), address(registry));
        graph.grantRole(graph.CURATOR_ROLE(), admin);

        // Nomor bit ditetapkan sekali dan TIDAK BOLEH berubah setelahnya -
        // menggesernya akan menulis ulang protocolDiversity setiap subjek yang
        // sudah ada. Empat protokol = TARGET_DIVERSITY_PROTOCOLS terpenuhi, jadi
        // diversity 100 poin benar-benar bisa dicapai.
        graph.assignProtocolBit(aaveAdapter.sourceContract(), 1);
        graph.assignProtocolBit(sparkAdapter.sourceContract(), 2);
        graph.assignProtocolBit(morphoAdapter.sourceContract(), 3);
        graph.assignProtocolBit(compoundAdapter.sourceContract(), 4);

        // Morpho butuh tabel Id pasar -> alamat token; Id-nya spesifik per pasar
        // dan di-resolve indexer lewat `idToMarketParams`, jadi tidak bisa
        // di-hardcode di sini. Kurator mendaftarkannya setelah deploy.
        morphoAdapter.grantRole(morphoAdapter.CURATOR_ROLE(), admin);

        // Terakhir: mulai alirkan fakta ke graph. Sebelum baris ini registry
        // tetap berfungsi, hanya belum memperbarui skor - jadi tidak ada jendela
        // waktu di mana graph menerima fakta tanpa role yang benar.
        registry.setCreditGraph(address(graph));

        vm.stopBroadcast();

        console.log("FACT_REGISTRY_ADDRESS =", address(registry));
        console.log("CREDIT_GRAPH_ADDRESS =", address(graph));
        console.log("AAVE_V3_ADAPTER_ADDRESS =", address(aaveAdapter));
        console.log("SPARK_ADAPTER_ADDRESS =", address(sparkAdapter));
        console.log("MORPHO_BLUE_ADAPTER_ADDRESS =", address(morphoAdapter));
        console.log("COMPOUND_V3_ADAPTER_ADDRESS =", address(compoundAdapter));
        console.log("");
        console.log(
            "LANGKAH LANJUTAN: daftarkan pasar Morpho lewat setMarket(id, loan, collateral)"
        );
        console.log("");
        console.log("Salin alamat di atas ke .env");
    }
}
