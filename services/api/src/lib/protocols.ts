import { ethers } from 'ethers';

/**
 * Nama protokol untuk tampilan. Alamatnya dikunci ke kontrak mainnet yang sama
 * dengan yang divalidasi adapter on-chain — kalau berbeda, UI akan memberi
 * label fakta dengan protokol yang bukan sumbernya.
 */
const NAMES: Record<string, string> = {
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'Aave V3',
  '0xc13e21b648a5ee794902342038ff3adab66be987': 'SparkLend',
  '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb': 'Morpho Blue',
  '0xc3d688b66703497daa19211eedff47f25384cdc3': 'Compound V3',
};

export function protocolName(address: string): string {
  const known = NAMES[address.toLowerCase()];
  if (known) return known;
  const a = ethers.getAddress(address);
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
