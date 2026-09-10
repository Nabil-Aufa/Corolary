"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { GradientArt } from "./GradientArt";

/** CTA penutup: satu input alamat, satu tombol, langsung ke halaman skornya. */
export function FinalCta() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = value.trim();
    if (!isAddress(candidate)) {
      setError(
        "Itu bukan alamat Ethereum yang sah (0x + 40 karakter heksadesimal).",
      );
      return;
    }
    router.push(`/score/${candidate}`);
  }

  return (
    // Pembungkus art SENGAJA di luar `max-w`: dibatasi lebar isi, ujung
    // kiri-kanannya berhenti mendadak di tengah panel dan terbaca sebagai
    // kotak yang lupa dihapus, bukan sebagai latar. `mask-image` menuntaskannya
    // — art memudar sebelum menyentuh tepi mana pun.
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 text-panel-ink-500 opacity-40 [mask-image:linear-gradient(to_top,black,transparent_85%)]"
      >
        <GradientArt variant="chevron" />
      </div>
      <div className="mx-auto max-w-[1280px] px-6 py-32 text-center md:px-8 md:py-40">
        <h2 className="font-display text-mkt-display text-panel-ink-900">
          <span className="block">Punya dompet Ethereum?</span>
          <span className="mt-2 inline-block border-b border-panel-border pb-2">
            Lihat riwayatnya.
          </span>
        </h2>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-10 max-w-xl"
          noValidate
        >
          <div className="flex items-center gap-2 rounded-full border border-panel-border bg-panel-raised p-2">
            <label htmlFor="final-cta-address" className="sr-only">
              Alamat dompet Ethereum
            </label>
            <input
              id="final-cta-address"
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                // Bersihkan pesan error begitu pengguna mengetik lagi — pesan
                // lama yang bertahan setelah input berubah terasa seperti bug.
                if (error !== null) setError(null);
              }}
              aria-describedby="final-cta-error"
              className="h-11 min-w-0 flex-1 bg-transparent px-4 text-body text-panel-ink-900 placeholder:text-panel-ink-500 focus:outline-none"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-full bg-accent px-6 text-body font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Cek
            </button>
          </div>
          <p
            id="final-cta-error"
            role="alert"
            className="mt-3 min-h-[1lh] text-small text-danger"
          >
            {error}
          </p>
        </form>

        <p className="mx-auto mt-2 max-w-xl text-small text-panel-ink-500">
          Dompet tanpa riwayat terbukti akan berskor nol dan tetap di 150% — itu
          bukan kesalahan, itu memang artinya.
        </p>
      </div>
    </div>
  );
}
