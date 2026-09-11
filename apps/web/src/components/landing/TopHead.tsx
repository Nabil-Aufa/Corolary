import { Reveal } from '@/components/marketing/Reveal';

/**
 * Kepala halaman: satu kalimat besar rata tengah, satu kalimat kecil di
 * bawahnya, lalu berhenti.
 *
 * Tidak setinggi satu layar. Itu keputusan yang paling mudah salah ditiru dari
 * referensinya: hero-nya hanya ~590px, jadi tepi atas bagian berikutnya sudah
 * terlihat tanpa menggulir sedikit pun. Hero setinggi layar penuh memaksa
 * orang menggulir "membuta" — mereka tidak tahu ada apa di bawah, dan sebagian
 * tidak menggulir sama sekali.
 *
 * Tanpa tombol. Referensinya juga tidak punya, dan alasannya sama: satu-satunya
 * aksi ada di navbar yang menempel di atas sepanjang halaman, jadi tombol kedua
 * di sini hanya membagi perhatian dari kalimat yang sedang dibaca.
 */
export function TopHead() {
  return (
    <section className="pb-6 pt-[clamp(64px,11vw,150px)]">
      <div className="mkt-container text-center">
        <Reveal distance={32}>
          <h1 className="font-display text-mkt-display font-medium text-ink-900">
            Reputation that
            <br />
            follows from proof
          </h1>
        </Reveal>

        <Reveal delay={0.08} distance={20}>
          {/* Empat protokol disebut namanya. Nama protokol adalah satu-satunya
              bagian kalimat ini yang bisa diperiksa sendiri oleh pembaca, dan
              itu yang membedakannya dari janji pemasaran. */}
          <p className="mx-auto mt-8 max-w-[46ch] text-mkt-lead text-ink-700">
            Lending history from Aave, Morpho, Compound and Spark on Ethereum mainnet, proven
            cryptographically and used to cut required collateral from 150% to 110%.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
