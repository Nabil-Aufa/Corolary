'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Batas error untuk SELURUH aplikasi.
 *
 * Sebelum berkas ini ada, satu exception saat render berarti halaman kosong di
 * produksi — tanpa pesan, tanpa jalan kembali, dan tanpa jejak apa pun untuk
 * ditanyakan. Overlay merah yang ramah itu hanya ada di dev.
 *
 * Satu boundary di root, bukan satu per route: error boundary React menggelembung
 * ke atas, jadi yang di sini menangkap keempat halaman data sekaligus. Halaman
 * error yang bergantung pada header, wallet, dan query client justru menambah
 * hal yang bisa ikut gagal tepat ketika sesuatu sudah gagal.
 */
export default function GlobalBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ke konsol, bukan ke layar. `error.message` bisa memuat detail internal,
    // dan `digest` adalah satu-satunya hal yang berguna untuk dicocokkan
    // dengan log server.
    console.error('[corolary] render error', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <AlertCircle size={28} strokeWidth={1.5} className="text-danger" />
      <p className="mt-5 text-h2 font-semibold tracking-tight text-ink-900">
        Something broke while rendering this page
      </p>
      <p className="mt-2 text-body text-ink-500">
        Nothing on-chain was affected. This is the interface failing, not the registry, and
        retrying re-renders the page without reloading the app.
      </p>

      {error.digest !== undefined && (
        <p className="num mt-4 text-micro text-ink-400">digest {error.digest}</p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCw size={15} strokeWidth={1.75} />
          Try again
        </Button>
        <Link href="/proofs">
          <Button variant="secondary">Browse proofs</Button>
        </Link>
      </div>
    </main>
  );
}
