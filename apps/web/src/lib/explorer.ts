import type { Address, Hex } from '@/types';

const CREDITCOIN_EXPLORER = (
  process.env.NEXT_PUBLIC_CREDITCOIN_EXPLORER_URL ?? 'https://creditcoin-testnet.blockscout.com'
).replace(/\/+$/, '');

export function etherscanTx(txHash: Hex | string): string {
  return `https://etherscan.io/tx/${txHash}`;
}

export function etherscanAddress(address: Address | string): string {
  return `https://etherscan.io/address/${address}`;
}

export function etherscanBlock(blockNumber: number): string {
  return `https://etherscan.io/block/${blockNumber}`;
}

export function creditcoinTx(txHash: Hex | string): string {
  return `${CREDITCOIN_EXPLORER}/tx/${txHash}`;
}

export function creditcoinAddress(address: Address | string): string {
  return `${CREDITCOIN_EXPLORER}/address/${address}`;
}
