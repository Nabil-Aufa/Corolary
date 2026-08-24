# Corolary — Model Bisnis & Materi Pitch

> Dokumen ini disiapkan untuk pembaca investor — utamanya **Credit Labs**, penyelenggara
> **CEIP (Creditcoin Ecosystem Investment Program)**: dana $10 juta, tiket investasi
> $25.000–$250.000, dengan **top 3 hackathon BUIDL CTC 2026 Fall langsung masuk
> due diligence**.
>
> **Disiplin angka:** setiap statistik di dokumen ini yang bersumber dari riset
> terverifikasi ditandai sebagai fakta dengan rujukan. Setiap statistik yang tidak
> bisa diverifikasi langsung ditandai eksplisit sebagai **ESTIMASI**, disertai cara
> hitungnya, supaya pembaca bisa menilai sendiri dan mengoreksinya. Tidak ada angka
> presisi yang dikarang untuk terdengar meyakinkan.

---

## 1. Ringkasan Eksekutif

**Corolary** adalah lapisan reputasi kredit di atas Creditcoin. Ia membaca aktivitas
pinjam-meminjam **nyata** di Ethereum mainnet (Aave V3, Morpho Blue, Compound V3),
membuktikannya secara kriptografis lewat **Attestcoin Protocol**, menyimpannya sebagai
fakta permanen di Creditcoin, menurunkan skor kredit 0–1000 dari fakta tersebut, lalu
memakai skor itu untuk memberi peminjam **rasio kolateral yang lebih efisien** —
150% turun berjenjang sampai 110% — di pasar pinjaman Creditcoin.

Corolary bukan produk "pinjaman tanpa jaminan". Semua pinjaman tetap over-kolateral;
yang berubah adalah **berapa banyak modal yang harus dikunci** peminjam dengan riwayat
terbukti. Ini pembeda yang menyelamatkan model ini dari kuburan proyek credit-scoring
on-chain sebelumnya (dibahas di §9).

---

## 2. Pernyataan Masalah

DeFi lending hari ini punya satu cacat struktural: **setiap peminjam diperlakukan
sebagai anonim berisiko tinggi**, tanpa kecuali. Protokol seperti Aave dan Compound
mewajibkan over-kolateralisasi **150–200%** — untuk meminjam $100, peminjam harus
mengunci $150–200 dalam bentuk aset lain.

Ini rasional secara teknis: tanpa identitas dan tanpa jalur hukum recourse, protokol
tidak punya cara membedakan dompet yang sudah dua tahun membayar lunas puluhan
pinjaman dari dompet yang dibuat lima menit lalu untuk kabur begitu diberi utang.
Keduanya diperlakukan sama.

Konsekuensinya dua arah:

1. **Modal terkunci berlebihan.** Setiap dolar kolateral ekstra adalah modal yang
   tidak produktif — tidak dipinjamkan, tidak menghasilkan yield tambahan, hanya
   duduk sebagai jaminan berlebih.
2. **Reputasi tidak punya nilai ekonomi.** Peminjam yang membangun riwayat kredit
   sempurna di satu protokol tidak membawa nilai itu ke mana pun. Riwayatnya terkunci
   di storage kontrak Ethereum, tidak bisa dibuktikan atau dipakai di tempat lain —
   termasuk di Creditcoin, chain yang justru dibangun di atas tesis kredit.

Attestcoin Protocol memecahkan tepat komponen yang hilang: cara **membuktikan** fakta
dari satu chain di chain lain, tanpa oracle terpusat yang bisa dibantah atau dipalsukan.

---

## 3. Solusi & Cara Kerja

Corolary punya tiga lapisan, dan mekanismenya bisa dijelaskan tanpa jargon:

1. **Bukti.** Setiap kali seseorang meminjam, membayar, atau dilikuidasi di Aave V3 /
   Morpho Blue / Compound V3 di Ethereum, itu tercatat sebagai event publik di chain
   tersebut. Corolary menangkap event itu, menunggu ~8 menit sampai attestor
   Attestcoin mengonfirmasinya, lalu meminta bukti kriptografis (Merkle proof +
   continuity proof) bahwa event itu benar terjadi di blok Ethereum yang sah.
2. **Catatan permanen.** Bukti itu diverifikasi secara on-chain di Creditcoin (lewat
   precompile Block Prover), lalu faktanya — "dompet X melunasi $Y di protokol Z pada
   waktu T" — disimpan permanen di kontrak `FactRegistry`. Fakta ini publik dan bisa
   dibaca siapa saja, kapan saja, tanpa membayar biaya pembuktian ulang.
3. **Skor.** Kumpulan fakta seorang dompet diringkas jadi skor 0–1000: seberapa
   banyak dan besar pinjaman yang dilunasi, seberapa tepat waktu, apakah pernah
   dilikuidasi, seberapa lama riwayatnya, seberapa beragam protokol yang dipakai.
   Setiap poin skor bisa ditelusuri balik ke fakta spesifik yang membentuknya — tidak
   ada kotak hitam.
4. **Manfaat konkret.** Skor itu dipakai di pasar pinjaman Corolary sendiri di
   Creditcoin: peminjam dengan skor tinggi mengunci kolateral lebih sedikit (turun
   dari 150% baseline sampai 110% untuk tier tertinggi) untuk pinjaman yang sama.
   Protokol tetap sepenuhnya over-kolateral dan solven — hanya distribusi bebannya
   yang jadi adil terhadap riwayat.

**Kenapa ini tahan terhadap manipulasi (Sybil resistance):** dompet baru itu murah
dibuat, tapi *riwayat baik* tidak murah dipalsukan. Memalsukan dua tahun pembayaran
lunas di Aave menuntut modal nyata yang benar-benar dikunci lama, dengan bunga yang
benar-benar dibayar. Biaya memalsukan riwayat kira-kira setara biaya memiliki riwayat
asli — sistem ini Sybil-resistant karena konstruksinya, bukan karena filter tambahan.

---

## 4. Kenapa Sekarang & Kenapa Creditcoin

Tiga hal berubah bersamaan yang membuat Corolary baru mungkin dibangun sekarang, bukan
lebih awal:

- **Attestcoin Protocol readability sudah live di Creditcoin** (diverifikasi langsung
  ke jaringan pada 2026-08-22). Sebelum ini, membuktikan aktivitas Ethereum secara
  trustless di chain lain butuh bridge kustom, oracle terpusat, atau kepercayaan pada
  operator — semua pilihan itu melemahkan klaim "reputasi terbukti".
- **CC3 Testnet bisa membaca Ethereum mainnet asli** (`chainKey = 3`), bukan hanya
  testnet Sepolia. Ini berarti Corolary bisa memenuhi syarat deploy-di-testnet
  hackathon **sambil tetap memakai data produksi sungguhan** — bukan token karangan
  yang di-mint khusus untuk demo.
- **Creditcoin sudah punya DNA kredit**, bukan chain generik yang baru mencoba masuk
  ke vertikal kredit. Dibangun oleh Gluwa sejak 2017/2019 sebagai infrastruktur kredit
  RWA untuk emerging market, dengan traksi nyata: **4,27 juta transaksi kredit, $79,7
  juta volume, 337.000 nasabah**, lewat partner seperti **Aella** (fintech Nigeria,
  $100 juta+ pinjaman) dan MoU dengan **Bank Sentral Nigeria** untuk eNaira. Corolary
  tidak butuh meyakinkan Creditcoin bahwa kredit itu bisnis yang bagus — mereka sudah
  membangun sepuluh tahun di atas tesis itu. Corolary menambahkan sisi crypto-native
  yang belum mereka punya.

Ekosistem aplikasi Creditcoin saat ini masih sangat tipis (praktis: satu DEX, satu
hub, satu bridge, satu wallet) — artinya ruang untuk infrastruktur kredit baru yang
dipakai dApp lain masih kosong, bukan pasar yang sudah penuh sesak.

---

## 5. Ukuran Pasar

> **Catatan metodologi:** dokumen ini disusun tanpa akses ke data pasar real-time.
> Semua angka di bagian ini adalah **ESTIMASI** berbasis pengetahuan umum tentang
> orde besaran industri DeFi lending, bukan hasil query ke sumber data langsung
> (mis. DeFiLlama). Sebelum dipakai di depan investor sungguhan, angka-angka ini
> **harus diverifikasi ulang** dengan data TVL terkini. Yang ditampilkan di sini
> adalah kerangka berpikir dan urutan besaran, bukan angka final.

**Total addressable market secara struktural:** setiap dolar yang dipinjamkan di DeFi
lending market besar (Aave, Compound, Morpho, Spark, dan sejenisnya) hari ini
mewajibkan kolateral 150–200% dari nilai pinjaman. DeFi lending secara historis
adalah salah satu segmen terbesar di DeFi, dengan total value locked (TVL) yang
— dalam orde besaran, berdasarkan siklus pasar beberapa tahun terakhir — biasanya
berkisar **puluhan miliar dolar AS** gabungan lintas protokol lending besar
(**ESTIMASI orde besaran**, bukan angka presisi; berfluktuasi signifikan mengikuti
siklus pasar crypto).

**Cara berpikir tentang "modal terkunci berlebihan" (bukan klaim dolar spesifik,
melainkan ilustrasi mekanisme):**

| Skenario | Kolateral dibutuhkan per $100 pinjaman | Modal ekstra vs tier terbaik |
|---|---|---|
| Baseline (tanpa reputasi) — 150% | $150 | — |
| Tier menengah — 130% | $130 | $20 lebih sedikit |
| Tier terbaik (riwayat terbukti) — 110% | $110 | $40 lebih sedikit (≈27% dari $150) |

Kalau bahkan sebagian kecil dari basis peminjam DeFi punya riwayat yang bisa
dibuktikan dan berpindah dari tier 150% ke tier yang lebih efisien, jumlah modal yang
dibebaskan **untuk digunakan produktif di tempat lain** (bukan hilang, hanya tidak
lagi terkunci sebagai kolateral berlebih) berpotensi signifikan relatif terhadap TVL
lending yang ada — tapi ini eksplisit **ilustrasi arah**, bukan proyeksi dolar.

**Pasar yang lebih dekat dan lebih terverifikasi untuk Corolary tahap awal** bukan
"seluruh DeFi lending", melainkan dua segmen konkret:
1. **Pengguna DeFi mapan** yang sudah punya riwayat pinjam-meminjam panjang di
   Ethereum (Aave/Morpho/Compound) dan mencari cara memonetisasi riwayat itu di chain
   lain — segmen ini terukur lewat jumlah dompet aktif di protokol-protokol tersebut,
   bukan lewat TVL.
2. **Partner lender existing Creditcoin/Gluwa** (Credal, Aella, dan jaringan mereka)
   yang sudah melayani **337.000 nasabah** dengan **$79,7 juta** volume kredit
   terverifikasi (fakta, bukan estimasi) — Corolary bisa jadi lapisan skor
   crypto-native tambahan untuk basis pengguna yang sudah ada ini, tanpa perlu
   membangun basis pengguna dari nol.

---

## 6. Aliran Pendapatan

Lima aliran pendapatan, masing-masing dengan mekanisme dan harga konkret:

### 6.1 Origination fee — 0,5% dari pokok pinjaman
**Mekanisme:** setiap kali peminjam membuka posisi utang baru di EfficiencyMarket
Corolary, protokol memotong 0,5% dari jumlah pokok sebagai fee sekali bayar, mirip
fee origination di lending fintech tradisional. **Siapa membayar:** peminjam, dipotong
otomatis saat pencairan. **Contoh:** pinjaman $10.000 → fee $50 sekali di awal.

### 6.2 Interest spread — 1–2%
**Mekanisme:** selisih antara APY yang dibayar peminjam dan APY yang diterima
penyedia likuiditas (mirip model lending pool standar: `borrowRate = supplyRate +
spread`). Spread ini pendapatan berulang selama posisi terbuka, bukan sekali bayar.
**Siapa membayar:** pasar (implisit, lewat selisih suku bunga) — tidak ada tagihan
eksplisit ke siapa pun.

### 6.3 Langganan Credit Graph API
**Mekanisme:** protokol lain (di dalam maupun luar Creditcoin) yang ingin membaca
skor kredit Corolary untuk keputusan mereka sendiri (mis. underwriting otomatis,
scoring risiko, dashboard analitik) membayar akses ke `/v1/score/:address` dan
endpoint terkait di luar rate limit gratis. **Model harga yang masuk akal untuk
tahap awal:** tingkatan berlangganan bulanan berbasis volume query (mis. tier gratis
dengan rate limit rendah untuk eksplorasi, tier berbayar untuk penggunaan produksi)
— angka nominal harga belum ditetapkan di dokumen ini karena butuh riset harga
kompetitor B2B API sebelum dikomit; yang dikunci adalah **modelnya**: bayar-per-akses
berulang, bukan sekali beli. **Siapa membayar:** builder/protokol pihak ketiga.

### 6.4 Sponsored facts
**Mekanisme:** menambahkan adapter untuk protokol lending baru (di luar Aave V3/
Morpho Blue/Compound V3 yang sudah didukung) membutuhkan kerja integrasi dan biaya
proving berkelanjutan untuk event mereka. Protokol yang ingin event-nya diindeks dan
dibuktikan secara eager oleh Corolary — supaya penggunanya ikut mendapat skor kredit
— bisa mensponsori biaya integrasi dan/atau biaya proving berjalan. **Siapa
membayar:** protokol penerbit yang ingin masuk ke Credit Graph. **Nilai bagi mereka:**
akses ke basis peminjam Corolary yang sudah terverifikasi reputasinya, dan distribusi
gratis lewat UI Corolary.

### 6.5 Lisensi B2B ke partner lender Gluwa/Credal
**Mekanisme:** Credal — API kredit on-chain milik Gluwa untuk lender fintech seperti
Aella — melayani data kredit **off-chain**. Corolary melengkapi itu dengan sisi
**crypto-native**: skor berbasis riwayat DeFi yang tidak pernah dimiliki Credal.
Corolary melisensikan akses Credit Graph ke Credal/Gluwa sebagai modul tambahan yang
bisa mereka tawarkan ke jaringan lender mereka (Aella dan sejenisnya), dengan skema
lisensi B2B (flat fee tahunan atau revenue share per keputusan kredit yang memakai
skor Corolary — struktur pastinya adalah bahan negosiasi, bukan sesuatu yang bisa
dikunci sepihak di dokumen ini). **Siapa membayar:** Gluwa/Credal atau lender di
jaringan mereka.

---

## 7. Unit Economics

Biaya inti Corolary adalah **biaya proving** — membeli bukti kriptografis dari
Attestcoin Protocol untuk setiap fakta yang dicatat. Angka ini **fakta terverifikasi
dari tabel biaya resmi Creditcoin**, bukan asumsi:

| Umur transaksi saat di-prove | Panjang continuity proof | Biaya per fakta |
|---|---|---|
| ~10 menit (jendela murah, eager proving) | 10 hash | **2,59 × 10⁻⁵ CTC** |
| ~24 jam+ (jendela mahal) | 1000 hash | **3,13 × 10⁻⁴ CTC** |

Corolary secara arsitektural **selalu eager** (lihat `docs/architecture.md` §3) —
setiap fakta dibuktikan dalam jendela murah, tidak pernah on-demand untuk data lama.
Jadi biaya operasional yang relevan adalah kolom pertama.

### 7.1 Biaya vs volume fakta

| Volume fakta / bulan | Total biaya proving (CTC) |
|---|---|
| 1.000 | 0,0259 CTC |
| 10.000 | 0,259 CTC |
| 100.000 | **2,59 CTC** |
| 1.000.000 | 25,9 CTC |

Karena dokumen ini tidak memakai harga pasar CTC yang terverifikasi (harga token
berfluktuasi dan tidak diverifikasi ulang saat menulis dokumen ini), konversi ke USD
di bawah memakai **rentang ilustratif eksplisit** semata-mata untuk menunjukkan orde
besaran — bukan prediksi harga:

| Volume fakta / bulan | Biaya CTC | Estimasi biaya USD (ilustratif, @ $0,05/CTC) | Estimasi biaya USD (ilustratif, @ $0,50/CTC) |
|---|---|---|---|
| 100.000 | 2,59 CTC | $0,13 | $1,30 |
| 1.000.000 | 25,9 CTC | $1,30 | $12,95 |

Bahkan di skenario harga CTC 10x lebih tinggi dari batas atas ilustratif ini, biaya
infrastruktur inti tetap **jauh di bawah** pendapatan dari satu transaksi bisnis
tunggal (lihat §7.2). Kesimpulan ini kokoh terhadap ketidakpastian harga token karena
rentang biayanya sangat sempit dalam dolar absolut.

### 7.2 Biaya vs pendapatan — satu transaksi

Bandingkan dengan pendapatan dari **satu** peminjam memakai origination fee (§6.1):

| Item | Nilai |
|---|---|
| Pinjaman contoh | $10.000 |
| Origination fee (0,5%) | $50 |
| Fakta yang perlu dibuktikan untuk merekonstruksi riwayat kredit peminjam ini (ilustratif, mis. 20 event pinjam/bayar historis) | 20 |
| Biaya proving 20 fakta | 20 × 2,59×10⁻⁵ = 5,18×10⁻⁴ CTC (≈ $0,00003–$0,0003 pada rentang ilustratif di atas) |
| **Margin kotor pada fee ini saja** | **mendekati 100%** |

Interest spread (§6.2) dan aliran B2B/API (§6.3–6.5) adalah pendapatan **tambahan**
di atas ini, tanpa menambah biaya proving marginal berarti — fakta yang sama dipakai
ulang oleh semua konsumen skor. Ini struktur biaya khas infrastruktur data: biaya
marginal per pembacaan tambahan mendekati nol, sementara setiap pembacaan baru
(langganan API, lisensi B2B) adalah pendapatan murni tambahan.

**Kesimpulan unit economics:** struktur biaya Corolary didominasi oleh biaya
proving yang secara struktural sangat kecil (orde 10⁻⁵ CTC per fakta), sementara
pendapatan per transaksi bisnis (origination fee, spread, langganan) berorde dolar
penuh. Ini menghasilkan margin kotor mendekati 100% pada level infrastruktur —
karakteristik yang khas untuk bisnis data/infrastruktur, bukan bisnis modal-intensif
seperti lending tradisional.

---

## 8. Strategi Go-to-Market

**Fase 0 — Cold start (pasca-hackathon, 0–3 bulan):**
Target bukan massa, tapi **pengguna DeFi mapan** — dompet yang sudah punya riwayat
panjang di Aave V3/Morpho Blue/Compound V3 Ethereum mainnet. Mereka adalah satu-
satunya segmen yang bisa langsung mendapat skor tinggi tanpa menunggu waktu, karena
riwayat mereka *sudah ada* dan tinggal dibuktikan. Distribusi: komunitas DeFi power-
user (Twitter/X crypto, Discord protokol lending besar), positioning sebagai "cek
skormu gratis, lihat berapa banyak modal yang bisa kamu hemat".

**Fase 1 — Bukti nilai (3–6 bulan):**
Begitu ada cukup dompet dengan skor terbukti, buka EfficiencyMarket untuk pinjaman
riil di Creditcoin dengan rasio kolateral berjenjang. Nilai konkret yang bisa
ditunjukkan: "$X modal dihemat" per pengguna, bukan klaim abstrak.

**Fase 2 — Ekspansi lewat infrastruktur (6–12 bulan):**
Dengan `FactRegistry` dan Credit Graph API sudah berjalan, buka akses ke builder lain
di ekosistem Creditcoin — dApp lending/kredit lain bisa membaca skor Corolary tanpa
membangun pipeline attestation mereka sendiri. Ini jalur aliran pendapatan #3 dan #4
(§6.3, §6.4), sekaligus memenuhi mandat pertumbuhan ekosistem CEIP.

**Fase 3 — Kemitraan B2B (12+ bulan, butuh pendanaan):**
Masuk ke jaringan lender existing Gluwa/Credal (Aella dan sejenisnya) sebagai modul
skor crypto-native tambahan. Ini butuh hubungan dagang formal dan waktu due diligence
lebih panjang — realistis hanya bisa dikejar serius setelah didanai (§11).

---

## 9. Lanskap Kompetitif

> **Status verifikasi:** bagian ini diperbarui **2026-08-25** lewat pencarian web
> langsung, menggantikan versi sebelumnya yang ditulis dari ingatan. Versi lama
> menyebut Spectral/Cred/ARCx "gagal" tanpa rujukan — klaim itu **tidak akurat untuk
> Spectral** dan sudah dikoreksi di bawah. Rujukan ada di §9.7.
>
> **Kenapa koreksi ini penting:** pembaca dokumen ini adalah Credit Labs. Mereka
> mengenal lanskap ini. Satu klaim kompetitif yang salah dan mudah dicek merusak
> kredibilitas seluruh dokumen — termasuk bagian yang benar.

Corolary bersinggungan dengan **empat kategori tetangga**. Tidak ada satu pun pemain
yang menggabungkan keempatnya, dan tidak ada satu pun yang hadir di Creditcoin.

### 9.1 Kategori A — Skor kredit on-chain

Kategori paling ramai dan paling tua (sejak ~2020).

| Proyek | Yang mereka bangun | Status terverifikasi (Agu 2026) |
|---|---|---|
| **Spectral** | MACRO score — skor risiko kredit multi-aset dari data transaksi on-chain; wallet dibundel jadi NFC (non-fungible credit) | **Masih aktif.** Skor on-chain paling banyak dikutip secara akademis di kategori ini; didanai General Catalyst. **Bukan proyek mati.** |
| **Cred Protocol** | Skor ala FICO untuk dompet, mencampur data on-chain + off-chain + identitas | Aktif, masih di tahap eksperimental |
| **ARCx** | "DeFi Passport" — skor portabel lintas platform | Aktif sebagai skor; produk under-collateralized lending-nya tidak bertahan |
| **Credora** | Credit intelligence institusional lewat proof of solvency terenkripsi | Aktif dan relatif berhasil, tapi di segmen **institusi ber-KYC** — tidak scalable ke ritel anonim tanpa balik butuh identitas |
| **Guild** | Reputasi berbasis jaringan/endorsement, bukan skor numerik statis | Eksperimental |
| **Ethos** | Skor reputasi dari riwayat wallet | Eksperimental |

**Pembacaan yang jujur atas kategori ini:** klaim yang benar **bukan** "mereka gagal",
melainkan — **kategori ini sudah lima tahun berjalan dan belum ada satu pun yang
mencapai adopsi ekonomi berarti.** Skor diproduksi; skor jarang dikonsumsi. Alasannya
struktural, dan penting untuk dipahami karena Corolary harus menghindarinya:

1. **Skornya adalah kotak hitam.** Model risiko proprietary. Protokol yang mau memakai
   skor itu harus mempercayai penerbitnya — persis jenis kepercayaan yang seharusnya
   dihapus oleh DeFi. Tidak ada protokol besar yang mau menaruh solvensinya di atas
   angka yang tidak bisa mereka verifikasi sendiri.
2. **Skor tidak pernah tersambung ke manfaat ekonomi konkret.** Mereka menjual angka,
   lalu berharap orang lain membangun pasar yang memakainya. Pasar itu tidak pernah
   datang dalam skala berarti.
3. **Yang tersambung ke pasar, tersambung ke produk yang salah** — pinjaman tanpa
   jaminan ke dompet anonim (lihat §9.2).

### 9.2 Kategori B — Pinjaman tanpa jaminan (ruang yang Corolary tolak masuki)

| Proyek | Model | Catatan |
|---|---|---|
| **3Jane** | Credit line USDC tanpa kolateral, peer-to-pool; underwriting **off-chain** memakai data on-chain + rekening bank + skor kredit tradisional | **Pesaing ide paling serius.** Seed $5,2 juta dipimpin Paradigm (Jun 2024). Yield: Aave base rate + spread + premi risiko gagal bayar |
| **TrueFi** | Pinjaman tanpa jaminan, rekam jejak pelunasan sebagai reputasi | Aktif |
| **Goldfinch** | Underwriting berbasis aktivitas bisnis nyata, bukan over-kolateralisasi | Aktif, fokus RWA |
| **Maple** | Kredit institusional dengan pool delegate | Aktif |

**Kenapa 3Jane justru memperkuat posisi Corolary, bukan melemahkannya:** underwriting
3Jane berjalan **di luar chain, lewat algoritma tertutup**, dan menarik data bank serta
skor kredit tradisional. Untuk memakainya, kamu harus mempercayai algoritma mereka dan
menyerahkan data off-chain. Corolary tidak meminta keduanya: setiap komponen skor
menunjuk ke `factId` yang bisa diverifikasi ulang oleh siapa pun, on-chain, tanpa
mempercayai Corolary sedikit pun. Ini bukan produk yang sama dengan sudut pandang
berbeda — ini asumsi kepercayaan yang berbeda.

**Pola risiko yang dihindari seluruh kategori ini:** tanpa identitas dan tanpa jalur
hukum recourse, insentif rasional peminjam begitu skornya cukup tinggi untuk mendapat
pinjaman besar tanpa jaminan penuh adalah **meminjam sebanyak mungkin lalu tidak
membayar** — biayanya nol karena dompet anonim bisa ditinggalkan. Skor yang bagus
tidak mengubah kalkulus itu selama taruhannya tetap "pinjaman tanpa jaminan".

### 9.3 Kategori C — Infrastruktur bukti (paling dekat dengan `FactRegistry`)

Ini tetangga terdekat Corolary **secara teknis**, dan bagian yang paling sering
terlewat saat orang membandingkan Corolary dengan proyek skor kredit.

| Proyek | Yang mereka lakukan |
|---|---|
| **Axiom** | Query terverifikasi ZK atas seluruh riwayat Ethereum (block header, account, storage) dengan callback ke kontrak |
| **Herodotus** | Storage proof + Historical Block Hash Accumulator — akses state historis melewati batas 256 blok EVM |
| **Brevis** | ZK data coprocessor + zkVM; marketplace query (`zkQueryNet`) |
| **Lagrange** | Komputasi lintas chain, arsitektur hibrida ZK + optimistic |

**Perbedaan arsitektur yang nyata — dan ini klaim teknis inti Corolary:** keempatnya
adalah **query-per-request**. Setiap pertanyaan tentang riwayat adalah proof baru yang
harus dibayar lagi. Model biayanya berbanding lurus dengan **jumlah pembacaan**.

Corolary membalik itu: bukti dibuat **sekali**, di jendela biaya termurah
(< 24 jam, 2,59×10⁻⁵ CTC — 10x lebih murah dari jendela mahal), lalu **faktanya
disimpan permanen** di `FactRegistry`. Setiap pembacaan berikutnya, oleh siapa pun,
selamanya, adalah `SLOAD` biasa. Biaya berbanding lurus dengan **jumlah fakta**, bukan
jumlah pembacaan — dan jumlah fakta terbatas sementara jumlah pembacaan tidak.

Inilah yang membuat Corolary infrastruktur dan bukan aplikasi, dan inilah yang harus
ditonjolkan ke juri teknis — **bukan** bagian scoring-nya, yang secara kategori sudah
ramai.

### 9.4 Kategori D — Cross-chain lending

**Radiant** (via LayerZero), **Balanced**, dan sejenisnya memindahkan **kolateral**
lintas chain: deposit di chain A, pinjam di chain B, dengan pesan bridge merelai bukti
deposit. Corolary memindahkan **reputasi**, bukan aset. Tidak ada aset Corolary yang
pernah melintasi chain — hanya fakta yang dibuktikan. Kategori berbeda; disebut di sini
hanya supaya tidak tertukar saat orang mendengar "cross-chain lending".

### 9.5 Di ekosistem Creditcoin sendiri

Pencarian terhadap ekosistem Creditcoin (Agu 2026) memunculkan **Penguinbase** (hub
resmi ekosistem: airdrop, game, dApp, NFT dengan akses token-gated) dan **Spacecoin**
(internet satelit terdesentralisasi, program reward untuk holder CTC).

**Tidak ditemukan satu pun proyek credit scoring crypto-native di Creditcoin.**

Yang paling dekat adalah **Credal milik Gluwa sendiri** — dan itu kredit **off-chain**
(KYC, riwayat pembayaran fintech tradisional). Ini memperkuat, bukan melemahkan,
posisi di §10: Corolary bukan pesaing Credal, melainkan sisi crypto-native yang
belum mereka punya.

### 9.6 Matriks orisinalitas (penilaian jujur)

| Komponen | Orisinal? | Alasan |
|---|---|---|
| Skor kredit dari riwayat DeFi | ❌ | Ada sejak 2020; enam pemain aktif (§9.1) |
| Membuktikan riwayat Ethereum secara trustless ke kontrak | ❌ | Axiom/Herodotus/Brevis/Lagrange sudah (§9.3) |
| Skor → rasio kolateral berjenjang, tetap over-kolateral | 🟡 | Jarang — mayoritas kategori mengejar pinjaman *tanpa* jaminan (§9.2) |
| **Eager proving + registry fakta permanen yang dibaca gratis** | ✅ | Tidak ditemukan padanannya; semua pembanding query-per-request |
| **Setiap poin skor menunjuk ke bukti yang bisa diverifikasi ulang** | ✅ | Semua pembanding di §9.1 adalah model tertutup |
| **Hadir di Creditcoin** | ✅ | Kategori kosong total (§9.5) |

**Kesimpulan yang harus dipegang saat pitching:** yang orisinal dari Corolary bukan
*ide skor kredit on-chain* — itu ide lama dan ramai. Yang orisinal adalah **kombinasi
arsitekturnya**: bukti eager yang disimpan permanen, skor yang sepenuhnya dapat
diaudit, produk yang menolak masuk ke ruang pinjaman-tanpa-jaminan, dan penempatan di
chain yang DNA-nya memang kredit tapi lapisan crypto-native-nya masih kosong.

Jangan pernah mengklaim "belum ada yang melakukan ini". Klaim yang benar dan tetap
kuat: **"kategori ini sudah lima tahun mencoba dan belum ada yang tersambung ke
manfaat ekonomi nyata — karena semuanya menjual angka yang harus dipercaya, bukan
bukti yang bisa diverifikasi."**

**Jawaban satu kalimat untuk pertanyaan juri "apa bedanya dengan Spectral?":**
> Spectral memberi kamu **skor**. Corolary memberi kamu **bukti** yang bisa
> diverifikasi ulang oleh siapa pun, on-chain, tanpa perlu mempercayai kami.

### 9.7 Yang BELUM bisa diverifikasi (jangan diklaim di deck)

1. **Submission peserta lain di BUIDL CTC 2026 Fall.** Belum diumumkan. Klaim
   "tidak ada tim lain yang punya ini" **tidak dapat dibuktikan** dan tidak boleh
   masuk deck.
2. **Angka TVL/traksi terkini** dari pemain di §9.1–§9.2. Yang diverifikasi hanya
   *keberadaan dan status aktif*, bukan ukuran. Jangan mengarang angka pembanding.
3. **Daftar lengkap dApp Creditcoin.** Pencarian tidak memunculkan direktori resmi
   yang menyeluruh; §9.5 adalah hasil terbaik yang tersedia, bukan sensus. Klaim
   "ekosistem tipis" aman; klaim "hanya ada N dApp" tidak.

**Rujukan:**
- Metaverse Post — *7 Projects Building Crypto-Native Credit Scores In 2026*: https://mpost.io/7-projects-building-crypto-native-credit-scores-in-2026/
- ChainAware — *DeFi Credit Score Platforms Compared*: https://chainaware.ai/blog/defi-credit-score-comparison/
- General Catalyst — *Our Investment in Spectral*: https://www.generalcatalyst.com/stories/our-investment-in-spectral-building-programmable-creditworthiness
- Leviathan News — *3Jane Lending Protocol Explained*: https://leviathannews.substack.com/p/3jane-lending-protocol-explained
- 3Jane Docs: https://docs.3jane.xyz/introduction
- ABCDE — *A Deep Dive into ZK Coprocessor and Its Future*: https://www.abcde.com/blog/a-deep-dive-into-zk-coprocessor-and-its-future
- Herodotus Docs — *Storage Proofs*: https://docs.herodotus.dev/herodotus-docs/developers/storage-proofs
- CoinMarketCap — *Creditcoin Latest Updates*: https://coinmarketcap.com/cmc-ai/creditcoin/latest-updates/
- Reactive Network — *Cross-Chain Lending Protocol*: https://blog.reactive.network/cross-chain-lending-protocol/

---

## 10. Kecocokan Strategis dengan Creditcoin

Creditcoin bukan chain generik yang kebetulan menerima submission kredit. DNA-nya
adalah **infrastruktur kredit RWA untuk emerging market**:

- Dibangun oleh **Gluwa** sejak 2017/2019.
- **Credal** — API kredit on-chain Gluwa untuk lender fintech — sudah memproses
  **4,27 juta transaksi kredit, $79,7 juta volume, 337.000 nasabah** (fakta
  terverifikasi, bukan estimasi).
- Partner utama **Aella**, fintech Nigeria dengan **$100 juta+** pinjaman
  tersalurkan, plus **MoU dengan Bank Sentral Nigeria** untuk eNaira (CBDC).
- Positioning saat ini: *"The Layer 1 Built for Cross-Chain Builders"*.

**Celah yang diisi Corolary:** seluruh traksi di atas adalah kredit **off-chain** —
underwriting berbasis data fintech tradisional (riwayat pembayaran, KYC, dsb).
Creditcoin belum punya lapisan skor yang berasal dari aktivitas **crypto-native**:
riwayat pinjam-meminjam di DeFi Ethereum, dibuktikan secara kriptografis, tanpa
bergantung pada data pihak ketiga yang harus dipercaya.

Corolary bukan bersaing dengan Credal — **Corolary adalah pasangan sisi yang hilang.**
Credal tahu siapa yang layak dipercaya berdasarkan riwayat finansial off-chain
(pinjaman fintech, pembayaran cicilan). Corolary tahu siapa yang layak dipercaya
berdasarkan riwayat finansial on-chain (pinjaman DeFi, pembayaran kripto). Digabung,
Gluwa/Credal punya gambaran kredit yang jauh lebih lengkap untuk memutuskan siapa
yang layak diberi syarat lebih baik — baik di dunia fintech emerging market mereka
maupun di produk-produk baru berbasis Creditcoin. Ini alasan konkret aliran
pendapatan #5 (§6.5) bukan sekadar ide di atas kertas.

---

## 11. Peta Jalan

**Selama hackathon (sampai submission):**
- FactRegistry + minimal dua adapter protokol (Aave V3, satu lagi) hidup di CC3
  Testnet, membaca event Ethereum mainnet asli.
- CreditGraph menghasilkan skor untuk alamat nyata dengan riwayat Aave nyata.
- EfficiencyMarket: minimal satu jalur pinjam dengan rasio kolateral mengikuti skor,
  berfungsi penuh end-to-end.
- UI: Score Explorer dan Proof Viewer, keduanya membaca data nyata (tanpa fixture di
  build produksi).

**Bulan 1–3 pasca-hackathon (bootstrap, sebelum atau selagi menunggu CEIP):**
- Tambah adapter Morpho Blue dan Compound V3 (sudah dispesifikasikan di
  `docs/architecture.md`, tinggal diimplementasikan).
- Buka Credit Graph API publik dengan rate limit gratis untuk builder eksplorasi.
- Mulai onboarding pengguna DeFi mapan (Fase 0 GTM, §8).

**Dengan pendanaan CEIP ($25K–$250K, sesuai tiket):**
- **Keamanan:** audit kontrak profesional (CertiK, sudah tersedia lewat benefit
  pemenang hackathon: 8K credits repository audit) sebelum menaikkan TVL riil.
- **Cakupan sumber data:** tambah protokol Ethereum lain (Spark, Aave V2) dan — begitu
  Attestcoin mendukung source chain lain di luar Ethereum — perluas ke chain
  tambahan tanpa mengubah arsitektur inti (FactRegistry sudah generik per-`chainKey`).
- **Kemitraan formal dengan Gluwa/Credal:** jalur lisensi B2B (§6.5, §10) butuh waktu
  hubungan dagang yang hanya realistis dikejar dengan tim & modal setelah pendanaan.
- **Tim:** dari 2 orang ke tim inti kecil (mis. tambahan smart contract engineer dan
  data/backend engineer) untuk menaikkan kecepatan menambah adapter protokol dan
  memperkuat pengamanan indexer.
- **Writability Attestcoin:** protokol sedang diaudit pihak ketiga (belum rilis saat
  dokumen ini ditulis). Begitu rilis, Corolary bisa mengeksplorasi menulis balik skor
  ke Ethereum — membuka reputasi terbukti dipakai langsung di protokol Ethereum asli,
  bukan hanya di Creditcoin. Ini item roadmap **bersyarat**, bukan janji timeline.

---

## 12. Risiko & Mitigasi

| Risiko | Kejujuran soal dampaknya | Mitigasi |
|---|---|---|
| **Cold start** | Sistem skor tidak berguna tanpa fakta terbukti dulu; pengguna pertama tidak punya insentif menunggu | Fase 0 GTM menargetkan pengguna yang **sudah** punya riwayat panjang — skor mereka langsung tinggi begitu diindeks, tidak perlu menunggu membangun riwayat baru |
| **Ketergantungan Ethereum-saja** | Attestcoin readability saat ini hanya mendukung Ethereum mainnet dan Sepolia sebagai source chain; klaim "multi-chain" belum bisa dibuktikan | Jangan janjikan multi-chain sekarang; posisikan arsitektur sebagai **siap ekspansi** (FactRegistry generik per-`chainKey`) begitu Attestcoin menambah source chain lain |
| **Writability belum rilis** | Corolary tidak bisa menulis balik ke Ethereum sama sekali saat ini — semua desain harus searah | Desain produk sepenuhnya menghindari kebutuhan tulis-balik; ini bukan tambal sulam tapi keputusan arsitektur dari awal (lihat `docs/architecture.md` §2) |
| **Ketidakpastian regulasi** | Skor kredit dan pinjaman — bahkan yang over-kolateral — bisa masuk area abu-abu regulasi finansial di berbagai yurisdiksi, terutama bila dihubungkan ke partner lender fintech (Aella dkk.) yang beroperasi di bawah regulasi lokal (mis. Nigeria) | Tidak ada mitigasi teknis untuk risiko regulasi — ini area yang butuh nasihat hukum spesifik yurisdiksi sebelum ekspansi B2B (§6.5) serius dikejar; diakui terbuka di sini alih-alih diabaikan |
| **Konsentrasi sumber data** | Mayoritas fakta awal akan berasal dari satu atau dua protokol (Aave V3) sampai adapter lain selesai — skor jadi kurang representatif untuk peminjam yang aktif di protokol lain | Prioritas roadmap pasca-hackathon (§11) menambah adapter Morpho Blue/Compound V3/Spark lebih dulu sebelum fitur baru lain |
| **Manipulasi skor via wash-trading terkoordinasi** | Aktor dengan modal besar secara teori bisa membuat pinjam-bayar berulang antar dompet miliknya sendiri untuk menaikkan skor palsu | Bobot skor memakai kombinasi modal-berisiko × durasi × keragaman lawan-transaksi (bukan hanya jumlah transaksi), membuat wash-trading tetap mahal secara ekonomi meski secara teknis mungkin — ini area yang perlu terus diawasi dan disempurnakan, bukan dianggap selesai |

---

## 13. Kerangka Pitch Deck

12–15 slide, urutan naratif problem → solusi → bukti → bisnis → tim/ask.

1. **Cover** — nama produk (Corolary), tagline ("reputasi yang mengikuti dari
   bukti"), track (DeFi), logo, nama tim.
2. **Masalah** — over-kolateralisasi 150–200% berlaku sama untuk semua orang;
   reputasi kredit terkunci di chain asalnya, tak bisa dibuktikan atau dibawa pergi.
3. **Kenapa masalah ini belum terpecahkan** — kategori credit-scoring on-chain
   sudah lima tahun berjalan (Spectral, Cred, ARCx, Credora) tanpa satu pun mencapai
   adopsi ekonomi berarti: mereka menjual **angka yang harus dipercaya**, dan yang
   tersambung ke pasar tersambung ke produk yang salah — pinjaman tanpa jaminan ke
   dompet anonim tanpa recourse (§9).
4. **Solusi Corolary dalam satu kalimat** — riwayat kredit terbukti kriptografis dari
   Ethereum mainnet, dipakai untuk efisiensi kolateral (150% → 110%), bukan pinjaman
   tanpa jaminan.
5. **Cara kerja (diagram tiga lapis)** — FactRegistry → CreditGraph →
   EfficiencyMarket, dengan Attestcoin Protocol sebagai fondasi bukti.
6. **Kedalaman integrasi Attestcoin** — eager proving (10x lebih murah di jendela
   segar), batch proving, replay protection, cek `receiptStatus`, `QueryBuilder` untuk
   ekstraksi field selektif. Ini slide yang menunjukkan kedalaman teknis ke juri.
7. **Demo langsung / screenshot Proof Viewer** — satu dompet nyata, satu fakta nyata,
   tautan ke transaksi Ethereum sungguhan yang membentuk skornya.
8. **Kenapa ini tahan manipulasi** — Sybil resistance: biaya memalsukan riwayat ≈
   biaya memiliki riwayat asli.
9. **Model bisnis** — lima aliran pendapatan (§6) dalam satu tabel ringkas.
10. **Unit economics** — biaya proving mendekati nol (2,59×10⁻⁵ CTC/fakta) vs
    pendapatan per transaksi berorde dolar; margin kotor mendekati 100%.
11. **Ukuran pasar & GTM** — kerangka TAM (dengan disclaimer estimasi), fase go-to-
    market dimulai dari pengguna DeFi mapan.
12. **Kecocokan strategis dengan Creditcoin** — Credal + Aella + traksi
    4,27 juta transaksi/$79,7 juta/337.000 nasabah; Corolary sebagai pelengkap sisi
    crypto-native.
13. **Lanskap kompetitif** (§9) — kenapa kategori skor on-chain stagnan (kotak
    hitam, tidak tersambung ke manfaat ekonomi), kenapa infrastruktur bukti
    (Axiom/Herodotus/Brevis) query-per-request sementara Corolary menyimpan fakta
    permanen, dan kenapa Corolary berbeda secara struktural (over-collateralized
    selalu, bukan gradasi framing). **Jangan pakai kata "gagal" untuk Spectral —
    mereka masih aktif dan pembaca tahu itu.**
14. **Roadmap & penggunaan dana CEIP** — audit keamanan, ekspansi adapter protokol,
    kemitraan formal Gluwa/Credal, ekspansi tim.
15. **Tim & ask** — Dev A/Dev B, peran masing-masing, kontak, ajakan untuk masuk
    due diligence CEIP.

---

## 14. Pemetaan Syarat Submission

Setiap syarat submission hackathon (`docs/hackathon.md`) dipetakan ke bagian konkret
Corolary yang memenuhinya:

| Syarat submission | Dipenuhi oleh |
|---|---|
| Project Name | "Corolary" |
| Project Sector | **DeFi** (juga relevan dengan RWA, tapi diajukan di bawah DeFi — lihat `docs/architecture.md` §1) |
| Project Description | Ringkasan eksekutif §1 dokumen ini, atau versi ringkas di §3 (Solusi & Cara Kerja) |
| **Attestcoin Protocol Integration Summary** | Lihat pemetaan detail di bawah — inti submission, bukan tempelan |
| GitHub Repository URL + README | Repo monorepo Corolary; `README.md` root memuat ringkasan produk, aturan proyek, dan tautan ke `docs/` |
| Project Deck / Whitepaper (PDF) | Diekspor dari kerangka §13 dokumen ini |
| Prototype Demo Video URL | Merekam alur: dompet nyata → Score Explorer → Proof Viewer → transaksi pinjam dengan rasio kolateral efisien di EfficiencyMarket |
| Deployed di testnet, alamat kontrak dicantumkan | Deploy ke CC3 Testnet (chainId 102031), alamat `FactRegistry`/`CreditGraph`/`EfficiencyMarket` dicatat di README dan `.env` (lihat `docs/setup.md` §7.4) |
| Attestcoin Protocol sebagai core feature | Attestcoin **adalah** lapisan bukti FactRegistry — tanpa itu tidak ada fakta yang bisa dicatat sama sekali; bukan fitur tambahan yang bisa dicabut |
| Original work dibuat selama hackathon | Seluruh kontrak, indexer, API, dan frontend Corolary ditulis untuk BUIDL CTC 2026 Fall |
| Team Information lengkap | Diisi terpisah di form submission — Dev A dan Dev B, peran masing-masing sesuai `docs/architecture.md` §7 |

### Attestcoin Protocol Integration Summary — draf untuk form submission

Bagian ini dinilai eksplisit sebagai salah satu kriteria inti (**"depth of Attestcoin
Protocol utilization"**), jadi disusun terpisah dan lebih rinci:

> Corolary memakai Attestcoin Protocol readability (Ethereum mainnet `chainKey = 3`
> → Creditcoin) sebagai **satu-satunya sumber kebenaran** untuk setiap fakta kredit
> yang dicatat — bukan satu panggilan fungsi tempelan. Alur integrasinya:
>
> 1. **Watcher** memantau event `Borrow`/`Repay`/`LiquidationCall`/`Supply`/`Withdraw`
>    dari Aave V3, Morpho Blue, dan Compound V3 langsung di Ethereum mainnet lewat
>    RPC archive-capable.
> 2. **Attestation wait** — sistem menunggu blok yang memuat event tersebut ter-
>    attest oleh attestor Attestcoin (dicek lewat ChainInfo precompile `0x0fd3` /
>    Prover API), bukan langsung mencoba prove.
> 3. **Eager proving** — begitu ter-attest, sistem segera meminta proof (Merkle proof
>    + continuity proof) selagi masih dalam jendela murah (< 24 jam, ~10 hash
>    continuity, 2,59×10⁻⁵ CTC), memakai **batch proving** (hingga 10 transaksi per
>    batch, berbagi satu continuity proof) untuk efisiensi biaya, dan `QueryBuilder`
>    SDK untuk ekstraksi field event secara selektif.
> 4. **Verifikasi on-chain** — `FactRegistry.recordFact` memanggil Block Prover
>    precompile (`0x0FD2`) `verifyAndEmit()` secara sinkron, lalu **wajib** memeriksa
>    `receiptStatus == 1` pada transaksi sumber (precompile sendiri tidak melakukan
>    ini — kelalaian memeriksa ini adalah lubang keamanan yang secara eksplisit
>    diperingatkan di dokumentasi protokol) dan memvalidasi alamat emitter log
>    terhadap daftar protokol terdaftar, sebelum fakta disimpan.
> 5. **Replay protection** lewat `queryId` turunan `(chainKey, blockHeight, txIndex,
>    logIndex)`, mengikuti pola `USCBase` resmi.
> 6. **Fakta permanen sebagai barang publik** — begitu tercatat, fakta bisa dibaca
>    ulang oleh siapa pun (Credit Graph internal Corolary, atau dApp Creditcoin lain
>    di masa depan) tanpa membayar biaya pembuktian ulang. Ini mengubah Attestcoin
>    dari oracle per-query menjadi **lapisan data terbukti yang persisten** —
>    kontribusi arsitektur yang menjadikan Corolary infrastruktur bagi ekosistem,
>    bukan sekadar satu aplikasi yang memakai Attestcoin sekali jalan.
>
> Tidak ada data dummy atau mock di jalur ini: seluruh fakta berasal dari transaksi
> Ethereum mainnet nyata, dibuktikan lewat pipeline Attestcoin yang sama seperti di
> atas, dibaca dari CC3 Testnet.
