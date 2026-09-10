'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { REVEAL_EASE } from './Reveal';

/**
 * Judul dipecah per baris supaya tiap baris naik dengan jeda kecil.
 *
 * Memecah per KATA terlihat lebih pintar dan terbaca lebih buruk: mata
 * mengikuti baris, bukan kata, jadi kata yang datang satu-satu membuat
 * kalimatnya dibaca dua kali. Tiga baris dengan jeda 80ms cukup untuk terasa
 * disusun tanpa menunda orang membaca.
 */
const LINES = ['Kolateral yang mengikuti', 'riwayatmu, bukan', 'tebakanmu.'];

const SUBHEAD =
  'Riwayat pinjam-meminjam nyata di Ethereum mainnet, dibuktikan secara kriptografis lewat Attestcoin, dipakai memangkas kolateral yang harus dikunci dari 150% ke 110%.';

export function Hero() {
  const reduced = useReducedMotion();

  return (
    <header className="mx-auto max-w-[1280px] px-6 pb-24 pt-24 text-center md:px-8 md:pb-32 md:pt-40">
      <h1 className="font-display text-mkt-display font-medium text-ink-900">
        {LINES.map((line, i) =>
          // Cabang penuh, bukan prop bernilai `undefined`: `exactOptionalPropertyTypes`
          // menolak `undefined` eksplisit, dan animasi berdurasi nol tetap melewati
          // compositor — yang justru ingin dihindari pengguna reduced-motion.
          reduced ? (
            <span key={line} className="block">
              {line}
            </span>
          ) : (
            // Kotak masking harus LEBIH TINGGI dari kotak barisnya. Dengan
            // line-height 1 — yang memang diinginkan di ukuran ini —
            // `overflow-hidden` memotong ascender dan descender, dan huruf
            // seperti "y" dan "g" kehilangan ekornya tanpa terlihat seperti
            // bug. Padding menambah ruang klip; margin negatif yang sama besar
            // mengembalikan tinggi layoutnya, jadi jarak antar baris tidak
            // berubah sedikit pun.
            <span key={line} className="-my-[0.16em] block overflow-hidden py-[0.16em]">
              <motion.span
                className="block"
                initial={{ y: '100%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 0.9, ease: REVEAL_EASE, delay: 0.05 + i * 0.08 }}
              >
                {line}
              </motion.span>
            </span>
          ),
        )}
      </h1>

      {reduced ? (
        <p className="mx-auto mt-7 max-w-xl text-body text-ink-500">{SUBHEAD}</p>
      ) : (
        <motion.p
          className="mx-auto mt-7 max-w-xl text-body text-ink-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: REVEAL_EASE, delay: 0.34 }}
        >
          {SUBHEAD}
        </motion.p>
      )}
    </header>
  );
}
