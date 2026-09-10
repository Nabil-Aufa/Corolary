import { cn } from '@/lib/utils';

export type ArtVariant = 'chevron' | 'arcs' | 'rays' | 'grid';

/**
 * Bentuk abstrak untuk sisi kanan kartu pipeline dan latar kartu skor.
 *
 * Ini SVG inline, bukan gambar. Alasannya bukan berat berkas: art di
 * cuberto.com yang terlihat seperti render 3D sebenarnya gradien radial dan
 * conic bertumpuk, dan menirunya sebagai SVG berarti ia ikut tema gelap-terang
 * sendiri, tidak pernah gagal dimuat, dan tidak menambah satu pun permintaan
 * jaringan ke halaman yang seluruh isinya sudah menunggu API.
 *
 * Warnanya `currentColor` beropasitas rendah — jadi ia selalu berkerabat
 * dengan teks di atasnya, dan tidak pernah menjadi warna keempat yang bersaing
 * dengan aksen biru dan teal.
 */
export function GradientArt({
  variant = 'chevron',
  className,
}: {
  variant?: ArtVariant;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 320 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn('pointer-events-none h-full w-full', className)}
    >
      <defs>
        <linearGradient id={`fade-${variant}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.34" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {variant === 'chevron' &&
        [0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M160 ${248 - i * 56} L${320 + i * 10} ${248 + 110 - i * 56} L${-i * 10} ${248 + 110 - i * 56} Z`}
            fill={`url(#fade-${variant})`}
          />
        ))}

      {variant === 'arcs' &&
        [0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            cx="160"
            cy="268"
            r={70 + i * 46}
            fill="none"
            stroke={`url(#fade-${variant})`}
            strokeWidth={34}
          />
        ))}

      {variant === 'rays' &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={i}
            d={`M160 268 L${-40 + i * 88} -40 L${14 + i * 88} -40 Z`}
            fill={`url(#fade-${variant})`}
          />
        ))}

      {variant === 'grid' &&
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect
            key={i}
            x={i * 44}
            y={240 - (i % 4) * 34 - 40}
            width="30"
            height={(i % 4) * 34 + 40}
            fill={`url(#fade-${variant})`}
          />
        ))}
    </svg>
  );
}
