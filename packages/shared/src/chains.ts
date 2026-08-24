// packages/shared/src/chains.ts
// Konfigurasi chain untuk viem/wagmi.
//
// PENTING: file ini SENGAJA tidak diekspor dari `index.ts`. Ia diimpor lewat
// subpath `@corolary/shared/chains` supaya backend (ethers v6, dipaksa
// @gluwa/usc-sdk) tidak pernah menarik viem hanya karena mengimpor tipe.
// Lihat docs/architecture.md §6.

import { defineChain } from 'viem';

export const creditcoinTestnet = defineChain({
  id: 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.cc3-testnet.creditcoin.network'] } },
  blockExplorers: {
    default: {
      name: 'Creditcoin Explorer',
      url: 'https://creditcoin-testnet.blockscout.com',
    },
  },
  testnet: true,
});
