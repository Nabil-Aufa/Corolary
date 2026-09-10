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
 * Pra-pemeriksaan TIDAK BOLEH menggantung, karena ia berjalan di dalam iterasi
 * submitter dan `loop()` menjadwalkan tick berikutnya hanya SETELAH iterasi
 * selesai. Satu panggilan yang tidak pernah kembali karena itu tidak
 * memperlambat submitter — ia menghentikannya, diam-diam, tanpa satu baris log
 * pun. Pola yang sama pernah membunuh loop harga selama 1 jam 40 menit.
 *
 * 15 detik jauh di atas waktu jawab normal `eth_call` (satu blok CC3 ~15 detik
 * adalah waktu EKSEKUSI transaksi, bukan waktu baca), dan jauh di bawah
 * ITERATION_TIMEOUT_MS supaya pemulihannya terjadi di sini — bukan dengan
 * membunuh seluruh iterasi.
 */
const PREFLIGHT_TIMEOUT_MS = 15_000;

/**
 * Di atas ukuran ini pra-pemeriksaan DILEWATI sama sekali.
 *
 * `eth_call` membawa payload yang sama persis dengan transaksinya, jadi untuk
 * batch besar ia menggandakan permintaan berat ke gateway RPC — dan justru
 * batch besarlah yang paling mungkin ditolak gateway dengan 413. Melakukan
 * pra-pemeriksaan di sana berarti membayar dua kali untuk penolakan yang sama.
 *
 * Melewatinya tidak menghilangkan perlindungan: 413 pada pengiriman sungguhan
 * kini divonis `splitBatch`, sehingga batch besar tetap dipecah dan tetap
 * tercatat. Ambangnya diturunkan dari byte, bukan dari jumlah transaksi, karena
 * byte-lah yang mengikat di kedua sisi (gas maupun HTTP).
 */
const PREFLIGHT_MAX_BYTES = 200_000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} melewati ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  const totalBytes = payload.encodedTransactions.reduce((n, t) => n + (t.length - 2) / 2, 0);
  if (totalBytes > PREFLIGHT_MAX_BYTES) {
    log.debug(
      { batchId, totalBytes, size: payload.heights.length },
      'batch terlalu besar untuk pra-pemeriksaan — langsung dikirim, 413 ditangani sebagai splitBatch',
    );
    return null;
  }

  try {
    await withTimeout(
      verifier.getFunction('verify').staticCall(
        payload.chainKey,
        payload.heights,
        payload.encodedTransactions,
        payload.merkleProofs,
        payload.sharedContinuityProof,
      ),
      PREFLIGHT_TIMEOUT_MS,
      'pra-pemeriksaan',
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
