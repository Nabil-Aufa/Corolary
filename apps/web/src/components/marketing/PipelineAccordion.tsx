'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { GradientArt, type ArtVariant } from './GradientArt';
import { REVEAL_EASE } from './Reveal';

interface Stage {
  title: string;
  body: string;
  /** Angka yang benar-benar bisa dipertanggungjawabkan, bukan hiasan. */
  figure: string;
  figureLabel: string;
  art: ArtVariant;
}

/**
 * Lima tahap pipeline.
 *
 * Angka di sini adalah KONSTANTA PROTOKOL, bukan hasil pengukuran yang
 * berubah: tarif proof dan batas batch ditentukan Attestcoin dan kontrak kita
 * sendiri. Angka yang bergerak — jumlah fakta, lag, blok terpindai — tinggal
 * di mosaik statistik yang membacanya dari API.
 */
const STAGES: Stage[] = [
  {
    title: 'Transaksi nyata di Ethereum',
    body: 'Seseorang meminjam atau melunasi di Aave, Morpho, Compound, atau Spark. Kami tidak menerbitkan apa pun — kami hanya mengamati apa yang sudah terjadi di mainnet.',
    figure: '4',
    figureLabel: 'protokol dipantau',
    art: 'grid',
  },
  {
    title: 'Attestor mencapai konsensus',
    body: 'Jaringan Attestcoin menyepakati blok Ethereum yang memuat transaksi itu. Sampai konsensus tercapai, tidak ada yang bisa dibuktikan tentangnya.',
    figure: '38 blok',
    figureLabel: '≈ 8 menit sampai bisa dibuktikan',
    art: 'chevron',
  },
  {
    title: 'Proof dibangun selagi segar',
    body: 'Proof yang dibuat di bawah 24 jam sepuluh kali lebih murah daripada yang dibuat belakangan. Karena itu indexer membuktikan peristiwa saat masih baru, lalu menyimpan faktanya permanen — tidak pernah membuktikan ulang di jalur panas.',
    figure: '10×',
    figureLabel: 'lebih murah: 2,59×10⁻⁵ lawan 3,13×10⁻⁴ CTC',
    art: 'arcs',
  },
  {
    title: 'FactRegistry menyimpan selamanya',
    body: 'Precompile memverifikasi inklusi, adapter mendekode log, dan kontrak menolak apa pun yang transaksi sumbernya gagal atau yang pemancar lognya bukan protokol terdaftar. Yang lolos tersimpan permanen di Creditcoin.',
    figure: '999 blok',
    figureLabel: 'rentang maksimum satu batch proof',
    art: 'chevron',
  },
  {
    title: 'Pasar memberi harga kolateral',
    body: 'CreditGraph menurunkan skor 0–1000 dari fakta-fakta itu, dan EfficiencyMarket menerjemahkan skor jadi rasio kolateral. Tidak ada penilai manusia di antaranya.',
    figure: '150% → 110%',
    figureLabel: 'rentang rasio kolateral',
    art: 'rays',
  },
];

/**
 * Akordeon yang membuka mengikuti scroll, bukan klik.
 *
 * Kartu yang aktif berpindah ke permukaan gelap dan memuai memunculkan
 * penjelasan. Itu satu-satunya gerakan di halaman ini yang benar-benar
 * diperhatikan orang, jadi ia dipakai untuk hal yang paling ingin dijelaskan.
 *
 * Aksesibilitas: kartu tetap `<button>` sungguhan dan tetap bisa dibuka dengan
 * keyboard, karena akordeon yang HANYA merespons scroll tidak bisa dioperasikan
 * sama sekali oleh pengguna keyboard. Fokus keyboard mengunci kartu terbuka
 * dan mematikan pengambilalihan oleh scroll sampai fokus pergi — tanpa kunci
 * itu, scroll akan menutup kartu yang baru saja dibuka seseorang dengan Enter.
 */
export function PipelineAccordion() {
  const [active, setActive] = useState(0);
  const [locked, setLocked] = useState(false);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (locked) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = refs.current.findIndex((el) => el === entry.target);
          if (index !== -1) setActive(index);
        }
      },
      // Pita sempit di tengah layar: kartu jadi aktif saat ia melewati
      // sepertiga tengah, bukan saat ujungnya baru menyentuh viewport.
      { rootMargin: '-42% 0px -42% 0px', threshold: 0 },
    );

    for (const el of refs.current) if (el !== null) observer.observe(el);
    return () => observer.disconnect();
  }, [locked]);

  return (
    <div className="mt-14 space-y-3">
      {STAGES.map((stage, i) => {
        const isActive = i === active;
        return (
          <div
            key={stage.title}
            ref={(el) => {
              refs.current[i] = el;
            }}
          >
            <button
              type="button"
              aria-expanded={isActive}
              onClick={() => setActive(i)}
              onFocus={() => {
                setActive(i);
                setLocked(true);
              }}
              onBlur={() => setLocked(false)}
              className={cn(
                'group relative isolate w-full overflow-hidden rounded-[var(--radius-card)] px-6 py-7 text-left transition-colors duration-500 md:px-10 md:py-9',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isActive ? 'bg-panel text-panel-ink-700' : 'bg-surface text-ink-500',
              )}
            >
              {isActive && (
                <div className="absolute inset-y-0 right-0 -z-10 w-1/2 text-panel-ink-500 opacity-50">
                  <GradientArt variant={stage.art} />
                </div>
              )}

              <div className="flex items-start justify-between gap-6">
                <h3
                  className={cn(
                    'font-display text-[clamp(1.375rem,3vw,2.125rem)] font-medium leading-tight tracking-[-0.01em] transition-colors duration-500',
                    isActive ? 'text-panel-ink-900' : 'text-ink-900',
                  )}
                >
                  {stage.title}
                </h3>
                <span
                  className={cn(
                    'num shrink-0 pt-1 text-body transition-colors duration-500',
                    isActive ? 'text-panel-ink-500' : 'text-ink-400',
                  )}
                >
                  0{i + 1}
                </span>
              </div>

              <motion.div
                initial={false}
                animate={{ height: isActive ? 'auto' : 0, opacity: isActive ? 1 : 0 }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.55, ease: REVEAL_EASE }
                }
                className="overflow-hidden"
              >
                <div className="grid gap-6 pt-5 md:grid-cols-12">
                  <p className="max-w-prose text-body text-panel-ink-700 md:col-span-7">
                    {stage.body}
                  </p>
                  <div className="md:col-span-4 md:col-start-9">
                    <p className="num font-display text-[clamp(1.5rem,3vw,2rem)] font-medium leading-none tracking-[-0.02em] text-panel-ink-900">
                      {stage.figure}
                    </p>
                    <p className="mt-2 text-small text-panel-ink-500">{stage.figureLabel}</p>
                  </div>
                </div>
              </motion.div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
