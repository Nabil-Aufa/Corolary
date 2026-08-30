import { Hono } from 'hono';
import { sql } from '../lib/db.js';
import { ok, notFound, invalidParam } from '../lib/envelope.js';
import { parseAddress, parseHash32, parseLimit, decodeCursor, encodeCursor } from '../lib/validate.js';
import { toFact, type FactRow } from '../lib/mappers.js';
import { factRegistry } from '../lib/chain.js';
import type { FactWithProof, Hex } from '@corolary/shared';

export const facts = new Hono();

/**
 * Kolom yang sama dipakai daftar dan detail, termasuk join harga.
 *
 * Harga diambil dari tabel `prices` — mirror dari PriceRegistry — dan bukan
 * dari feed langsung. Fakta yang tampil di UI harus bisa ditelusuri ke sebuah
 * proof; harga live yang tidak terbukti akan merusak klaim itu diam-diam.
 */
const SELECT = sql`
  SELECT f.*, a.symbol, a.decimals,
         p.answer AS price_answer, p.decimals AS price_decimals
  FROM facts f
  LEFT JOIN assets a ON a.address = f.asset
  LEFT JOIN prices p ON p.asset  = f.asset
`;

/** Maksimum elemen per parameter berdaftar-koma (`kind=1,2`, `protocol=0xa,0xb`). */
const MAX_LIST_PARAM = 10;

/**
 * Memecah `?kind=1,2` atau `?protocol=0xaaa,0xbbb` jadi daftar tervalidasi,
 * sambil tetap kompatibel mundur dengan nilai tunggal (`?kind=1`). Dibatasi
 * `MAX_LIST_PARAM` supaya query tidak bisa dibuat sewenang-wenang besar oleh
 * daftar koma yang panjang.
 */
function parseList<T>(
  raw: string | undefined,
  paramName: string,
  validate: (element: string) => T,
): T[] | null {
  if (raw === undefined) return null;
  const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) invalidParam(`${paramName} tidak boleh kosong`);
  if (parts.length > MAX_LIST_PARAM) {
    invalidParam(`${paramName} maksimum ${MAX_LIST_PARAM} elemen, dapat ${parts.length}`);
  }
  return parts.map(validate);
}

function parseKind(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 4) {
    invalidParam(`kind harus 0..4, dapat "${raw}"`);
  }
  return n;
}

facts.get('/facts', async (c) => {
  const q = c.req.query();
  const limit = parseLimit(q['limit']);
  const cursor = decodeCursor(q['cursor']);

  const subject = q['subject'] !== undefined ? parseAddress(q['subject']) : null;
  const protocols = parseList(q['protocol'], 'protocol', (s) => parseAddress(s));
  const kinds = parseList(q['kind'], 'kind', parseKind);

  // Ambil satu lebih banyak dari limit: kehadiran baris ke-(limit+1) adalah
  // cara mengetahui ada halaman berikutnya tanpa COUNT(*) di tabel besar.
  const rows = await sql<FactRow[]>`
    ${SELECT}
    WHERE true
      ${subject ? sql`AND f.subject = ${subject}` : sql``}
      ${protocols ? sql`AND f.protocol = ANY(${protocols})` : sql``}
      ${kinds ? sql`AND f.kind = ANY(${kinds})` : sql``}
      ${
        cursor
          ? sql`AND (f.block_height, f.tx_index, f.tx_log_index) <
                    (${cursor.blockHeight}, ${cursor.txIndex}, ${cursor.logIndex})`
          : sql``
      }
    ORDER BY f.block_height DESC, f.tx_index DESC, f.tx_log_index DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return ok(
    c,
    page.map(toFact),
    hasMore && last
      ? {
          cursor: encodeCursor({
            blockHeight: Number(last.block_height),
            txIndex: last.tx_index,
            logIndex: last.tx_log_index,
          }),
        }
      : undefined,
  );
});

facts.get('/facts/:factId', async (c) => {
  const factId = parseHash32(c.req.param('factId'), 'factId');

  const rows = await sql<(FactRow & { batch_id: string | null; creditcoin_block: string })[]>`
    ${SELECT} WHERE f.fact_id = ${factId}
  `;
  const row = rows[0];
  if (!row) notFound(`fakta ${factId}`);

  // Dibaca dari KOLOM, bukan dari `payload`. Payload sebuah batch dikosongkan
  // begitu ia mencapai `done` (migrasi 0013): ~18 KB per batch, 116 MB dari
  // database 216 MB, disimpan selamanya demi dua integer yang tidak pernah
  // berubah. Kedua angka itu sekarang ditulis prover saat batch dibuat.
  const batchRows = await sql<
    {
      tx_count: number;
      continuity_roots_count: number | null;
      merkle_siblings_count: number | null;
    }[]
  >`
    SELECT tx_count, continuity_roots_count, merkle_siblings_count
    FROM proof_batches WHERE batch_id = ${row.batch_id}
  `;
  const batch = batchRows[0];

  const observedAt = Number(row.observed_at);
  const recordedAt = Number(row.recorded_at);

  const data: FactWithProof = {
    ...toFact(row),
    proof: {
      // Jendela 24 jam adalah alasan keberadaan eager proving: melewatinya
      // membuat proof ~12x lebih mahal. Angka ini yang membuktikan janji itu
      // ditepati untuk fakta ini, bukan sekadar diklaim di dokumen.
      provedWithinHours: Math.max(0, Math.round(((recordedAt - observedAt) / 3600) * 10) / 10),
      continuityProofRootsCount: batch?.continuity_roots_count ?? 0,
      merkleProofSiblingsCount: batch?.merkle_siblings_count ?? 0,
      batchId: row.batch_id,
      batchSize: batch?.tx_count ?? 1,
      verifiedAtBlock: Number(row.creditcoin_block),
      creditcoinExplorerUrl:
        `https://creditcoin-testnet.blockscout.com/tx/${row.creditcoin_tx_hash}`,
    },
  };

  return ok(c, data);
});

/** Dipakai /v1/score untuk melampirkan bukti pada tiap komponen. */
export async function factIdsFor(subject: string, kinds: number[], limit = 10): Promise<Hex[]> {
  const rows = await sql<{ fact_id: string }[]>`
    SELECT fact_id FROM facts
    WHERE subject = ${subject} AND kind = ANY(${kinds})
    ORDER BY block_height DESC LIMIT ${limit}
  `;
  return rows.map((r) => r.fact_id as Hex);
}

export async function factCountFor(subject: string, kinds: number[]): Promise<number> {
  const rows = await sql<{ n: string }[]>`
    SELECT count(*) AS n FROM facts WHERE subject = ${subject} AND kind = ANY(${kinds})
  `;
  return Number(rows[0]?.n ?? 0);
}

export { factRegistry };
