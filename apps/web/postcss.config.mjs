// Tailwind v4 tidak lagi memakai plugin `tailwindcss` + `autoprefixer` di
// PostCSS; keduanya digantikan satu plugin. Konfigurasi tema hidup di CSS
// (src/app/globals.css), bukan di tailwind.config.ts.
const config = {
  plugins: { '@tailwindcss/postcss': {} },
};

export default config;
