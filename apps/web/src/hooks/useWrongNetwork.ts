'use client';

import { useAccount } from 'wagmi';
import { creditcoinTestnet } from '@corolary/shared/chains';

/**
 * Jaringan salah hanya relevan kalau wallet-nya terhubung. Pengunjung tanpa
 * wallet tetap bisa membaca skor, bukti, dan pasar — produk ini publik, dan
 * memaksa mereka connect untuk membaca fakta on-chain akan mengingkari itu.
 */
export function useWrongNetwork(): { isWrong: boolean; expectedChainId: number } {
  const { chainId, isConnected } = useAccount();
  return {
    isWrong: isConnected && chainId !== creditcoinTestnet.id,
    expectedChainId: creditcoinTestnet.id,
  };
}
