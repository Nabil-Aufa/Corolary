import { CoverageBand } from '@/components/marketing/CoverageBand';
import { Faq } from '@/components/marketing/Faq';
import { FactTrace } from '@/components/marketing/FactTrace';
import { FinalCta } from '@/components/marketing/FinalCta';
import { Hero } from '@/components/marketing/Hero';
import { LimitsRow } from '@/components/marketing/LimitsRow';
import { LiveScoreCard } from '@/components/marketing/LiveScoreCard';
import { Panel } from '@/components/marketing/Panel';
import { PipelineAccordion } from '@/components/marketing/PipelineAccordion';
import { ScoreAnatomy } from '@/components/marketing/ScoreAnatomy';
import { SectionIntro } from '@/components/marketing/SectionIntro';
import { StatMosaic } from '@/components/marketing/StatMosaic';
import { TierTable } from '@/components/marketing/TierTable';
import type { Address } from '@/types';

/**
 * Dompet yang dipamerkan di halaman ini — alamat mainnet NYATA dengan riwayat
 * terbukti. Sama dengan yang dibaca `LiveScoreCard`; disebut di sini juga
 * supaya `ScoreAnatomy` dan penanda baris di `TierTable` bicara tentang dompet
 * yang persis sama. Dua sumber alamat yang bisa menyimpang berarti halaman
 * memamerkan skor satu dompet sambil membedah dompet lain.
 */
const FEATURED = (process.env.NEXT_PUBLIC_FEATURED_ADDRESS ??
  '0x94963B928498bE7f06637C3D57ea1E74D7f73423') as Address;

/**
 * Landing.
 *
 * Susunannya bergantian terang → gelap → terang → gelap. Itu bukan selera:
 * tiap peralihan adalah panel bersudut membulat yang meluncur MENUTUPI bagian
 * sebelumnya, dan pergantian arah kontras itulah yang membuat gulirannya
 * terasa seperti benda, bukan seperti dokumen panjang.
 *
 * Argumen produknya sengaja habis di tiga layar pertama — hero, kartu skor
 * hidup, dan pipeline. Sisanya untuk orang yang benar-benar menggulir.
 */
export default function HomePage() {
  return (
    <main>
      <Hero />
      <LiveScoreCard />

      <section className="mx-auto max-w-[1280px] px-6 pb-8 pt-28 md:px-8 md:pt-36">
        <SectionIntro label="APA INI">
          Setiap angka di halaman ini berasal dari transaksi Ethereum mainnet yang dibuktikan
          secara kriptografis — bukan dari basis data kami.
        </SectionIntro>
        <PipelineAccordion />
      </section>

      <CoverageBand />

      {/* Curtain pertama: gelap menutupi halaman terang. */}
      <Panel tone="dark">
        <FactTrace />
      </Panel>

      {/* Curtain balik: warna halaman menutupi panel gelap. */}
      <Panel tone="page">
        <TierTable highlightTier={4} />
        <ScoreAnatomy address={FEATURED} />
        <StatMosaic />
      </Panel>

      {/* Curtain terakhir — menyatu dengan footer, yang juga bg-panel. */}
      <Panel tone="dark">
        <LimitsRow />
        <Faq />
        <FinalCta />
      </Panel>
    </main>
  );
}
