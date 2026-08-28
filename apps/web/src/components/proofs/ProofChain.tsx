import { Check, ExternalLink } from 'lucide-react';
import { creditcoinTx, etherscanTx } from '@/lib/explorer';
import { formatCount, formatDuration } from '@/lib/format';
import type { FactWithProof } from '@/types';

/**
 * Empat langkah dari transaksi Ethereum ke fakta permanen di Creditcoin.
 *
 * Ini komponen yang membuat juri MELIHAT kedalaman Attestcoin, bukan
 * membacanya di deck — jadi ia dirender sebagai <ol> semantik dengan dua
 * tautan keluar yang benar-benar bisa diklik di kedua ujung rantai.
 */
export function ProofChain({ fact }: { fact: FactWithProof }) {
  const lagSeconds = Math.max(0, fact.recordedAt - fact.observedAt);

  const steps = [
    {
      key: 'observed',
      label: 'Ethereum transaction',
      detail: `Block ${formatCount(fact.blockHeight)} · tx index ${fact.txIndex} · log ${fact.logIndex}`,
      href: etherscanTx(fact.txHash),
      hrefLabel: 'View on Etherscan',
    },
    {
      key: 'attested',
      label: 'Attested on Creditcoin',
      detail: `Attestor consensus reached · ${formatDuration(lagSeconds)} from observation to record`,
      href: null,
      hrefLabel: null,
    },
    {
      key: 'proved',
      label: 'Proof built',
      detail: `chainKey ${fact.chainKey} · ${formatCount(fact.proof.merkleProofSiblingsCount)} Merkle siblings · ${formatCount(fact.proof.continuityProofRootsCount)} continuity roots · proved ${fact.proof.provedWithinHours.toFixed(2)}h after the transaction`,
      href: null,
      hrefLabel: null,
    },
    {
      key: 'recorded',
      label: 'Recorded in FactRegistry',
      detail: `Creditcoin block ${formatCount(fact.proof.verifiedAtBlock)} · batch of ${fact.proof.batchSize}`,
      href: creditcoinTx(fact.creditcoinTxHash),
      hrefLabel: 'View on Blockscout',
    },
  ] as const;

  return (
    <ol className="relative">
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
          {/* Garis penghubung, warna verified — bahasa visual yang sama di
              mana pun sesuatu terbukti secara kriptografis. */}
          {i < steps.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-[11px] top-6 h-full w-px bg-verified/30"
            />
          )}

          <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-verified-soft text-verified">
            <Check size={13} strokeWidth={2} />
          </span>

          <div className="min-w-0">
            <p className="text-body font-medium text-ink-900">{step.label}</p>
            <p className="num mt-1 break-words text-small text-ink-500">{step.detail}</p>
            {step.href !== null && (
              <a
                href={step.href}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-small text-accent hover:underline"
              >
                {step.hrefLabel} <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
