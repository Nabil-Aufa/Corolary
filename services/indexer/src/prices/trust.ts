/**
 * Mendaftarkan dan mempercayai feed harga di PriceRegistry, diturunkan dari
 * `FEEDS` — bukan dari daftar kedua yang harus tetap sepakat selamanya.
 *
 * Ada karena `trustAggregator` adalah setter ber-`CURATOR_ROLE`: menambah feed
 * TIDAK butuh redeploy, jadi ia tidak boleh hanya hidup di `Deploy.s.sol`.
 * Kalau ia hanya ada di sana, satu-satunya cara menambah USDT/DAI adalah
 * men-deploy ulang PriceRegistry — dan itu menyeret `EfficiencyMarket` serta
 * `CreditGraph` ikut, karena `EfficiencyMarket.priceRegistry` di-set di
 * konstruktor dan tidak punya setter.
 *
 * Idempoten: feed yang sudah dipercaya dan sudah cocok dilewati, jadi aman
 * dijalankan berulang kali.
 *
 *   DEPLOYER_PRIVATE_KEY=0x… pnpm --filter @corolary/indexer prices:trust
 *
 * Memakai kunci DEPLOYER (pemegang CURATOR_ROLE), bukan kunci submitter —
 * sehingga ia tidak pernah mengklaim nonce dari baris `submitter_state` dan
 * aman dijalankan selagi indexer hidup.
 */
import { ethers } from 'ethers';
import { creditcoin, ethereum } from '../chain/providers.js';
import { loadAbi } from '../chain/abi.js';
import { requireContracts } from '../config.js';
import { logger } from '../logger.js';
import { FEEDS } from './feeds.js';

/**
 * Desimal feed Chainlink. Diverifikasi lewat `decimals()` di proxy untuk
 * kelima feed pada 2026-08-30; tetap diperiksa ulang saat jalan karena salah
 * nilai di sini menggeser SELURUH harga aset itu berkali-kali lipat tanpa satu
 * pun gejala.
 */
const AGGREGATOR_ABI = ['function decimals() view returns (uint8)'];
const ERC20_ABI = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'];

/**
 * CC3 menagih ~3,5x lipat estimasi lokal untuk operasi penyimpanan, dan
 * `eth_estimateGas` CC3 dijawab terhadap state beberapa blok lebih tua.
 * Gejala kekurangan gas di sini menyesatkan: `gasUsed == gasLimit` persis,
 * yang terbaca seperti revert logika. Batas eksplisit yang longgar lebih murah
 * daripada satu jam salah diagnosis.
 */
const GAS_LIMIT = 400_000n;

async function main(): Promise<void> {
  const key = process.env['DEPLOYER_PRIVATE_KEY'];
  if (!key) throw new Error('DEPLOYER_PRIVATE_KEY belum diisi — ia pemegang CURATOR_ROLE');

  const { priceRegistry: address } = requireContracts();
  const wallet = new ethers.Wallet(key, creditcoin);
  const registry = new ethers.Contract(address, loadAbi('PriceRegistry'), wallet);

  const curator = (await registry.getFunction('CURATOR_ROLE')()) as string;
  const hasRole = (await registry.getFunction('hasRole')(curator, wallet.address)) as boolean;
  if (!hasRole) {
    throw new Error(`${wallet.address} tidak memegang CURATOR_ROLE di ${address}`);
  }

  for (const feed of FEEDS) {
    const asset = ethers.getAddress(feed.asset);

    await applyMaxPriceAge(registry, feed.pair, asset, feed.maxPriceAgeSeconds);

    const trusted = (await registry.getFunction('assetOfAggregator')(feed.aggregator)) as string;
    if (trusted !== ethers.ZeroAddress) {
      if (ethers.getAddress(trusted) !== asset) {
        // Tidak diperbaiki otomatis: aggregator yang menunjuk aset LAIN berarti
        // feeds.ts dan kontrak tidak sepakat soal apa yang sedang dihargai, dan
        // menimpanya diam-diam adalah cara mengubur kesalahan itu.
        logger.error(
          { pair: feed.pair, expected: asset, onChain: trusted },
          'aggregator sudah dipercaya untuk aset LAIN — perbaiki manual',
        );
        continue;
      }
      logger.info({ pair: feed.pair }, 'sudah dipercaya, dilewati');
      continue;
    }

    // Desimal dibaca dari MAINNET, bukan diketik. Salah nilai di sini menggeser
    // seluruh nilai USD aset itu tanpa gejala apa pun sampai skornya sudah salah.
    const token = new ethers.Contract(asset, ERC20_ABI, ethereum);
    const assetDecimals = Number(await token.getFunction('decimals')());
    const symbol = (await token.getFunction('symbol')()) as string;

    const agg = new ethers.Contract(feed.aggregator, AGGREGATOR_ABI, ethereum);
    const feedDecimals = Number(await agg.getFunction('decimals')());

    // `registerAsset` adalah prasyarat `trustAggregator` (kontrak me-revert
    // dengan AssetNotRegistered kalau desimalnya masih nol). Aman diulang.
    const reg = await registry.getFunction('registerAsset')(asset, assetDecimals, {
      gasLimit: GAS_LIMIT,
    });
    await reg.wait();

    const tx = await registry.getFunction('trustAggregator')(asset, feed.aggregator, feedDecimals, {
      gasLimit: GAS_LIMIT,
    });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`trustAggregator revert: ${tx.hash}`);

    logger.info(
      { pair: feed.pair, symbol, asset, assetDecimals, feedDecimals, tx: tx.hash },
      'aggregator dipercaya',
    );
  }
}

/**
 * Menyamakan anggaran kesegaran per-aset di kontrak dengan `feeds.ts`.
 *
 * Terpisah dari `trustAggregator` dan dijalankan lebih dulu karena ia juga
 * berlaku untuk feed yang SUDAH dipercaya — anggaran yang salah tidak
 * memperbaiki dirinya sendiri hanya karena aggregatornya sudah terdaftar.
 *
 * Butuh DEFAULT_ADMIN_ROLE, bukan CURATOR_ROLE. Kalau kunci yang dipakai tidak
 * memegangnya, ini dilaporkan sebagai peringatan dan sisa skrip tetap jalan:
 * mempercayai aggregator tanpa menyetel anggaran masih lebih berguna daripada
 * tidak melakukan apa-apa.
 */
async function applyMaxPriceAge(
  registry: ethers.Contract,
  pair: string,
  asset: string,
  wanted: number | undefined,
): Promise<void> {
  if (wanted === undefined) return;

  const current = Number(await registry.getFunction('maxPriceAgeOf')(asset));
  if (current === wanted) return;

  try {
    const tx = await registry.getFunction('setMaxPriceAgeFor')(asset, wanted, {
      gasLimit: GAS_LIMIT,
    });
    await tx.wait();
    logger.info({ pair, asset, from: current, to: wanted, tx: tx.hash }, 'anggaran harga disetel');
  } catch (err) {
    logger.warn(
      { pair, asset, wanted, err: String(err) },
      'gagal menyetel anggaran harga — butuh DEFAULT_ADMIN_ROLE',
    );
  }
}

await main();
