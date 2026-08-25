#!/usr/bin/env node
/**
 * Gerbang nol-mock (CLAUDE.md §1).
 *
 * Aturannya: setiap angka yang tampil di UI harus berasal dari transaksi
 * Ethereum mainnet nyata yang dibuktikan lewat Attestcoin, atau dari state
 * kontrak Creditcoin nyata. Skrip ini menegakkan bagian aturan itu yang bisa
 * diperiksa secara mekanis.
 *
 * Filosofinya SEMPIT DAN PASTI, bukan luas dan kira-kira. Pemeriksa yang
 * sering salah tuduh akan diabaikan, dan pemeriksa yang diabaikan lebih buruk
 * daripada tidak ada — ia memberi rasa aman tanpa memberi jaminan. Apa yang
 * TIDAK diperiksa ditulis terbuka di akhir keluaran.
 *
 * Pintu keluar: tulis `// check-no-mocks: allow <alasan>` di baris tepat
 * sebelum baris yang ditandai. Alasannya wajib — pengecualian tanpa alasan
 * adalah pengecualian yang tidak akan pernah ditinjau ulang.
 *
 * Pemakaian:
 *   node scripts/check-no-mocks.mjs              # dev: frontend absen = peringatan
 *   node scripts/check-no-mocks.mjs --require-web  # submit: frontend absen = GAGAL
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const requireWeb = process.argv.includes('--require-web');

const SCAN_ROOTS = ['apps/web/src', 'services/api/src', 'services/indexer/src', 'packages/shared/src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'build', 'out', '.turbo']);
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

/** Satu-satunya file yang boleh memuat fixture (CLAUDE.md §1). */
const ALLOWED_FIXTURE_FILE = 'apps/web/src/lib/dev-fixtures.ts';

/** Bendera yang harus menjaga setiap pemakaian fixture. */
const FIXTURE_FLAG = 'NEXT_PUBLIC_USE_FIXTURES';

const violations = [];
const notes = [];

function fail(file, line, rule, message) {
  violations.push({ file, line, rule, message });
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

/** Baris sebelumnya memuat pintu keluar yang beralasan? */
function isAllowed(lines, index) {
  const prev = lines[index - 1] ?? '';
  const m = prev.match(/check-no-mocks:\s*allow\s+(.+)/);
  return m !== null && m[1].trim().length > 3;
}

// ── Aturan berbasis pola, per baris ───────────────────────────────────
//
// `test` sengaja bukan regex bebas: pola yang terlalu longgar menghasilkan
// tuduhan palsu, dan itu yang membunuh kegunaan gerbang ini.
const LINE_RULES = [
  {
    id: 'fitur-mati',
    // Tombol/label yang menjanjikan sesuatu yang tidak ada. CLAUDE.md §1
    // melarang "Coming soon" secara eksplisit.
    // `belum tersedia` sengaja TIDAK ada di sini. Ia sempat masuk dan langsung
    // menuduh 'blok belum tersedia di RPC' — pesan error yang sepenuhnya sah.
    // Pola yang salah tuduh membuat gerbang ini diabaikan, dan gerbang yang
    // diabaikan lebih buruk daripada tidak ada.
    test: /\b(coming soon|segera hadir|not implemented yet)\b/i,
    message: 'menjanjikan fitur yang tidak berfungsi — aturan nol-mock melarang "Coming soon"',
  },
  {
    id: 'teks-isian',
    test: /\b(lorem ipsum|dolor sit amet)\b/i,
    message: 'teks isian di jalur yang bisa tampil ke pengguna',
  },
  {
    id: 'angka-acak',
    // Angka acak di produk yang seluruh klaimnya "setiap angka bisa dibuktikan".
    // Jitter retry adalah pemakaian yang sah — tandai dengan pintu keluar.
    test: /Math\s*\.\s*random\s*\(/,
    message: 'angka acak — kalau ini jitter/ID, tandai dengan `// check-no-mocks: allow <alasan>`',
  },
  {
    id: 'alamat-karangan',
    // 0x1234…, 0xdead…, 0x0000…0001 dan sejenisnya di kode (bukan dokumen).
    test: /0x(?:1234|dead|beef|cafe|abcd)[0-9a-fA-F]{4,}/i,
    message: 'alamat/hash karangan di kode',
  },
];

// ── Kumpulkan berkas ──────────────────────────────────────────────────
const scanned = [];
const missingRoots = [];
for (const root of SCAN_ROOTS) {
  const abs = join(ROOT, root);
  if (!existsSync(abs)) {
    missingRoots.push(root);
    continue;
  }
  scanned.push(...walk(abs));
}

// ── Aturan per berkas ─────────────────────────────────────────────────
for (const file of scanned) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  const importsFixtures = /from\s+['"][^'"]*dev-fixtures[^'"]*['"]/.test(text);
  const isFixtureFile = rel === ALLOWED_FIXTURE_FILE;

  // 1. Fixture hanya boleh tinggal di satu berkas.
  if (!isFixtureFile && /\bdev-?fixtures?\b/i.test(rel)) {
    fail(rel, 1, 'fixture-liar', `fixture hanya boleh di ${ALLOWED_FIXTURE_FILE}`);
  }

  // 2. Yang memakai fixture wajib menjaganya dengan bendera.
  if (importsFixtures && !text.includes(FIXTURE_FLAG)) {
    fail(rel, 1, 'fixture-tanpa-penjaga',
      `mengimpor dev-fixtures tanpa menyebut ${FIXTURE_FLAG} — fixture bisa lolos ke produksi`);
  }

  // 3. Aturan per baris.
  lines.forEach((line, i) => {
    // Komentar dilewati: penjelasan tentang aturan bukan pelanggaran aturan.
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (code.trim().length === 0) return;
    for (const rule of LINE_RULES) {
      if (rule.test.test(code) && !isAllowed(lines, i)) {
        fail(rel, i + 1, rule.id, rule.message);
      }
    }
  });
}

// ── Bendera fixture harus default mati ────────────────────────────────
const envExample = join(ROOT, '.env.example');
if (existsSync(envExample)) {
  const text = readFileSync(envExample, 'utf8');
  const m = text.match(new RegExp(`^${FIXTURE_FLAG}=(.*)$`, 'm'));
  if (m === null) {
    fail('.env.example', 1, 'bendera-hilang', `${FIXTURE_FLAG} tidak ada — defaultnya jadi tak tentu`);
  } else if (m[1].trim() !== 'false') {
    fail('.env.example', 1, 'bendera-nyala', `${FIXTURE_FLAG} harus false di .env.example`);
  }
}

// `.env` tidak di-commit, tapi ia yang benar-benar dipakai saat demo.
const envLocal = join(ROOT, '.env');
if (existsSync(envLocal)) {
  const text = readFileSync(envLocal, 'utf8');
  const m = text.match(new RegExp(`^${FIXTURE_FLAG}=(.*)$`, 'm'));
  if (m !== null && m[1].trim() === 'true') {
    fail('.env', 1, 'bendera-nyala', `${FIXTURE_FLAG}=true di .env — demo akan menampilkan fixture`);
  }
}

// ── Cakupan yang tidak terperiksa ─────────────────────────────────────
const webMissing = missingRoots.includes('apps/web/src');
if (webMissing) {
  const msg =
    'apps/web/src tidak ada — gerbang ini BELUM memeriksa frontend sama sekali, ' +
    'dan frontend adalah tempat mock paling mungkin muncul';
  if (requireWeb) fail('apps/web/src', 1, 'frontend-absen', msg);
  else notes.push(msg);
}
for (const root of missingRoots.filter((r) => r !== 'apps/web/src')) {
  notes.push(`${root} tidak ada — tidak diperiksa`);
}

// ── Laporan ───────────────────────────────────────────────────────────
console.log(`check:no-mocks — ${scanned.length} berkas diperiksa`);

for (const n of notes) console.log(`  ⚠  ${n}`);

if (violations.length > 0) {
  console.log('');
  for (const v of violations) {
    console.log(`  ✗  ${v.file}:${v.line}  [${v.rule}]`);
    console.log(`     ${v.message}`);
  }
  console.log(`\nGAGAL — ${violations.length} pelanggaran.`);
  process.exit(1);
}

console.log('');
console.log('Yang TIDAK diperiksa skrip ini (harus ditinjau manusia sebelum submit):');
console.log('  - apakah angka di UI benar-benar berasal dari API, bukan dari konstanta;');
console.log('  - apakah grafik memakai deret sungguhan, bukan yang dibentuk agar rapi;');
console.log('  - apakah tombol yang terlihat aktif benar-benar melakukan sesuatu.');
console.log('');
console.log(webMissing ? 'LULUS SEBAGIAN — frontend belum ada untuk diperiksa.' : 'LULUS.');
