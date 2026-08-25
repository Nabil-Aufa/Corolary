import { chainInfo, proofProvider } from '@gluwa/usc-sdk';
import { config } from '../config.js';
import { creditcoin, ETH_CHAIN_KEY } from '../chain/providers.js';

/**
 * Perhatikan signature aslinya: ProofBuilder(chainKey, builderUrl, timeout?),
 * bukan objek opsi. docs/indexer.md §10.1 menulisnya dengan `{ baseUrl }` dan
 * itu keliru — dikoreksi terhadap dist/proof-provider/service/index.d.ts SDK
 * v0.18.0 yang benar-benar terpasang.
 */
export const proofBuilder = new proofProvider.service.ProofBuilder(
  ETH_CHAIN_KEY,
  config.PROOF_BUILDER_URL,
);

// Cast yang disengaja. Paket ini CJS dan me-require ethers lewat lib.commonjs,
// sementara indexer mengimpornya sebagai ESM lewat lib.esm. Di bawah NodeNext,
// TypeScript melihat DUA deklarasi JsonRpcApiProvider yang berbeda meski versi
// paketnya sama persis (6.17.0, satu salinan di store). Runtime-nya aman: SDK
// hanya memanggil method, tidak pernah `instanceof`.
type SdkRpc = ConstructorParameters<typeof chainInfo.PrecompileChainInfoProvider>[0];

export const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(
  creditcoin as unknown as SdkRpc,
);

export { ETH_CHAIN_KEY };
