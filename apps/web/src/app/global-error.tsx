'use client';

/**
 * Jaring terakhir: error yang terjadi di `app/layout.tsx` itu sendiri.
 *
 * `app/error.tsx` dirender DI DALAM root layout, jadi ia tidak bisa menangkap
 * kegagalan layout itu — font, ThemeProvider, WagmiProvider, QueryClient.
 * Ketika itu yang pecah, satu-satunya yang tersisa adalah berkas ini, dan ia
 * harus menyediakan `<html>` dan `<body>`-nya sendiri.
 *
 * Sengaja tanpa token tema, tanpa komponen, tanpa font: semuanya hidup di
 * layout yang baru saja gagal. Gaya ditulis inline supaya halaman ini tidak
 * bergantung pada apa pun kecuali browser.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '24px',
          textAlign: 'center',
          font: '16px/1.5 system-ui, sans-serif',
          color: '#0b0e14',
          background: '#f6f7fa',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Corolary failed to start</h1>
        <p style={{ margin: 0, color: '#5c6577', maxWidth: '38ch' }}>
          The application shell itself did not load. Nothing on-chain was affected.
        </p>
        {error.digest !== undefined && (
          <p style={{ margin: 0, fontSize: '12px', color: '#98a2b3' }}>digest {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '8px',
            padding: '10px 16px',
            border: '1px solid #c7ccd6',
            borderRadius: '8px',
            background: '#ffffff',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
