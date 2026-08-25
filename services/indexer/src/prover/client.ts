import { chainInfo, proofProvider } from '@gluwa/usc-sdk';
import { config } from '../config.js';
import { creditcoin, ETH_CHAIN_KEY } from '../chain/providers.js';

/**
 * Perhatikan signature aslinya: ProofBuilder(chainKey, builderUrl, timeout?),
 * bukan objek opsi. docs/indexer.md §10.1 menulisnya dengan `{ baseUrl }` dan
 * itu keliru — dikoreksi terhadap dist/proof-provider/service/index.d.ts SDK
 * v0.18.0 yang benar-benar terpasang.
 */
/**
 * Timeout 60 detik, BUKAN default SDK yang 10 detik.
 *
 * Diukur, bukan ditebak: 24 transaksi backfill ditandai `failed` permanen
 * setelah delapan percobaan, seolah proof-nya tidak tersedia. Diuji ulang lewat
 * SDK yang sama, blok yang sama menjawab `success=true` — sementara blok lain
 * yang SEBELUMNYA berhasil justru timeout. Jadi yang terjadi bukan proof tidak
 * ada, melainkan kita menyerah terlalu cepat.
 *
 * Blok lama lebih lambat dilayani, dan backfill seluruhnya terdiri dari blok
 * lama. Dengan 10 detik, jalur backfill menghukum dirinya sendiri: makin tua
 * riwayat yang diminta, makin besar peluang ia divonis gagal permanen.
 */
const PROOF_TIMEOUT_MS = 60_000;

export const proofBuilder = new proofProvider.service.ProofBuilder(
  ETH_CHAIN_KEY,
  config.PROOF_BUILDER_URL,
  PROOF_TIMEOUT_MS,
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
