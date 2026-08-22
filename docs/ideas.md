> ## ✅ KEPUTUSAN — dikunci 2026-08-22
>
> **Ide #1 dipilih dan diberi nama `Corolary`.**
>
> Dokumen ini disimpan sebagai catatan keputusan: kenapa Corolary dipilih, dan ide
> mana yang dipertimbangkan lalu dilewati. Untuk desain sistem yang berlaku sekarang,
> lihat [`architecture.md`](architecture.md).
>
> Nama produk dieja **Corolary** sesuai permintaan pemilik proyek. Kalau yang dimaksud
> adalah kata bahasa Inggris "corollary" (proposisi yang mengikuti secara niscaya dari
> sesuatu yang sudah dibuktikan — makna yang kebetulan sangat pas untuk produk ini),
> penggantian ejaan masih murah dilakukan sekarang: nama itu baru muncul di `README.md`,
> `CLAUDE.md`, dan `docs/`, belum di kode mana pun.

# Rekomendasi Ide — BUIDL CTC 2026 Fall

> Tujuan: **menang**, produk **production-ready**, **nol mock data**, model bisnis nyata.
> Basis: `docs/attestcoin-research.md` (semua batasan teknis sudah diverifikasi live).

---

## Bagian 0 — Tesis Kemenangan

Sebelum ide, pahami dulu apa yang sebenarnya dinilai.

**Juri adalah investor.** Credit Labs menjalankan CEIP: dana $10 juta, tiket
$25.000–$250.000. Top 3 langsung masuk **due diligence**. Artinya pertanyaan di kepala
mereka bukan "keren nggak demo ini?" tapi **"apakah ini layak saya taruh $250.000?"**

Dari situ turun lima kriteria kemenangan:

| # | Kriteria | Konsekuensi konkret |
|---|---|---|
| 1 | **Kedalaman Attestcoin** (kriteria resmi) | Attestcoin harus jadi *produknya*, bukan satu panggilan fungsi yang ditempel |
| 2 | **Pertumbuhan ekosistem** (mandat CEIP) | Infrastruktur yang dipakai builder lain > aplikasi tunggal |
| 3 | **Kredibel sebagai bisnis** | Ada yang membayar, dan jelas kenapa mereka membayar |
| 4 | **Nyata, bukan demo** | Data Ethereum mainnet asli — bukan token karangan di Sepolia |
| 5 | **Selaras DNA Creditcoin** | Mereka perusahaan infrastruktur **kredit**. Kredit menang di kandang sendiri. |

### Senjata rahasia kita

Riset menemukan tiga hal yang hampir pasti dilewatkan tim lain:

1. **CC3 Testnet bisa membaca Ethereum MAINNET asli** (`chainKey 3`, terverifikasi live,
   lag ~8 menit). Aturan mewajibkan testnet; kita tetap patuh **sambil memakai data
   produksi sungguhan**. Peserta lain akan pakai Sepolia dan men-deploy token palsu untuk demo.
2. **Proof 10x lebih murah kalau dibuat < 24 jam.** Ini mengubah arsitektur yang benar
   dari "prove on demand" menjadi **eager proving + simpan fakta permanen**.
3. **`QueryBuilder` di SDK** (tidak ada di dokumentasi utama) untuk ekstraksi field
   selektif — bukti penguasaan protokol.

### Yang HARUS dihindari

Empat tutorial resmi adalah token bridge dan cross-chain loan sederhana. **Itulah yang
akan dikloning mayoritas peserta.** Membangun bridge di sini = berenang di kolam paling
ramai dengan pembeda paling tipis. Hindari.

---

## 🥇 Ide #1 — **Cornerstone**: Proven Credit Layer

**Track: DeFi** (bisa juga RWA) · **Rekomendasi utama**

### Satu kalimat
Riwayat kredit on-chain yang portabel dan **terbukti secara kriptografis** —
diturunkan dari aktivitas pinjam-meminjam nyata di Ethereum — dipakai untuk membuka
**pinjaman dengan kolateral jauh lebih efisien** di Creditcoin.

### Masalah yang diserang
DeFi hari ini menuntut over-kolateralisasi 150–200% untuk *semua orang*. Peminjam yang
sudah membayar lunas 40 pinjaman Aave selama dua tahun diperlakukan persis sama dengan
dompet yang dibuat 5 menit lalu. **Reputasi tidak punya nilai ekonomi** — karena
riwayat itu terkunci di chain lain dan tidak bisa dibuktikan di tempat kita berdiri.

Attestcoin memecahkan tepat bagian yang hilang itu.

### Arsitektur tiga lapis

```
Lapis 3 — Efficiency Market      Pasar pinjaman: rasio kolateral = f(reputasi terbukti)
              ↑
Lapis 2 — Credit Graph           Skor reputasi; tiap komponen dapat dilacak ke satu proof
              ↑
Lapis 1 — Attested Fact Registry Prover eager: buktikan saat murah, simpan permanen
              ↑
         Attestcoin Readability  ← event Aave / Morpho / Spark / Compound (Ethereum MAINNET)
```

**Lapis 1 — Attested Fact Registry (kontribusi teknis inti)**

Worker memantau Ethereum mainnet dan membuktikan event kredit **selagi segar**
(< 24 jam, 10x lebih murah), lalu **menyimpan fakta terverifikasi itu permanen** di
Creditcoin. Konsumen berikutnya membaca fakta yang sudah terbukti — nyaris gratis —
alih-alih membayar proof historis yang mahal.

Ini mengubah Attestcoin dari *oracle per-query* menjadi **lapisan data terbukti yang
persisten dan bisa dibaca siapa saja**. Registry-nya adalah barang publik: dApp
Creditcoin lain bisa membangun di atasnya. **Persis mandat CEIP.**

Teknik yang dipakai — dan setiap poin adalah sinyal kedalaman ke juri:
- Batch proving (10 tx / 1000 blok, berbagi satu continuity proof)
- Jendela biaya murah dieksploitasi secara sadar
- `QueryBuilder` untuk ekstraksi field selektif
- `require(receiptStatus == 1)` — jebakan keamanan yang di-flag docs
- Replay protection lewat `queryId` ala `USCBase`

**Lapis 2 — Credit Graph**

Skor dari fakta terbukti saja: jumlah & nilai pinjaman lunas, rasio bayar tepat waktu,
riwayat likuidasi, lama posisi, umur dompet, keragaman protokol. Tiap komponen skor
**menunjuk ke bukti spesifik** — bisa diaudit siapa pun, tidak ada kotak hitam.

**Lapis 3 — Collateral-Efficiency Market**

Pasar pinjam-meminjam di Creditcoin. Rasio kolateral turun berjenjang mengikuti
reputasi terbukti: **150% (baseline) → 110% (terbukti sangat baik)**.

### ⚠️ Keputusan desain yang menyelamatkan ide ini

Skor kredit on-chain punya kuburan panjang: Spectral, Cred Protocol, ARCx — semua
gagal. Penyebabnya sama: mereka menjanjikan **pinjaman tanpa kolateral ke dompet
anonim**. Tanpa identitas dan tanpa jalur hukum, peminjam selalu untung kabur.

**Cornerstone tidak mengulangi kesalahan itu.** Kita tidak menjual "pinjaman tanpa
jaminan". Kita menjual **efisiensi kolateral berjenjang**. Pinjaman selalu
over-kolateral — hanya saja peminjam terbukti membutuhkan modal terkunci jauh lebih
sedikit. Protokol tetap solven tanpa perlu recourse. Ini secara ekonomi kokoh, dan
inilah bedanya dengan proposal yang terdengar sama tapi runtuh saat ditanya juri.

**Ketahanan Sybil (jawaban untuk pertanyaan juri yang pasti muncul):**
Dompet baru itu murah — tapi *riwayat baik* tidak. Memalsukan dua tahun pembayaran
Aave menuntut modal nyata yang terkunci lama plus bunga yang benar-benar dibayar.
**Biaya memalsukan riwayat ≈ biaya memiliki riwayat asli.** Sistem ini Sybil-resistant
secara konstruksi, bukan karena ditambal. Untuk serangan wash-history, bobot skor
memakai modal-berisiko × durasi × keragaman lawan-transaksi.

### Model bisnis

| Aliran pendapatan | Mekanisme | Siapa membayar |
|---|---|---|
| **Origination fee** | 0,5% dari pokok pinjaman | Peminjam |
| **Interest spread** | 1–2% selisih APY lender vs borrower | Pasar |
| **Credit Graph API** | Langganan / bayar-per-query | Protokol lain (di dalam & luar Creditcoin) |
| **Sponsored facts** | Protokol membayar agar event-nya diindeks & dibuktikan | Penerbit protokol |
| **Lisensi B2B** | Pelengkap crypto-native untuk **Credal** | Partner lender Gluwa (Aella, dll.) |

**Unit economics — dan ini bagian yang membuat juri duduk tegak:**
biaya membuktikan satu fakta di jendela murah adalah **2,59 × 10⁻⁵ CTC**. Bahkan pada
100.000 fakta per bulan, total biaya proving ≈ **2,6 CTC**. Pendapatan dari **satu**
peminjam sudah melampaui biaya infrastruktur sebulan penuh berkali-kali lipat.
Margin kotor mendekati 100%, dan angkanya bukan asumsi — diambil dari tabel biaya resmi.

**Kenapa ini menarik sebagai investasi:** aliran #3 dan #5 menjadikan Cornerstone
*infrastruktur*, bukan aplikasi. Setiap dApp kredit baru di Creditcoin adalah pelanggan,
bukan pesaing. Dan jalur ke Credal memberi Credit Labs cerita strategis yang jelas —
Cornerstone melengkapi data kredit off-chain milik mereka dengan sisi crypto-native.

### Nol mock data
Aave V3, Morpho Blue, Spark, Compound V3 — semuanya di Ethereum mainnet, event nyata,
peminjam nyata, pembayaran nyata, dibaca lewat `chainKey 3` dari CC3 Testnet.
Tidak satu pun baris data dikarang.

### Kenapa ini menang
✅ Attestcoin **adalah** produknya — bukan tempelan
✅ Infrastruktur yang dipakai builder lain → mandat CEIP terpenuhi
✅ **Kredit** — bisnis inti Creditcoin selama satu dekade
✅ Data produksi asli, di testnet, patuh aturan
✅ Model bisnis dengan margin terbukti dan jalur B2B ke partner mereka sendiri
✅ Kontribusi arsitektur orisinal (eager proving registry) yang tidak akan dimiliki tim lain

### Risiko jujur
- **Cakupan besar.** Tiga lapis itu banyak. Mitigasi: Lapis 1 + 2 sudah merupakan
  submission yang kuat; Lapis 3 boleh tampil sebagai pasar tunggal yang berfungsi penuh.
- Kategori "credit scoring" mudah terdengar klise — **framing efisiensi kolateral**
  (bukan "pinjaman tanpa jaminan") yang membedakannya. Ini harus eksplisit di deck.
- Cold start: peminjam awal butuh riwayat Ethereum. Segmen awal = pengguna DeFi mapan.

---

## 🥈 Ide #2 — **Sentinel**: Autonomous Risk Agent dengan Input Terbukti

**Track: AI** · **Peluang terbaik dari sisi kompetisi**

### Kenapa track ini
Track AI **baru ditambahkan** untuk edisi Fall — edisi sebelumnya hanya 4 track.
Peserta paling sedikit. Hashtag resmi panitia: **#AI Agents #Onchain Decisioning
#Verified Data** — deskripsi track secara harfiah meminta "memproses data cross-chain
terverifikasi secara kriptografis untuk mengambil keputusan otonom tanpa operator
oracle terpusat". Itu bukan petunjuk halus.

### Satu kalimat
Agent risiko otonom untuk protokol Creditcoin yang **setiap inputnya adalah fakta
Ethereum yang terbukti** dan **setiap keputusannya tercatat on-chain beserta bukti
yang memicunya** — sehingga siapa pun bisa memutar ulang dan mengaudit alasan agent bertindak.

### Masalah yang diserang
Cacat fatal agent keuangan on-chain bukan pada kecerdasannya, melainkan pada **inputnya**:
agent memakan data dari API terpusat, dan tidak ada yang bisa membuktikan apa yang
sebenarnya dilihat agent saat mengambil keputusan. Ketika agent salah, tidak ada jejak audit.

Attestcoin memperbaiki tepat lapisan itu: **input yang tidak bisa dipalsukan.**

### Use case nyata: pertahanan contagion lintas chain
Ketika protokol besar di Ethereum kena eksploit atau likuidasi massal, pasar di
Creditcoin ikut terekspos lewat kolateral yang berkorelasi. Sentinel membuktikan
event Ethereum tersebut lewat Attestcoin, lalu bertindak otonom: menaikkan rasio
kolateral, menjeda pasar, atau melakukan hedge — **sebelum** kerugian menyebar.

Setiap tindakan menyimpan referensi ke proof yang membenarkannya. Auditor bisa
merekonstruksi: *"Pada blok N, agent menaikkan rasio kolateral karena transaksi
Ethereum 0xABC… yang terbukti berisi event ini."*

### Model bisnis
| Aliran | Mekanisme |
|---|---|
| **Protection fee** | bps atas TVL yang dilindungi (SaaS ke protokol) |
| **Performance fee** | bagian dari kerugian yang berhasil dicegah / hasil hedge |
| **Audit-trail licensing** | enterprise & institusi yang butuh bukti kepatuhan keputusan otomatis |
| **Agent marketplace** | pihak ketiga menerbitkan policy, kita ambil rake |

### ⚠️ Peringatan jujur
Proyek "AI agent" sangat mudah terbaca sebagai gimmick oleh juri yang berpikir sebagai
investor. Syarat menangnya spesifik: **verifiabilitas adalah produknya, bukan LLM-nya.**
Rekomendasi tegas — pakai **policy engine deterministik** (+ model skoring bila perlu)
untuk keputusan finansial, dan batasi LLM hanya untuk menjelaskan keputusan kepada
manusia. Investor tidak akan mendanai LLM yang memindahkan uang; mereka akan mendanai
agent yang **bisa membuktikan mengapa ia bertindak**.

### Nol mock data
Event eksploit, likuidasi besar, dan pergerakan whale di Ethereum mainnet adalah
kejadian publik yang nyata dan bisa dibuktikan lewat `chainKey 3`.

---

## 🥉 Ide #3 — **Mirror**: Kolateral RWA yang Terbukti

**Track: RWA** · **Paling selaras dengan headline Creditcoin**

### Satu kalimat
Fasilitas kredit di Creditcoin dengan jaminan **posisi treasury tokenized nyata di
Ethereum** (Ondo OUSG/USDY, BlackRock BUIDL, Franklin BENJI, Superstate) — posisi
direkonstruksi lewat *event sourcing* dari event yang terbukti, bukan dari oracle harga terpusat.

### Kontribusi teknis
Attestcoin tidak menyediakan storage proof — **tidak bisa** menanyakan saldo secara
langsung. Mirror menyiasatinya dengan benar: buktikan **seluruh rangkaian event
transfer/mint/redeem** sebuah alamat sejak titik awal yang diketahui, lalu rekonstruksi
posisi di Creditcoin. Hasilnya saldo dengan **provenance kriptografis penuh** — setiap
perubahan bisa ditelusuri ke satu proof.

Ditambah **circuit breaker kesegaran**: bila rantai attestation basi melewati ambang,
fasilitas otomatis membeku. Ini justru mengubah keterbatasan protokol menjadi fitur
keamanan yang bisa dijual.

### Model bisnis
| Aliran | Mekanisme |
|---|---|
| **Facility fee** | biaya originasi atas fasilitas kredit |
| **Borrow spread** | selisih bunga |
| **Issuer SaaS** | pemantauan risiko & bukti distribusi untuk penerbit RWA |
| **Verification-as-a-service** | protokol lain membayar untuk memverifikasi kolateral RWA |

### Risiko jujur
- Token RWA umumnya **permissioned** (transfer terbatas ke alamat ter-whitelist)
  → basis pengguna nyata kecil, dan itu harus diakui di deck.
- Event sourcing untuk pemegang dengan riwayat panjang butuh banyak proof; batching
  membantu tapi tidak menghilangkan biaya.
- Ada dimensi regulasi yang tidak bisa diselesaikan dalam hackathon.

---

## Perbandingan

| | **#1 Cornerstone** | **#2 Sentinel** | **#3 Mirror** |
|---|---|---|---|
| Track | DeFi / RWA | AI | RWA |
| Kedalaman Attestcoin | ★★★★★ | ★★★★☆ | ★★★★★ |
| Persaingan | Sedang | **Paling rendah** | Sedang |
| Selaras DNA Creditcoin | ★★★★★ | ★★★☆☆ | ★★★★★ |
| Nilai infrastruktur (CEIP) | ★★★★★ | ★★★☆☆ | ★★★☆☆ |
| Kekuatan model bisnis | ★★★★★ | ★★★★☆ | ★★★★☆ |
| Kemudahan "nol mock" | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Kompleksitas bangun | Tinggi | Sedang | Sedang-Tinggi |

## Rekomendasi

**Bangun Cornerstone (#1).** Ia menang di dimensi yang benar-benar dinilai: Attestcoin
sebagai produk itu sendiri, infrastruktur yang menumbuhkan ekosistem, kredit sebagai
bisnis inti Creditcoin, data mainnet asli, dan model bisnis yang berdiri sendiri.

**Kombinasi terkuat:** Cornerstone sebagai produk utama, dengan **Sentinel sebagai
konsumen pertama Fact Registry**. Itu membuktikan tesis infrastruktur secara nyata di
dalam satu submission — registry bukan cuma diklaim reusable, tapi ditunjukkan
sedang dipakai — sekaligus menjangkau track AI yang paling sepi.

Kalau cakupan harus dipangkas: **Lapis 1 + Lapis 2 saja sudah submission yang kuat.**
Attested Fact Registry berdiri sendiri sebagai infrastruktur bernilai, dan justru di
lapis itulah kedalaman teknis Attestcoin paling terlihat.
