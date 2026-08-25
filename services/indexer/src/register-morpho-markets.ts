/**
 * Mendaftarkan setiap pasar Morpho Blue yang benar-benar tersentuh oleh log
 * yang sudah kita panen.
 *
 * Pasar yang tidak terdaftar dilewati adapter secara DIAM-DIAM — tidak ada
 * revert, tidak ada peringatan, hanya fakta yang tidak pernah muncul. Karena
 * `FactRegistry` merevert seluruh transaksi kalau nol log yang bisa dipetakan
 * (`NoRelevantLogs`), efeknya berlipat: satu log Morpho dari pasar tak dikenal
 * bisa menjatuhkan transaksi yang sebetulnya membawa fakta lain.
 *
 * Parameternya dibaca dari Morpho Blue di Ethereum mainnet, bukan dimasukkan
 * tangan: `idToMarketParams(id)` adalah sumber kebenarannya.
 */
import { ethers } from 'ethers';
import { sql, closeDb } from './db/client.js';
import { creditcoin, ethereum } from './chain/providers.js';
import { loadAbi } from './chain/abi.js';
import { config } from './config.js';
import { logger } from './logger.js';

const MORPHO_MAINNET = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';
const ADAPTER = process.env.MORPHO_BLUE_ADAPTER_ADDRESS ?? '';
const KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '';
if (!ADAPTER || !KEY) throw new Error('MORPHO_BLUE_ADAPTER_ADDRESS / DEPLOYER_PRIVATE_KEY kosong');

const curator = new ethers.Wallet(KEY, creditcoin);
const adapter = new ethers.Contract(ADAPTER, loadAbi('MorphoBlueAdapter'), curator);
const morpho = new ethers.Contract(
  MORPHO_MAINNET,
  ['function idToMarketParams(bytes32) view returns (address,address,address,address,uint256)'],
  ethereum,
);

const rows = await sql<{ id: string; n: string }[]>`
  SELECT raw_log->'topics'->>1 AS id, count(*)::text AS n
  FROM observed_events
  WHERE protocol = ${MORPHO_MAINNET} AND raw_log->'topics'->>1 IS NOT NULL
  GROUP BY 1 ORDER BY count(*) DESC
`;

logger.info({ markets: rows.length }, 'pasar Morpho tersentuh');

let registered = 0;
let already = 0;
let failed = 0;

for (const r of rows) {
  const id = r.id;
  try {
    const existing = (await adapter.getFunction('marketOf')(id)) as unknown as {
      registered: boolean;
    };
    if (existing.registered) {
      already++;
      continue;
    }

    const p = (await morpho.getFunction('idToMarketParams')(id)) as [
      string, string, string, string, bigint,
    ];
    const loanToken = p[0];
    const collateralToken = p[1];

    // Pasar dengan kolateral nol adalah pasar "idle" Morpho — tidak ada yang
    // bisa dipinjam terhadapnya, jadi mendaftarkannya hanya menambah kebisingan.
    if (loanToken === ethers.ZeroAddress || collateralToken === ethers.ZeroAddress) {
      logger.warn({ id, loanToken, collateralToken }, 'pasar tanpa token, dilewati');
      continue;
    }

    const tx = await adapter.getFunction('setMarket')(id, loanToken, collateralToken);
    await tx.wait();
    registered++;
    logger.info({ id, loanToken, collateralToken, logs: r.n }, 'pasar didaftarkan');
  } catch (err) {
    failed++;
    logger.error({ id, err: String(err).slice(0, 140) }, 'gagal mendaftarkan pasar');
  }
}

logger.info({ registered, already, failed, total: rows.length }, 'selesai');
await closeDb();
