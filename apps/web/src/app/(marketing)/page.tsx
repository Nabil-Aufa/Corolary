import { FeatureAccordion } from '@/components/landing/FeatureAccordion';
import { Insights } from '@/components/landing/Insights';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { Outro } from '@/components/landing/Outro';
import { Preview } from '@/components/landing/Preview';
import { ProofReveal } from '@/components/landing/ProofReveal';
import { ProtocolReel } from '@/components/landing/ProtocolReel';
import { ScoreShowcase } from '@/components/landing/ScoreShowcase';
import { Statement } from '@/components/landing/Statement';
import { TopHead } from '@/components/landing/TopHead';
import { WhyCorolary } from '@/components/landing/WhyCorolary';
import { Panel } from '@/components/marketing/Panel';
import type { Address } from '@/types';

/**
 * Dompet yang dipamerkan di halaman ini — alamat mainnet NYATA dengan riwayat
 * terbukti, bukan contoh.
 *
 * Disebut SEKALI di sini lalu dioper ke `Preview` dan `ScoreShowcase`. Dua
 * sumber alamat yang bisa menyimpang berarti halaman memamerkan skor satu
 * dompet di layar pertama sambil membedah dompet lain di tengah halaman, dan
 * tidak ada satu pun yang akan terlihat salah.
 */
const FEATURED = (process.env.NEXT_PUBLIC_FEATURED_ADDRESS ??
  '0x94963B928498bE7f06637C3D57ea1E74D7f73423') as Address;

/**
 * Landing.
 *
 * Sebelas bagian, disusun terang → gelap → terang → gelap. Pergantian itu
 * bukan selera: tiap peralihan ke gelap adalah panel bersudut membulat 80px
 * yang meluncur MENUTUPI bagian sebelumnya, dan efek "menutupi" itu hanya
 * terbaca kalau warnanya benar-benar berbalik. Dua panel gelap berurutan tanpa
 * bagian terang di antaranya hanya terlihat seperti situs yang berubah gelap.
 *
 * Karena itu `Insights` dan `LandingFaq` — dua bagian gelap yang bersebelahan —
 * berbagi SATU `Panel`. Membungkus keduanya sendiri-sendiri akan menggambar
 * sudut membulat kedua di tengah bidang hitam, yang terbaca sebagai jahitan
 * yang lupa dirapikan.
 *
 * Argumen produknya habis di tiga layar pertama: kalimat pembuka, skor hidup
 * yang bisa diklik, dan pipeline. Sisanya untuk orang yang benar-benar
 * menggulir.
 */
export default function HomePage() {
  return (
    <main>
      <TopHead />
      <Preview address={FEATURED} />

      <div className="py-[clamp(48px,6vw,96px)]">
        <Statement label="What this is">
          Every number on this page comes from an Ethereum mainnet transaction proven
          cryptographically — not from our database.
        </Statement>
      </div>

      <FeatureAccordion />
      <ProtocolReel />

      {/* Curtain pertama: gelap menutupi halaman terang. */}
      <Panel tone="dark">
        <ProofReveal />
      </Panel>

      {/* Curtain balik: warna halaman menutupi panel gelap. Tanpa langkah ini
          seluruh sisa halaman tetap gelap dan curtain berikutnya tidak punya
          apa pun untuk ditutupi. */}
      <Panel tone="page">
        <ScoreShowcase address={FEATURED} />
        <WhyCorolary />
      </Panel>

      {/* Curtain terakhir — dua bagian dalam satu panel, lalu menyatu dengan
          Outro dan footer yang juga berlatar panel. */}
      <Panel tone="dark">
        <Insights />
        <LandingFaq />
      </Panel>

      <Outro />
    </main>
  );
}
