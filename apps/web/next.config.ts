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
};

export default nextConfig;
