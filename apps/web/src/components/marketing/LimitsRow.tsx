import { SectionIntro } from './SectionIntro';
import { Reveal } from './Reveal';

interface Limit {
  title: string;
  body: string;
}

// Ditulis lebih dulu oleh kami, bukan ditemukan lebih dulu oleh orang lain.
// Ketiganya batas nyata pada produk ini, dan mengakuinya secara terbuka
// memperkuat setiap klaim lain di halaman: kami tahu persis apa yang belum
// dibuktikan, bukan cuma apa yang sudah.
const LIMITS: Limit[] = [
  {
    title: 'Searah saja',
    body: 'Attestcoin Writability — jalur tulis balik dari Creditcoin ke Ethereum — belum rilis, masih audit. Corolary membaca Ethereum; ia tidak pernah menulis ke sana.',
  },
  {
    title: 'Tetap over-collateralized',
    body: 'Skor menurunkan kolateral dari 150% ke 110%, bukan ke nol. Tidak ada identitas dan tidak ada jalur hukum di balik dompet — 110% adalah lantai, dan itulah yang membuat protokol tetap solven.',
  },
  {
    title: 'Satu field tidak terbukti',
    body: 'Receipt Ethereum tidak memuat timestamp, jadi observedAt adalah satu-satunya field fakta yang tidak terbukti kriptografis. Untuk urutan, durasi, dan kesegaran, sistem memakai tinggi blok — bukan observedAt.',
  },
];

/**
 * Baris tiga batas yang kami akui secara terbuka.
 *
 * Sudah berada di dalam panel gelap saat dirender, karena itu memakai
 * `onPanel` pada SectionIntro dan `text-panel-ink-*` di seluruh isi.
 */
export function LimitsRow() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-24 md:px-8 md:py-32">
      <SectionIntro label="BATAS YANG KAMI AKUI" onPanel>
        Kami menyebut batas-batas ini lebih dulu supaya tidak perlu dicari sendiri.
      </SectionIntro>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {LIMITS.map((limit, i) => (
          <Reveal key={limit.title} delay={i * 0.08}>
            <div className="rounded-[var(--radius-card)] bg-panel-raised p-8">
              <h3 className="font-display text-mkt-statement text-panel-ink-900">{limit.title}</h3>
              <p className="mt-3 text-body text-panel-ink-700">{limit.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
