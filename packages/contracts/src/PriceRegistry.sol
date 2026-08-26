// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";

import {AttestcoinReader} from "./AttestcoinReader.sol";
import {ChainlinkDecoder} from "./libraries/ChainlinkDecoder.sol";
import {IPriceRegistry} from "./interfaces/IPriceRegistry.sol";

/// @title PriceRegistry
/// @notice Harga yang DIBUKTIKAN dari event Chainlink `AnswerUpdated` di Ethereum
///         mainnet — bukan dari API harga mana pun.
///
/// @dev Ini yang membuat klaim "nol oracle terpusat" di `architecture.md` §2 benar
///      secara harfiah. Setiap proyek credit-scoring bisa bilang skornya on-chain;
///      hampir semuanya tetap menarik harga dari API terpusat di suatu tempat.
///      Corolary membuktikan harganya lewat jalur kriptografis yang sama persis
///      dengan yang dipakai untuk fakta pinjaman.
///
///      Satu perbedaan penting dari `FactRegistry`: `updatedAt` di sini **terbukti**.
///      Ia ada di dalam `data` log Chainlink, jadi ia bagian dari yang dibuktikan
///      Merkle proof. Bandingkan dengan `Fact.observedAt` yang harus dipasok
///      operator karena receipt Ethereum tidak memuat timestamp blok. Karena itu
///      kesegaran harga bersandar pada waktu yang terbukti, bukan yang dipercaya.
contract PriceRegistry is AccessControl, ReentrancyGuard, AttestcoinReader, IPriceRegistry {
    bytes32 public constant PRICE_RECORDER_ROLE = keccak256("PRICE_RECORDER_ROLE");
    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");

    /// @dev Batas kewarasan jumlah token. Suplai token nyata terbesar pun jauh di
    ///      bawah 1e40 (bahkan 1e27 sudah ekstrem untuk token berdesimal 18).
    ///      Ambang ini membuat `tryToUsd1e18` MUSTAHIL overflow, sehingga janjinya
    ///      "tidak pernah revert" benar-benar dipegang — bukan sekadar diharapkan.
    uint256 internal constant MAX_SANE_AMOUNT = 1e60;

    struct PriceData {
        uint256 answer; // skala native feed
        uint256 roundId;
        uint64 updatedAt; // waktu Ethereum, TERBUKTI
        uint64 recordedAt; // block.timestamp Creditcoin
        uint64 sourceBlock;
        uint8 feedDecimals;
    }

    mapping(address => PriceData) internal _prices;

    /// @notice aggregator => aset yang ia layani. HIMPUNAN, bukan satu per aset.
    /// @dev Chainlink mengganti aggregator di balik proxy saat upgrade feed. Kalau
    ///      hanya satu alamat yang dipercaya, feed akan **berhenti terbarui secara
    ///      senyap** begitu upgrade terjadi — jenis kegagalan paling berbahaya,
    ///      karena tidak ada error yang muncul. Beberapa aggregator boleh memetakan
    ///      ke aset yang sama sehingga upgrade bisa disiapkan sebelum terjadi.
    mapping(address => address) public assetOfAggregator;

    /// @notice Desimal feed yang dipercaya per aggregator.
    mapping(address => uint8) public feedDecimalsOf;

    /// @notice Desimal token ERC-20 per aset.
    /// @dev Wajib disimpan di sini: struct `Fact` on-chain TIDAK memuat desimal
    ///      aset, jadi `CreditGraph` tidak punya cara memasoknya.
    mapping(address => uint8) public assetDecimals;

    /// @notice Aset yang meminjam harga aset lain. alias => kanonik.
    /// @dev Dibutuhkan oleh aturan hackathon, bukan oleh keinginan kita.
    ///      `EfficiencyMarket` berjalan di CC3 Testnet, di mana USDC/WETH sungguhan
    ///      tidak ada — jadi token testnet harus di-deploy (open-issues B2). Tapi
    ///      token itu tidak punya feed Chainlink sendiri, dan feed mainnet yang
    ///      sungguhan sudah dipetakan ke aset kanoniknya untuk keperluan scoring.
    ///
    ///      Alias menyelesaikan keduanya tanpa berbohong: `TestUSDC` dinilai dengan
    ///      harga USDC MAINNET yang benar-benar dibuktikan. Tokennya stand-in;
    ///      harganya tidak. Ini harus dinyatakan terbuka di submission, sama seperti
    ///      B2 sendiri.
    mapping(address => address) public priceAliasOf;

    /// @notice Batas kesegaran default, dipakai aset yang tidak punya batasnya sendiri.
    /// @dev 24 jam adalah nilai yang SALAH untuk dipakai sendirian, dan itu terukur:
    ///      heartbeat Chainlink USDC/USD 24 jam, dengan jarak antar ronde terukur
    ///      23,00 jam - menyisakan satu jam untuk seluruh pipeline kita. Satu batas
    ///      global selalu berukuran feed TERLAMBAT, sehingga feed cepat seperti
    ///      ETH/USD (heartbeat 1 jam) ikut dilonggarkan 24x lipat tanpa alasan.
    ///      Itulah yang diperbaiki `maxPriceAgeOf`.
    uint64 public maxPriceAge = 24 hours;

    /// @notice Batas kesegaran khusus per aset KANONIK. 0 = pakai `maxPriceAge`.
    /// @dev Dikunci ke aset kanonik, bukan aset yang diminta, karena kesegaran
    ///      adalah sifat FEED-nya - bukan sifat token yang meminjam harga itu.
    ///      Konsekuensinya `tUSDC` otomatis mewarisi batas `USDC`, dan tidak ada
    ///      cara untuk keliru menyetelnya berbeda dari feed yang menjadi sumbernya.
    mapping(address => uint64) public maxPriceAgeOf;

    event PriceRecorded(
        address indexed asset,
        address indexed aggregator,
        uint256 answer,
        uint256 roundId,
        uint64 updatedAt,
        uint64 sourceBlock
    );
    event AggregatorTrusted(address indexed asset, address indexed aggregator, uint8 feedDecimals);
    event AggregatorUntrusted(address indexed asset, address indexed aggregator);
    event AssetRegistered(address indexed asset, uint8 decimals);
    event PriceAliasSet(address indexed aliasAsset, address indexed canonicalAsset);
    event MaxPriceAgeUpdated(uint64 maxPriceAge);
    event MaxPriceAgeForAssetUpdated(address indexed asset, uint64 seconds_);

    error PriceUnavailable(address asset);
    error PriceStale(address asset, uint64 updatedAt, uint64 maxAge);
    error AggregatorNotTrusted(address aggregator);
    error NonPositiveAnswer(int256 answer);
    error NoPriceLogs();
    error ZeroAddress();
    error AssetNotRegistered(address asset);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------
    // Pencatatan
    // -------------------------------------------------------------

    /// @notice Catat setiap harga terbukti dari SATU transaksi Ethereum.
    /// @dev Tidak menerima parameter `aggregator`. Aggregator ditentukan OLEH
    ///      alamat pemancar log, alasan yang sama seperti di `FactRegistry`:
    ///      pasangan "aggregator salah dengan log" jadi tidak bisa diungkapkan,
    ///      dan satu transaksi yang memperbarui beberapa feed tercakup sekaligus.
    function recordPrice(ProofBundle calldata bundle, bytes calldata encodedTransaction)
        external
        onlyRole(PRICE_RECORDER_ROLE)
        nonReentrant
        returns (uint256 recorded)
    {
        (EvmV1Decoder.ReceiptFields memory receipt, uint32 txIndex) =
            _verifyAndDecode(bundle, encodedTransaction);
        txIndex; // indeks transaksi tidak dipakai untuk harga — harga bukan fakta ber-ID

        uint256 logCount = receipt.receiptLogs.length;
        for (uint256 i; i < logCount; ++i) {
            EvmV1Decoder.LogEntry memory log = receipt.receiptLogs[i];

            // GERBANG 3 — emitter. Aggregator tak tepercaya dilewati diam-diam:
            // satu transaksi bisa menyentuh banyak kontrak, dan menolak seluruh
            // transaksi karena ada log asing akan membuang harga yang sah.
            address asset = assetOfAggregator[log.address_];
            if (asset == address(0)) continue;

            (bool ok, int256 answer, uint256 roundId, uint64 updatedAt) =
                ChainlinkDecoder.decodeAnswerUpdated(log);
            if (!ok) continue;

            // `answer` bertipe int256. Meng-cast langsung ke uint256 akan mengubah
            // -1 menjadi 2^256-1 — harga tak berhingga yang membuat setiap posisi
            // terlihat sehat sempurna. Tolak keras, jangan dilewati: aggregator
            // TEPERCAYA yang memancarkan harga non-positif berarti ada yang rusak
            // secara mendasar, dan itu harus berisik.
            if (answer <= 0) revert NonPositiveAnswer(answer);

            PriceData storage p = _prices[asset];

            // Monotonisitas ronde. Tanpa ini, ronde LAMA yang di-prove belakangan
            // akan menimpa harga baru — dan indexer memang memproses backfill
            // setelah data segar.
            if (roundId <= p.roundId) continue;

            // forge-lint: disable-next-line(unsafe-typecast)
            p.answer = uint256(answer); // aman: `answer <= 0` sudah ditolak di atas
            p.roundId = roundId;
            p.updatedAt = updatedAt;
            p.recordedAt = uint64(block.timestamp);
            p.sourceBlock = bundle.blockHeight;
            p.feedDecimals = feedDecimalsOf[log.address_];

            unchecked {
                ++recorded;
            }
            emit PriceRecorded(
                asset,
                log.address_,
                // forge-lint: disable-next-line(unsafe-typecast)
                uint256(answer), // aman: sama seperti di atas
                roundId,
                updatedAt,
                bundle.blockHeight
            );
        }

        if (recorded == 0) revert NoPriceLogs();
    }

    // -------------------------------------------------------------
    // Baca
    // -------------------------------------------------------------

    /// @inheritdoc IPriceRegistry
    function tryToUsd1e18(address asset, uint256 amount)
        external
        view
        returns (uint256 usdWad, bool ok)
    {
        (uint256 answer, uint8 feedDec, bool fresh) = _peek(asset);
        if (!fresh) return (0, false);

        uint8 tokenDec = assetDecimals[asset];
        if (tokenDec == 0 && amount != 0) {
            // Aset tanpa desimal terdaftar tidak bisa dinormalisasi. Kembalikan
            // "tidak tersedia" — JANGAN asumsikan 18.
            return (0, false);
        }

        // Dijaga supaya janji "tidak pernah revert" benar-benar dipegang.
        if (amount > MAX_SANE_AMOUNT) return (0, false);

        // usd = amount * answer * 1e18 / (10^tokenDec * 10^feedDec)
        uint256 denom = 10 ** uint256(tokenDec) * 10 ** uint256(feedDec);
        usdWad = Math.mulDiv(amount, answer * 1e18, denom);
        ok = true;
    }

    /// @notice Harga mentah; revert bila tidak ada atau basi.
    function getPrice(address asset) external view returns (uint256 answer, uint8 decimals) {
        PriceData storage p = _prices[_canonical(asset)];
        if (p.roundId == 0) revert PriceUnavailable(asset);
        uint64 maxAge = maxAgeFor(asset);
        if (_ageOf(p.updatedAt) > maxAge) {
            // Ambang yang dilaporkan adalah yang BERLAKU, bukan yang global.
            // Error yang menyebut ambang salah membuat orang mencari sebab di
            // tempat yang salah.
            revert PriceStale(asset, p.updatedAt, maxAge);
        }
        return (p.answer, p.feedDecimals);
    }

    /// @notice Varian non-revert untuk pemanggil yang menangani sendiri.
    function tryGetPrice(address asset)
        external
        view
        returns (bool ok, uint256 answer, uint8 decimals)
    {
        (uint256 a, uint8 d, bool fresh) = _peek(asset);
        return (fresh, a, d);
    }

    function priceDataOf(address asset) external view returns (PriceData memory) {
        return _prices[_canonical(asset)];
    }

    /// @notice Batas kesegaran yang BENAR-BENAR berlaku untuk sebuah aset.
    /// @dev Diekspos supaya pemanggil dan UI bisa menjelaskan kenapa sebuah harga
    ///      ditolak. Tanpa ini, "harga basi" adalah pernyataan tanpa ambang.
    function maxAgeFor(address asset) public view returns (uint64) {
        uint64 specific = maxPriceAgeOf[_canonical(asset)];
        return specific == 0 ? maxPriceAge : specific;
    }

    function _canonical(address asset) private view returns (address) {
        address c = priceAliasOf[asset];
        return c == address(0) ? asset : c;
    }

    /// @notice Umur harga dalam detik, memakai waktu Ethereum yang TERBUKTI.
    function priceAgeSeconds(address asset) external view returns (uint64) {
        return _ageOf(_prices[_canonical(asset)].updatedAt);
    }

    function _peek(address asset) private view returns (uint256 answer, uint8 dec, bool fresh) {
        // Harga di-resolve lewat aset kanonik; DESIMAL tetap milik aset itu
        // sendiri, karena token stand-in boleh punya desimal berbeda.
        address canonical = priceAliasOf[asset];
        PriceData storage p = _prices[canonical == address(0) ? asset : canonical];
        if (p.roundId == 0) return (0, 0, false);
        if (_ageOf(p.updatedAt) > maxAgeFor(asset)) return (0, 0, false);
        return (p.answer, p.feedDecimals, true);
    }

    /// @dev Umur diukur dari `updatedAt` yang terbukti, bukan `recordedAt`.
    ///      Selisih jam antara Ethereum dan Creditcoin bisa membuat `updatedAt`
    ///      sedikit di depan waktu lokal; itu dijepit ke 0, bukan dibiarkan
    ///      underflow menjadi umur raksasa yang membekukan pasar tanpa sebab.
    function _ageOf(uint64 updatedAt) private view returns (uint64) {
        if (updatedAt == 0) return type(uint64).max;
        // forge-lint: disable-next-line(block-timestamp)
        if (updatedAt >= block.timestamp) return 0;
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(block.timestamp - updatedAt); // aman: selisih < 2^64
    }

    // -------------------------------------------------------------
    // Kurasi
    // -------------------------------------------------------------

    /// @notice Percayai satu aggregator sebagai sumber harga untuk `asset`.
    /// @dev Beberapa aggregator boleh menunjuk ke aset yang sama — itu SENGAJA.
    ///      Chainlink mengganti aggregator saat upgrade feed, jadi yang baru bisa
    ///      dipercayai lebih dulu tanpa jeda di mana harga berhenti terbarui.
    function trustAggregator(address asset, address aggregator, uint8 feedDecimals)
        external
        onlyRole(CURATOR_ROLE)
    {
        if (asset == address(0) || aggregator == address(0)) revert ZeroAddress();
        if (assetDecimals[asset] == 0) revert AssetNotRegistered(asset);
        assetOfAggregator[aggregator] = asset;
        feedDecimalsOf[aggregator] = feedDecimals;
        emit AggregatorTrusted(asset, aggregator, feedDecimals);
    }

    function untrustAggregator(address aggregator) external onlyRole(CURATOR_ROLE) {
        address asset = assetOfAggregator[aggregator];
        if (asset == address(0)) revert AggregatorNotTrusted(aggregator);
        delete assetOfAggregator[aggregator];
        delete feedDecimalsOf[aggregator];
        emit AggregatorUntrusted(asset, aggregator);
    }

    /// @notice Daftarkan desimal ERC-20 sebuah aset.
    /// @dev Harus dipanggil sebelum `trustAggregator`. Desimal salah = seluruh
    ///      nilai USD aset itu meleset berkali-kali lipat, dan tidak ada gejala
    ///      apa pun sampai skor sudah salah.
    /// @notice Buat `aliasAsset` memakai harga terbukti milik `canonicalAsset`.
    /// @dev Hanya harganya yang dipinjam. Desimal `aliasAsset` tetap harus
    ///      didaftarkan sendiri lewat `registerAsset`.
    function setPriceAlias(address aliasAsset, address canonicalAsset)
        external
        onlyRole(CURATOR_ROLE)
    {
        if (aliasAsset == address(0) || canonicalAsset == address(0)) revert ZeroAddress();
        if (assetDecimals[aliasAsset] == 0) revert AssetNotRegistered(aliasAsset);
        // Alias berantai akan membuat resolusi butuh loop dan bisa membentuk
        // siklus. Satu tingkat saja - itu semua yang dibutuhkan.
        if (priceAliasOf[canonicalAsset] != address(0)) revert AssetNotRegistered(canonicalAsset);
        priceAliasOf[aliasAsset] = canonicalAsset;
        emit PriceAliasSet(aliasAsset, canonicalAsset);
    }

    function registerAsset(address asset, uint8 decimals) external onlyRole(CURATOR_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        if (decimals == 0 || decimals > 36) revert AssetNotRegistered(asset);
        assetDecimals[asset] = decimals;
        emit AssetRegistered(asset, decimals);
    }

    function setMaxPriceAge(uint64 seconds_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxPriceAge = seconds_;
        emit MaxPriceAgeUpdated(seconds_);
    }

    /// @notice Setel batas kesegaran khusus satu aset; 0 mengembalikannya ke global.
    /// @dev Setel pada aset KANONIK (mis. USDC), bukan pada alias (tUSDC) - alias
    ///      mewarisinya lewat `_canonical`. Menyetel pada alias tidak akan pernah
    ///      terbaca, dan itu kegagalan senyap.
    function setMaxPriceAgeFor(address asset, uint64 seconds_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (asset == address(0)) revert ZeroAddress();
        maxPriceAgeOf[asset] = seconds_;
        emit MaxPriceAgeForAssetUpdated(asset, seconds_);
    }

    function setChainKeyAllowed(uint64 chainKey, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setChainKeyAllowed(chainKey, allowed);
    }
}
