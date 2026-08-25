// Mengekspor ABI dari artifact Foundry ke packages/shared/src/abis.
//
// Frontend (viem) dan indexer (ethers) sama-sama membaca dari sini, jadi satu
// sumber kebenaran: kalau kontrak berubah, `pnpm contracts:abi` yang menyamakan
// keduanya. Menyalin ABI manual ke dua tempat adalah cara paling mudah membuat
// frontend memanggil signature yang sudah tidak ada.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../out');
const DEST = resolve(HERE, '../../shared/src/abis');

// Hanya kontrak yang benar-benar dipanggil dari luar. Mengekspor semuanya akan
// menyeret library dan kontrak tes ke dalam bundle frontend.
const CONTRACTS = [
  'FactRegistry',
  'CreditGraph',
  'PriceRegistry',
  'EfficiencyMarket',
  'AaveV3Adapter',
  'SparkAdapter',
  'MorphoBlueAdapter',
  'CompoundV3Adapter',
  'FaucetToken',
];

if (!existsSync(OUT_DIR)) {
  console.error(`out/ tidak ada di ${OUT_DIR} — jalankan \`forge build\` dulu.`);
  process.exit(1);
}

await rm(DEST, { recursive: true, force: true });
await mkdir(DEST, { recursive: true });

const missing = [];
const exported = [];

for (const name of CONTRACTS) {
  const artifact = join(OUT_DIR, `${name}.sol`, `${name}.json`);
  if (!existsSync(artifact)) {
    missing.push(name);
    continue;
  }
  const { abi } = JSON.parse(await readFile(artifact, 'utf8'));
  if (!Array.isArray(abi)) {
    missing.push(name);
    continue;
  }
  await writeFile(join(DEST, `${name}.json`), `${JSON.stringify(abi, null, 2)}\n`);
  exported.push(name);
}

if (missing.length > 0) {
  console.error(`artifact tidak ditemukan untuk: ${missing.join(', ')}`);
  console.error('jalankan `forge build` lalu ulangi.');
  process.exit(1);
}

// `as const` supaya viem bisa menurunkan tipe argumen dari ABI. Tanpa itu
// frontend kehilangan seluruh type-safety pemanggilan kontrak.
const index = [
  '// DIHASILKAN OTOMATIS oleh packages/contracts/scripts/export-abi.mjs',
  '// Jangan diedit manual — jalankan `pnpm contracts:abi`.',
  '',
  ...exported.map((n) => `import ${n} from './${n}.json' with { type: 'json' };`),
  '',
  ...exported.map((n) => `export const ${n}Abi = ${n} as const;`),
  '',
].join('\n');

await writeFile(join(DEST, 'index.ts'), index);
console.log(`ABI diekspor (${exported.length}): ${exported.join(', ')}`);
