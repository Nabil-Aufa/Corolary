# Deck

`corolary-deck.html` adalah sumbernya. PDF-nya disajikan dari domain produk,
bukan dari repo, supaya tautan di form submission menunjuk ke `corolary.vercel.app`
dan bukan ke halaman blob GitHub.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=20000 \
  --print-to-pdf=../../apps/web/public/deck.pdf \
  "file://$PWD/corolary-deck.html"
```

Ukuran halaman 20in x 11.25in, yaitu 1920x1080 pada 96dpi, 16 halaman.

Dua aturan yang dipegang berkas ini dan gampang hilang saat menyunting:

- **Tanpa em dash, titik dua, dan titik koma** di seluruh teks yang tampil.
  Periksa dengan memindai teks HTML setelah membuang tag, bukan dengan membaca
  PDF-nya. Data font yang tertanam di PDF memuat karakter itu sebagai bytecode
  hinting, jadi memindai PDF akan selalu memberi positif palsu.
- **Slide 8 tidak boleh dibuang** saat memangkas jumlah slide. Itu pengungkapan
  token testnet, dan ia ada di checklist panitia (`docs/hackathon.md`).

Tiap slide tingginya tetap 1080px. Setelah menyunting, periksa tidak ada yang
meluber dan tidak ada yang menyisakan rongga di bawah:

```js
[...document.querySelectorAll('section.s')].map((s,i)=>({
  i: i+1,
  overflow: s.scrollHeight - s.clientHeight,
  slack: s.getBoundingClientRect().bottom - [...s.children].filter(c=>!c.classList.contains('num')).pop().getBoundingClientRect().bottom,
}))
```

`overflow` harus 0 dan `slack` harus mendekati 104, yaitu padding bawahnya.
