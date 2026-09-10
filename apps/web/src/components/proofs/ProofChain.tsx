import { Check } from 'lucide-react';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FactWithProof } from '@/types';

interface Step {
  key: string;
  title: string;
  note: string;
}

/**
 * Empat langkah dari transaksi Ethereum ke fakta permanen di Creditcoin.
 *
 * Bentuknya SATU rel mendatar, bukan empat kartu berdampingan. Empat kartu
 * terbaca sebagai empat hal yang kebetulan bersebelahan; yang perlu terbaca
 * adalah satu transaksi bergerak melewati empat tahap, dan garis yang
 * menyambung antar titik itulah yang mengatakannya.
 *
 * Tautan keluar ke Etherscan dan Blockscout sengaja TIDAK di sini — keduanya
 * sudah berdiri sebagai pill di hero, dan tautan yang sama di dua tempat
 * membuat pembaca menduga keduanya menuju hal berbeda.
 */
export function ProofChain({ fact }: { fact: FactWithProof }) {
  const lagSeconds = Math.max(0, fact.recordedAt - fact.observedAt);

  const steps: Step[] = [
    {
      key: 'observed',
      title: 'Ethereum transaction',
      // Menyebut pemeriksaan `receiptStatus == 1`. Block Prover hanya
      // membuktikan INKLUSI, bukan sukses — tanpa cek itu transaksi yang
      // revert ikut lolos, dan itu lubang keamanan #1 di proyek ini.
      note: 'Included in a mined mainnet block. The receipt confirms success.',
    },
    {
      key: 'attested',
      title: 'Attested on Creditcoin',
      note: `Attestor consensus reached. ${formatDuration(lagSeconds)} from observation to record.`,
    },
    {
      key: 'proved',
      title: 'Proof built',
      note: `Proved ${fact.proof.provedWithinHours.toFixed(2)}h after the transaction, inside the cheap window.`,
    },
    {
      key: 'recorded',
      title: 'Recorded in FactRegistry',
      note: 'Permanent and replay-protected. The same log cannot be recorded twice.',
    },
  ];

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-6 py-7">
      <ol className="flex flex-col gap-7 lg:flex-row lg:gap-0">
        {steps.map((step, i) => {
          const isFirst = i === 0;
          const isLast = i === steps.length - 1;

          return (
            <li
              key={step.key}
              className="relative flex-1 pl-10 lg:flex lg:flex-col lg:items-center lg:gap-3.5 lg:pl-0"
            >
              {/* Rel vertikal untuk layar sempit. Di lg ke atas relnya
                  mendatar, jadi yang ini menghilang sepenuhnya. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-[-1.75rem] left-[14px] top-8 w-1.5 rounded-full bg-verified lg:hidden"
                />
              )}

              <p className="text-body font-medium text-ink-900 lg:order-1 lg:text-center">
                {step.title}
              </p>

              {/* [garis][titik][garis] dalam satu baris, garis memakai `flex-1`.
                  Titik karena itu SELALU tepat di tengah kolomnya berapa pun
                  lebar kartunya — jaminan yang hilang begitu garis diberi
                  posisi sendiri. */}
              <div className="lg:order-2 lg:flex lg:w-full lg:items-center lg:gap-3.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'hidden h-1.5 flex-1 rounded-r-full bg-verified lg:block',
                    // `invisible`, bukan `hidden`: ia harus tetap memakan
                    // ruang, kalau tidak titik di ujung rantai kehilangan
                    // penyeimbang dan bergeser ke tepi kolom.
                    isFirst && 'invisible',
                  )}
                />

                <span className="absolute left-0 top-0 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-verified text-on-solid lg:static">
                  <Check size={16} strokeWidth={3} aria-hidden="true" />
                </span>

                <span
                  aria-hidden="true"
                  className={cn(
                    'hidden h-1.5 flex-1 rounded-l-full bg-verified lg:block',
                    isLast && 'invisible',
                  )}
                />
              </div>

              <p className="mt-2 text-micro leading-[1.5] text-ink-500 lg:order-3 lg:mt-0 lg:w-52 lg:text-center">
                {step.note}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
