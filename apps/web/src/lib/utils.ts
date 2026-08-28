import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge harus DIBERI TAHU skala tipe kustom kita.
 *
 * Tanpa ini ia tidak mengenali `text-small` sebagai ukuran font, menebaknya
 * sebagai WARNA teks, lalu membuang warna asli yang ditulis lebih dulu:
 *
 *   "bg-brand text-white text-small"  ->  "bg-brand text-small"
 *
 * Gejalanya tombol biru dengan teks gelap, tanpa satu pun error — dan ia
 * mengintai di mana pun warna teks bertemu ukuran kustom, bukan hanya di
 * tombol. Skala ini didefinisikan di globals.css (@theme --text-*).
 */
const TYPE_SCALE = ['display', 'h1', 'h2', 'h3', 'body', 'small', 'micro'];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TYPE_SCALE }],
    },
  },
});

/** Gabungkan className bersyarat, dengan konflik utility Tailwind diselesaikan. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
