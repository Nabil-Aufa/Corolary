'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Salin ke clipboard, dengan konfirmasi yang padam sendiri.
 *
 * Diekstrak karena tiga tempat di halaman detail fakta menyalin nilai — pill
 * Subject di hero dan setiap kotak hex di bagian Raw — dan tiga salinan logika
 * yang sama akan berbeda durasi konfirmasinya dalam hitungan minggu.
 *
 * `navigator.clipboard` bisa DITOLAK (konteks non-secure, izin dicabut). Yang
 * benar adalah diam: nilainya tetap terlihat dan bisa diseleksi manual, jadi
 * tidak ada yang benar-benar hilang — sementara toast error untuk sesuatu yang
 * masih bisa dilakukan sendiri hanya menambah kebisingan.
 */
export function useCopy(resetAfterMs = 1400): { copied: boolean; copy: (value: string) => void } {
  const [copied, setCopied] = useState(false);
  // Klik beruntun pada kotak yang sama akan menumpuk timer, dan yang paling
  // awal memadamkan centang milik klik terakhir.
  const timer = useRef<number | null>(null);

  const copy = useCallback(
    (value: string) => {
      void navigator.clipboard
        .writeText(value)
        .then(() => {
          setCopied(true);
          if (timer.current !== null) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), resetAfterMs);
        })
        .catch(() => {
          /* diabaikan dengan sengaja — lihat komentar di atas */
        });
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
