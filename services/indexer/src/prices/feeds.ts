/**
 * Feed harga Chainlink yang dipantau di Ethereum mainnet.
 *
 * `aggregator` WAJIB cocok dengan yang dipercaya di PriceRegistry lewat
 * `trustAggregator` (lihat script/Deploy.s.sol). Kalau berbeda, indexer akan
 * membeli proof untuk log yang kontraknya lewati diam-diam — biaya terbayar,
 * nol harga tercatat, dan tidak ada error yang muncul karena `recordPrice`
 * memang sengaja melewati emitter tak tepercaya.
 *
 * `proxy` TIDAK dipakai untuk memanen log. Ia ada semata untuk mendeteksi
 * rotasi: Chainlink mengganti aggregator di balik proxy saat upgrade feed, dan
 * kalau itu terjadi tanpa ketahuan, harga berhenti terbarui tanpa satu pun
 * gejala sampai `maxPriceAge` terlewat dan pasar membeku. Sekali per start,
 * indexer membandingkan `proxy.aggregator()` dengan daftar di bawah.
 *
 * Diverifikasi live 2026-08-25 terhadap Ethereum mainnet:
 *   ETH/USD  aggregator 0x7d4E…6Fb5  update terakhir 30 blok lalu
 *   BTC/USD  aggregator 0x4a34…84f1  update terakhir 196 blok lalu
 *   USDC/USD aggregator 0xc9E1…e9d7  update terakhir 55 blok lalu
 *
 * Ditambahkan dan diverifikasi live 2026-08-30, keduanya lewat `aggregator()`
 * pada proxy resmi dan `description()` yang mengonfirmasi pasangan harganya:
 *   USDT/USD aggregator 0x0d5F…4Df5
 *   DAI/USD  aggregator 0x7097…72A3
 * Kelimanya berdesimal 8.
 *
 * Keduanya menutup 3.490 fakta yang sebelumnya tampil tanpa nilai USD — USDT
 * saja 3.307. Menambahkannya TIDAK butuh redeploy: `trustAggregator` adalah
 * setter ber-`CURATOR_ROLE`, dan deployer memegang role itu.
 */
export interface FeedConfig {
  /** Label untuk log dan untuk kolom `pair` di API. */
  pair: string;
  /** Proxy resmi Chainlink — hanya untuk deteksi rotasi aggregator. */
  proxy: string;
  /** Pemancar `AnswerUpdated`. Inilah yang dipercaya PriceRegistry. */
  aggregator: string;
  /** Aset kanonik di Ethereum mainnet yang dihargai feed ini. */
  asset: string;
  /**
   * Seberapa jauh ke belakang mencari ronde, dalam blok. Default
   * `MAX_LOOKBACK_BLOCKS` (~20 jam).
   *
   * Ada karena jendela default lebih PENDEK daripada heartbeat feed lambat, dan
   * itu membuat registry kosong tidak bisa bootstrap sama sekali. Terukur
   * 2026-08-26 saat cutover PriceRegistry: ronde USDC/USD terakhir berumur
   * 22,9 jam, di luar jendela 20 jam, sehingga `findNewerRound` tidak akan
   * pernah menemukannya — `tryToUsd1e18(tUSDC)` menjawab `false` dan pasar
   * tUSDC beku, sementara API tetap menampilkan harga dari mirror Postgres.
   * ETH/USD dan BTC/USD (heartbeat 1 jam) terisi normal dalam hitungan menit.
   */
  lookbackBlocks?: number;
  /**
   * Anggaran kesegaran on-chain khusus aset ini, dalam detik. Kosong = pakai
   * `maxPriceAge` global (terbaca 10.800 detik / 3 jam pada 2026-08-30).
   *
   * Dipasang `prices:trust` lewat `setMaxPriceAgeFor`. Ada di sini, bukan
   * hanya di `Deploy.s.sol`, karena ia harus berpasangan dengan
   * `lookbackBlocks`: keduanya turunan dari HEARTBEAT feed yang sama, dan
   * memisahkannya berarti dua tempat yang harus tetap sepakat selamanya.
   *
   * Anggaran yang lebih PENDEK dari heartbeat berarti harga aset itu basi
   * secara berkala tanpa ada yang salah — `tryToUsd1e18` menjawab `false` dan
   * pasar membeku diam-diam sampai ronde berikutnya masuk.
   */
  maxPriceAgeSeconds?: number;
}

/**
 * topic0 `AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt)`.
 *
 * `current` DI-INDEX: harganya ada di `topics[1]`, bukan di `data`. Membaca
 * `data[0]` sebagai harga menghasilkan `updatedAt` — pada feed berdesimal 8 itu
 * terbaca ≈$18, angka yang cukup masuk akal untuk tidak pernah dicurigai.
 * Diukur pada log nyata 2026-08-25: topics[1] = $2.511,24, data[0] = $17,88.
 */
export const ANSWER_UPDATED_TOPIC =
  '0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f';

export const FEEDS: FeedConfig[] = [
  {
    pair: 'ETH/USD',
    proxy: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    aggregator: '0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5',
    asset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  },
  {
    pair: 'BTC/USD',
    proxy: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    aggregator: '0x4a3411ac2948B33c69666B35cc6d055B27Ea84f1',
    asset: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
  },
  {
    pair: 'USDC/USD',
    proxy: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    aggregator: '0xc9E1a09622afdB659913fefE800fEaE5DBbFe9d7',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    // 30 jam. Heartbeat USDC/USD adalah 24 jam dan jarak antar ronde terukur
    // 23,00 jam, jadi jendela harus melewatinya — kalau tidak, ronde terbaru
    // bisa berada tepat di luar jangkauan justru ketika paling dibutuhkan.
    //
    // Konsekuensinya diterima dengan sadar: ronde di atas 24 jam dibuktikan
    // pada tarif lazy 3,13x10^-4 CTC, bukan 2,59x10^-5. Selisihnya ~2,9x10^-4
    // CTC untuk SATU ronde — sepele, dan hanya terjadi saat bootstrap registry
    // kosong. Feed cepat tetap memakai jendela ketat.
    lookbackBlocks: 9_000,
    // 28 jam = plafon heartbeat 24 jam + 4 jam kelonggaran operasional
    // (attestation ~8 menit, lalu prove dan submit).
    maxPriceAgeSeconds: 100_800,
  },
  {
    pair: 'USDT/USD',
    proxy: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
    aggregator: '0x0d5F4aADf3fde31BBB55dB5F42C080F18aD54Df5',
    asset: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    // Feed PALING LAMBAT dari semua yang dipantau. Terukur live 2026-08-30 di
    // rentang yang sama: ETH 31 ronde per 9.000 blok, DAI 30, USDC 2, USDT 1.
    // Jendela default 6.000 blok (~20 jam) karena itu bisa berada di bawah
    // jarak antar ronde USDT, dan pada registry kosong itu berarti buntu
    // permanen — bukan hipotesis, persis yang terjadi pada USDC saat cutover
    // 2026-08-26.
    lookbackBlocks: 9_000,
    // Sama seperti USDC dan untuk alasan yang sama: heartbeat 24 jam melawan
    // anggaran global 3 jam. Tanpa ini USDT praktis SELALU basi di mata
    // kontrak — bukan karena ada yang rusak, melainkan karena anggarannya
    // diukur untuk feed yang berbeda.
    maxPriceAgeSeconds: 100_800,
  },
  {
    pair: 'DAI/USD',
    proxy: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
    aggregator: '0x709783ab12b65fD6cd948214EEe6448f3BdD72A3',
    asset: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    // Jendela dan anggaran default keduanya cukup: 30 ronde per 9.000 blok,
    // sekelas ETH/USD. Heartbeat 1 jam, jauh di dalam anggaran global 3 jam.
  },
];
