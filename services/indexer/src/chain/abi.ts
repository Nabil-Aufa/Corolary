import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InterfaceAbi } from 'ethers';

// ABI dibaca dari file hasil generate, bukan disalin ke sini. Menyalinnya
// berarti indexer bisa memanggil signature yang sudah tidak ada di kontrak
// tanpa satu pun error saat compile.
const ABI_DIR = resolve(import.meta.dirname, '../../../../packages/shared/src/abis');

export function loadAbi(contract: string): InterfaceAbi {
  const path = resolve(ABI_DIR, `${contract}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as InterfaceAbi;
  } catch {
    throw new Error(
      `ABI ${contract} tidak ada di ${path} — jalankan \`pnpm contracts:abi\` ` +
        '(butuh `forge build` lebih dulu).',
    );
  }
}
