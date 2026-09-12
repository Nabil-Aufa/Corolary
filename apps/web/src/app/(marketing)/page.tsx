import { FeatureAccordion } from '@/components/landing/FeatureAccordion';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { Outro } from '@/components/landing/Outro';
import { Preview } from '@/components/landing/Preview';
import { ProtocolGrid } from '@/components/landing/ProtocolGrid';
import { RegistryStats } from '@/components/landing/RegistryStats';
import { WhyDifferent } from '@/components/landing/WhyDifferent';
import { Statement } from '@/components/landing/Statement';
import { TopHead } from '@/components/landing/TopHead';
import { Panel } from '@/components/marketing/Panel';
import type { Address } from '@/types';

/**
 * Dompet yang dipamerkan di halaman ini — alamat mainnet NYATA dengan riwayat
 * terbukti, bukan contoh.
 *
 * Dipakai `Preview`, satu-satunya bagian di halaman ini yang menampilkan skor
 * sebuah dompet.
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
 * Karena itu `RegistryStats` di antara `WhyDifferent` dan `LandingFaq` bukan
 * cuma soal urutan isi: tanpa bagian terang di sana, dua panel gelap jadi
 * bersebelahan dan sudut membulat 80px di antara keduanya terbaca sebagai
 * jahitan yang lupa dirapikan, bukan sebagai sesuatu yang datang menutup.
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
      <ProtocolGrid />

      {/* Curtain pertama: panel gelap menutupi warna halaman. */}
      <Panel tone="dark">
        <WhyDifferent />
      </Panel>

      {/* Curtain balik: warna halaman menutupi panel gelap. Tanpa langkah ini
          seluruh sisa halaman tetap gelap dan curtain berikutnya tidak punya
          apa pun untuk ditutupi. */}
      <Panel tone="page">
        <RegistryStats />
      </Panel>

      {/* Curtain terakhir, lalu menyatu dengan Outro dan footer yang juga
          berlatar panel. */}
      <Panel tone="dark">
        <LandingFaq />
      </Panel>

      <Outro />
    </main>
  );
}
