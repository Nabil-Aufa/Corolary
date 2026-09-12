import { GradientArt, type ArtVariant } from '@/components/marketing/GradientArt';
import { cn } from '@/lib/utils';

interface Stage {
  title: string;
  body: string;
  art: ArtVariant;
  /** Kartu terang memutus deretan gelap. Lihat catatan `tone` di bawah. */
  light?: boolean;
}

/**
 * Lima tahap pipeline, satu kartu masing-masing.
 *
 * Isinya bukan daftar fitur melainkan urutan sebab-akibat, dan itu yang
 * membuat bentuk tumpukan ini tepat: kartu berikutnya menutupi yang sebelumnya
 * karena tahap berikutnya memang menggantikan tahap sebelumnya.
 */
const STAGES: Stage[] = [
  {
    title: 'Real mainnet activity',
    body: 'A watcher follows Aave V3, Morpho Blue, Compound and SparkLend on Ethereum mainnet. Nothing is simulated and nothing is seeded — the only input is a transaction that actually settled.',
    art: 'grid',
  },
  {
    title: 'Attestation',
    body: 'Attestcoin attestors reach consensus on the block that contains the transaction. That takes roughly eight minutes, and until it lands there is nothing to prove.',
    art: 'arcs',
  },
  {
    title: 'Eager proving',
    body: 'A proof costs ten times less inside the first 24 hours, so events are proven while they are fresh and batched up to ten at a time. Nothing is ever proven on demand.',
    art: 'rays',
  },
  {
    title: 'Permanent facts',
    body: 'FactRegistry verifies the proof against the Block Prover precompile, checks the source transaction actually succeeded, confirms the emitting contract, and stores the fact forever.',
    art: 'chevron',
  },
  {
    title: 'Collateral efficiency',
    body: 'CreditGraph turns those facts into a score from 0 to 1000, and the market prices required collateral against it — 150% for an unproven wallet, 110% at the top tier.',
    art: 'grid',
    light: true,
  },
];

/**
 * Tumpukan kartu sticky.
 *
 * Mekanismenya murni CSS: tiap kartu `sticky` dengan `top` yang bertambah
 * sedikit demi sedikit, jadi kartu ke-n berhenti 18px lebih rendah daripada
 * kartu ke-(n-1) dan sisa 18px itulah yang terlihat sebagai tepi kartu di
 * bawahnya. Versi berbasis JavaScript bisa lebih halus, tapi ia berhenti
 * bekerja persis saat paling dibutuhkan — saat scriptnya gagal dimuat — dan
 * yang tersisa adalah lima kartu yang bertumpuk di satu titik.
 *
 * Dua hal yang wajib ada dan mudah terlewat:
 *
 * 1. Induknya TIDAK boleh punya `overflow` selain `visible`. Satu `overflow-x:
 *    hidden` di mana pun di atas rantai ini mematikan `sticky` sepenuhnya, dan
 *    gejalanya adalah kartu yang mengalir biasa tanpa satu pun error.
 * 2. Tiap kartu butuh latar SOLID. Kartu tembus pandang yang bertumpuk membuat
 *    teks lima lapis saling menembus.
 *
 * `tone`: empat kartu gelap lalu satu terang. Kartu terakhir memutus deretan
 * karena ia satu-satunya yang bicara tentang hasil, bukan tentang proses — dan
 * pergantian itu juga yang menyambungkan tumpukan ini ke bagian berikutnya
 * yang berlatar halaman.
 */
export function FeatureStack() {
  return (
    <section id="pipeline" className="mkt-container pb-[clamp(80px,10vw,160px)] pt-[clamp(48px,6vw,96px)]">
      <ol className="[&>li]:list-none">
        {STAGES.map((s, i) => (
          <li
            key={s.title}
            className="sticky"
            // `top` bertambah per kartu, dan 96px pertama memberi ruang untuk
            // navbar yang menempel. Inline karena nilainya turunan dari indeks;
            // menulis lima kelas Tailwind terpisah berarti lima tempat untuk
            // lupa saat tahapnya bertambah.
            style={{ top: `calc(96px + ${i * 18}px)` }}
          >
            <article
              className={cn(
                'relative mb-5 flex min-h-[clamp(300px,34vw,374px)] flex-col overflow-hidden rounded-card p-[clamp(24px,3.4vw,48px)]',
                s.light ? 'bg-card-break text-card-break-ink' : 'bg-panel text-panel-ink-700',
              )}
            >
              {/* Art diletakkan di kanan dan dipotong oleh kartu. Ia dekoratif
                  penuh: tidak membawa satu pun angka, jadi tidak ada yang
                  hilang kalau seseorang tidak pernah melihatnya. */}
              <div
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-y-0 right-0 w-[62%] max-w-[560px]',
                  s.light ? 'text-card-break-ink/60' : 'text-panel-ink-900',
                )}
              >
                <GradientArt variant={s.art} />
              </div>

              <header className="relative flex items-start justify-between gap-6">
                <h3
                  className={cn(
                    'text-mkt-h3',
                    s.light ? 'text-card-break-ink' : 'text-panel-ink-900',
                  )}
                >
                  {s.title}
                </h3>
                <span
                  className={cn(
                    'num shrink-0 text-mkt-h3',
                    s.light ? 'text-card-break-ink/45' : 'text-panel-ink-500',
                  )}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </header>

              <p
                className={cn(
                  'relative mt-8 max-w-[46ch] text-body',
                  s.light ? 'text-card-break-ink/75' : 'text-panel-ink-700',
                )}
              >
                {s.body}
              </p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
