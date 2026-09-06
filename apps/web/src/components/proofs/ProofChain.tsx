import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { Chip } from '@/components/ui/chip';
import { formatCount, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FactWithProof } from '@/types';

/**
 * Berapa langkah yang boleh berdiri dalam satu baris di desktop.
 *
 * Jumlah langkah TIDAK datang dari API — `FactWithProof` tidak memuat array
 * langkah; rantai ini disusun di sini dari field-field proof. Hari ini empat,
 * dan menambah satu (mis. pemisahan attestation dan finality) hanya berarti
 * menambah entri ke `steps`. Karena itu tata letaknya tidak boleh menyebut
 * angka empat di mana pun: kolomnya diturunkan dari `steps.length`, dan yang
 * dijaga cuma batas atas supaya kartu tidak menyempit sampai tak terbaca.
 */
const MAX_COLUMNS = 4;

interface Step {
  key: string;
  title: string;
  /** Metadata pendek berbentuk nilai. Satu chip per potongan. */
  chips: string[];
  /** Metadata berbentuk kalimat. Tidak pernah dipaksa masuk chip. */
  note: string | null;
}

/**
 * Empat langkah dari transaksi Ethereum ke fakta permanen di Creditcoin.
 *
 * Ini komponen yang membuat juri MELIHAT kedalaman Attestcoin, bukan
 * membacanya di deck. Tautan keluar ke Etherscan dan Blockscout sengaja TIDAK
 * di sini — keduanya sudah berdiri sebagai pill di hero, dan menaruh tautan
 * yang sama di dua tempat membuat pembaca menduga keduanya menuju hal berbeda.
 */
export function ProofChain({ fact }: { fact: FactWithProof }) {
  const lagSeconds = Math.max(0, fact.recordedAt - fact.observedAt);

  const steps: Step[] = [
    {
      key: 'observed',
      title: 'Ethereum transaction',
      chips: [
        `Block ${formatCount(fact.blockHeight)}`,
        `tx index ${fact.txIndex}`,
        `log ${fact.logIndex}`,
      ],
      note: null,
    },
    {
      key: 'attested',
      title: 'Attested on Creditcoin',
      chips: [],
      note: `Attestor consensus reached. ${formatDuration(lagSeconds)} from observation to record.`,
    },
    {
      key: 'proved',
      title: 'Proof built',
      chips: [
        `chainKey ${fact.chainKey}`,
        `${formatCount(fact.proof.merkleProofSiblingsCount)} Merkle siblings`,
        `${formatCount(fact.proof.continuityProofRootsCount)} continuity roots`,
      ],
      note: `Proved ${fact.proof.provedWithinHours.toFixed(2)}h after the transaction, inside the cheap window.`,
    },
    {
      key: 'recorded',
      title: 'Recorded in FactRegistry',
      chips: [
        `Creditcoin block ${formatCount(fact.proof.verifiedAtBlock)}`,
        `batch of ${fact.proof.batchSize}`,
      ],
      note: null,
    },
  ];

  const columns = Math.min(steps.length, MAX_COLUMNS);

  return (
    <ol
      className="grid lg:gap-4 lg:[grid-template-columns:repeat(var(--proof-cols),minmax(0,1fr))]"
      style={{ '--proof-cols': columns } as CSSProperties}
    >
      {steps.map((step, i) => {
        // Konektor hanya digambar kalau langkah berikutnya benar-benar duduk di
        // KANAN langkah ini. Di ujung baris yang membungkus, tetangganya ada di
        // baris bawah — garis ke kanan di sana akan menjulur ke ruang kosong.
        const isRowEnd = (i + 1) % columns === 0;
        const hasNext = i < steps.length - 1;

        return (
          <li
            key={step.key}
            className={cn(
              'relative pb-7 pl-9 last:pb-0',
              'lg:min-h-[168px] lg:rounded-[var(--radius-lg)] lg:border lg:border-border lg:bg-surface lg:p-5 lg:pb-5 lg:pl-5',
            )}
          >
            {/* Rel vertikal: bahasa visual timeline, dipakai di bawah lg saja. */}
            {hasNext && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[11px] top-7 w-px bg-verified/30 lg:hidden"
              />
            )}

            {/* Konektor horizontal, melintasi gap grid tepat selebar gap itu. */}
            {hasNext && !isRowEnd && (
              <span
                aria-hidden="true"
                className="absolute left-full top-8 hidden h-px w-4 bg-verified/30 lg:block"
              />
            )}

            {/* `items-start`, bukan `items-center`: judul dua baris ("Attested on
                Creditcoin") akan menggeser tick ke bawah kalau baris ini
                memusat, dan konektor horizontal — yang tingginya tetap — jadi
                tidak lagi menyambung ke tengah tick. */}
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-verified-soft text-verified lg:static"
              >
                <Check size={13} strokeWidth={2} />
              </span>
              <p className="text-body font-medium text-ink-900">{step.title}</p>
            </div>

            {step.chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {step.chips.map((chip) => (
                  <Chip key={chip}>{chip}</Chip>
                ))}
              </div>
            )}

            {step.note !== null && (
              <p className={cn('text-small text-ink-500', step.chips.length > 0 ? 'mt-3' : 'mt-2')}>
                {step.note}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
