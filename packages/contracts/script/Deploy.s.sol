// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {FactRegistry} from "../src/FactRegistry.sol";
import {CreditGraph} from "../src/CreditGraph.sol";
import {PriceRegistry} from "../src/PriceRegistry.sol";
import {EfficiencyMarket} from "../src/EfficiencyMarket.sol";
import {FaucetToken} from "../src/testnet/FaucetToken.sol";
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
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    /// @dev Aggregator Chainlink di balik proxy, terverifikasi live 2026-08-22.
    ///      Ini alamat PEMANCAR event `AnswerUpdated` - bukan alamat proxy.
    ///      Chainlink menggantinya saat upgrade feed, jadi indexer harus
    ///      me-resolve `aggregator()` dari proxy secara berkala dan memberi tahu
    ///      kurator. Semua feed berdesimal 8.
    address internal constant ETH_USD_AGG = 0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5;
    address internal constant BTC_USD_AGG = 0x4a3411ac2948B33c69666B35cc6d055B27Ea84f1;
    address internal constant USDC_USD_AGG = 0xc9E1a09622afdB659913fefE800fEaE5DBbFe9d7;
    uint8 internal constant CHAINLINK_FEED_DECIMALS = 8;

    function run() external {
        address admin = vm.envAddress("DEPLOYER_ADDRESS");
        address recorder = vm.envAddress("SUBMITTER_ADDRESS");

        // Kunci dibaca dari .env oleh Foundry sendiri, BUKAN dioper lewat
        // `--private-key` di baris perintah: argumen CLI terlihat di daftar
        // proses seluruh mesin (`ps aux`), dan kunci deployer memegang seluruh
        // ownership kontrak. Foundry memuat .env dari root proyek Foundry —
        // `packages/contracts/.env`, yang `pnpm env:link` sambungkan ke .env root.
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Kalau kunci dan alamat tidak sepasang, seluruh grantRole di bawah akan
        // revert satu per satu dengan pesan AccessControl yang membingungkan.
        // Lebih baik gagal di sini, dengan sebabnya jelas.
        require(vm.addr(deployerKey) == admin, "DEPLOYER_PRIVATE_KEY bukan milik DEPLOYER_ADDRESS");

        vm.startBroadcast(deployerKey);

        FactRegistry registry = new FactRegistry(admin);
        CreditGraph graph = new CreditGraph(admin, address(registry));
        PriceRegistry prices = new PriceRegistry(admin);

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

        // --- Harga: nol oracle terpusat ---
        prices.grantRole(prices.CURATOR_ROLE(), admin);
        prices.grantRole(prices.PRICE_RECORDER_ROLE(), recorder);
        prices.setChainKeyAllowed(ETHEREUM_MAINNET_CHAIN_KEY, true);

        // Desimal token harus terdaftar SEBELUM aggregator-nya - salah desimal
        // membuat seluruh nilai USD aset itu meleset berkali-kali lipat, tanpa
        // gejala apa pun sampai skornya sudah salah.
        prices.registerAsset(WETH, 18);
        prices.registerAsset(USDC, 6);
        prices.registerAsset(WBTC, 8);
        prices.trustAggregator(WETH, ETH_USD_AGG, CHAINLINK_FEED_DECIMALS);
        prices.trustAggregator(USDC, USDC_USD_AGG, CHAINLINK_FEED_DECIMALS);
        prices.trustAggregator(WBTC, BTC_USD_AGG, CHAINLINK_FEED_DECIMALS);

        // Default kontrak 24 jam TIDAK cukup, dan kekurangannya struktural.
        //
        // Heartbeat Chainlink USDC/USD adalah 24 jam, dan terukur dari
        // aggregator mainnet 2026-08-26 jaraknya 23,00 jam antar ronde
        // (1148->1149 dan 1150->1151, keduanya 82.812 detik). Batas 24 jam
        // menyisakan margin satu jam untuk seluruh pipeline kita — attestation
        // ~8 menit, lalu prove dan submit — sehingga harga stablecoin PASTI
        // melewati batas secara berkala. Gejalanya bukan error: pasar tUSDC
        // membeku diam-diam sampai ronde berikutnya masuk.
        //
        // 28 jam = plafon heartbeat 24 jam + 4 jam kelonggaran operasional.
        // Ini melonggarkan batas untuk ETH/BTC juga (heartbeat 1 jam), tapi
        // batas 24 jam sebelumnya pun tidak pernah menjadi jaminan ketat bagi
        // keduanya: ia selalu berukuran feed TERLAMBAT. Batas per-aset adalah
        // desain yang benar dan butuh perubahan kontrak — dicatat di
        // docs/open-issues.md.
        prices.setMaxPriceAge(28 hours);

        graph.setPriceRegistry(address(prices));

        // --- Lapis 3: pasar ---
        EfficiencyMarket market = new EfficiencyMarket(admin, address(graph), address(prices));
        market.grantRole(market.CURATOR_ROLE(), admin);

        // Token testnet (open-issues B2). Aturan hackathon mewajibkan deploy di
        // testnet dan CC3 tidak punya USDC/WETH sungguhan, jadi ini tak
        // terhindarkan - dan dinyatakan terbuka, bukan disembunyikan.
        //
        // Harganya TIDAK dikarang: alias membuat keduanya dinilai memakai harga
        // Ethereum mainnet yang benar-benar dibuktikan lewat Attestcoin.
        FaucetToken tUsdc = new FaucetToken("Corolary Test USDC", "tUSDC", 6, 10_000e6);
        FaucetToken tWeth = new FaucetToken("Corolary Test WETH", "tWETH", 18, 5e18);

        prices.registerAsset(address(tUsdc), 6);
        prices.registerAsset(address(tWeth), 18);
        prices.setPriceAlias(address(tUsdc), USDC);
        prices.setPriceAlias(address(tWeth), WETH);

        market.addReserve(address(tUsdc), 1000, true); // dapat dipinjam
        market.addReserve(address(tWeth), 1000, false); // kolateral saja

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
        console.log("PRICE_REGISTRY_ADDRESS =", address(prices));
        console.log("AAVE_V3_ADAPTER_ADDRESS =", address(aaveAdapter));
        console.log("SPARK_ADAPTER_ADDRESS =", address(sparkAdapter));
        console.log("MORPHO_BLUE_ADAPTER_ADDRESS =", address(morphoAdapter));
        console.log("COMPOUND_V3_ADAPTER_ADDRESS =", address(compoundAdapter));
        console.log("EFFICIENCY_MARKET_ADDRESS =", address(market));
        console.log("TEST_USDC_ADDRESS =", address(tUsdc));
        console.log("TEST_WETH_ADDRESS =", address(tWeth));
        console.log("");
        console.log(
            "LANGKAH LANJUTAN: daftarkan pasar Morpho lewat setMarket(id, loan, collateral)"
        );
        console.log("");
        console.log("Salin alamat di atas ke .env");
    }
}
