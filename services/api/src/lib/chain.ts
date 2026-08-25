import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ethers } from 'ethers';
import { config } from '../config.js';

const ABI_DIR = resolve(import.meta.dirname, '../../../../packages/shared/src/abis');

function abi(name: string): ethers.InterfaceAbi {
  try {
    return JSON.parse(readFileSync(resolve(ABI_DIR, `${name}.json`), 'utf8')) as ethers.InterfaceAbi;
  } catch {
    throw new Error(`ABI ${name} tidak ada — jalankan \`pnpm contracts:abi\``);
  }
}

export const creditcoin = new ethers.JsonRpcProvider(
  config.CREDITCOIN_RPC_URL,
  config.CREDITCOIN_CHAIN_ID,
  { staticNetwork: true },
);

export const factRegistry = new ethers.Contract(
  config.FACT_REGISTRY_ADDRESS, abi('FactRegistry'), creditcoin);
export const creditGraph = new ethers.Contract(
  config.CREDIT_GRAPH_ADDRESS, abi('CreditGraph'), creditcoin);
export const priceRegistry = new ethers.Contract(
  config.PRICE_REGISTRY_ADDRESS, abi('PriceRegistry'), creditcoin);
export const market = new ethers.Contract(
  config.EFFICIENCY_MARKET_ADDRESS, abi('EfficiencyMarket'), creditcoin);

/** Indeks bunga diskalakan WAD (1e18), sama seperti EfficiencyMarket. */
export const WAD = 10n ** 18n;

export function scaledToActual(scaled: bigint, index: bigint): bigint {
  return index === 0n ? 0n : (scaled * index) / WAD;
}

/** Nilai WAD → string desimal USD dengan 2 angka di belakang koma. */
export function wadToUsd(wad: bigint): string {
  const cents = (wad * 100n) / WAD;
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

// Precompile ChainInfo diakses lewat SDK, BUKAN ABI tulisan tangan.
// Percobaan pertama memakai signature karangan dan precompile membalas
// "Unknown selector" — selektornya memang berbeda, dan tidak ada cara
// mengetahuinya selain membaca definisi resmi.
const { chainInfo } = await import('@gluwa/usc-sdk');
type SdkRpc = ConstructorParameters<typeof chainInfo.PrecompileChainInfoProvider>[0];
export const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(
  creditcoin as unknown as SdkRpc,
);

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

/**
 * Melengkapi metadata token yang hidup di CREDITCOIN, bukan di Ethereum.
 *
 * Tabel `assets` diisi indexer dari token Ethereum. Token pasar testnet
 * (tUSDC/tWETH) tidak pernah lewat sana, sehingga tanpa ini mereka jatuh ke
 * default 18 desimal — dan tUSDC berdesimal 6, jadi setiap saldo akan meleset
 * 10^12 kali tanpa gejala apa pun di UI.
 */
export async function ensureCreditcoinAsset(
  address: string,
  upsert: (a: { address: string; symbol: string; decimals: number }) => Promise<void>,
): Promise<void> {
  const { ethers } = await import('ethers');
  const token = new ethers.Contract(address, ERC20_ABI, creditcoin);
  const symbol = (await token.getFunction('symbol')()) as string;
  const decimals = Number(await token.getFunction('decimals')());
  await upsert({ address: ethers.getAddress(address), symbol, decimals });
}
