// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CreditGraph} from "../src/CreditGraph.sol";
import {PriceRegistry} from "../src/PriceRegistry.sol";
import {EfficiencyMarket} from "../src/EfficiencyMarket.sol";

/// @notice Deploy ULANG hanya lapis harga + pasar (open-issues B6).
///
/// @dev BEDAH, bukan deploy ulang total. `Deploy.s.sol` membuat SEMUANYA
///      termasuk `FactRegistry` - menjalankannya di sini akan meninggalkan
///      registry berisi ribuan fakta terbukti dan memulai dari nol. Skrip ini
///      tidak menyentuh `FactRegistry`, `CreditGraph`, keempat adapter, maupun
///      kedua FaucetToken.
///
///      Token TIDAK di-deploy ulang dengan sengaja: alamatnya sudah dipegang
///      dompet lain lewat faucet, dan mengganti alamatnya akan menghanguskan
///      saldo mereka tanpa jejak.
///
///      Kenapa `EfficiencyMarket` ikut: `priceRegistry`-nya hanya di-set di
///      konstruktor pada versi yang ter-deploy, jadi ia tidak bisa diarahkan ke
///      registry baru. Versi yang di-deploy skrip ini punya `setPriceRegistry`,
///      sehingga ini adalah TERAKHIR kalinya pasar harus ikut diganti.
contract RedeployPricing is Script {
    uint64 internal constant ETHEREUM_MAINNET_CHAIN_KEY = 3;

    address internal constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    address internal constant ETH_USD_AGG = 0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5;
    address internal constant BTC_USD_AGG = 0x4a3411ac2948B33c69666B35cc6d055B27Ea84f1;
    address internal constant USDC_USD_AGG = 0xc9E1a09622afdB659913fefE800fEaE5DBbFe9d7;
    uint8 internal constant CHAINLINK_FEED_DECIMALS = 8;

    /// @dev Default KETAT, pengecualian longgar - bukan sebaliknya.
    ///
    ///      Heartbeat ETH/USD dan BTC/USD adalah 1 jam; 3 jam memberi dua jam
    ///      toleransi kalau pipeline kita tersendat. Feed baru yang ditambahkan
    ///      nanti otomatis mewarisi batas ketat ini, dan kalau ternyata ia feed
    ///      lambat, gejalanya adalah pasar membeku - keras dan terlihat - bukan
    ///      diam-diam menerima harga basi.
    uint64 internal constant DEFAULT_MAX_AGE = 3 hours;

    /// @dev USDC/USD adalah pengecualiannya. Heartbeat 24 jam, dan jarak antar
    ///      ronde terukur 23,00 jam di aggregator mainnet (1148->1149 dan
    ///      1150->1151, keduanya 82.812 detik). 28 jam = plafon heartbeat +
    ///      4 jam kelonggaran operasional.
    uint64 internal constant STABLECOIN_MAX_AGE = 28 hours;

    function run() external {
        address admin = vm.envAddress("DEPLOYER_ADDRESS");
        address recorder = vm.envAddress("SUBMITTER_ADDRESS");
        address graphAddr = vm.envAddress("CREDIT_GRAPH_ADDRESS");
        address tUsdc = vm.envAddress("TEST_USDC_ADDRESS");
        address tWeth = vm.envAddress("TEST_WETH_ADDRESS");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(vm.addr(deployerKey) == admin, "DEPLOYER_PRIVATE_KEY bukan milik DEPLOYER_ADDRESS");

        vm.startBroadcast(deployerKey);

        PriceRegistry prices = new PriceRegistry(admin);
        prices.grantRole(prices.CURATOR_ROLE(), admin);
        prices.grantRole(prices.PRICE_RECORDER_ROLE(), recorder);
        prices.setChainKeyAllowed(ETHEREUM_MAINNET_CHAIN_KEY, true);

        // Desimal SEBELUM aggregator - salah desimal membuat nilai USD meleset
        // berkali-kali lipat tanpa gejala sampai skornya sudah salah.
        prices.registerAsset(WETH, 18);
        prices.registerAsset(USDC, 6);
        prices.registerAsset(WBTC, 8);
        prices.trustAggregator(WETH, ETH_USD_AGG, CHAINLINK_FEED_DECIMALS);
        prices.trustAggregator(USDC, USDC_USD_AGG, CHAINLINK_FEED_DECIMALS);
        prices.trustAggregator(WBTC, BTC_USD_AGG, CHAINLINK_FEED_DECIMALS);

        prices.setMaxPriceAge(DEFAULT_MAX_AGE);
        // Disetel pada aset KANONIK. tUSDC mewarisinya lewat alias; menyetelnya
        // pada tUSDC tidak akan pernah terbaca.
        prices.setMaxPriceAgeFor(USDC, STABLECOIN_MAX_AGE);

        // Token testnet memakai harga mainnet yang benar-benar dibuktikan.
        prices.registerAsset(tUsdc, 6);
        prices.registerAsset(tWeth, 18);
        prices.setPriceAlias(tUsdc, USDC);
        prices.setPriceAlias(tWeth, WETH);

        EfficiencyMarket market = new EfficiencyMarket(admin, graphAddr, address(prices));
        market.grantRole(market.CURATOR_ROLE(), admin);
        market.addReserve(tUsdc, 1000, true); // dapat dipinjam
        market.addReserve(tWeth, 1000, false); // kolateral saja

        // Graph diarahkan TERAKHIR di antara perubahan state lama: sampai baris
        // ini, seluruh sistem lama masih utuh dan bisa ditinggalkan tanpa jejak
        // kalau ada yang gagal di atas.
        CreditGraph(graphAddr).setPriceRegistry(address(prices));

        vm.stopBroadcast();

        console.log("PRICE_REGISTRY_ADDRESS =", address(prices));
        console.log("EFFICIENCY_MARKET_ADDRESS =", address(market));
        console.log("");
        console.log("LANGKAH LANJUTAN (tidak otomatis):");
        console.log("  1. Perbarui .env, README, docs/deployment.md");
        console.log("  2. Perbarui PRICE_REGISTRY_ADDRESS + EFFICIENCY_MARKET_ADDRESS di Railway");
        console.log("     pada KEDUA service, lalu redeploy");
        console.log("  3. Tarik likuiditas dari pasar LAMA, setor ke pasar baru");
        console.log("  4. Harga baru terisi otomatis dalam ~10 menit oleh price loop");
    }
}
