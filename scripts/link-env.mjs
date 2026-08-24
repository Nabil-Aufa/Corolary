// Satu file `.env` untuk seluruh repo — backend, indexer, kontrak, dan frontend.
//
// Node membaca `.env` root lewat `--env-file`, Foundry lewat shell, tapi Next.js
// hanya membaca file env di dalam direktori app-nya. Tanpa jembatan ini, Dev B
// terpaksa memelihara `apps/web/.env.local` kedua — dan dua file env yang harus
// disinkronkan manual adalah sumber bug konfigurasi yang tidak pernah terlihat
// sampai demo. Symlink membuatnya tetap satu file fisik.

import { existsSync, lstatSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const webDir = join(root, 'apps', 'web');
const linkPath = join(webDir, '.env.local');

if (!existsSync(webDir)) {
  // apps/web belum ada — tidak apa-apa, jalankan lagi setelah Dev B men-scaffold.
  process.exit(0);
}

if (!existsSync(envPath)) {
  console.warn('[link-env] .env belum ada di root. Jalankan: cp .env.example .env');
  process.exit(0);
}

const target = relative(webDir, envPath); // ../../.env

if (existsSync(linkPath) || lstatSync(linkPath, { throwIfNoEntry: false })) {
  const stat = lstatSync(linkPath);
  if (stat.isSymbolicLink() && readlinkSync(linkPath) === target) {
    process.exit(0); // sudah benar
  }
  if (!stat.isSymbolicLink()) {
    console.error(
      `[link-env] ${linkPath} adalah file biasa, bukan symlink.\n` +
        '  Repo ini memakai SATU .env di root. Pindahkan isinya ke .env root,\n' +
        '  hapus file ini, lalu jalankan ulang perintahnya.',
    );
    process.exit(1);
  }
  unlinkSync(linkPath);
}

symlinkSync(target, linkPath);
console.log(`[link-env] apps/web/.env.local -> ${target}`);
