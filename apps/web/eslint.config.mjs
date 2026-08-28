// eslint-config-next 16 mengekspor flat config sebagai ARRAY, bukan fungsi.
// Memanggilnya (`...next()`) gagal dengan "next is not a function" — pesan yang
// menyesatkan karena terlihat seperti paketnya rusak, padahal bentuk ekspornya
// yang berbeda dari config lama.
import next from 'eslint-config-next';

const config = [...next, { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] }];

export default config;
