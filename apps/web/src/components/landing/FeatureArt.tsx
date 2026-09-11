export type FeatureArtVariant = 'activity' | 'consensus' | 'batch' | 'layers' | 'ratio';

/**
 * Art untuk sisi kanan kartu akordeon.
 *
 * Terpisah dari `GradientArt` karena tugasnya berbeda jenis, bukan berbeda
 * pengaturan. Art di sana dekorasi generik: namanya bentuk (`chevron`, `arcs`),
 * dan ia dipakai di tempat tempat yang tidak berhubungan. Di sini tiap bentuk
 * terikat pada isi kartunya, jadi namanya makna (`batch`, `layers`), dan
 * memindahkannya ke komponen bersama berarti menaruh kosakata satu section di
 * tempat yang dipakai `Preview` dan `Outro`.
 *
 * Dua aturan bentuk yang berlaku untuk semuanya:
 *
 * 1. Semua bentuk MELUBER lewat tepi bawah viewBox. Bentuk yang muat utuh punya
 *    tepi, dan tepi di tengah bidang hitam terbaca sebagai gambar yang
 *    terpotong. Karena itu koordinatnya sengaja melewati `240`.
 * 2. Gradiennya vertikal dan padam di atas, jadi tiap bentuk hanya pekat di
 *    dekat dasar kartu. Ini yang menjaga art tetap latar dan tidak pernah
 *    bersaing dengan teks di kolom kiri.
 *
 * Ukuran kotaknya sendiri dipatok dari `FeatureAccordion`, dan tepi kirinya
 * dilarutkan oleh `mask-image` di `globals.css`. Keduanya di luar berkas ini.
 */

/**
 * Opasitas ujung terang, dipakai kelima bentuk tanpa kecuali.
 *
 * Nilai yang sama TIDAK cukup untuk terlihat sama. Ada dua hal yang bisa
 * membuatnya menyimpang, dan keduanya pernah terjadi di berkas ini:
 *
 * 1. Bentuk yang menimpa dirinya sendiri melipatgandakan opasitas di daerah
 *    tumpang tindih. Karena itu tidak ada bentuk di bawah yang boleh
 *    bersinggungan, dan yang berlapis digambar bergaris, bukan berisi.
 * 2. `gradientUnits` bawaan SVG adalah `objectBoundingBox`, artinya tiap
 *    bentuk mendapat gradiennya SENDIRI yang diukur terhadap kotak bentuk itu.
 *    Akibatnya lingkaran besar dan persegi kecil dengan nilai identik tampil
 *    dengan terang yang sama sekali berbeda: terukur puncak 69 lawan 151 pada
 *    `stopOpacity` yang sama persis. `userSpaceOnUse` di bawah memaksa kelima
 *    bentuk berbagi satu ramp yang sama, dipetakan ke viewBox, sehingga terang
 *    sebuah piksel hanya ditentukan oleh posisinya di kartu.
 */
const GLOW = 0.34;

/** Tinggi batang aktivitas. Sengaja tidak beraturan: deret yang rapi terbaca
 *  sebagai grafik yang dikarang, dan justru itu kesan yang paling salah untuk
 *  kartu yang isinya "tidak ada yang disimulasikan". */
const ACTIVITY = [120, 70, 165, 95, 200, 60, 140, 110];

/** Petak batch: tiga baris lima. Jaraknya 12 mendatar dan 17 menegak, menjaga
 *  tidak ada ubin yang bersinggungan — syarat yang berlaku untuk semua bentuk
 *  di berkas ini, karena bentuk yang menimpa dirinya sendiri jadi lebih terang
 *  daripada empat kartu lainnya. */
const BATCH: [number, number][] = [0, 1, 2].flatMap((row) =>
  [0, 1, 2, 3, 4].map((col): [number, number] => [16 + col * 60, 85 + row * 65]),
);

/** Tangga menurun untuk `ratio`. Enam anak tangga: delapan terbaca terlalu
 *  halus sampai bentuk tangganya hilang, empat jadi bongkahan. */
const STAIRS = (() => {
  const parts = ['M-20 64'];
  let x = -20;
  let y = 64;
  for (let i = 0; i < 6; i += 1) {
    x += 58;
    parts.push(`L${x} ${y}`);
    y += 28;
    parts.push(`L${x} ${y}`);
  }
  parts.push(`L340 ${y}`, 'L340 280', 'L-20 280', 'Z');
  return parts.join(' ');
})();

export function FeatureArt({ variant }: { variant: FeatureArtVariant }) {
  const id = `fa-${variant}`;
  const paint = `url(#${id})`;

  return (
    <svg
      viewBox="0 0 320 240"
      // `slice` supaya art menutupi kotak dan meluber, bukan muat lalu berhenti.
      // `YMax` menahan dasar bentuk di dasar kartu; yang terbuang bagian atas,
      // yang memang sudah padam oleh gradien.
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none h-full w-full"
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="240" x2="0" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity={GLOW} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Aktivitas mainnet: batang setinggi tinggi yang tidak beraturan, seperti
          aliran transaksi yang benar benar masuk. */}
      {variant === 'activity' &&
        ACTIVITY.map((h, i) => (
          <rect key={i} x={i * 44} y={240 - h} width={30} height={h + 40} fill={paint} />
        ))}

      {/* Attestation: cincin sepusat yang menyebar dari satu titik, bentuk yang
          sama dipakai orang untuk menggambarkan kesepakatan yang merambat. */}
      {variant === 'consensus' &&
        [0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            cx={160}
            cy={268}
            r={70 + i * 46}
            fill="none"
            stroke={paint}
            strokeWidth={34}
          />
        ))}

      {/* Eager proving: antrean yang dibereskan berombongan. Baris terbawah
          sengaja terpotong tepi kartu, jadi ia terbaca sebagai antrean yang
          masih berlanjut, bukan sebagai sekumpulan benda yang kebetulan muat. */}
      {variant === 'batch' &&
        BATCH.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width={48} height={48} rx={6} fill={paint} />
        ))}

      {/* Fakta permanen: lapisan yang menumpuk dan tidak pernah diambil lagi.
          Mendatar, supaya jelas berlawanan dengan tiga bentuk yang menegak. */}
      {variant === 'layers' &&
        [0, 1, 2, 3, 4].map((i) => (
          // Tipis, bukan setebal 30. Batang mendatar sejajar dengan garis
          // sama nilai gradien, jadi seluruh lebarnya menyala pada opasitas
          // yang sama sekaligus. Pada ketebalan yang sama dengan bentuk lain,
          // kartu ini jadi satu satunya yang terbaca sebagai bidang pejal.
          <rect key={i} x={-20} y={232 - i * 44} width={360} height={18} fill={paint} />
        ))}

      {/* Efisiensi kolateral: satu tangga yang menurun. Rasio 150% ke 110%
          memang turun bertingkat mengikuti skor, bukan melandai mulus. */}
      {variant === 'ratio' && <path d={STAIRS} fill={paint} />}
    </svg>
  );
}
