import { ethers } from 'ethers';
import { config } from '../config.js';

// Backend memakai ethers v6 (frontend memakai viem/wagmi). Disengaja: SDK
// Attestcoin memaksa ethers. Keduanya tidak pernah bertemu di satu file.
/**
 * `batchMaxCount: 3` bukan angka sembarangan.
 *
 * ethers v6 diam-diam menggabungkan permintaan yang berjalan bersamaan menjadi
 * SATU JSON-RPC batch. Begitu getBlock dijalankan paralel, ethers mengirim batch
 * berisi 12 permintaan dan drpc free plan menolak seluruh batch dengan HTTP 500:
 * "Batch of more than 3 requests are not allowed on free plan". Yang gagal bukan
 * satu permintaan, melainkan semuanya sekaligus — dan pesannya muncul sebagai
 * error server, bukan rate limit, sehingga mudah salah didiagnosis.
 *
 * Jadi paralelismenya dipertahankan (itu yang memangkas 39,6 detik per chunk),
 * tapi ukuran batch dikunci di bawah batas provider.
 */
export const ethereum = new ethers.JsonRpcProvider(config.ETHEREUM_RPC_URL, 1, {
  staticNetwork: true,
  batchMaxCount: 3,
});

export const creditcoin = new ethers.JsonRpcProvider(
  config.CREDITCOIN_RPC_URL,
  config.CREDITCOIN_CHAIN_ID,
  { staticNetwork: true },
);

export const submitter = new ethers.Wallet(config.SUBMITTER_PRIVATE_KEY, creditcoin);

export const ETH_CHAIN_KEY = config.ETHEREUM_CHAIN_KEY;
