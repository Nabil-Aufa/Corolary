import { cn } from '@/lib/utils';

/**
 * Identicon deterministik dari alamat — digambar, bukan diambil.
 *
 * Tidak ada permintaan ke layanan avatar pihak ketiga: alamat dompet adalah
 * data pengguna, dan mengirimkannya ke host lain hanya demi gambar kecil
 * adalah kebocoran yang tidak perlu. Pola yang sama akan selalu lahir dari
 * alamat yang sama, di mesin mana pun, tanpa jaringan.
 */
export function WalletAvatar({
  address,
  size = 20,
  className,
}: {
  address: string;
  size?: number;
  className?: string;
}) {
  const hex = address.slice(2).toLowerCase();

  // Tiga nilai warna diambil dari potongan alamat yang berbeda supaya dua
  // dompet berbeda hampir tidak mungkin menghasilkan kombinasi yang sama.
  const hue = parseInt(hex.slice(0, 4), 16) % 360;
  const hue2 = (hue + 40 + (parseInt(hex.slice(4, 6), 16) % 120)) % 360;
  const bg = `hsl(${hue} 70% 55%)`;
  const fg = `hsl(${hue2} 75% 42%)`;

  // Pola 5x5 simetris cermin — hanya 3 kolom kiri yang diputuskan, dua sisanya
  // dipantulkan, persis seperti identicon klasik.
  const cells: boolean[] = [];
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      const nibble = hex.charCodeAt((y * 3 + x + 6) % hex.length);
      cells.push(nibble % 2 === 0);
    }
  }

  return (
    <svg
      viewBox="0 0 5 5"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-full', className)}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect width="5" height="5" fill={bg} />
      {cells.map((on, i) => {
        if (!on) return null;
        const y = Math.floor(i / 3);
        const x = i % 3;
        return (
          <g key={i} fill={fg}>
            <rect x={x} y={y} width="1" height="1" />
            <rect x={4 - x} y={y} width="1" height="1" />
          </g>
        );
      })}
    </svg>
  );
}
