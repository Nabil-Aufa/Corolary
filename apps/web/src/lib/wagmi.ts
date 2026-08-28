import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { creditcoinTestnet } from '@corolary/shared/chains';

/**
 * Konfigurasi wallet. Chain-nya diimpor dari @corolary/shared (milik Dev A) —
 * jangan pernah mendefinisikan ulang objek chain di sini, karena chainId dan
 * RPC harus identik dengan yang dipakai backend.
 *
 * Connector: `injected` saja untuk sekarang. WalletConnect butuh
 * NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID yang belum ada di .env.example —
 * menambahkannya dengan projectId kosong akan gagal saat runtime, bukan saat
 * build, jadi lebih baik absen daripada rusak diam-diam.
 */
export const wagmiConfig = createConfig({
  chains: [creditcoinTestnet],
  connectors: [injected()],
  transports: {
    [creditcoinTestnet.id]: http(
      process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL ?? creditcoinTestnet.rpcUrls.default.http[0],
    ),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
