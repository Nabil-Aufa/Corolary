'use client';

import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FaqItem {
  question: string;
  answer: string;
}

// Enam pertanyaan yang jawabannya diambil langsung dari fakta jaringan dan
// aturan proyek — tidak ada angka yang dikarang di sini.
const ITEMS: FaqItem[] = [
  {
    question: 'What is actually being proven here?',
    answer:
      'Three things, together: that a transaction was included in a specific Ethereum mainnet block, that the source transaction actually succeeded (not reverted), and that the log came from the address of a registered protocol, not an impersonating contract. All three checks run on-chain before a fact is stored.',
  },
  {
    question: 'Why Creditcoin testnet if the data is Ethereum mainnet?',
    answer:
      'Creditcoin CC3 Testnet can read Ethereum mainnet through Attestcoin using chainKey 3. That lets the product satisfy a testnet deployment requirement without ever falling back to seeded or synthetic data.',
  },
  {
    question: 'Is this unsecured lending?',
    answer:
      'No. Every loan stays over-collateralized. A proven wallet simply needs to lock up less capital against it — the required ratio moves from 150% down to a floor of 110%, it never reaches zero.',
  },
  {
    question: 'How long until a new transaction counts?',
    answer:
      'Roughly eight minutes for Attestcoin attestors to reach consensus on the block, then the proof is built and submitted on-chain. Nothing is proven on demand from stale history.',
  },
  {
    question: 'Which protocols are read?',
    answer:
      'Aave V3, Morpho Blue, Compound, and SparkLend for borrowing and repayment history, plus Chainlink for the prices used to value collateral.',
  },
  {
    question: 'Can I check this myself?',
    answer:
      'Yes. Every fact carries both the Creditcoin transaction that recorded it and the Ethereum transaction it was proven from, and both can be opened directly in a block explorer.',
  },
];

/**
 * FAQ akordeon di atas panel gelap.
 *
 * Beda dari `Faq.tsx` lama (details/summary murni): di sini state dipegang
 * React supaya hanya SATU jawaban terbuka sekaligus — details/summary asli
 * tidak punya cara bawaan untuk memaksa itu tanpa nama grup, yang belum
 * didukung merata. `aria-expanded`/`aria-controls` menggantikan semantik
 * yang otomatis didapat details/summary secara gratis.
 */
export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const idBase = useId();

  return (
    <div id="faq" className="mkt-container py-[clamp(80px,10vw,160px)]">
      <h2 className="font-display font-medium text-mkt-h2 text-panel-ink-900">FAQ</h2>

      <div className="mt-14">
        {ITEMS.map((item, i) => {
          const open = openIndex === i;
          const panelId = `${idBase}-panel-${i}`;
          const buttonId = `${idBase}-button-${i}`;

          return (
            <div
              key={item.question}
              className={cn('border-t border-panel-border', i === ITEMS.length - 1 && 'border-b')}
            >
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex w-full items-center justify-between gap-6 py-7 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="text-mkt-h3 text-panel-ink-900">{item.question}</span>
                <Plus
                  aria-hidden="true"
                  className={cn(
                    'h-6 w-6 shrink-0 text-panel-ink-500 transition-transform',
                    open && 'rotate-45',
                  )}
                />
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className={cn(open ? 'slide-down' : 'grid grid-rows-[0fr] opacity-0')}
              >
                <p className="max-w-[60ch] overflow-hidden pb-7 text-body text-panel-ink-700">
                  {item.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
