import { Hono } from 'hono';
import { sql } from '../lib/db.js';
import { ok, notFound, invalidParam } from '../lib/envelope.js';
import { parseHash32 } from '../lib/validate.js';
import { config } from '../config.js';
import { rateLimit } from '../lib/ratelimit.js';
import type { Hex, ProveJob, ProveJobAccepted, ProveJobKind, ProveJobStatus } from '@corolary/shared';

export const prove = new Hono();

/**
 * Menitipkan permintaan proving eksplisit ke tabel `jobs`, yang dibaca indexer.
 *
 * API TIDAK memanggil prover atau mengirim transaksi sendiri. Submitter harus
 * tetap menjadi satu-satunya penulis dari kunci submitter — begitu ada dua
 * penulis, manajemen nonce butuh lock terdistribusi dan transaksi mulai saling
 * menimpa (docs/indexer.md §9).
 */
prove.post('/prove', rateLimit({ perMinute: 10, burst: 5 }), async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    invalidParam('body harus JSON');
  }

  const parsed = body as { txHash?: string; chainKey?: number };
  const txHash = parseHash32(parsed.txHash, 'txHash');
  const chainKey = parsed.chainKey ?? config.ETHEREUM_CHAIN_KEY;

  if (chainKey !== config.ETHEREUM_CHAIN_KEY) {
    // chainKey 1 adalah Sepolia. Menerimanya berarti fakta dari token karangan
    // bisa masuk registry lewat pintu ini.
    invalidParam(`chainKey ${chainKey} tidak dilayani; hanya ${config.ETHEREUM_CHAIN_KEY}`);
  }

  // Fakta yang SUDAH tercatat tidak boleh memicu job baru.
  //
  // Dedupe di bawah hanya melihat tabel `jobs`, jadi transaksi yang sudah lama
  // masuk registry lewat watcher tetap diterima di sini: prover membeli proof,
  // membayarnya, lalu submit-nya ditolak `QueryAlreadyProcessed` dan diklasifikasi
  // `skip`. Biayanya nyata, hasilnya nol. Dengan rate limit 10/menit/IP, siapa pun
  // bisa membakar CTC kita tanpa melanggar batas apa pun.
  const already = await sql<{ fact_id: string; recorded_at: string }[]>`
    SELECT fact_id, recorded_at FROM facts WHERE tx_hash = ${txHash} LIMIT 1
  `;
  const done = already[0];
  if (done) {
    const settled: ProveJobAccepted = {
      // null, bukan fact_id: fakta ini tidak pernah punya job, dan menaruh
      // factId di sini membuat GET /v1/prove/:jobId dipanggil dengan id yang
      // tidak akan pernah ditemukan.
      jobId: null,
      status: 'recorded',
      txHash,
      chainKey,
      createdAt: Number(done.recorded_at),
      factId: done.fact_id as Hex,
    };
    return ok(c, settled, undefined, 202);
  }

  const existing = await sql<{ id: string; status: string; created_at: Date }[]>`
    SELECT id, status, created_at FROM jobs
    WHERE kind = 'eager_prove' AND payload->>'txHash' = ${txHash}
    ORDER BY created_at DESC LIMIT 1
  `;
  const prior = existing[0];
  if (prior) {
    const accepted: ProveJobAccepted = {
      jobId: prior.id,
      status: prior.status as ProveJobStatus,
      txHash,
      chainKey,
      createdAt: Math.floor(new Date(prior.created_at).getTime() / 1000),
    };
    return ok(c, accepted, undefined, 202);
  }

  const inserted = await sql<{ id: string; created_at: Date }[]>`
    INSERT INTO jobs ${sql({
      kind: 'eager_prove',
      payload: sql.json({ txHash, chainKey }),
      status: 'pending',
    })}
    RETURNING id, created_at
  `;
  const row = inserted[0];
  if (!row) invalidParam('gagal menitipkan job');

  const accepted: ProveJobAccepted = {
    jobId: row.id,
    status: 'pending',
    txHash,
    chainKey,
    createdAt: Math.floor(new Date(row.created_at).getTime() / 1000),
  };
  return ok(c, accepted, undefined, 202);
});

prove.get('/prove/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) invalidParam('jobId harus UUID');

  const rows = await sql<
    { id: string; kind: string; status: string; payload: { txHash: string; chainKey: number };
      attempts: number; last_error: string | null; created_at: Date; updated_at: Date }[]
  >`SELECT * FROM jobs WHERE id = ${jobId}`;
  const row = rows[0];
  if (!row) notFound(`job ${jobId}`);

  const data: ProveJob = {
    jobId: row.id,
    kind: row.kind as ProveJobKind,
    status: row.status as ProveJobStatus,
    txHash: row.payload.txHash as Hex,
    chainKey: row.payload.chainKey,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: Math.floor(new Date(row.created_at).getTime() / 1000),
    updatedAt: Math.floor(new Date(row.updated_at).getTime() / 1000),
  };
  return ok(c, data);
});
