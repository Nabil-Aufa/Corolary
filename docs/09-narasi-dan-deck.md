# Narasi, Pasar & Deck

Disusun **9 Agustus 2026**. Dokumen ini mengisi kekosongan yang ditandai `CLAUDE.md` §10.

**Baca ini sebelum menulis satu kata pun** yang akan dilihat juri — deck, video, README,
dan **copy di UI**. Semua materi tetap wajib disaring lewat daftar klaim terlarang
(`01-riset-mendalam.md` §7) sebelum dikirim.

⚠️ Dokumen internal ini bahasa Indonesia. **Semua materi yang dilihat juri: bahasa Inggris.**

---

## 1. Produk dalam tiga tingkat kedalaman

Pakai yang sesuai lawan bicara. Jangan pernah membuka dengan tingkat 3.

**Tingkat 1 — untuk siapa pun (10 detik):**

> Token dolar yang **tidak bisa dicetak melebihi uang yang benar-benar ada** — dan
> **pintu keluarnya tidak punya kunci.**

**Tingkat 2 — untuk juri (30 detik):**

> Issuer menerbitkan token dolar di Creditcoin. Cadangannya USDC di Ethereum. Kontraknya
> hanya mempercayai cadangan yang **dibuktikan secara kriptografis ter-include** di blok
> Ethereum yang final — lewat Attestcoin, tanpa oracle, tanpa bridge, tanpa izin siapa pun.
> `mint()` **revert** kalau melanggar lantai. `redeem()` **selalu** terbuka. Kontraknya
> **tidak bisa di-upgrade**. Dan **kunci issuer-nya kami terbitkan di README.**

**Tingkat 3 — untuk pertanyaan teknis:** `03-spesifikasi-produk.md`.

### Analogi yang boleh dipakai (dan yang tidak)

✅ **Airbag.** Tidak ada yang paham kimia natrium azida; semua paham *"dia mengembang
waktu nabrak"*. Mekanisme kami berat, janjinya ringan.
✅ **Brankas berjendela kaca yang tidak bisa ditutup.**
❌ **Jangan** pakai analogi bank sentral / cetak uang — mengundang perdebatan moneter
yang tidak ada hubungannya.

---

## 2. Protagonis: penabung, bukan CFO

Ini perbaikan RT2, dan sumbu terlemah kita. Grand prize musim 1 jatuh ke **CrediKye**
(arisan on-chain) — bukan yang paling canggih, tapi yang jurinya bisa **membayangkan
orang memakainya**.

**Bingkai wajib di semua materi:**

> Sebuah fintech di Lagos menerbitkan token tanda terima dolar untuk nasabahnya.
> Cadangannya USDC di treasury Ethereum. Nasabahnya tidak punya cara memeriksa apakah
> cadangan itu benar ada — sampai sekarang.
>
> **Protagonisnya penabung. Pelanggannya fintech. Mint-lock melindungi penabung dari
> fintech-nya sendiri.**

Ini sah secara teknis, selaras persis dengan tesis Creditcoin (Aella: 337.000+ user,
$100 jt+ pinjaman on-chain, MoU Bank Sentral Nigeria), dan meminjam kekuatan emosional
ide #5 **tanpa** menabrak HashCredit.

### Aturan keras soal menyebut nama perusahaan

| Boleh | Tidak boleh |
|---|---|
| **Zondacrypto sebagai CERITA** — kasusnya selesai, terdokumentasi, sedang diproses hukum | ❌ Memasang dompet exchange yang **masih beroperasi** sebagai target hidup dengan label alarm |
| **Sky sebagai target observatory** dengan bingkai netral (§3) | ❌ Menyiratkan Sky tidak solven |
| **Resolv/StablR/Ankr sebagai preseden** | ❌ Menyebut Circle/BUIDL/Ondo/PAXG sebagai "yang kami audit" (RT1) |

Menuduh perusahaan yang masih beroperasi bukan cuma risiko hukum — di panggung juri itu
terbaca sebagai ceroboh, dan kecerobohan menular ke semua klaim lain.

---

## 3. Urutan cerita — DIPUTUSKAN, jangan diperdebatkan lagi

Addendum `02-keputusan-ide.md` menggantung pertanyaan "Vault dulu atau Observatory dulu".
**Jawabannya: dua-duanya salah. Korban dulu.**

| # | Beat | Isi | Durasi |
|---|---|---|---|
| 1 | **Korban** | StablR: berlisensi Malta, patuh MiCA, didukung Tether. Multisig 1-of-3 dibobol → $13,5 jt dicetak tanpa backing → EURR $0,548. **Runtuh dalam hitungan jam, di antara dua laporan bulanan.** | 20 dtk |
| 2 | **Deteksi** | Observatory hidup di alamat nyata di Ethereum mainnet, di depan mata. *"Ini yang tidak ada bulan Desember."* | 40 dtk |
| 3 | **Pencegahan** ⭐ | `mint()` melebihi cadangan → **revert**. Lalu: *"Kunci issuer-nya ada di README kami. Coba sendiri sekarang."* | 60 dtk |
| 4 | **Otonomi** | Penarikan Sepolia yang **dipicu di menit pertama** mendarat. Rasio jatuh, minting membeku **sendiri**. Tidak ada yang menekan apa pun. | 40 dtk |
| 5 | **Pengguna** | Holder view: saldo, bukti di baliknya, tombol **Tebus** yang berfungsi. *"Pintu keluar ini tidak bisa dikunci siapa pun."* | 40 dtk |
| 6 | **Platform** | Dua kontrak lain sudah membaca `IProvenReserve`. Angka ini infrastruktur, bukan aplikasi. | 25 dtk |
| 7 | **Batas** | Slide "yang TIDAK kami cegah": Balance Coin (22 Jul 2026), apxUSD. | 25 dtk |

**Masalah → deteksi → pencegahan → otonomi → pengguna → ekosistem → kejujuran.**

⚠️ **RT3 — 9 menit kekosongan.** Beat 4 butuh attestation mendarat. **Picu penarikan
Sepolia di detik pertama rekaman**, kerjakan beat 2–3 sambil menunggu, kembali di beat 4.
Jangan sembunyikan penantiannya — tampilkan hitung mundur ke tinggi blok ter-attest, dan
jelaskan kenapa 32–42 blok. Angkanya bisa diturunkan siapa pun dari konfigurasi on-chain.

---

## 4. Argumen pasar — buang slide TAM

**Jangan** buka dengan "$299 miliar stablecoin". Itu angka TAM, bukan permintaan, dan
juri menghukum TAM teater.

### Keberatan yang jujur (akui dulu, jangan tunggu ditanya)

- Belum pernah ada yang **membeli** "bukti tidak bisa mencetak berlebih" sebagai produk.
- Issuer justru **ingin** fleksibilitas mencetak (float operasional, market making).
- Issuer besar yang paling butuh bukti cadangan justru **di luar cakupan** — cadangannya
  off-chain.
- Yang paling diuntungkan (penabung) **tidak membayar dan tidak memilih**.

### Pembalikan yang membuat pasarnya nyata

Pertanyaannya bukan *"siapa mau diborgol?"* tapi ***"siapa yang tidak punya cara lain
untuk dipercaya?"***

> **Circle tidak butuh Corolary karena Circle punya merek.** Fintech di Lagos yang
> menerbitkan token dolar untuk 50.000 nasabah tidak punya merek, tidak punya auditor
> Big Four, tidak punya regulator yang dikenal. Untuk mereka, cadangan yang terbukti
> **bukan borgol — itu merek termurah yang bisa mereka beli.**
>
> Corolary tidak dijual sebagai **keamanan**. Dijual sebagai **kredibilitas untuk issuer
> yang tidak bisa membeli kredibilitas dengan cara lain.**

### DUA SEGMEN — dan jangan pernah menggabungkannya jadi satu kalimat

Ini presisi yang menentukan. Salah sedikit, dan juri Credit Labs — yang tahu persis
bisnisnya sendiri — mematahkannya dalam satu pertanyaan.

| | **Segmen B — kripto-native** | **Segmen A — Creditcoin-adjacent** |
|---|---|---|
| **Siapa** | Issuer dengan kolateral hidup on-chain: kelas Sky, Resolv, Reserve | Fintech emerging-market yang menerbitkan token dolar untuk nasabahnya |
| **Status** | **Nyata hari ini**, terverifikasi on-chain (`01` §3.5) | **Hipotesis** — belum tervalidasi |
| **Kekuatan** | Bisa dibuktikan di layar. **Di sinilah kegagalan 2026 benar-benar terjadi** | Tesis Creditcoin, distribusi Credal, cerita manusiawi |
| **Kelemahan** | Bukan pelanggan Creditcoin. Ceritanya dingin | Belum ada bukti mereka mau menerbitkan token |
| **Dipakai untuk** | **DEMO** — kredibilitas | **SLIDE BISNIS** — CEIP |

**Strategi: demo pakai B, argumen bisnis pakai A.** Demo menunjukkan Sky ($4,25 miliar,
terverifikasi, hidup) — kredibilitas yang tidak bisa dibantah. Slide bisnis bicara
segmen A — itu yang membuat Credit Labs condong ke depan.

#### ⚠️ Kalimat yang BENAR tentang hubungan dengan Creditcoin

Yang Creditcoin layani hari ini adalah **pemberi pinjaman** — Aella itu *lender*, dan
Credal adalah API pencatatan kredit. **Mereka tidak menerbitkan token.** Jadi:

| ❌ Jangan bilang | ✅ Bilang ini |
|---|---|
| "Pasar kami persis pelanggan Creditcoin" | "**Populasi perusahaannya sama, produknya bersebelahan**" |
| "Aella adalah pelanggan kami" | "Aella membuktikan **populasinya ada dan Creditcoin sudah menjangkaunya**" |
| "Kami melayani pasar yang sama" | "Kami **memperluas** hubungan pelanggan yang sudah mereka punya" |

Kalimat lengkapnya untuk deck:

> Fintech Lagos yang hari ini mencatat pinjaman di Creditcoin adalah persis jenis
> perusahaan yang besok menerbitkan token dolar untuk nasabahnya — karena mata uang
> lokalnya rusak dan nasabahnya butuh dolar. Begitu mereka melakukan itu, mereka
> menabrak masalah kami: **tidak ada seorang pun yang punya alasan mempercayai mereka.**

Ini lebih kuat untuk CEIP daripada versi longgarnya, karena artinya Corolary
**memperluas** hubungan yang sudah ada — bukan mengulang apa yang sudah Creditcoin
kerjakan.

**Angka yang boleh dipakai sebagai bukti populasi** (bukan sebagai pipeline):
Aella 337.000+ user · $100 jt+ pinjaman on-chain · 5 juta+ pinjaman tercatat lewat
Credal · MoU Bank Sentral Nigeria untuk eNaira.

### Slide pasar — dua kalimat, bukan grafik

> **$4,25 miliar cadangan dolar on-chain terbesar di dunia dijaga oleh sebuah janji.**
> *(Sky LitePSM Pocket, sebuah EOA — terverifikasi 9 Agt 2026)*
>
> **Satu-satunya issuer yang jebol tahun ini, jebol persis di tempat kami memasang kunci.**
> *(Resolv, 22 Mar 2026 — kolateralnya utuh; yang jebol otoritas mint)*

### Jawaban CEIP: "ini perusahaan apa?"

> Produknya bukan dashboard. Produknya **infrastruktur penerbitan**: kepatuhan cadangan
> yang **kontinu dan ditegakkan on-chain**, bukan foto bulanan. GENIUS Act mewajibkan
> pengungkapan **bulanan**; Resolv dan StablR runtuh dalam **hitungan jam**.
>
> Pasar pertama kami sudah ada dan bisa ditunjuk hari ini — **issuer berkolateral
> on-chain**, tempat semua kegagalan 2026 terjadi.
>
> Pasar keduanya adalah alasan kami membangunnya di Creditcoin: **populasi perusahaan
> yang sudah kalian jangkau lewat Credal** akan menerbitkan token dolar begitu nasabahnya
> butuh dolar — dan saat itu terjadi, mereka butuh cara untuk dipercaya.
>
> Observatory adalah **kanal distribusinya**: audit paksa yang gratis untuk semua orang
> menciptakan tekanan bagi issuer untuk mengadopsi kuncinya secara sukarela.

⚠️ Perhatikan kalimat kedua: *"populasi perusahaan yang sudah kalian jangkau"* — **bukan**
*"pelanggan kalian adalah pelanggan kami"*. Bedanya satu frasa, dan yang kedua bisa
dipatahkan dengan *"Aella tidak menerbitkan token."*

### Pekerjaan lapangan sebelum submission

**Segmen B (bisa dikerjakan sekarang, tanpa bicara dengan siapa pun):**

1. **Lengkapi jadi 3 issuer berkolateral on-chain** dengan alamat terverifikasi. Dua
   sudah ada di `01` §3.5 (Sky, Resolv); Reserve eUSD tinggal dienumerasi pembungkusnya.
2. Jalankan **tes kelayakan tiga langkah** untuk masing-masing. Kalau ada yang gagal,
   coret — jangan dipaksakan.

**Segmen A (butuh orang, kerjakan paralel):**

3. **Ngobrol dengan 1 fintech emerging-market** yang menerbitkan atau berencana
   menerbitkan token dolar. Satu kalimat dari mereka (*"nasabah kami memang tidak punya
   cara memeriksa ini"*) mengalahkan semua slide pasar yang bisa kamu buat.
4. Kalau nomor 3 gagal — **itu temuan, bukan bencana.** Segmen A turun jadi *"arah yang
   kami tuju"*, bukan *"pasar yang kami layani"*. Deck tetap berdiri di atas segmen B,
   yang bisa dibuktikan di layar. **Idenya tidak berubah.**

⚠️ **Jangan pernah mengarang traksi segmen A.** Kalau belum ada yang diajak bicara,
katakan begitu. Juri CEIP menilai kejujuran soal tahap pasar lebih tinggi daripada
klaim traksi yang tidak bisa dibuktikan — dan mereka melakukan due diligence setelahnya.

---

## 5. Slide "yang TIDAK kami cegah"

Tabel final ada di `07-red-team.md` RT8. Intinya: **Ankr 2022 → Zoth/UPCX 2025 →
Resolv/StablR 2026 ✅ dicegah** · **apxUSD & Balance Coin 2026 ❌ tidak**.

> Kami menutup risiko **otoritas penerbitan**. Kami tidak menutup risiko **nilai
> kolateral**, dan kami tidak berpura-pura bisa — menutup yang kedua butuh price oracle,
> dan price oracle membatalkan seluruh klaim kami.

Dua baris merah itu **menaikkan** skor. Juri sudah tahu ada kasus yang tidak muat;
menyebutnya duluan mengubah pertanyaan mereka dari *"apa yang disembunyikan?"* jadi
*"mereka tahu persis batas produknya."*

---

## 6. Jawaban satu kalimat — HAFALKAN

| Serangan | Jawaban |
|---|---|
| **"Ini kan collateral ratio ala MakerDAO"** (RT4) | Yang baru bukan rasionya. Yang baru: **kolateralnya ada di rantai lain, tidak pernah di-bridge, tidak pernah dilaporkan siapa pun, dan dibuktikan per-transaksi lewat bukti inklusi.** MakerDAO hanya melihat kolateral di rantainya sendiri. |
| **"Chainlink PoR sudah melakukan ini"** (RT5) | Keduanya **menanyakan kabar cadangan kepada pihak yang sedang kita curigai** — dan hanya kalau issuer setuju. Kami tidak bertanya kepada siapa pun. |
| **"Cuma on-chain, cuma Ethereum, telat 9 menit?"** (RT8) | Cadangan off-chain butuh kustodian yang dipercaya. Cadangan on-chain tidak — dan **di sanalah kegagalan tahun ini terjadi.** |
| **"Kunci admin bisa upgrade kontraknya"** (RT9) | Kontrak ini tidak bisa di-upgrade. Bukan karena kami tidak sempat — **tombol upgrade adalah kunci mint yang menyamar.** Zoth dan UPCX jatuh persis begitu. |
| **"Ada jendela 9 menit"** (RT10) | Benar, dan tidak bisa ditutup — itu konsekuensi protokol satu arah. Kami membatasinya: **5% cadangan per jendela, ditegakkan on-chain**, plus gerbang kesegaran yang menolak mint di atas data basi. |
| **"Solvabilitas itu cadangan dibagi kewajiban — mana kewajibannya?"** (RT11) | Di vault mode kami membuktikan solvabilitas — kewajibannya `totalSupply()` kami sendiri. Di observatory kami membuktikan **pergerakan kolateral**, dan kami **tidak akan berpura-pura** bisa membuktikan kewajiban issuer lain. |
| **"Kok kuncinya dipublikasikan?"** (RT12) | Karena kunci itu tidak punya kekuasaan yang berbahaya. Kontraknya immutable, lantai kolateral dicek sebelum otorisasi. **Silakan ambil — kamu tidak akan bisa mencetak satu token pun tanpa cadangan.** |
| **"Saya redeem, lalu uang saya keluar dari mana?"** (RT13) | Kami tidak menjamin issuer membayar. Kami menjamin **klaimmu tidak pernah bisa diencerkan**, dan `redeem()` mencatat **permintaan tebus yang tidak bisa disangkal pernah diterima** — permanen, on-chain, dengan cap waktu. Itu model asli Creditcoin. |
| **"Bagian sulitnya dikerjakan Attestcoin, kalian cuma memanggilnya"** (RT6) | Dokumentasi mereka tidak menyebut apa yang di-attest. Kami membacanya dari sumbernya: **pasangan (tx, receipt), tanpa block header.** Itu sebabnya kami tidak bisa membuktikan saldo — dan sebabnya seluruh akuntansi kami berbentuk seperti ini. |

---

## 7. Ringkasan integrasi Attestcoin — untuk kriteria "depth of utilization"

Ini **syarat wajib submission**, dan salah satu kriteria penilaian utama. Tulis sebagai
daftar permukaan protokol yang benar-benar dipakai, dengan angka:

| Permukaan | Bagaimana dipakai | Sinyal |
|---|---|---|
| `verifyAndEmit` (bukan `verify`) | Setiap ingest meninggalkan `TransactionVerified` on-chain | Jejak audit independen |
| **Overload batch** `verifyAndEmit` | 21% hemat terukur (37.079 vs 46.746 gas/tx) | Hampir tidak ada yang tahu fungsi ini ada |
| `EvmV1Decoder` | Decode receipt + log kontrak **pihak ketiga** | Bukan membaca kontrak sendiri |
| ChainInfo `0x0fd3` | Gerbang kesegaran `mint()` **dan** indikator kesehatan publik | `mint()` bergantung langsung pada state protokol Attestcoin |
| **Dua chainKey serentak** (1 Sepolia + 3 ETH mainnet) | Satu sistem, dua chain sumber | **Sinyal terkuat & paling kasat mata** |
| Pallet `attestation` (Substrate RPC) | Model kepercayaan ditampilkan di dashboard produksi | Kami menampilkan asumsi kepercayaan kami sendiri |
| **`mintWithProof()`** | Ingest + mint atomik | Tidak ada token yang lahir tanpa bukti di transaksi yang sama |
| **`RawProofBuilder`** | Fallback proof lokal, tanpa server | **Kami tidak bergantung pada server siapa pun — termasuk server Creditcoin** |
| **ChainInfo bounds/find/is_attested** | Memperpendek continuity proof + hindari `BlockNotReady` | Penghematan gas **terukur**, bukan sekadar "kami memakai ChainInfo" |
| **`decodeCommonTxFields`** | `tx.from` ditampilkan di feed | Feed menjawab *"siapa yang memindahkan uangnya"*, bukan cuma *"berapa"* |
| **Babak 5** *(kalau jadi)* | State root Base dibuktikan lewat Ethereum | Memperluas jangkauan Attestcoin tanpa mengubah protokolnya |

**Sebutkan juga yang sengaja TIDAK dipakai** — ini terbaca lebih dalam daripada memakai
semuanya asal-asalan:

- `QueryBuilder` — alat off-chain untuk memilih field. **Tidak menolong**: `0x0FD2` hanya
  punya 5 fungsi dan tidak ada varian query, dan merkle leaf dihitung dari transaksi utuh
  sehingga bukti sebagian tidak mungkin.
- `decodeTransactionType0..4` — mendekode seluruh field termasuk tanda tangan, accessList,
  dan parameter gas yang tidak pernah kita butuhkan. Kami memakai `decodeCommonTxFields`
  + `decodeReceiptFields` terpisah, dan itu lebih murah.

Satu kalimat pembuka untuk bagian ini:

> Kami tidak memanggil Attestcoin. Kami membangun di atasnya sampai menemukan batasnya —
> dan batas itu tidak tertulis di dokumentasinya.

---

## 8. Checklist sebelum kirim

- [ ] Semua materi disaring lewat `01-riset-mendalam.md` §7 (klaim terlarang)
- [ ] **Dua segmen pasar tidak digabung jadi satu kalimat** (§4). Demo = B, bisnis = A.
- [ ] **Aella tidak disebut sebagai pelanggan** — mereka *lender*, bukan penerbit token
- [ ] **Traksi segmen A tidak dikarang.** Kalau belum ada yang diajak bicara, katakan
- [ ] Kata *solvency* **tidak muncul** di copy observatory (RT11)
- [ ] Tidak ada nama di RT1 yang disebut sebagai "yang kami audit"
- [ ] **Ethena tidak disebut** kecuali sudah diverifikasi ulang
- [ ] Writability disebut **maksimal sekali**, dan dilabeli roadmap
- [ ] Angka lag disebut sebagai **pita**, bukan "44 blok"
- [ ] Slide "yang TIDAK kami cegah" ada di deck, bukan cuma di kepala
- [ ] Semua screenshot dari bundle produksi pasca Fase 6c — **cek tanggal file**
- [ ] README bahasa Inggris, memuat kunci issuer **beserta alasannya**
- [ ] **Verifikasi ulang semua temuan negatif** tentang infrastruktur Creditcoin.
      Pelajaran G5: kesimpulan negatif tidak pernah dicek ulang siapa pun, jadi dia
      bertahan paling lama dan paling memalukan.
