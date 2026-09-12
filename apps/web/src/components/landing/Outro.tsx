'use client';

import { useId, useState, type FormEvent } from 'react';
import { isAddress } from 'viem';
import { ArrowRight } from 'lucide-react';
import { GradientArt } from '@/components/marketing/GradientArt';
import { Reveal } from '@/components/marketing/Reveal';
import { appHref } from '@/lib/hosts';

/**
 * Penutup halaman: satu kalimat besar rata tengah, lalu satu kolom alamat.
 *
 * Di situs referensi baris kedua judulnya adalah tautan bergaris bawah ke
 * halaman kontak. Di sini baris itu diganti kolom input, dan alasannya bukan
 * selera: agensi menjual percakapan, jadi tautan kontak memang tujuan
 * akhirnya. Produk ini menjual sesuatu yang bisa diperiksa sendiri, jadi
 * tujuan akhir yang sepadan adalah memeriksa — bukan menghubungi kami.
 *
 * Validasinya di klien dan sengaja hanya memeriksa BENTUK alamat. Apakah
 * dompetnya punya riwayat atau tidak dijawab oleh halaman skornya, yang sudah
 * punya cabang jujur untuk "belum ada yang terbukti". Menebak-nebak di sini
 * berarti dua tempat yang bisa berbeda jawabannya.
 */
export function Outro() {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = value.trim();
    if (!isAddress(candidate)) {
      setError('That is not a valid Ethereum address — 0x followed by 40 hex characters.');
      return;
    }
    setError(null);
    // A full navigation, not router.push: the score page lives on the app host.
    window.location.assign(appHref(`/score/${candidate}`));
  }

  return (
    <section
      // Penanda nada yang sama dengan `Panel` — bagian ini gelap tapi bukan
      // `Panel`. Saat ini tidak ada yang membacanya (lihat Panel.tsx).
      data-tone="dark"
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
            Have a wallet
            <br />
            with history?
          </h2>
        </Reveal>

        <Reveal delay={0.08} distance={20}>
          <form onSubmit={handleSubmit} className="mx-auto mt-12 max-w-[560px]">
            <label htmlFor={inputId} className="sr-only">
              Ethereum address
            </label>

            {/* Pil, bukan kotak. Bentuk ini yang dipakai CTA di seluruh
                halaman, dan input yang bentuknya berbeda dari tombolnya
                terbaca sebagai dua komponen dari dua situs. */}
            <div className="flex items-center gap-2 rounded-full border border-panel-border bg-panel-raised p-2 pl-6 focus-within:border-panel-ink-500">
              <input
                id={inputId}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error !== null) setError(null);
                }}
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={error !== null}
                aria-describedby={error === null ? undefined : errorId}
                className="num min-w-0 flex-1 bg-transparent text-small text-panel-ink-900 outline-none placeholder:text-panel-ink-500"
              />
              <button
                type="submit"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-panel-ink-900 px-6 text-small font-medium text-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Check score
                <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            {/* `role="alert"` supaya pembaca layar mengumumkannya tanpa harus
                memindahkan fokus keluar dari input yang baru saja diisi. */}
            {error !== null && (
              <p id={errorId} role="alert" className="mt-3 text-small text-danger">
                {error}
              </p>
            )}
          </form>
        </Reveal>
      </div>
    </section>
  );
}
