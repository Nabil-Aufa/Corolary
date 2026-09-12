import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next 16 menulis AGENTS.md + CLAUDE.md sendiri ke apps/web. Repo ini sudah
  // punya CLAUDE.md di root sebagai instruksi tunggal; file kedua yang
  // di-generate otomatis akan bersaing dengannya tanpa ada yang memutuskan.
  agentRules: false,
  typedRoutes: true,
  // @corolary/shared dipublikasikan sebagai ESM ber-`dist`. Transpile agar
  // Next tidak memperlakukannya sebagai paket eksternal yang sudah dibundel.
  transpilePackages: ['@corolary/shared'],
  // The app is served on `app.localhost` in development (see src/lib/hosts.ts).
  // Next blocks dev assets requested from any host other than the one it
  // started on, and the symptom is not an error page: the app renders but
  // hot reload silently stops working on that host.
  allowedDevOrigins: ['app.localhost'],
};

export default nextConfig;
