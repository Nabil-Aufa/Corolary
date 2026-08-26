// Satu file `.env` untuk seluruh repo — backend, indexer, kontrak, dan frontend.
//
// Node membaca `.env` root lewat `--env-file` atau dotenv, tapi dua alat lain
// hanya melihat file env di dalam direktorinya sendiri:
//
//   Next.js  hanya membaca env di dalam direktori app-nya.
//   Foundry  hanya membaca `.env` di root proyek Foundry, yaitu tempat
//            `foundry.toml` berada — BUKAN root repo. Tanpa jembatan ini,
//            `forge script --rpc-url $CREDITCOIN_RPC_URL` mengembang jadi
//            string kosong dan deploy gagal dengan pesan yang menyesatkan.
//
// Tanpa symlink, keduanya memaksa file env kedua yang harus disinkronkan
// manual — sumber bug konfigurasi yang tidak pernah terlihat sampai demo.

import { existsSync, lstatSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

/** Direktori yang butuh salinan env-nya sendiri, dan nama file yang dicari alat di sana. */
const TARGETS = [
  { dir: join(root, 'apps', 'web'), file: '.env.local' },
  { dir: join(root, 'packages', 'contracts'), file: '.env' },
];

if (!existsSync(envPath)) {
  console.warn('[link-env] .env belum ada di root. Jalankan: cp .env.example .env');
  process.exit(0);
}

let failed = false;

for (const { dir, file } of TARGETS) {
  if (!existsSync(dir)) continue; // direktori belum di-scaffold — jalankan lagi nanti

  const linkPath = join(dir, file);
  const target = relative(dir, envPath);

  const stat = lstatSync(linkPath, { throwIfNoEntry: false });
  if (stat) {
    if (stat.isSymbolicLink() && readlinkSync(linkPath) === target) continue; // sudah benar
    if (!stat.isSymbolicLink()) {
      console.error(
        `[link-env] ${linkPath} adalah file biasa, bukan symlink.\n` +
          '  Repo ini memakai SATU .env di root. Pindahkan isinya ke .env root,\n' +
          '  hapus file ini, lalu jalankan ulang perintahnya.',
      );
      failed = true;
      continue;
    }
    unlinkSync(linkPath);
  }

  try {
    symlinkSync(target, linkPath);
  } catch (err) {
    // Windows melarang symlink untuk akun non-admin kecuali Developer Mode
    // menyala, dan pesan bawaannya — "EPERM: operation not permitted" — tidak
    // menyebut itu sama sekali. Tanpa petunjuk ini, gejalanya terbaca seperti
    // masalah izin berkas dan orang akan mencoba menjalankan ulang sebagai
    // administrator, yang memang berhasil tapi bukan perbaikan yang benar.
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.error(
        `[link-env] tidak bisa membuat symlink ${relative(root, linkPath)}.\n` +
          '  Di Windows, symlink butuh Developer Mode:\n' +
          '    Settings > Privacy & security > For developers > Developer Mode = On\n' +
          '  Lalu jalankan ulang perintahnya. Menjalankan terminal sebagai\n' +
          '  administrator juga berhasil, tapi Developer Mode yang benar.',
      );
      failed = true;
      continue;
    }
    throw err;
  }
  console.log(`[link-env] ${relative(root, linkPath)} -> ${target}`);
}

process.exit(failed ? 1 : 0);
