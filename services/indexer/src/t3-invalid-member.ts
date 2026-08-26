/**
 * T3 — mengamati semua-atau-tidak-sama-sekali dalam bentuk MURNI.
 *
 *   pnpm --filter @corolary/indexer t3
 *
 * Yang sudah teramati di produksi adalah kegagalan tingkat-BATCH: 16 batch
 * revert lalu setiap anggotanya lolos sendiri-sendiri, artinya penyebabnya
 * `sharedContinuityProof` yang kedaluwarsa — bukan anggota yang buruk. Yang
 * belum pernah teramati: satu anggota yang benar-benar TIDAK SAH di antara
 * anggota yang sah (docs/open-issues.md T3).
 *
 * Pertanyaannya bukan akademis. Kalau precompile diam-diam MELEWATI anggota
 * yang tidak sah alih-alih menolak seluruh batch, maka kegagalan verifikasi
 * tidak punya gejala sama sekali — batch tetap sukses, fakta yang sah tetap
 * tercatat, dan satu-satunya bedanya adalah fakta yang hilang. Lebih buruk
 * lagi kalau anggota rusak itu tetap MENGHASILKAN fakta: berarti isi
 * `encodedTx` tidak sepenuhnya terikat pada proof-nya, dan registry bisa
 * diracuni.
 *
 * Dijalankan lewat `eth_call`, bukan transaksi. Revert di `eth_call` sudah
 * konklusif untuk semua-atau-tidak-sama-sekali — kalau seluruh panggilan
 * revert, tidak ada state yang berubah, jadi tidak mungkin ada 9 dari 10 yang
 * tercatat. Biayanya nol dan registry tidak tersentuh.
 */
import { ethers } from 'ethers';
import { sql, closeDb } from './db/client.js';
import { submitter } from './chain/providers.js';
import { loadAbi } from './chain/abi.js';
import { requireContracts } from './config.js';
import { logger } from './logger.js';
import type { BatchBundleJson } from './prover/bundle.js';

const log = logger.child({ stage: 't3' });

const abi = loadAbi('FactRegistry');
const errorNameBySelector = new Map<string, string>();
new ethers.Interface(abi).forEachError((f) => errorNameBySelector.set(f.selector, f.name));

interface Outcome {
  reverted: boolean;
  selector: string | null;
  name: string | null;
  message: string;
}

function describe(err: unknown): Outcome {
  const e = (err ?? {}) as {
    data?: unknown;
    info?: { error?: { data?: unknown } };
    revert?: { name?: string; args?: unknown[] };
    shortMessage?: string;
    message?: string;
  };
  const raw = typeof e.data === 'string' ? e.data : (e.info?.error?.data as string | undefined);
  const selector = typeof raw === 'string' && raw.startsWith('0x') && raw.length >= 10
    ? raw.slice(0, 10)
    : null;
  // Nama diresolusi dari ABI kita sendiri, karena ethers menyerah dengan
  // "unknown custom error" untuk revert yang datang tanpa konteks kontrak —
  // kelalaian yang sempat mengubur 49 event dengan pesan yang sama untuk sebab
  // yang berbeda-beda.
  const name = e.revert?.name ?? (selector ? (errorNameBySelector.get(selector) ?? null) : null);
  return {
    reverted: true,
    selector,
    name,
    message: e.shortMessage ?? e.message ?? String(err),
  };
}

/** Membalik satu byte di tengah — cukup untuk membatalkan Merkle proof-nya. */
function corruptHex(hex: string, atFraction = 0.5): string {
  const body = hex.slice(2);
  const i = Math.floor(body.length * atFraction) & ~1;
  const byte = parseInt(body.slice(i, i + 2), 16);
  const flipped = (byte ^ 0xff).toString(16).padStart(2, '0');
  return `0x${body.slice(0, i)}${flipped}${body.slice(i + 2)}`;
}

async function main(): Promise<void> {
  const { factRegistry: address } = requireContracts();
  const registry = new ethers.Contract(address, abi, submitter);

  // Diklaim seperti submitter mengklaimnya, supaya indexer yang sedang berjalan
  // tidak mengirimnya di tengah eksperimen — kontrolnya akan dijawab
  // `QueryAlreadyProcessed` dan seluruh pengukuran jadi tidak berarti.
  const rows = await sql<{ batch_id: string; payload: BatchBundleJson }[]>`
    UPDATE proof_batches SET status = 'submitting', updated_at = now()
    WHERE batch_id = (
      SELECT batch_id FROM proof_batches
      WHERE status = 'ready' AND jsonb_array_length(payload->'heights') >= 3
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING batch_id, payload
  `;
  const row = rows[0];
  if (!row) {
    log.error('tidak ada batch `ready` berisi >= 3 transaksi — jalankan lagi saat antrean terisi');
    process.exitCode = 1;
    return;
  }

  const { batch_id: batchId, payload } = row;
  const size = payload.heights.length;
  log.info({ batchId, size, heights: payload.heights }, 'batch dipinjam untuk eksperimen');

  const call = async (p: BatchBundleJson): Promise<Outcome> => {
    try {
      await registry.getFunction('recordFactBatch').staticCall(
        {
          chainKey: p.chainKey,
          heights: p.heights,
          merkleProofs: p.merkleProofs,
          sharedContinuityProof: p.sharedContinuityProof,
        },
        p.encodedTransactions,
        p.observedAts,
      );
      return { reverted: false, selector: null, name: null, message: 'sukses' };
    } catch (err) {
      return describe(err);
    }
  };

  try {
    // ── Kontrol ──
    // Tanpa ini, revert pada varian rusak tidak membuktikan apa-apa: batch itu
    // bisa saja memang sudah busuk sejak awal (proof kedaluwarsa), yaitu persis
    // mode kegagalan yang SUDAH kita amati dan bukan yang sedang dicari.
    const control = await call(payload);
    log.info({ batchId, ...control }, 'KONTROL — batch utuh');
    if (control.reverted) {
      log.error(
        'kontrol sudah revert, jadi batch ini tidak bisa membuktikan apa pun soal anggota tidak sah — kemungkinan besar proof-nya kedaluwarsa. Jalankan lagi dengan batch yang lebih segar.',
      );
      return;
    }

    const victim = Math.floor(size / 2);

    // ── Varian A: isi transaksi dirusak ──
    // Satu byte dibalik di tengah `encodedTx`. Isinya tidak lagi cocok dengan
    // daun Merkle yang dibuktikan, sementara SEMBILAN anggota lain tetap sah
    // dan `sharedContinuityProof` tetap yang sama persis seperti di kontrol.
    const variantA: BatchBundleJson = {
      ...payload,
      encodedTransactions: payload.encodedTransactions.map((t, i) =>
        i === victim ? corruptHex(t) : t,
      ),
    };
    const a = await call(variantA);
    log.info({ batchId, victim, ...a }, 'VARIAN A — satu encodedTx dirusak');

    // ── Varian B: satu simpul Merkle proof dirusak ──
    // Membedakan "isi tidak cocok proof" dari "proof itu sendiri cacat".
    const proofs = payload.merkleProofs.map((mp, i) =>
      i !== victim || mp.siblings.length === 0
        ? mp
        : {
            ...mp,
            siblings: mp.siblings.map((sib, j) =>
              j === 0 ? { ...sib, hash: corruptHex(sib.hash) } : sib,
            ),
          },
    );
    const b = await call({ ...payload, merkleProofs: proofs });
    log.info({ batchId, victim, ...b }, 'VARIAN B — satu simpul Merkle proof dirusak');

    // ── Kesimpulan ──
    const pure = a.reverted && b.reverted;
    log.info(
      {
        batchId,
        ukuranBatch: size,
        anggotaDirusak: victim,
        kontrol: control.reverted ? 'revert' : 'sukses',
        varianA: a.reverted ? `revert ${a.name ?? a.selector ?? '?'}` : 'SUKSES',
        varianB: b.reverted ? `revert ${b.name ?? b.selector ?? '?'}` : 'SUKSES',
        kesimpulan: pure
          ? 'semua-atau-tidak-sama-sekali TERBUKTI dalam bentuk murni'
          : 'TIDAK all-or-nothing — anggota tidak sah lolos, selidiki segera',
      },
      'hasil T3',
    );

    if (!pure) {
      // Bukan sekadar temuan menarik. Kalau anggota rusak tidak menjatuhkan
      // batch, `encodedTx` tidak sepenuhnya terikat pada proof-nya — dan itu
      // berarti registry bisa diracuni lewat batch yang tampak sukses.
      log.error(
        'TEMUAN KEAMANAN: batch dengan anggota tidak sah tidak revert. JANGAN kirim sebagai transaksi; periksa apakah anggota rusak itu menghasilkan fakta.',
      );
      process.exitCode = 2;
    }
  } finally {
    // Dikembalikan apa pun yang terjadi. Batch yang ditinggal `submitting`
    // hanya kembali saat indexer restart lewat reclaimOrphanedBatches, dan
    // sampai saat itu ia diam di antrean tanpa ada yang mengerjakannya.
    await sql`
      UPDATE proof_batches SET status = 'ready', updated_at = now() WHERE batch_id = ${batchId}
    `;
    log.info({ batchId }, 'batch dikembalikan ke antrean');
  }
}

await main()
  .catch((err) => {
    log.error({ err: String(err) }, 't3 gagal');
    process.exitCode = 1;
  })
  .finally(closeDb);
