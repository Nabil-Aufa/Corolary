import { FeatureAccordion } from '@/components/landing/FeatureAccordion';
import { HeroScroll } from '@/components/landing/hero/HeroScroll';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { Outro } from '@/components/landing/Outro';
import { ProtocolGrid } from '@/components/landing/ProtocolGrid';
import { RegistryStats } from '@/components/landing/RegistryStats';
import { WhyDifferent } from '@/components/landing/WhyDifferent';
import { Panel } from '@/components/marketing/Panel';

/**
 * Landing.
 *
 * Bagian-bagiannya disusun terang → gelap → terang → gelap. Pergantian itu
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
 * Tidak ada bagian "What this is" di sini. Judul itu dan paragrafnya sekarang
 * adalah dua plane BERTEXTURE di dalam scene hero (hero/coin-scene.ts), dibuka
 * oleh kamera yang mendekat lalu turun, dengan kalimat yang sama persis.
 * Menyisakan versi DOM-nya berarti pembaca menerima kalimat itu dua kali
 * berturut-turut: sekali sebagai adegan, sekali sebagai teks datar. Salinan
 * untuk pembaca layar tetap ada, `sr-only`, di dalam HeroScroll.
 *
 * Tidak ada dompet yang dipamerkan di sini lagi, jadi tidak ada `FEATURED`.
 * `Preview` adalah satu-satunya bagian yang pernah menampilkan skor satu
 * dompet, dan hero menggantikannya. Angka yang tersisa di halaman ini semuanya
 * milik registry, bukan milik satu alamat.
 *
 * Argumen produknya habis di tiga layar pertama: kalimat pembuka, frame yang
 * menembus pasar pinjaman, dan pipeline. Sisanya untuk orang yang benar-benar
 * menggulir.
 */
export default function HomePage() {
  return (
    <main>
      <HeroScroll />

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
