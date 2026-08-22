# Ranking Ide — Terkuat ke Terlemah

Disusun **2 Agustus 2026**, setelah riset mendalam.
Dasar bukti: `01-riset-mendalam.md`. Semua penilaian berpijak pada angka yang
**diukur sendiri**, bukan asumsi.

**Keputusan: #1 dikunci** (2 Agustus 2026). Dokumen ini disimpan sebagai catatan
alasannya — berguna saat menulis deck, dan saat godaan mengganti arah muncul.

---

## Rubrik penilaian

Enam sumbu, diturunkan dari kriteria juri resmi + pola pemenang musim 1.

| Sumbu | Bobot | Kenapa |
|---|---|---|
| **A. Kedalaman USC** — mustahil ditiru tanpa Attestcoin | ×3 | Kriteria penilaian utama yang dinyatakan eksplisit tahun ini |
| **B. Selaras tesis Creditcoin & layak CEIP** | ×3 | Juri menilai lewat lensa "layak diinvestasikan", bukan cuma teknis |
| **C. Belum jenuh** | ×2 | 76 BUIDL musim 1 sudah menghabiskan beberapa lahan |
| **D. Kekuatan demo** | ×2 | Grand prize musim 1 jatuh ke produk paling matang, bukan paling canggih |
| **E. Koherensi produk** | ×1 | Satu produk utuh mengalahkan dua produk setengah jadi |
| **F. Bisa dibela tanpa klaim palsu** | ×1 | Satu klaim ketahuan bohong = seluruh deck mati |

Skor 1–10 per sumbu. Maksimum tertimbang: **120**.

| # | Ide | A×3 | B×3 | C×2 | D×2 | E | F | **Total** |
|---|---|---|---|---|---|---|---|---|
| 1 | **Solvency-Locked Issuance** | 10 | 9 | 10 | 10 | 9 | 9 | **‍115** |
| 2 | Attested Collateral Credit Market | 10 | 10 | 9 | 8 | 6 | 6 | 106 |
| 3 | Unfakeable Credit Bureau (AI) | 8 | 8 | 7 | 6 | 7 | 8 | 89 |
| 4 | Proof-of-Payment Trade Rail | 6 | 9 | 6 | 8 | 8 | 9 | 88 |
| 5 | Attested Payroll → Kredit Keluarga | 6 | 10 | 5 | 8 | 8 | 8 | 88 |
| 6 | Cross-Chain DAO Execution | 7 | 4 | 9 | 6 | 8 | 9 | 76 |
| 7 | DePIN Revenue Financing | 6 | 8 | 3 | 6 | 7 | 8 | 75 |

---

# #1 — Solvency-Locked Issuance · Track RWA · **REKOMENDASI**

*(evolusi dari "Attested Reserves")*

**Nama produk: `Corolary`** — dikunci 2 Agustus 2026. Satu L, disengaja.
Tagline: *Solvency isn't claimed. It follows.*

### Pitch satu kalimat

> Token yang **tidak bisa dicetak melebihi cadangan yang terbukti** — bahkan oleh
> pemegang kunci admin yang sudah dibajak sepenuhnya.

### Masalah, dengan korban yang punya nama dan tanggal

Dua stablecoin runtuh tahun ini karena hal yang sama persis:

- **Resolv (USR), 22 Maret 2026** — satu private key bocor, USR dicetak tanpa backing, depeg.
- **StablR (USDR/EURR), 24 Mei 2026** — issuer **berlisensi Malta, patuh MiCA, didukung
  Tether**. Penyerang menguasai satu kunci dari multisig 1-of-3, mengangkat dirinya
  jadi admin, menghapus penanda tangan sah, lalu mencetak **$13,5 juta tanpa backing**.
  EURR jatuh ke **$0,548**. Minting dan redemption dibekukan.

Standar kepatuhan terbaik hari ini — GENIUS Act — mewajibkan pengungkapan cadangan
**bulanan**. Kedua issuer itu runtuh **dalam hitungan jam**. Laporan bulanan adalah
foto; yang dibutuhkan adalah **kunci pada pintunya**.

### Produk

Kontrak di Creditcoin yang memelihara **saldo cadangan terbukti** untuk sebuah alamat
treasury di Ethereum. Saldo itu **hanya** bergerak lewat event `Transfer` ERC-20 nyata
yang dibuktikan secara kriptografis ter-include di blok Ethereum yang sudah final.
Tidak ada admin yang bisa menaikkannya. Tidak ada oracle yang bisa berbohong.

Di atas saldo itu:

- `mint()` **revert** kalau melanggar lantai kolateral. Ini bukan monitoring, ini **kunci**.
  Kunci admin yang dibajak total pun tidak bisa mencetak tanpa backing.
- `redeem()` **selalu** diizinkan. Memblokir pintu keluar saat krisis adalah persis
  kegagalan yang kontrak ini ada untuk mencegahnya.
- Pembekuan terjadi **sendiri**, saat penarikan terbukti mendarat. Tidak ada tombol,
  tidak ada operator, tidak ada rapat komite.

### Dua wajah — dan wajah kedua ini yang mengubah segalanya

**Vault mode** — issuer memakainya untuk menerbitkan token yang backing-nya terbukti.
Ini produknya.

**Observatory mode** — **siapa pun** bisa mengarahkannya ke treasury issuer di Ethereum
mainnet, **tanpa izin dan tanpa sepengetahuan issuer**, dan mendapat feed
**proven-collateral** publik yang berjalan terus. (Bukan "solvabilitas" — RT11.)
Target final terverifikasi 9 Agt: **Sky LitePSM Pocket · Resolv · Liquity**
(⛔ Ethena dicabut — `01-riset-mendalam.md` §3.5).

⚠️ **Hanya issuer yang kolateralnya on-chain.** Circle, BlackRock BUIDL, Ondo, dan Paxos
**tidak bisa** diaudit begini — backing mereka T-bill dan emas di kustodian off-chain.
Mengklaim sebaliknya adalah ranjau yang akan meledak di sesi tanya jawab. Batas lengkap
dan kalimat yang benar: `03-spesifikasi-produk.md` §4.2.

Ini bukan alat vendor untuk CFO. Ini **perisai untuk penabung**, dan issuer tidak
punya cara untuk mematikannya.

### Kenapa mustahil tanpa Attestcoin

Kita membaca event `Transfer` dari kontrak **milik Circle**, di **Ethereum mainnet**,
dari kontrak di **Creditcoin**. Tidak ada oracle terpusat yang memberikan ini secara
trustless. Tidak ada bridge yang relevan. Tidak ada cara lain — titik.

### Diferensiasi terhadap kompetitor nyata

| | Sumber data | Perlu izin issuer? | Frekuensi |
|---|---|---|---|
| Chainlink PoR | Kustodian & auditor off-chain | **Ya** | Periodik |
| Chronicle Proof of Asset (BlackRock BUIDL, $1,7 M AUM) | Kustodian & fund administrator | **Ya** | Kontinu |
| **Kita** | **Rantai itu sendiri, via bukti inklusi** | **Tidak** | **Per event** |

Chainlink dan Chronicle **menanyakan kabar cadangan kepada pihak yang sedang dicurigai**.
Kita tidak bertanya kepada siapa pun.

**Batas jujur yang wajib dinyatakan di deck:** kita hanya melihat cadangan **on-chain**.
Kalau backing-nya T-bill di kustodian tradisional, kita buta. Kita **melengkapi** PoR
kustodian, bukan menggantikannya. — Dan tetap: **Resolv dan StablR keduanya ada di
dalam cakupan kita.** Segmen yang kita layani persis segmen yang meledak tahun ini.

### Demo (sumber utama mainnet, panggung kendali Sepolia)

1. **Buka dengan pembunuhnya.** Dashboard menampilkan cadangan sungguhan yang mengalir
   dari **Ethereum mainnet** — arus USDC Circle, live, di depan mata juri. Bukan token mainan.
2. **Serahkan kunci admin ke penyerang.** Jalankan ulang serangan StablR di panggung
   kita: `mint()` dengan owner key penuh, jumlah melebihi cadangan terbukti.
   → **revert `WouldBreachCollateralFloor`**. Kunci dibajak, kerugian nol.
3. **Tarik cadangannya.** Di Sepolia (panggung yang kita kendalikan), operator menarik
   dana dari treasury. ~9 menit kemudian, tanpa disentuh siapa pun, rasio jatuh di
   layar dan tombol mint mati sendiri.
4. **Tutup dengan observatory.** Alihkan ke treasury issuer sungguhan yang tidak pernah
   minta diaudit. "Mereka tidak tahu kita melakukan ini. Mereka tidak bisa
   menghentikannya."

### Status kode: **nol — repo direset 2 Agustus 2026**

Prototipe pertama (kontrak inti + 15/15 test + spike end-to-end) **sudah pernah
dibangun dan lolos** pada 1 Agustus, lalu **sengaja dihapus** untuk memulai repo dari
nol dengan arsitektur yang lebih baik (multi-aset, observatory, batch).

Yang tersisa dari pekerjaan itu bukan kodenya, tapi **pengetahuannya** — dan itu
seluruhnya sudah dipindahkan ke `03-spesifikasi-produk.md`, termasuk desain akuntansi
order-independent, tiga validasi log, dan jebakan `foundry.toml`. Spesifikasi itu
ditulis agar sistem bisa dibangun ulang tanpa melihat kode lama.

Arsip kode lama: `arsip-kode-lama-2026-08-02.tar.gz` (di-gitignore).

**Yang sudah terbukti dan tidak perlu diulang** — semuanya terekam di
`01-riset-mendalam.md`:
- Kontrak Creditcoin bisa memverifikasi event kontrak pihak ketiga (Sepolia **dan** mainnet)
- Biaya, batas gas, penghematan batch — terukur
- Produk ini mainnet-able — terbukti di Creditcoin mainnet

### Risiko & jawabannya

| Risiko | Jawaban |
|---|---|
| "Proof of reserves sudah ada" (Chainlink, Chronicle) | Keduanya butuh izin issuer & sumbernya kustodian. Kita permissionless & sumbernya rantai itu sendiri. Tabel di atas. |
| Cerita B2B, kurang menyentuh | Observatory mode membalik ini jadi utilitas publik untuk penabung. Plus dua korban nyata dengan nama & tanggal. |
| Docs melarang membaca event `Transfer` standar | Panduan itu untuk kontrak **milikmu sendiri**. Kita menyimpang sadar, dan menutup ambiguitasnya dengan 3 lapis validasi. Ini justru bukti kedalaman. |
| Hanya melihat cadangan on-chain | Dinyatakan terus terang sebagai batas cakupan. Kejujuran ini menaikkan kredibilitas, bukan menurunkan. |
| Token RWA institusional jarang bergerak | Sudah diukur: BUIDL/USDY/USTB = 0 event/20 menit. Karena itu **demo dipacu USDC/USDT**, RWA dipakai untuk bobot naratif saja. |

---

# #2 — Attested Collateral Credit Market · Track RWA/DeFi

### Pitch

Peminjam membuktikan kolateralnya di Ethereum mainnet — token RWA, stablecoin, stETH —
dan Creditcoin menerbitkan **credit line yang mengurangi risikonya sendiri** ketika
buktinya memburuk.

### Kenapa kuat

Ini ekspresi paling penuh dari tesis Creditcoin: kolateral dunia nyata → kredit dunia
nyata. Skor B (kelayakan CEIP) tertinggi dari semua ide. Pasar tokenized RWA ~$22–33,5
miliar dan risiko #1 yang belum terpecahkan adalah persis "apakah kolateralnya benar
ada".

### Kenapa TIDAK saya taruh di #1 — dan ini masalah arsitektur, bukan selera

**Protokol ini satu arah. Kita tidak bisa melikuidasi apa pun di Ethereum.**
Tidak ada callback, tidak ada pesan balik. Kalau kolateral peminjam anjlok, kontrak
Creditcoin kita **tahu** tapi **tidak berdaya** menyentuhnya.

Tiga jalan keluar, semuanya berbiaya:
- **(a) Over-kolateralisasi dalam aset native Creditcoin** — jadi kolateral mainnet-nya
  cuma hiasan. Melemahkan seluruh premis.
- **(b) Kredit berbasis recourse hukum dunia nyata** — ini justru model asli Creditcoin
  (Aella!), jadi jujur dan selaras. Tapi tidak bisa didemokan dalam 5 menit.
- **(c) Vault di source chain dengan keeper** — memperkenalkan pihak terpercaya, dan
  membatalkan klaim "tanpa bridge".

Juri yang tajam akan menemukan lubang ini. Ide #1 tidak punya lubang setara, karena
di sana **penerbitan token adalah aksi di sisi Creditcoin saja** — kita tidak perlu
menyentuh Ethereum sama sekali.

### Kapan ini jadi pilihan tepat

Kalau kamu mau ambisi maksimum dan siap menghabiskan waktu menyusun jawaban yang
meyakinkan untuk masalah likuidasi. Catatan penting: **#1 sudah merupakan instrumen
kredit** — mencetak token tanda terima terhadap cadangan terbukti *adalah* pemberian
kredit. Jadi #2 lebih tepat dipahami sebagai **babak kedua #1**, bukan produk saingan.

---

# #3 — Unfakeable Credit Bureau · Track AI

### Pitch

Agen kredit yang **seluruh inputnya terbukti kriptografis**: `Borrow`, `Repay`,
`LiquidationCall` dari Aave V3 **mainnet**, plus arus stablecoin. Agen menilai ulang
risiko terus-menerus dan menyesuaikan limit, APR, dan margin call di Creditcoin sendiri.

**Agen AI pertama yang tidak bisa diracuni data palsu.**

### Yang berubah hari ini

Ide ini **hampir mati, lalu hidup lagi**. Diukur langsung:

```
Aave V3 Sepolia  :  76 log / 13 jam   ← terlalu tipis untuk demo jujur
Compound Sepolia :   0 log / 13 jam   ← mati
Morpho Sepolia   :   0 log / 13 jam   ← mati
Aave V3 MAINNET  :  73 log / 20 menit ← hidup
```

Tanpa unlock mainnet, ide ini tidak bisa didemokan tanpa kita sendiri yang
bertransaksi di Aave — dan itu menghancurkan satu-satunya hal yang membuatnya kuat.
Dengan mainnet, datanya nyata.

### Kenapa tetap di #3

- Track AI memang paling sepi, **tapi "AI + kredit" sudah dicoba dan kalah dua kali**
  musim lalu (BorrowIQ, AWRA). Juri sudah pernah melihat dan tidak terkesan.
- Lahan "credit score" jenuh: ≥6 tim mencoba, **nol yang menang**.
- Sulit membuktikan agennya *bagus* dalam demo 5 menit. "Ada AI-nya" mudah terbaca
  sebagai hiasan. Diferensiasi harus 100% bersandar pada **input yang terverifikasi**,
  dan itu argumen teknis yang dingin.
- Kontrak yang sudah jadi harus ditulis ulang sebagian.

### Kalau tetap dipilih

Jangan jual "AI". Jual **"input yang mustahil dipalsukan"**. AI-nya harus komponen
yang jujur dan terbatas — mesin aturan yang bisa dijelaskan, bukan kotak hitam.

---

# #4 — Proof-of-Payment Trade Rail · Track RWA

Pembeli membayar stablecoin di Ethereum → USC membuktikan `Transfer`-nya → kontrak
Creditcoin melepas dokumen kepemilikan / NFT bill-of-lading, dan mencatat riwayat
pembayaran yang lalu menjadi basis kredit trade finance.

**Kuat:** real-world jelas, demo mudah dicerna, selaras tesis lintas batas Creditcoin.

**Lemah:** kedalaman USC dangkal — satu pembayaran memicu satu pelepasan, polanya
mendekati "seremonial" yang justru dihindari kriteria *depth of utilization*. Lahannya
juga berdekatan dengan invoice tokenization yang sudah ramai. Dan demonya butuh kita
mengendalikan kedua sisi, jadi kehilangan efek "kami membaca kontrak Circle".

---

# #5 — Attested Payroll → Kredit Keluarga · Track RWA

Pekerja diaspora digaji stablecoin di Ethereum tiap bulan. USC membuktikan arus masuk
berulang itu. Creditcoin membangun **riwayat pendapatan terverifikasi**, dan keluarganya
di negara asal mendapat credit line lokal atas dasar itu.

**Skor B tertinggi bersama #2** — ini *persis* Aella/Nigeria/eNaira. Paling menyentuh
secara emosional dari semua ide, dan musim lalu grand prize memang jatuh ke yang paling
manusiawi.

**Lemah:** bertabrakan langsung dengan **HashCredit**, juara 2 musim lalu, yang polanya
identik (bukti pendapatan eksternal → credit line). Juri baru saja memberi hadiah untuk
pola ini; mengulanginya membuat kita jadi versi kedua, bukan versi baru. Kedalaman USC
juga sedang saja.

**Catatan:** kekuatan emosionalnya bisa **dipinjam** oleh #1 tanpa mengambil idenya —
bingkai penabung emerging-market yang memegang stablecoin terbitan entitas yang mustahil
mereka audit.

---

# #6 — Cross-Chain DAO Execution · Track DeFi

Baca event `VoteCast` dari Governor di Ethereum mainnet → eksekusi treasury yang murah
di Creditcoin. Elegan, sepi, dan secara teknis rapi — membaca kontrak Governor pihak
ketiga itu USC-depth sejati.

**Mematikan:** pasarnya terlalu kecil dan tidak menyentuh kredit sama sekali. Skor B
rendah = tidak akan menarik CEIP, dan CEIP adalah hadiah yang sebenarnya.

---

# #7 — DePIN Revenue Financing · Track DePIN

Pembiayaan hardware yang dicicil dari aliran reward DePIN yang terbukti on-chain.
Selaras tesis.

**Mematikan:** terlalu dekat dengan **HashCredit**, pemenang 2nd musim lalu. Track DePIN
juga tidak punya data mainnet yang kaya untuk didemokan.

---

# Jangan sentuh

| Lahan | Alasan |
|---|---|
| ROSCA / arisan / savings circle | ≥5 tim musim lalu. **Pemenangnya sudah ada** (CrediKye). |
| Credit score generik | ≥6 tim. **Nol yang menang.** |
| Invoice tokenization | Sudah ramai (CreditFlow dkk). |
| Demo bridge / mint token | Persis tutorial resmi. Terbaca sebagai integrasi tempelan. |
| Cross-chain lending polos | Tutorial resmi #4 + satu-satunya folder use case di `USC-Builder-Examples`. Jalur paling "nyontek". |
| Klaim "omnichain" | Sumber cuma Ethereum. Juri tahu. |
| ~~Membuktikan riwayat lama retroaktif~~ | ⚠️ **DICABUT 9 Agt 2026.** Alasan lama (*"biaya continuity proof naik >10× per hari"*) berasal dari `[docs]` dan **terbukti salah saat diukur**: biaya naik lalu **datar** — tx berumur 30 hari sama mahalnya dengan yang berumur 40 menit (~4×10⁻⁵ CTC). Backfill dibatasi **waktu**, bukan biaya. Lihat `01-riset-mendalam.md` §1.3. |

---

# Rekomendasi akhir

**Ambil #1 — Solvency-Locked Issuance.**

Alasannya, berurutan:

1. **Satu-satunya ide yang skor A dan C-nya sama-sama 10.** Kedalaman USC maksimum,
   dan tidak ada satu pun dari 76 BUIDL musim 1 yang menyentuh lahannya.
2. **Demonya punya momen yang tidak bisa dilupakan** — kunci admin diserahkan ke
   penyerang di depan juri, dan `mint()` tetap menolak. Itu bukan grafik; itu adegan.
3. **Ceritanya punya korban dengan nama dan tanggal**, dua-duanya dari tahun ini,
   dua-duanya di dalam cakupan teknis kita.
4. **Sudah ~40% jadi dan lolos test**, jadi seluruh waktu tersisa bisa dipakai untuk
   kedalaman dan kematangan — persis dua hal yang memenangkan musim 1.
5. **Membaca mainnet membuktikan slogan Creditcoin sendiri**: *"Deploy once. Read every
   chain."*

Ambisi maksimum dijalankan bukan dengan mengganti ide, tapi dengan **memperluas #1 ke
babak keduanya (#2)** setelah babak pertama benar-benar matang dan berjalan di mainnet.

Urutan yang saya sarankan:

```
Babak 1  Vault mode      — issuer + kunci minting terhadap cadangan terbukti   [inti, sudah ada]
Babak 2  Observatory     — audit paksa issuer mainnet tanpa izin                [pembeda naratif]
Babak 3  Multi-aset      — keranjang cadangan (USDC + USDT + PAXG + RWA)        [kedalaman]
Babak 4  Credit market   — kredit terhadap kolateral terbukti (#2)              [kalau waktu ada]
```

Babak 1–3 adalah satu produk yang koheren dan bisa berdiri sendiri. Babak 4 hanya
ditambahkan kalau 1–3 sudah benar-benar rapi.

---

# Addendum — Uji ulang 7 Agustus 2026: adakah ide yang mengalahkan #1?

Dipicu pertanyaan langsung user. Dicari **ide di luar 7 yang sudah diskor**, memakai
rubrik yang sama, dengan riset pasar segar (Agustus 2026). **Hasil: tidak ada.**
Skor tertinggi kandidat baru = 86, masih di bawah #2 (106), jauh di bawah #1 (115).

## Kandidat baru yang diuji

| # | Ide | A×3 | B×3 | C×2 | D×2 | E | F | Total | Sebab gugur |
|---|---|---|---|---|---|---|---|---|---|
| N1 | Attested Depeg/Solvency Insurance | 9 | 7 | 8 | 6 | 5 | 5 | **86** | Trigger parametrik butuh **harga** → price oracle → membatalkan klaim "tanpa oracle". Trigger tanpa harga = rasio solvabilitas #1 itu sendiri. |
| N2 | DAT / mNAV attestation (treasury perusahaan publik) | 8 | 7 | 8 | 6 | 6 | 6 | **84** | Sama persis mesin observatory #1, tapi **tanpa `mint()` lock** → jadi monitor, bukan kunci. Hilang adegan demo. mNAV butuh harga; treasury DAT mayoritas BTC (bukan chain sumber). |
| N3 | x402 / agentic payment credit rail | 6 | 9 | 9 | 4 | 7 | 6 | **83** | **Latensi mematikan.** x402 premisnya pembayaran sub-detik; kita 8,8–14,8 mnt. Juri yang tahu x402 akan menyebut ini. Kalau di-reframe jadi riwayat kredit agen → kembali ke ide #3/#5. |
| N4 | Attested burn → redemption receipt | — | — | — | — | — | — | **gugur** | Persis "demo bridge/mint" di daftar *Jangan sentuh*. |
| N5 | Sanctions / clean-address attestation | — | — | — | — | — | — | **gugur** | Butuh membuktikan **ketiadaan** event. Inclusion proof secara arsitektur tidak bisa. |

## Kenapa secara struktural #1 sulit dikalahkan

Attestcoin **satu arah** (chain sumber → Creditcoin) dengan latensi ~9–15 menit.
Sebuah ide hanya cocok sempurna kalau **aksinya seluruhnya hidup di sisi Creditcoin**
dan **toleran terhadap latensi menit**. `mint()` yang menolak memenuhi keduanya:
tidak perlu pesan balik, dan penundaan 9 menit justru *aman* (arah ketat—cadangan turun
lebih cepat memblokir daripada membuka). Hampir semua kandidat lain gagal di salah satu
dari tiga hal: butuh jalan balik, butuh price oracle, atau butuh sub-detik.

## Temuan pasar baru (Agustus 2026) — dampaknya ke deck, bukan ke pilihan ide

1. **Tesis makin kuat, bukan melemah.** Pola 2026: kerugian termahal datang dari
   kegagalan *privileged access / key management*, bukan bug smart contract baru.
   Resolv (22 Mar) dan StablR (24 Mei) dua-duanya cocok persis.
   ⚠️ Angka Resolv di §"Masalah" perlu dipertajam: laporan menyebut ~80 juta USR
   dicetak dari kunci di AWS KMS, ekstraksi terealisasi ~$23–25 juta. Verifikasi ulang
   sebelum masuk deck.
1b. **Preseden 2025 dan sebelumnya — polanya lebih tua dari 2026.** Dicari 7 Agt 2026
   karena kalau hanya ada dua kasus (dua-duanya 2026), deck terbaca seperti mengejar
   berita. Ternyata tidak:

   | Tanggal | Korban | Kunci | Kerugian | Cocok cakupan kita? |
   |---|---|---|---|---|
   | 2 Des 2022 | **Ankr** (aBNBc) | Deployer key dicuri lewat supply-chain attack eks-karyawan | ~$5 jt; **10 triliun aBNBc dicetak**; harga −99% | ✅ **Kasus paling murni** — mint tak berbacking langsung dari kunci curian |
   | Mar 2025 | **Zoth** (RWA restaking) | Deployer EOA tunggal → upgrade proxy jahat | $8,4 jt | ⚠️ Sebagian — penarikan lewat upgrade, bukan mint |
   | Apr 2025 | **UPCX** | Admin key → upgrade kontrak jahat + fungsi admin | $70 jt / 18,4 jt UPC | ⚠️ Sebagian — sama, penarikan bukan mint |
   | Feb 2025 | **Bybit** | Infrastruktur signing | ~$1,5 miliar | ❌ CEX, cadangan off-chain — **di luar cakupan** |
   | 22 Mar 2026 | **Resolv** (USR) | `SERVICE_ROLE` di EOA tunggal (kunci di AWS KMS) | 80 jt USR dicetak, ekstraksi ~$23–25 jt | ✅ Penuh |
   | 24 Mei 2026 | **StablR** (USDR/EURR) | 1-of-3 multisig, penyerang jadi admin | $13,5 jt dicetak; EURR ~$0,548–0,88 | ✅ Penuh |

   Konteks makro 2025 (Chainalysis): total dicuri **$3,4 miliar**; kompromi private key
   jarang tapi **mendominasi angka kerugian** — akses & privilege menentukan besar
   kerugian lebih dari frekuensi serangan. Top 3 hack = 69% kerugian layanan.

   **Cara memakainya di deck:** Ankr 2022 → Zoth/UPCX 2025 → Resolv/StablR 2026.
   *"Empat tahun, pola yang sama, mitigasi yang sama: audit kontrak dan laporan
   cadangan. Tidak satu pun memasang kunci di pintu mint."*
   Jangan pakai Bybit — cadangan CEX off-chain, di luar cakupan.

   ⚠️ **Jebakan tanggal:** ringkasan hasil pencarian sempat menempatkan Resolv & StablR
   di 2025. URL sumbernya (CoinDesk `/2026/03/23/`, `/2026/05/26/`) mengatakan **2026**.
   Pakai 2026. Verifikasi tanggal dari URL, bukan dari ringkasan.

   ⚠️ **Jebakan Q&A — apxUSD (Apyx, Juni 2026).** Depeg ke $0,78–0,93, ramai dibahas,
   tapi **di luar cakupan kita**: kolateralnya saham preferen STRC/SATA, bukan aset
   on-chain, dan penyebabnya nilai kolateral jatuh — bukan kunci dibajak. Menilainya
   butuh price oracle. Jawaban benar kalau juri menyebutnya: *"itu risiko nilai
   kolateral, bukan risiko penerbitan; kami menutup yang kedua, dan kami tidak
   berpura-pura menutup yang pertama."*

2. **"Proof of Reserves" jadi komoditas di 2026** — audit/PoR bergeser jadi
   *non-negotiable* dan vendornya ramai. Konsekuensi: **jangan positioning sebagai
   "PoR yang lebih baik"** — itu perlombaan vendor yang tidak bisa kita menangkan dalam
   5 menit. Pembedanya harus tetap **kuncinya, bukan laporannya**: PoR memberi tahu
   setelah kejadian; Corolary membuat kejadiannya mustahil.
3. Belum berhasil memverifikasi kriteria penilaian resmi edisi Fall (DoraHacks menolak
   fetch, HTTP 405). Rubrik di dokumen ini masih berpijak pada aturan edisi Maret 2026
   + `00-hackathon.md`. Cek manual sebelum submission.

## Satu-satunya penantang nyata: bukan ide baru, tapi urutan cerita #1

Pertimbangkan **membuka dengan Observatory mode**, bukan Vault mode. Observatory adalah
utilitas publik permissionless (skor C & D-nya yang paling tinggi), sementara Vault mode
butuh juri membayangkan sebuah issuer hipotetis. Produk dan kodenya identik — hanya
urutan demo yang berubah. Diputuskan saat menulis deck, bukan sekarang.

**Kesimpulan: #1 tetap terkunci. Jangan buka lagi tanpa fakta baru.**

---

# Addendum 2 — Uji ulang 9 Agustus 2026: **PENGUNCIAN FINAL**

Dipicu permintaan langsung user untuk mencari ide yang lebih kuat, dengan riset baru
terhadap protokol, pasar, dan lanskap kompetitif. **Hasil: tidak ada.** Skor tertinggi
kandidat baru **96**, masih di bawah #2 (106) dan jauh di bawah #1 (115).

## Lima kandidat baru yang diuji

| # | Ide | A×3 | B×3 | C×2 | D×2 | E | F | Total | Sebab gugur |
|---|---|---|---|---|---|---|---|---|---|
| P1 | **L2-lewat-L1** — baca state root Base/OP/Arbitrum yang di-post ke Ethereum, verifikasi MPT proof state L2 di kontrak Creditcoin | 10 | 7 | 10 | 6 | 6 | 7 | **96** | Infrastruktur tanpa protagonis. Memasukkan asumsi kepercayaan baru (proposer OP Stack + jendela sengketa) yang wajib diakui. **Diserap jadi Babak 5, bukan produk pengganti.** |
| P2 | **Attested Repayment Bureau** — riwayat pelunasan terbukti dari Maple/Goldfinch/Centrifuge/Clearpool mainnet (pasar $14 M private credit on-chain) | 8 | 10 | 5 | 6 | 8 | 7 | **91** | Lahan credit-score jenuh (≥6 tim, 0 menang). Dan **sybil**: peminjam tinggal pakai alamat baru. Riwayat kredit tanpa pengikat identitas itu rapuh. |
| P3 | **Prediction market yang menyelesaikan dirinya sendiri** — di-settle oleh event Ethereum terbukti, tanpa UMA/oracle | 9 | 4 | 9 | 9 | 8 | 6 | **89** | Demo terbaik dari semua kandidat, tapi **B=4 membunuhnya**. Tidak menyentuh kredit → CEIP nol. Hanya bisa menyelesaikan proposisi on-chain. |
| P4 | **Circuit breaker lintas rantai** — registry publik yang mem-*pause* protokol Creditcoin saat aliran abnormal Ethereum terbukti | 9 | 6 | 8 | 6 | 6 | 8 | **87** | Superset Observatory **tanpa `mint()` lock** → jadi monitor, bukan kunci. Kegagalan N2 terulang: adegan demo hilang. |
| P5 | **Proof-gated AI agent** (track AI) — agen yang seluruh inputnya terbukti kriptografis | 8 | 6 | 8 | 6 | 7 | 7 | **84** | Sama dengan ide #3. "Ada AI-nya" terbaca hiasan; membuktikan agennya *bagus* dalam 5 menit mustahil. |

**Pola kegagalannya konsisten** dengan analisis struktural di addendum 1: kandidat dengan
A tinggi (P1, P3, P4) selalu jatuh di B atau D; kandidat dengan B tinggi (P2) jatuh di C.

## Temuan protokol yang memperkuat kunci ini

Riset 9 Agustus menemukan batas Attestcoin yang **tidak tertulis di dokumentasi mana pun**
(`01-riset-mendalam.md` §1.7): attestation hanya berkomitmen pada pasangan
**(transaksi, receipt)** — tanpa block header, tanpa `stateRoot`.

Konsekuensinya mempersempit ruang ide lebih jauh dari yang kita kira: **Attestcoin adalah
oracle kejadian, bukan oracle keadaan.** Ide apa pun yang butuh membaca *keadaan* sebuah
alamat di Ethereum — saldo, posisi, kepemilikan — **mustahil, permanen.** Ini menggugurkan
sebagian besar variasi "monitor/dashboard/skor" sebelum sempat diskor, dan menjelaskan
kenapa #1 pas: `mint()` yang menolak hanya butuh **kejadian**, dan aksinya seluruhnya di
sisi Creditcoin.

## Penantang sesungguhnya bukan ide lain

Setelah semua diskor, satu-satunya cara #1 kalah adalah: **tim lain membangun ide yang
lebih dangkal, tapi dengan pengguna nyata di dalamnya.** Grand prize musim 1 jatuh ke
CrediKye — arisan — bukan ke yang paling canggih.

**Karena itu penguatan yang dipilih bukan ide baru, tapi empat gerakan** yang seluruhnya
berdiri di atas kontrak yang sudah dirancang (detail: `09-narasi-dan-deck.md`):

| # | Gerakan | Menaikkan |
|---|---|---|
| **1** | **Terbitkan private key issuer di README** — aman karena RT9 (immutable, tanpa fungsi admin) + A3 (lantai sebelum otorisasi). Klaim berubah dari pernyataan jadi eksperimen publik | F, D, RT6 |
| **2** | **Beri dia pengguna** — holder view + `redeem()` yang tidak bisa dibekukan siapa pun | **D, B** (sumbu terlemah) |
| **3** | **Beri dia publik** — observatory di target nyata terverifikasi, dibingkai kasus Zondacrypto | C, D |
| **4** | **Beri dia platform** — `IProvenReserve` sebagai standar + konsumen nyata | **B (CEIP)**, RT7 |

Ditambah **`mintWithProof()`** untuk kedalaman (A) dan **Babak 5 / P1** sebagai plafon.

## Yang TIDAK berubah walau waktu tak terbatas

Diuji khusus atas pertanyaan *"kalau waktu bukan kendala, apa yang berubah?"*
Jawabannya: **tambahkan yang dulu terhalang waktu; jangan sentuh yang terhalang
arsitektur atau prinsip.**

| Tetap ditolak | Kenapa waktu tidak menolongnya |
|---|---|
| **Ide #2 — credit market** | Lubangnya likuidasi, dan protokolnya satu arah. Waktu tidak membuat callback ada. |
| **Multi-aset ber-harga** (PAXG, token RWA) | Butuh price oracle → membatalkan klaim inti. Prinsip, bukan penyederhanaan. |
| **Membuktikan kewajiban issuer eksternal** (RT11) | Butuh angka awal yang tidak terbukti. Waktu tak terbatas justru memperburuk — biaya proof naik >10×/hari. |
| **Cadangan off-chain** | Tidak ada di rantai. Titik. |
| **Backfill riwayat dalam** | Sama, biaya continuity proof. |

**VONIS FINAL: #1 dikunci permanen. Dokumen ini ditutup untuk perdebatan arah.**
Yang tersisa adalah eksekusi, dan seluruh spesifikasinya ada di
`03-spesifikasi-produk.md`.
