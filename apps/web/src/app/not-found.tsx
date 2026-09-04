import Link from 'next/link';
import { CorolaryLogo } from '@/components/brand/CorolaryLogo';
import { Button } from '@/components/ui/button';

/**
 * 404 untuk seluruh aplikasi.
 *
 * Tidak memakai `AppShell`: `not-found.tsx` di root hanya dibungkus
 * `app/layout.tsx`, jadi header dan navigasi milik route group `(app)` tidak
 * tersedia di sini. Menariknya masuk berarti satu komponen klien lagi yang
 * harus berhasil di halaman yang justru muncul ketika sesuatu tidak beres.
 *
 * Tautan di bawah menggantikannya, dan sengaja menunjuk tiga tempat yang
 * benar-benar menjawab pertanyaan pengunjung yang tersesat.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <CorolaryLogo className="h-8 w-8 text-ink-900" />
      <p className="num mt-6 text-display font-semibold leading-none text-ink-900">404</p>
      <p className="mt-3 text-h3 font-medium text-ink-900">This page does not exist</p>
      <p className="mt-2 text-body text-ink-500">
        A fact id or an address in the URL may be malformed, or the page may simply never have
        existed.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link href="/proofs">
          <Button>Browse proofs</Button>
        </Link>
        <Link href="/score">
          <Button variant="secondary">Look up a score</Button>
        </Link>
        <Link href="/">
          <Button variant="ghost">Home</Button>
        </Link>
      </div>
    </main>
  );
}
