'use client';

import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FaqItem {
  question: string;
  /** Per paragraf, bukan satu blok: jawaban sepanjang ini dibaca sebagai
   *  dinding teks kalau dirender jadi satu `<p>`. */
  answer: string[];
}

// Enam pertanyaan yang jawabannya diambil langsung dari fakta jaringan dan
// aturan proyek — tidak ada angka yang dikarang di sini.
const ITEMS: FaqItem[] = [
  {
    question: 'What is actually being proven here?',
    answer: [
      'Three things, together: that a transaction was included in a specific Ethereum mainnet block, that the source transaction actually succeeded (not reverted), and that the log came from the address of a registered protocol, not an impersonating contract.',
      'All three checks run on-chain before a fact is stored.',
    ],
  },
  {
    question: 'Why Creditcoin testnet if the data is Ethereum mainnet?',
    answer: [
      'Creditcoin CC3 Testnet can read Ethereum mainnet through Attestcoin using chainKey 3.',
      'That lets the product satisfy a testnet deployment requirement without ever falling back to seeded or synthetic data.',
    ],
  },
  {
    question: 'Is this unsecured lending?',
    answer: [
      'No. Every loan stays over-collateralized.',
      'A proven wallet simply needs to lock up less capital against it. The required ratio moves from 150% down to a floor of 110%, and it never reaches zero.',
    ],
  },
  {
    question: 'How long until a new transaction counts?',
    answer: [
      'Roughly eight minutes for Attestcoin attestors to reach consensus on the block, then the proof is built and submitted on-chain.',
      'Nothing is proven on demand from stale history.',
    ],
  },
  {
    question: 'Which protocols are read?',
    answer: [
      'Aave V3, Morpho Blue, Compound, and SparkLend for borrowing and repayment history.',
      'Chainlink is read separately, for the prices used to value the collateral behind a loan.',
    ],
  },
  {
    question: 'Can I check this myself?',
    answer: [
      'Yes. Every fact carries both the Creditcoin transaction that recorded it and the Ethereum transaction it was proven from.',
      'Both can be opened directly in a block explorer.',
    ],
  },
];

/**
 * FAQ akordeon di atas panel gelap.
 *
 * BEBERAPA jawaban boleh terbuka sekaligus, dan itu perubahan dari versi
 * sebelumnya yang memaksa hanya satu. Membuka satu jawaban lalu menutup
 * jawaban yang sedang dibaca orangnya adalah hal yang tidak pernah diminta
 * pembaca; ia juga membuat halaman melompat, karena tinggi yang hilang di
 * atas menarik seluruh isi ke atas di tengah klik.
 *
 * Karena state-nya dipegang React dan bukan `details`/`summary`,
 * `aria-expanded` dan `aria-controls` harus ditulis sendiri — keduanya
 * didapat gratis kalau memakai elemen bawaan, dan hilang tanpa gejala kalau
 * lupa.
 */
export function LandingFaq() {
  const [openSet, setOpenSet] = useState<ReadonlySet<number>>(() => new Set());
  const idBase = useId();

  const toggle = (i: number) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (!next.delete(i)) next.add(i);
      return next;
    });

  return (
    <div id="faq" className="mkt-container py-[clamp(80px,10vw,160px)]">
      <h2 className="font-display font-medium text-mkt-h2 text-panel-ink-900">FAQ</h2>

      <div className="mt-14">
        {ITEMS.map((item, i) => {
          const open = openSet.has(i);
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
                onClick={() => toggle(i)}
                className="flex w-full items-center justify-between gap-6 py-[clamp(22px,2.4vw,34px)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="text-mkt-h3 text-panel-ink-900">{item.question}</span>
                {/* Satu ikon untuk dua keadaan: `+` yang diputar 45 derajat
                    JADI `×`. Menukar dua ikon berbeda memutus transisinya —
                    yang tergantikan tidak bisa beranimasi menjadi penggantinya. */}
                <Plus
                  aria-hidden="true"
                  className={cn(
                    'h-6 w-6 shrink-0 text-panel-ink-500 transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
                    open && 'rotate-45 text-panel-ink-900',
                  )}
                />
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className={cn('faq-panel', open && '-open')}
              >
                <div>
                  {/* Padding ada di SINI, bukan di anak langsung `.faq-panel`.
                      Anak itu yang dipotong `overflow: hidden`, dan potongan
                      itu tidak menyentuh padding miliknya sendiri — jawaban
                      yang tertutup akan menyisakan celah setinggi paddingnya. */}
                  <div className="flex flex-col gap-5 pb-[clamp(32px,4vw,64px)] pt-[clamp(4px,1vw,16px)]">
                    {/* `text-body` (15px) terlalu kecil di sini: ia ukuran untuk
                        teks pendamping di kolom sempit, sementara jawaban ini
                        membentang selebar kontainer. Baris sepanjang itu butuh
                        badan huruf yang lebih besar dan jarak baris yang lebih
                        longgar supaya mata tidak kehilangan barisnya saat
                        kembali ke kiri. */}
                    {item.answer.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="text-[clamp(16px,1.15vw,20px)] leading-[1.6] text-panel-ink-700"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
