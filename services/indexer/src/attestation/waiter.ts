import { sql } from '../db/client.js';
import { chainInfoProvider } from '../prover/client.js';
import { ETH_CHAIN_KEY } from '../chain/providers.js';
import { stageLogger } from '../logger.js';

const log = stageLogger('attestation-waiter');

/** Tinggi blok yang diperiksa per putaran. Satu panggilan precompile per tinggi. */
const HEIGHTS_PER_PASS = 25;

interface HeightRow {
  block_height: string;
}

/**
 * Memindahkan event dari pending/awaiting_attestation ke proving begitu blok
 * sumbernya ter-attest di Creditcoin.
 *
 * Bekerja per TINGGI BLOK, bukan per event: satu blok bisa memuat puluhan log
 * yang kita minati, dan status attestation-nya identik untuk semuanya. Memeriksa
 * per event berarti memanggil precompile puluhan kali untuk jawaban yang sama.
 */
export async function waitOnce(): Promise<void> {
  const heights = await sql<HeightRow[]>`
    SELECT DISTINCT block_height
    FROM observed_events
    WHERE chain_key = ${ETH_CHAIN_KEY}
      AND status IN ('pending', 'awaiting_attestation')
    ORDER BY block_height ASC
    LIMIT ${HEIGHTS_PER_PASS}
  `;

  for (const row of heights) {
    const height = Number(row.block_height);
    let attested: boolean;
    try {
      const bounds = await chainInfoProvider.getContinuityBounds(ETH_CHAIN_KEY, height);
      attested = bounds.isAttested;
    } catch (err) {
      // Precompile/RPC bermasalah adalah kondisi sementara. Biarkan barisnya dan
      // coba lagi; menandainya failed di sini akan menghukum event yang sehat.
      log.warn({ height, err: String(err) }, 'gagal membaca continuity bounds');
      continue;
    }

    if (attested) {
      const updated = await sql`
        UPDATE observed_events
        SET status = 'proving'
        WHERE chain_key = ${ETH_CHAIN_KEY}
          AND block_height = ${height}
          AND status IN ('pending', 'awaiting_attestation')
      `;
      log.info({ height, events: updated.count }, 'blok ter-attest, masuk antrean proving');
    } else {
      await sql`
        UPDATE observed_events
        SET status = 'awaiting_attestation'
        WHERE chain_key = ${ETH_CHAIN_KEY}
          AND block_height = ${height}
          AND status = 'pending'
      `;
    }
  }
}
