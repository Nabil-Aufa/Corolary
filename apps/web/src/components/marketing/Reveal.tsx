'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Satu kurva untuk seluruh landing. Dua easing berbeda terbaca sebagai dua situs. */
const EASE = [0.16, 1, 0.3, 1] as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Jeda dalam detik. Dipakai untuk stagger manual antar-saudara. */
  delay?: number;
  /** Jarak naik dalam px. Judul raksasa butuh lebih jauh daripada baris kecil. */
  distance?: number;
  as?: 'div' | 'section' | 'li' | 'span';
}

/**
 * Muncul saat masuk viewport, sekali saja.
 *
 * `once: true` disengaja. Elemen yang beranimasi ulang setiap kali digulir
 * melewatinya terasa gelisah pada kunjungan kedua, dan landing ini digulir
 * naik-turun oleh orang yang membandingkan angka antar bagian.
 *
 * Saat `prefers-reduced-motion` menyala, komponen ini merender keadaan AKHIR
 * secara langsung — bukan animasi yang dipercepat. Animasi 0 detik tetap
 * melewati compositor dan tetap bisa memicu gejala pada sebagian orang.
 */
export function Reveal({ children, className, delay = 0, distance = 24, as = 'div' }: RevealProps) {
  const reduced = useReducedMotion();
  const Tag = motion[as];

  if (reduced) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      // `margin` negatif di bawah: elemen baru dianggap masuk setelah benar-
      // benar 12% naik ke dalam layar, supaya ia tidak selesai beranimasi
      // sebelum sempat terlihat.
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

export { EASE as REVEAL_EASE };
