import { ethers } from 'ethers';
import { creditcoin, submitter } from '../chain/providers.js';
import { stageLogger } from '../logger.js';

const log = stageLogger('submitter');

/**
 * Ambang peringatan saldo CTC submitter.
 *
 * Diturunkan dari biaya nyata, bukan dikarang. Terukur atas 476 batch produksi:
 * 1.340.325.969 gas total pada baseFee CC3 0,5 gwei = **0,67 CTC**, yaitu
 * **~0,0014 CTC per batch**.
 *
 * WARN 25 CTC  ≈ 17.800 batch tersisa — berminggu-minggu, waktu berlimpah untuk
 *                mengisi lewat faucet yang punya limit harian.
 * ERROR 5 CTC  ≈ 3.500 batch — masih jalan, tapi berhenti menunggu.
 *
 * Ambangnya sengaja jauh di atas nol. Kalau saldo benar-benar habis, submitter
 * memvonis `fatal` dan antrean berhenti TOTAL — dan gejalanya cuma antrean yang
 * tidak pernah berkurang. Peringatan yang baru berbunyi saat sudah kering tidak
 * ada gunanya; faucet testnet tidak bisa mengisi seketika.
 */
const WARN_CTC = 25n;
const ERROR_CTC = 5n;

/** ~0,0014 CTC per batch, terukur. Dipakai untuk menerjemahkan saldo jadi sisa batch. */
const WEI_PER_BATCH = 1_400_000_000_000_000n;

let lastLoggedAt = 0;

/**
 * Diperiksa berkala, bukan tiap batch: `eth_getBalance` per pengiriman berarti
 * satu panggilan RPC tambahan untuk angka yang bergerak sangat lambat.
 */
const CHECK_INTERVAL_MS = 600_000;

export async function checkSubmitterBalance(force = false): Promise<void> {
  if (!force && Date.now() - lastLoggedAt < CHECK_INTERVAL_MS) return;
  lastLoggedAt = Date.now();

  let wei: bigint;
  try {
    wei = await creditcoin.getBalance(submitter.address);
  } catch (err) {
    // Kegagalan RPC di sini tidak boleh menjatuhkan submitter: ini pemantauan,
    // bukan jalur kritis.
    log.warn({ err: String(err) }, 'gagal membaca saldo submitter');
    return;
  }

  const ctc = wei / 10n ** 18n;
  const batchesLeft = Number(wei / WEI_PER_BATCH);
  const fields = {
    address: submitter.address,
    saldoCtc: ethers.formatEther(wei),
    perkiraanBatchTersisa: batchesLeft,
  };

  if (ctc < ERROR_CTC) {
    log.error(fields, 'saldo CTC submitter KRITIS — isi sekarang, antrean akan berhenti total');
  } else if (ctc < WARN_CTC) {
    log.warn(fields, 'saldo CTC submitter menipis — minta faucet sebelum kering');
  } else {
    log.info(fields, 'saldo submitter');
  }
}
