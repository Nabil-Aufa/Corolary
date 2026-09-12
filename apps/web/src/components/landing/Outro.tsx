import { GradientArt } from '@/components/marketing/GradientArt';
import { Reveal } from '@/components/marketing/Reveal';
import { appHref } from '@/lib/hosts';

/**
 * Penutup halaman: satu kalimat besar rata tengah, baris keduanya tautan.
 *
 * Sebelumnya baris kedua itu kolom input alamat. Menggantinya dengan tautan
 * TIDAK menghilangkan apa pun: halaman `/score` punya kolom input yang sama
 * dan validasi yang sama, jadi yang dibuang cuma salinan keduanya. Dua kolom
 * input untuk satu pekerjaan adalah dua tempat yang bisa berbeda jawabannya —
 * dan yang satu di sini tidak pernah bisa menjawab "dompet ini belum punya
 * riwayat", karena jawaban itu baru ada setelah halaman skornya dimuat.
 */
export function Outro() {
  return (
    <section
      // Penanda nada yang sama dengan `Panel` — bagian ini gelap tapi bukan
      // `Panel`. Saat ini tidak ada yang membacanya (lihat Panel.tsx).
      data-tone="dark"
      data-nav="dark"
      className="relative isolate overflow-hidden bg-panel pb-[clamp(64px,8vw,120px)] pt-[clamp(80px,10vw,160px)] text-panel-ink-700"
    >
      {/* Art memenuhi seluruh lebar, bukan hanya kolom isi. Dibatasi ke kolom,
          ujung kiri-kanannya berhenti mendadak di tengah panel gelap dan
          terbaca sebagai kotak yang lupa dihapus. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 text-panel-ink-900 opacity-50"
      >
        <GradientArt variant="chevron" />
      </div>

      <div className="mkt-container text-center">
        <Reveal distance={32}>
          <h2 className="font-display text-mkt-outro text-panel-ink-900">
            Have a wallet with history?
          </h2>
        </Reveal>

        <Reveal delay={0.08} distance={20}>
          {/* Gaya garis bawah dan animasinya ada di `.outro-link`
              (globals.css), termasuk alasan ia tidak ditulis sebagai utility. */}
          <p className="mt-2">
            <a
              href={appHref('/score')}
              className="outro-link font-display text-mkt-outro text-panel-ink-700 transition-colors hover:text-panel-ink-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              Check its score
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
