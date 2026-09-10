import { ethers } from 'ethers';
import { creditcoin } from '../chain/providers.js';
import { classifySubmitError, type Classified } from './errors.js';
import { logger } from '../logger.js';
import type { BatchBundleJson } from '../prover/bundle.js';

const log = logger.child({ stage: 'preflight' });

/**
 * Varian BACA-SAJA dari precompile Attestcoin (`0x…0FD2`).
 *
 * `verifyAndEmit` mengubah state dan karena itu harus dikirim sebagai transaksi
 * — artinya gas terbayar bahkan ketika batch-nya sudah pasti ditolak. `verify`
 * punya parameter yang identik tetapi `view`, jadi ia bisa dipanggil lewat
 * `eth_call`: biaya nol, tidak ada nonce terpakai, registry tidak tersentuh.
 */
const VERIFY_ABI = [
  'function verify(uint64 chainKey,uint64[] heights,bytes[] encodedTransactions,(bytes32 root,(bytes32 hash,bool isLeft)[] siblings)[] merkleProofs,(bytes32 lowerEndpointDigest,bytes32[] roots) sharedContinuityProof) external view returns (bool)',
];

const PRECOMPILE = '0x0000000000000000000000000000000000000FD2';

const verifier = new ethers.Contract(PRECOMPILE, VERIFY_ABI, creditcoin);

/**
 * Memeriksa lapisan PROOF sebuah batch sebelum gas dibayar.
 *
 * Diukur langsung terhadap precompile hidup, bukan disimpulkan dari tanda
 * tangannya: `verify` **tidak pernah** mengembalikan `false`. Ia revert dengan
 * `Error(string)`, dan pesannya membedakan sebabnya —
 * `"Merkle proof validation failed"` untuk isi yang tidak cocok dengan proof,
 * `"Continuity proof does not match attestation or checkpoint"` untuk proof
 * yang kedaluwarsa atau height yang salah. Karena itu `require(verify(...))`
 * adalah cabang yang tidak pernah terjangkau, dan satu-satunya cara membaca
 * hasilnya adalah menangkap revert-nya.
 *
 * Yang diperiksa HANYA lapisan proof. Gerbang bisnis `FactRegistry`
 * — `receiptStatus`, alamat emitter, replay — tidak ikut dievaluasi di sini
 * dan tetap ditegakkan on-chain saat pengiriman sungguhan. Pemisahan itu
 * disengaja: kegagalan yang tertangkap di sini pasti soal proof, sehingga
 * penanganannya (beli proof baru, atau pecah batch) tidak perlu menebak.
 *
 * @returns vonis bila batch pasti ditolak di lapisan proof; `null` bila batch
 *   layak dikirim ATAU bila pemeriksaan sendiri gagal karena sebab
 *   infrastruktur. Mengembalikan `null` saat ragu adalah pilihan yang
 *   disengaja: pra-pemeriksaan tidak boleh menjadi cara baru bagi batch sehat
 *   untuk tertahan. Paling buruk kita kembali ke perilaku lama, yaitu membayar
 *   gas lalu ditolak.
 */
export async function preflightBatch(
  batchId: string,
  payload: BatchBundleJson,
): Promise<Classified | null> {
  try {
    await verifier.getFunction('verify').staticCall(
      payload.chainKey,
      payload.heights,
      payload.encodedTransactions,
      payload.merkleProofs,
      payload.sharedContinuityProof,
    );
    return null;
  } catch (err) {
    const verdict = classifySubmitError(err, true);

    // Hanya dua vonis yang benar-benar berasal dari lapisan proof. Vonis lain
    // — termasuk kegagalan RPC yang menyamar sebagai revert — dibiarkan lewat
    // supaya jalur pengiriman biasa yang memutuskan.
    if (verdict.verdict === 'staleProof' || verdict.verdict === 'splitBatch') {
      log.info(
        { batchId, verdict: verdict.verdict, reason: verdict.reason, size: payload.heights.length },
        'batch ditolak di pra-pemeriksaan — gas tidak jadi dibayar',
      );
      return verdict;
    }

    log.debug(
      { batchId, verdict: verdict.verdict, reason: verdict.reason },
      'pra-pemeriksaan tidak konklusif, lanjut ke pengiriman biasa',
    );
    return null;
  }
}
