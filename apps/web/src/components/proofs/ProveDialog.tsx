'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ExternalLink } from 'lucide-react';
import { isHex } from 'viem';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose } from '@/components/ui/dialog';
import { useProveJob, useStartProve } from '@/hooks/useApi';
import { etherscanTx } from '@/lib/explorer';
import { shortenHex } from '@/lib/format';
import type { Hex, ProveJob, ProveJobStatus } from '@/types';

const TITLE_ID = 'prove-tx-title';

/**
 * Tiap tahap dijelaskan apa adanya, termasuk yang lama.
 *
 * `awaiting_attestation` adalah yang paling penting untuk dinamai: ~8 menit
 * menunggu tanpa keterangan terbaca seperti aplikasi yang menggantung, padahal
 * itu Attestcoin yang sedang bekerja dan tidak ada yang bisa mempercepatnya.
 */
const STAGE: Record<ProveJobStatus, { title: string; detail: string }> = {
  pending: {
    title: 'Queued',
    detail: 'The indexer picks this up on its next pass.',
  },
  awaiting_attestation: {
    title: 'Waiting for attestation',
    detail:
      'Creditcoin attests Ethereum blocks about every 8 minutes. Nothing can speed this up. The wait is the protocol, not the app.',
  },
  proving: {
    title: 'Building the proof',
    detail: 'Fetching the Merkle proof for this transaction from the Proof Builder.',
  },
  submitting: {
    title: 'Recording on Creditcoin',
    detail: 'The proof is being verified by the Block Prover precompile.',
  },
  recorded: {
    title: 'Recorded',
    detail: 'This transaction is now a permanent fact.',
  },
  failed: {
    title: 'Failed',
    detail: 'The job stopped before recording anything.',
  },
  skipped: {
    title: 'Nothing to record',
    detail:
      'The proof verified, but this transaction carries no lending event from a registered protocol, so there is no fact to write. Aave V3, Morpho Blue, Compound V3, and Spark are the ones we index.',
  },
};

const DONE: ReadonlySet<ProveJobStatus> = new Set(['recorded', 'failed', 'skipped']);

export function ProveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [factId, setFactId] = useState<Hex | null>(null);

  const start = useStartProve();
  const job = useProveJob(jobId);

  function close() {
    setValue('');
    setError(null);
    setJobId(null);
    setFactId(null);
    start.reset();
    onClose();
  }

  function submit() {
    const txHash = value.trim();
    // Divalidasi di klien lebih dulu supaya hash cacat tidak pernah jadi
    // permintaan sia-sia. API tetap sumber kebenaran.
    if (!isHex(txHash) || txHash.length !== 66) {
      setError('A transaction hash is 0x followed by 64 hexadecimal characters.');
      return;
    }
    setError(null);
    start.mutate(txHash as Hex, {
      onSuccess: (accepted) => {
        // `jobId` null berarti transaksinya SUDAH jadi fakta tanpa pernah lewat
        // antrean — jalur biasa untuk apa pun yang ditemukan watcher live.
        // Tidak ada job untuk ditanyakan; `factId` yang membawa jawabannya.
        setJobId(accepted.jobId);
        setFactId(accepted.factId ?? null);
      },
    });
  }

  const stage = job.data?.status ?? null;

  return (
    <Dialog open={open} onClose={close} labelledBy={TITLE_ID}>
      <div className="relative flex h-12 items-center px-4">
        <h2
          id={TITLE_ID}
          className="pointer-events-none absolute inset-x-0 text-center text-body font-semibold text-ink-900"
        >
          Prove a transaction
        </h2>
        <DialogClose onClose={close} />
      </div>

      <div className="dialog-view px-6 pb-6">
        {factId !== null ? (
          <Settled
            title="Already proven"
            detail="This transaction was indexed before you asked. Nothing was spent to answer."
            factId={factId}
            onClose={close}
          />
        ) : jobId !== null ? (
          <Progress job={job.data ?? null} stage={stage} />
        ) : (
          <>
            <p className="text-small text-ink-500">
              Paste any Ethereum mainnet transaction. If it carries a lending event we index, it
              becomes a permanent fact on Creditcoin: proven, not asserted.
            </p>

            <label htmlFor="txhash" className="mt-5 block text-micro uppercase tracking-wide text-ink-400">
              Transaction hash
            </label>
            <input
              id="txhash"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={error !== null}
              className="num mt-1.5 h-12 w-full rounded-[var(--radius-base)] border border-border bg-bg px-4 text-body text-ink-900 outline-none placeholder:text-ink-400 focus:border-border-strong"
            />

            {(error !== null || start.isError) && (
              <p className="mt-2 text-small text-danger" role="alert">
                {error ??
                  (start.error instanceof Error ? start.error.message : 'Could not queue the job.')}
              </p>
            )}

            <Button
              className="mt-5 w-full"
              size="lg"
              onClick={submit}
              disabled={start.isPending || value.trim() === ''}
            >
              {start.isPending ? 'Queueing…' : 'Prove it'}
              <ArrowRight size={16} strokeWidth={1.75} />
            </Button>

            {/* Proof itu dibayar, dan yang membayarnya kita. Transaksi tanpa
                event dari protokol terdaftar tetap menghabiskan satu proof dan
                menghasilkan nol fakta — menyembunyikan itu membuat kotak ini
                terasa gratis untuk diisi apa saja. */}
            <p className="mt-4 text-micro leading-relaxed text-ink-400">
              Only Aave V3, Morpho Blue, Compound V3, and Spark events become facts. A transaction
              without one still costs a proof and records nothing.
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}

function Progress({ job, stage }: { job: ProveJob | null; stage: ProveJobStatus | null }) {
  const info = stage === null ? STAGE.pending : STAGE[stage];
  const settled = stage !== null && DONE.has(stage);

  return (
    <div className="py-2 text-center">
      {settled && stage === 'recorded' ? (
        <span className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-verified-soft text-verified">
          <Check size={28} strokeWidth={2} />
        </span>
      ) : (
        <div className="relative mx-auto flex h-[64px] w-[64px] items-center justify-center">
          <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <rect
              x="3"
              y="3"
              width="58"
              height="58"
              rx="20"
              fill="none"
              stroke={settled ? 'var(--color-danger)' : 'var(--color-accent)'}
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={settled ? '100 0' : '26 74'}
              className={settled ? undefined : 'ring-travel'}
            />
          </svg>
        </div>
      )}

      <p className="mt-5 text-h3 font-semibold text-ink-900">{info.title}</p>
      <p className="mx-auto mt-1.5 max-w-[22rem] text-small leading-relaxed text-ink-500">
        {info.detail}
      </p>

      {job !== null && job.lastError !== null && (
        <p className="mt-3 text-small text-danger">{job.lastError}</p>
      )}

      {job !== null && (
        <a
          href={etherscanTx(job.txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-small text-ink-500 hover:text-accent"
        >
          <span className="num">{shortenHex(job.txHash)}</span> on Etherscan
          <ExternalLink size={13} strokeWidth={1.5} />
        </a>
      )}
    </div>
  );
}

function Settled({
  title,
  detail,
  factId,
  onClose,
}: {
  title: string;
  detail: string;
  factId: Hex;
  onClose: () => void;
}) {
  return (
    <div className="py-2 text-center">
      <span className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-verified-soft text-verified">
        <Check size={28} strokeWidth={2} />
      </span>
      <p className="mt-5 text-h3 font-semibold text-ink-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[22rem] text-small leading-relaxed text-ink-500">
        {detail}
      </p>
      <Link href={`/proofs/${factId}`} onClick={onClose}>
        <Button variant="secondary" className="mt-5 w-full">
          See the proof chain
          <ArrowRight size={15} strokeWidth={1.75} />
        </Button>
      </Link>
    </div>
  );
}
