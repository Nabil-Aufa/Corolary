# Naskah & Panduan Rekaman Video Demo

Untuk submission BUIDL CTC 2026 Fall, field **Prototype Demo Video URL**.

Target durasi **3 menit**. Juri menonton puluhan video; menit pertama menentukan
apakah sisanya ditonton. Struktur di bawah menaruh bukti sedini mungkin dan
menunda semua penjelasan arsitektur sampai penonton sudah melihat angka nyata.

Dokumen ini punya tiga bagian:
1. Pra-rekam: apa yang harus hidup dan diverifikasi sebelum kamera menyala.
2. Naskah per-scene: narasi verbatim plus apa yang terlihat di layar.
3. Panduan rekaman: layar mana saja yang direkam, dalam urutan take apa.

Aturan yang tidak bisa ditawar: **pengungkapan token testnet diucapkan**, tepat
saat `tUSDC` pertama kali muncul di layar (`docs/business.md` §13.1). Bukan di
akhir, bukan hanya teks di deskripsi video.

---

## 1. Pra-rekam

### 1.1 Angka berubah, naskah tidak boleh ketinggalan

Semua angka di naskah ini dibaca live **2026-09-12**. Registry terus tumbuh, dan
skor dompet terbukti bergerak beberapa poin saat fakta baru masuk. **Baca ulang tepat
sebelum merekam**, lalu ucapkan angka yang benar-benar ada di layar. Kalau ragu,
pakai bentuk yang tahan drift: "di atas 800", "lebih dari 67 ribu fakta".

```bash
B=https://corolary-production.up.railway.app
curl -s $B/v1/indexer/status | jq '{totalFacts:.data.totalFacts, wallets:.data.distinctSubjects, last24h:.data.queue.recorded24h, lag:.data.lagBlocks, frozen:.data.marketFrozen}'
curl -s $B/v1/score/0x94963B928498bE7f06637C3D57ea1E74D7f73423 | jq '.data | {score, tier, collateralRatioBps}'
```

Nilai per 2026-09-12 sebagai patokan:

| Angka | Nilai |
|---|---|
| Fakta dari Ethereum mainnet | 72.366 |
| Dompet dengan riwayat terbukti | 11.315 |
| Fakta 24 jam terakhir | 5.474 |
| Lag watcher dari head Ethereum | 0 blok |
| Dompet terbukti `0x94963B92...3423` | skor **818**, tier 4, rasio **110%** |

Arah driftnya satu arah dan cukup cepat: sekitar 5.500 fakta dan 500 dompet
per hari. Angka yang diucapkan di scene 3 dan 6 karena itu ikut naik,
tidak pernah turun — kalau lupa membaca ulang, yang terjadi adalah
MEREMEHKAN registry sendiri, bukan melebih-lebihkannya.

### 1.2 Gerbang yang wajib hijau sebelum merekam

Kalau salah satu gagal, jangan merekam. Rekaman ulang lebih murah daripada video
yang memperlihatkan pasar beku.

```bash
export R=https://rpc.cc3-testnet.creditcoin.network
export PRICES=0x1fC6c2CFB9e339012B70D45977737B9e411efdc9
export MARKET=0xd97657E361928298A342D8e5049b7aD440b167d4
# FACTS dan GRAPH dipakai di scene 6. Diekspor di sini juga supaya terminal
# yang sama bisa dipakai ulang saat merekam take I tanpa menyetel apa pun lagi.
export FACTS=0xF7283aDefb2801db75160A49dA2F7E5e8fDc36c5
export GRAPH=0x896E283FB7213650f2C65c239168fEd89F57e952
export W=0x94963B928498bE7f06637C3D57ea1E74D7f73423

# Harga harus SEGAR di kontrak, bukan di API. API menyajikan mirror Postgres
# dan tetap terlihat sehat walaupun registry on-chain kosong.
cast call $PRICES "tryToUsd1e18(address,uint256)(uint256,bool)" \
  0x66f5F2C577ec38CE5bb7BCb7054a531a72004d19 1000000 --rpc-url $R   # harus true
cast call $PRICES "tryToUsd1e18(address,uint256)(uint256,bool)" \
  0x886E3d92314c037206bB789Ee3A9016EE67b661E 1000000000000000000 --rpc-url $R  # harus true

# Rasio efektif dompet terbukti harus benar-benar 11000, bukan baseline 15000.
# Inilah angka yang dikontraskan scene 5 terhadap 15000 milik dompet tim.
cast call $MARKET "effectiveRatioBps(address)(uint16)" $W --rpc-url $R   # 11000
```

Plus cek `"marketFrozen": false` dan `"lagBlocks"` kecil di `/v1/indexer/status`.

### 1.3 Dua dompet, dan hanya satu yang bisa menandatangani

Ini bagian yang paling mudah salah, dan salahnya tidak akan terlihat sampai
rekaman sudah jadi. **Video ini memakai DUA alamat yang berbeda, dan itu
disengaja.**

| Peran | Alamat | Bisa menandatangani? |
|---|---|---|
| Dompet TERBUKTI, yang skornya ditampilkan | `0x94963B92...3423` | **TIDAK** |
| Dompet TIM, yang melakukan borrow di kamera | dompet kalian sendiri | ya |

`0x94963B92...3423` adalah alamat Ethereum mainnet nyata yang riwayatnya kita
indeks. **Kunci privatnya bukan milik tim.** Ia tidak pernah mengirim satu pun
transaksi di CC3 — terverifikasi 2026-09-12, saldo 0 CTC dan nonce 0. Jadi ia
hanya boleh muncul sebagai layar yang DIBACA, tidak pernah sebagai dompet yang
menandatangani apa pun.

Menampilkannya sama sekali tidak bermasalah: itu data on-chain publik, dan
naskah scene 3 menyebutnya apa adanya, "a real mainnet wallet, not one of
ours". Yang dilarang cuma satu hal, dan versi lama naskah ini melanggarnya:
mengucapkan "**this** wallet borrows at 110 percent" sambil mengoperasikan
dompet. Kalimat itu mengubah data publik yang kita buktikan menjadi klaim
kepemilikan yang tidak benar.

**Yang harus disiapkan pada dompet tim, sebelum kamera menyala:**

- **CTC untuk gas.** Diperiksa lebih dulu, jangan diasumsikan. Dompet demo yang
  lama ternyata nol, dan itu baru ketahuan saat dicek: `cast balance <ALAMAT>
  --rpc-url $R`.
- **Klaim tUSDC lewat tombol faucet di halaman Market**, supaya scene borrow
  tidak terpotong menunggu transaksi faucet.
- **Pinjam tUSDC, bukan tWETH.** Terukur 2026-09-12: reserve tWETH punya
  `totalSupplied` nol dan `borrowEnabled` **false**, jadi tWETH memang tidak
  bisa dipinjam. tUSDC punya likuiditas 10.000.
- **Siapkan posisi supply lebih dulu**, sehingga di kamera yang terlihat hanya
  satu transaksi: borrow.
- **Jangan lakukan "repay all" di depan kamera.** Bunga berjalan antara borrow
  dan repay, jadi selalu ada sisa dan itu akan terlihat seperti bug.

### 1.4 Layar boot di awal setiap take

Landing dan app sekarang dibuka oleh layar boot: logo Corolary digambar sebagai
satu garis lalu terisi warna, dan ia baru terangkat setelah font dan hero
WebGL benar-benar siap. Durasinya sekitar **2,7 detik** dan ia muncul di setiap
pemuatan halaman penuh — termasuk setiap kali kamu me-refresh untuk mengambil
take ulang.

- Mulai potongan **setelah** layar boot terangkat, kecuali kamu memang ingin
  memakainya sebagai pembuka video. Kalau dipakai, pakai sekali saja di take A;
  mengulangnya di take berikutnya terbaca seperti video yang dijahit kasar.
- Landing dan app disajikan di **host yang berbeda**, jadi membuka app dari
  landing adalah pemuatan halaman penuh dan layar boot main lagi. Jangan kaget,
  dan jangan merekam transisi itu sebagai satu potongan mulus.
- Navigasi di dalam app (misalnya score ke proofs) TIDAK memunculkannya lagi.

### 1.5 Kebersihan layar

- Browser profil bersih: tanpa bookmark bar, tanpa ekstensi selain dompet,
  tanpa tab lain yang memuat email atau chat.
- Notifikasi sistem dimatikan (Do Not Disturb).
- Terminal: font besar (16 sampai 18 pt), tema terang atau gelap konsisten
  dengan web app, prompt dipendekkan supaya tidak memperlihatkan path pribadi.
- Tidak ada private key, seed phrase, atau isi `.env` yang pernah masuk frame.
  Kalau perlu menampilkan `.env`, tampilkan `.env.example`.

---

## 2. Naskah

Notasi: **[LAYAR]** adalah yang direkam, **[SUARA]** adalah yang diucapkan.
**Narasi ditulis dan diucapkan dalam bahasa Inggris.** Jangan diterjemahkan saat
merekam, dan jangan mengarang ulang kalimat pengungkapan di scene 5: versi
Inggris di bawah adalah terjemahan setia dari naskah kanonik berbahasa Indonesia
di `docs/business.md` §13.1.

Naskah ini sengaja pendek: **420 kata, sekitar 2 menit 48 detik** pada kecepatan
bicara normal (150 kata per menit). Sisa 12 detik dari target 3 menit adalah
jeda, dan jeda itu disengaja karena gambar butuh waktu untuk dibaca. **Jangan
menambah kalimat untuk mengisi ruang kosong.** Kalau ada yang terasa kurang
dijelaskan, biarkan: README dan deck yang menjawab, bukan video.

Jeda itu TIDAK dibagi rata, dan batas waktu di judul tiap scene sudah
memperhitungkannya. Jatah terbesar tetap di scene 3, karena di sanalah gambar
bekerja sendirian: dial dan breakdown butuh dibaca, bukan diceritakan. Scene 5
memakan lebih dari sepertiga video, dan itu memang harganya — pengungkapan token
testnet sendirian 112 kata dan tidak boleh dipercepat, sementara kontras 150
lawan 110 sekarang ikut diucapkan di sana.

Ruangnya sudah habis. **Menambah satu kalimat saja membuat video lewat dari tiga
menit**, karena 420 kata sudah 168 detik dan sisanya cuma 12 detik jeda.

| Scene | Jatah | Bicara | Jeda |
|---|---|---|---|
| 1 | 18 dtk | 42 kata, 16,8 dtk | 1,2 dtk |
| 2 | 15 dtk | 36 kata, 14,4 dtk | 0,6 dtk |
| 3 | 26 dtk | 51 kata, 20,4 dtk | 5,6 dtk |
| 4 | 32 dtk | 76 kata, 30,4 dtk | 1,6 dtk |
| 5 | 56 dtk | 136 kata, 54,4 dtk | 1,6 dtk |
| 6 | 17 dtk | 40 kata, 16,0 dtk | 1,0 dtk |
| 7 | 16 dtk | 39 kata, 15,6 dtk | 0,4 dtk |

Catatan pengucapan: `tUSDC` dibaca "tee you ess dee see", `tWETH` dibaca "tee
weth". Alamat kontrak tidak pernah dibacakan, cukup ditampilkan.

### Scene 1, Masalah (00:00 sampai 00:18)

**[LAYAR]** Landing page Corolary, mulai setelah layar boot terangkat. Tahan di
hero sampai koin selesai melintas dan "What this is" terbaca, lalu scroll pelan
ke bagian **Pipeline** (`#pipeline`). Tanpa kursor yang berkeliaran.

**[SUARA]**
> "DeFi asks everyone for 150 percent collateral. A wallet that repaid 40 Aave
> loans over two years is treated like a wallet created five minutes ago. That
> reputation exists. It is just locked on another chain. Corolary proves it, then
> prices it."

### Scene 2, Solusi dalam satu kalimat (00:18 sampai 00:33)

**[LAYAR]** Lanjutan scroll yang sama: akordeon **Pipeline** (`#pipeline`),
lima langkah dari "Real mainnet activity" sampai "Collateral efficiency", lalu
berhenti di **Proof** (`#proof`) pada baris logo di bawah judul "Every fact
starts on Ethereum mainnet". Label yang terbaca di sana adalah nama penuh yang
dipakai indexer — Aave V3, Morpho Blue, SparkLend, Compound V3 — bukan nama
pendeknya.

Tidak ada lagi diagram tiga lapis di landing, dan tidak perlu dicari: akordeon
itu menceritakan pipeline yang sama secara berurutan, dan baris logo di
bawahnya adalah versi yang lebih kuat dari kotak arsitektur — ia dibaca dari
cursor indexer yang hidup, bukan digambar.

**[SUARA]**
> "We read real lending activity on Ethereum mainnet, prove it through the
> Attestcoin Protocol, and store it permanently on Creditcoin. Collateral drops
> from 150 percent to 110. Still fully over-collateralized. Proven borrowers just
> lock less capital."

### Scene 3, Skor dompet nyata (00:33 sampai 00:59)

**[LAYAR]** `/score/0x94963B928498bE7f06637C3D57ea1E74D7f73423`. Tunggu dial
selesai, lalu scroll ke ComponentBreakdown. **Klik** satu komponen supaya
barisnya terbuka dan daftar `factId`-nya terlihat — barisnya akordeon, bukan
tooltip, jadi hover saja tidak memperlihatkan apa pun. Hanya satu baris bisa
terbuka pada satu waktu; pilih **Repayment volume**, yang punya fakta paling
banyak. Beri jeda di sini, gambarnya yang bekerja.

**[SUARA]**
> "A real mainnet wallet, not one of ours. Score 818, tier 4. No off-chain model: every component
> is computed on-chain, and every one points at specific evidence. Repayment
> volume, 298 of 300. Protocol diversity, two of four. Liquidation penalty, zero.
> No black box, which is exactly where earlier credit scores failed."

Catatan: kalau angka di layar berbeda, sebut angka di layar. Bentuk yang tahan
drift: "score above 800, tier 4".

### Scene 4, Rantai bukti (00:59 sampai 01:31)

**[LAYAR]** Klik salah satu fakta, masuk ke `/proofs/<factId>`. Perlihatkan rel
empat langkah: Ethereum transaction, Attested on Creditcoin, Proof built,
Recorded in FactRegistry. Lalu buka tautan Etherscan di tab baru, perlihatkan
transaksi mainnet aslinya, dan kembali.

**[SUARA]**
> "One fact, opened all the way up. The original Ethereum transaction, on
> Etherscan. Attestors agreed on that block, the proof was bought inside the
> cheap window, and the fact is permanent and replay-protected. One thing is easy
> to get wrong. The precompile proves a transaction was **included**, not that it
> **succeeded**. So we check the receipt status ourselves, and we pick the
> decoder by the emitting address. A copycat faking Aave events has no way in."

### Scene 5, Pasar dan pengungkapan (01:31 sampai 02:27)

**[LAYAR]**, tiga potongan yang memperlihatkan DUA ujung dari satu fungsi yang
sama (§1.3 menjelaskan kenapa ada dua alamat):

1. Kembali sebentar ke layar skor `0x94963B92...3423` pada kartu **Required
   collateral 110%**. Ini murni dibaca; tidak ada dompet yang terhubung.
2. `/market` dengan **dompet tim** terhubung: reserve, panel PriceProvenance,
   dan kartu yang menyebut **150%** karena dompet itu belum punya apa pun yang
   terbukti.
3. Buka dialog borrow **tUSDC**, kirim transaksi, tunggu konfirmasi, posisi
   muncul di PositionTable dengan health factor.

Borrow-nya nyata dan ditandatangani sendiri. Yang tidak dilakukan adalah
berpura-pura meminjam sebagai dompet yang kuncinya bukan milik kita.

**[SUARA]**, bagian pertama:
> "The score arrives here as a price. This wallet has nothing proven yet, so it
> posts the same 150 percent everyone posts. The wallet from a moment ago is
> quoted 110 by the same contract, on the same market. The ratio is locked at
> borrow time, so a later score drop cannot make a healthy position
> liquidatable."

**[SUARA]**, pengungkapan, ucapkan **tepat saat `tUSDC` terbaca di layar**,
sekitar 12 detik, jangan dipotong dan jangan dipercepat:
> "One thing I want to be straightforward about. The tokens borrowed here,
> `tUSDC` and `tWETH`, are testnet tokens, because this hackathon requires a
> testnet deployment and CC3 has no real USDC. **The market tokens are testnet
> tokens. The credit history, the prices, and the scores come from real Ethereum
> mainnet.** That score came from Aave and Morpho transactions that actually
> happened, and `tUSDC` is priced using genuine mainnet USDC proven through
> Chainlink."

**[SUARA]**, penutup scene:
> "No centralized oracle anywhere in this system."

### Scene 6, Bukti skala (02:27 sampai 02:44)

**[LAYAR]** Split atau potong bergantian: halaman `/proofs` dengan daftar fakta
yang panjang, lalu terminal yang menjalankan tiga `cast call` di bawah ini
dengan hasil terlihat.

```bash
cast call $FACTS "allowedChainKeys(uint64)(bool)" 3 --rpc-url $R   # true, mainnet
cast call $FACTS "allowedChainKeys(uint64)(bool)" 1 --rpc-url $R   # false, Sepolia
cast call $GRAPH "scoreOf(address)(uint16,uint8)" $W --rpc-url $R
```

**[SUARA]**
> "Not one cherry-picked wallet. Over 70 thousand proven facts, 11 thousand
> wallets, four mainnet protocols. And this line matters most: Sepolia is refused
> by contract policy. Only Ethereum mainnet counts, so nobody farms a score with
> tokens they minted themselves."

### Scene 7, Penutup (02:44 sampai 03:00)

**[LAYAR]** Kembali ke landing, bagian Outro ("Have a wallet with history?"),
lalu terus scroll ke footer dan freeze pada kolom **Contracts** di dalam kartu
footer, dengan wordmark "Corolary" raksasa di bawahnya.

URL repo **tidak ada di halaman mana pun**, jadi ia harus datang dari overlay
teks editor (§3.4), bukan dari sesuatu yang kamu cari di layar.

**[SUARA]**
> "FactRegistry is infrastructure. Pay for a proof once, and the fact is free to
> read forever, by any Creditcoin dApp. Cost scales with facts, not reads. Every
> number here you can check yourself with one `cast call`. Thank you."

---

## 3. Panduan rekaman layar

### 3.1 Daftar layar yang direkam

Rekam sebagai take terpisah, jangan satu rekaman panjang. Voice over direkam
belakangan di atas potongan yang sudah dipilih.

| # | Take | Yang dibuka | Durasi mentah | Dipakai di |
|---|---|---|---|---|
| A | Landing, hero sampai Pipeline | `<URL_WEB>/` | 40 detik | Scene 1 |
| B | Landing, Pipeline dan Proof | `<URL_WEB>/` (scroll) | 30 detik | Scene 2 |
| C | Score Explorer | `<URL_WEB>/score/0x94963B928498bE7f06637C3D57ea1E74D7f73423` | 60 detik | Scene 3 |
| D | Proof Viewer | `<URL_WEB>/proofs/<factId>` | 45 detik | Scene 4 |
| E | Etherscan transaksi asli | tautan keluar dari take D | 15 detik | Scene 4 |
| F | Market, keadaan awal, dompet tim terhubung | `<URL_WEB>/market` | 30 detik | Scene 5 |
| F2 | Kartu Required collateral 110%, tanpa dompet | `<URL_WEB>/score/0x94963B928498bE7f06637C3D57ea1E74D7f73423` | 10 detik | Scene 5 |
| G | Market, borrow tUSDC sampai posisi muncul | dialog borrow plus konfirmasi dompet | 90 detik | Scene 5 |
| H | Daftar fakta | `<URL_WEB>/proofs` | 20 detik | Scene 6 |
| H2 | Landing, bagian Registry | `<URL_WEB>/#registry` | 15 detik | Scene 6 (opsional) |
| I | Terminal `cast call` | iTerm atau Terminal | 40 detik | Scene 6 |
| J | Blockscout kontrak terverifikasi | `https://creditcoin-testnet.blockscout.com/address/0xF7283aDefb2801db75160A49dA2F7E5e8fDc36c5` | 20 detik | Scene 6 atau 7 |
| K | Landing, Outro sampai footer | `<URL_WEB>/` | 25 detik | Scene 7 |

Take H2 opsional tapi murah: bagian **Registry** di landing menampilkan persis
angka yang diucapkan di scene 6 (total fakta, dompet, fakta 24 jam) dalam bentuk
yang sudah didesain, dibaca live dari `/v1/indexer/status` yang sama. Kalau
dipakai, potong ke sana saat kalimat angkanya diucapkan, lalu kembali ke
terminal untuk baris `allowedChainKeys`.

`<URL_WEB>` diisi setelah frontend naik ke Vercel. Sampai itu ada, rekam dari
`pnpm dev:web` di `http://localhost:3000` dan jangan pernah memperlihatkan URL
bar, karena `localhost` di video submission terbaca seperti belum ter-deploy.

### 3.2 Setelan teknis

- Resolusi **1920x1080**, 30 atau 60 fps. Kalau layar Mac Retina, rekam
  1920x1080 secara logis (bukan 2x) supaya teks tidak buram setelah kompresi.
- Zoom browser **110 sampai 125 persen**. Video ditonton di jendela kecil, dan
  teks berukuran default akan hilang.
- Perekam: QuickTime (bawaan, cukup) atau OBS (kalau butuh split layar untuk
  scene 6). Screen Studio kalau ada, terutama untuk zoom otomatis di take C dan D.
- Gerakan kursor pelan dan sedikit. Setiap klik harus punya jeda satu detik
  sebelum dan sesudah, supaya editor punya ruang potong.
- Scroll dengan trackpad dua jari, pelan dan konstan. Scroll yang tersentak
  membuat halaman yang bagus terlihat murah.
- Take G adalah satu-satunya yang punya waktu tunggu tak pasti (konfirmasi
  on-chain). Rekam utuh, lalu percepat 2x sampai 4x di bagian tunggunya dengan
  label "sped up" di layar. Jangan memotong sampai seolah instan; juri yang
  paham akan curiga.

### 3.3 Urutan kerja

1. Jalankan gerbang di §1.2. Semua harus hijau.
2. Rekam take A, B, H2, K sekaligus (landing, satu sesi, empat potongan). Satu
   sesi berarti satu layar boot, di awal saja.
3. Rekam C, lalu D, lalu E berurutan supaya `factId` yang dipakai konsisten
   antara ketiganya. Catat `factId`-nya.
4. Rekam F2 lebih dulu selagi belum ada dompet terhubung — begitu dompet tim
   tersambung, kartu 110% itu tidak bisa diambil lagi tanpa memutus koneksi.
   Lalu F dan G. G take paling rapuh; siapkan untuk mengulang.
5. Rekam H, I, J.
6. Susun kasar tanpa suara, potong ke target 3 menit, baru rekam voice over.
7. Voice over dalam bahasa Inggris: satu take per scene, mikrofon dekat, ruangan
   kecil dan berperabot. Audio jelek merusak video bagus lebih cepat daripada
   sebaliknya. Kalau aksen membuat sebagian kalimat sulit ditangkap, tambahkan
   subtitle Inggris (file `.srt` di YouTube, bukan auto-caption), jangan ganti
   bahasa narasinya.

### 3.4 Overlay teks di layar

Minimal, tapi wajib ada tiga:

- Detik 0: judul "Corolary, reputation that follows you, backed by proof" plus
  "BUIDL CTC 2026 Fall, DeFi".
- Scene 5, bersamaan dengan pengungkapan yang diucapkan: caption permanen
  "Market tokens are testnet ERC20. Credit history, prices, and scores come from
  real Ethereum mainnet." Caption ini **melengkapi** suara, tidak menggantikannya.
- Scene 7: alamat kontrak dan URL repo, cukup lama untuk dibaca (5 detik).
  Alamatnya juga ada di kolom Contracts pada footer, jadi overlay-nya memperkuat
  apa yang sudah terlihat. **URL repo tidak ada di UI sama sekali**, jadi untuk
  URL itu overlay ini adalah satu-satunya tempat penonton bisa melihatnya, dan
  ia tidak boleh lupa dipasang.

Alamat yang ditampilkan di akhir:

```
FactRegistry       0xF7283aDefb2801db75160A49dA2F7E5e8fDc36c5
CreditGraph        0x896E283FB7213650f2C65c239168fEd89F57e952
EfficiencyMarket   0xd97657E361928298A342D8e5049b7aD440b167d4
PriceRegistry      0x1fC6c2CFB9e339012B70D45977737B9e411efdc9
```

### 3.5 Kalau waktu 3 menit tidak cukup

Urutan yang dipotong, dari yang paling boleh hilang:

1. Scene 2 dipadatkan jadi 10 detik (diagram muncul, satu kalimat saja).
2. Take E (Etherscan) dipersingkat jadi 5 detik.
3. Scene 6 kehilangan bagian `/proofs`, sisakan terminal saja.

Yang **tidak boleh** dipotong dalam keadaan apa pun, ada tiga: pengungkapan
token testnet di scene 5, kontras 150 lawan 110 di scene 5, dan
`allowedChainKeys(1) == false` di scene 6.

Dua yang pertama soal kejujuran dan saling mengunci. Tanpa kontrasnya, satu-
satunya angka rasio yang terlihat adalah 150% milik dompet tim, dan seluruh
premis produk hilang. Tanpa pengungkapannya, videonya mengaku memakai USDC
sungguhan. Yang ketiga adalah pembeda teknis paling tajam yang kita punya.

---

## 4. Checklist sebelum upload

- [ ] Gerbang §1.2 hijau pada hari perekaman
- [ ] Angka yang diucapkan cocok dengan angka di layar
- [ ] Tidak ada satu kalimat pun yang mengaku memiliki `0x94963B92...3423`
- [ ] Kontras 150 lawan 110 benar-benar terlihat di layar, bukan cuma diucapkan
- [ ] Narasi seluruhnya berbahasa Inggris, termasuk kalimat pengungkapan
- [ ] Pengungkapan token testnet **diucapkan** di scene 5, bukan hanya caption
- [ ] Tidak ada private key, seed phrase, isi `.env`, atau notifikasi pribadi di frame
- [ ] Tidak ada `localhost` di URL bar
- [ ] Bagian tunggu on-chain diberi label "sped up"
- [ ] Durasi di bawah atau sekitar 3 menit
- [ ] Audio dinormalisasi, tidak ada klip yang pecah
- [ ] Diunggah sebagai **public** atau **unlisted** di YouTube, bukan private
- [ ] Deskripsi video memuat: repo URL, alamat kontrak, dan pengungkapan token
      testnet secara tertulis (tetap ditulis walaupun sudah diucapkan)
- [ ] URL video ditempel ke form submission dan ke checklist `docs/hackathon.md`
