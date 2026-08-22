# Red Team — Di Mana Ide Ini Bisa Kalah

Disusun **2 Agustus 2026**. Ditulis dari kursi juri yang skeptis, bukan dari kursi
pembuat. Tujuannya menemukan cara ide ini kalah **sebelum** juri menemukannya.

Diperbarui **9 Agustus 2026** — RT12 (kunci issuer diterbitkan publik) dan RT13 (lubang
`redeem()`) ditambahkan; daftar target RT1 dikoreksi; slide batas RT8 diberi bentuk final.

Aturan main: tiap temuan punya **serangannya**, **kenapa itu mematikan**, dan
**perbaikan konkret**. Temuan yang sudah diperbaiki ditandai ✅.

📌 **Jawaban satu kalimat untuk semua RT di sini sudah dikumpulkan jadi tabel hafalan di
`09-narasi-dan-deck.md` §6.** Dokumen ini menjelaskan *kenapa*; dokumen itu memberi
*kalimatnya*.

---

## ✅ RT1 — KRITIS: "Kami mengaudit Circle" adalah klaim palsu

**Serangan juri:** *"Cadangan USDC itu T-bill dan kas di BNY Mellon. Kalau kalian
memantau alamat Circle di Ethereum, sebenarnya kalian membuktikan apa?"*

**Kenapa mematikan:** karena jawabannya **tidak ada**. Kita cuma melihat token bergerak.
Dan begitu satu klaim ketahuan kosong, juri akan mencurigai semua klaim lain — termasuk
yang benar. Juri Creditcoin sedang mendorong RWA; mereka pasti tahu ini.

Yang sama salahnya: BlackRock BUIDL (T-bill), Ondo USDY/OUSG (T-bill + deposito),
Paxos PAXG (emas fisik di brankas).

**Perbaikan (sudah diterapkan):** target observatory dibatasi ke issuer yang kolateralnya
**benar-benar hidup on-chain**. Sudah diverifikasi aktif di mainnet:

⚠️ **Daftar diperbarui 9 Agustus 2026** — satu nama dicabut, satu ditambahkan sebagai
target utama. Daftar final beserta saldo terukur: `01-riset-mendalam.md` §3.5.

```
⭐ Sky LitePSM "Pocket"   0x37305B1c…   4.251.196.990 USDC MENTAH   eth_getCode = 0x (EOA)
   Liquity LUSD           $27,4 jt       kolateral ETH on-chain
   Resolv USR             korban 22 Mar 2026 — kolateral UTUH, yang jebol otoritas mint
   Reserve eUSD           supply $23,3 jt — kolateral DIBUNGKUS, enumerasi dulu
❌ Ethena USDe            DICABUT — off-exchange custody, gagal tes RT1 ini sendiri
❌ Aave aUSDC             ANTI-CONTOH — 8% backed by design, bukan kustodi 1:1
```

**Pelajaran dari pencabutan Ethena:** RT1 bisa kita langgar sendiri tanpa sadar, dengan
memasukkan nama ke kolom ✅ karena "terasa on-chain". Jalankan **tes kelayakan tiga
langkah** (`01` §3.5) untuk setiap target, termasuk yang sudah tertulis di dokumen ini.

**Kalimat penggantinya lebih kuat, bukan lebih lemah:**

> Tidak ada seorang pun on-chain yang bisa mengaudit Circle — cadangan mereka ada di bank.
> Kami mengaudit lapisan tempat kegagalan 2026 benar-benar terjadi: issuer yang
> kolateralnya hidup on-chain, yang mencetak di atasnya, dan yang bisa mencetak lebih
> banyak daripada yang mereka pegang.

Resolv adalah bukti sempurna: kolateral on-chain, korban Maret 2026, dan suplainya
menyusut dari miliaran ke $6,1 juta setelah kejadian.

**Yang tetap sah:** memakai **USDC sebagai aset cadangan**. Kita membuktikan *"fintech X
memegang N USDC di treasury-nya"* — bukan *"backing USDC itu sendiri"*. Dua klaim yang
sangat berbeda; jangan pernah tertukar.

---

## 🔴 RT2 — "Siapa sebenarnya yang memakai ini?"

**Serangan juri:** *"Siapa yang bangun pagi lalu membuka produk ini?"*

**Kenapa berbahaya:** ini sumbu terlemah kita. Grand prize musim 1 jatuh ke **CrediKye**,
produk arisan yang manusiawi dan menyenangkan — **bukan** yang paling canggih. Produk
infrastruktur B2B yang dingin kalah dari produk yang juri bisa bayangkan dipakai orang.

Observatory membantu (utilitas publik), tapi dashboard bukan produk yang punya pengguna.

**Perbaikan yang disarankan — beri protagonis, tanpa mengubah ide:**

Sandarkan pada tesis Creditcoin yang sebenarnya. Creditcoin bukan L1 generik: mereka
punya **Aella** (fintech Nigeria, 337.000+ user, $100 jt+ pinjaman on-chain) dan **MoU
dengan Central Bank of Nigeria**.

> Sebuah fintech di Lagos menerbitkan token tanda terima dolar untuk nasabahnya.
> Cadangannya USDC di treasury Ethereum. Nasabahnya tidak punya cara memeriksa apakah
> cadangan itu benar ada — sampai sekarang.
>
> **Protagonisnya penabung. Pelanggannya fintech. Mint-lock adalah yang melindungi
> penabung dari fintech-nya sendiri.**

Ini sah secara teknis (cadangan fintech memang USDC on-chain), selaras persis dengan
tesis Creditcoin, dan meminjam kekuatan emosional ide #5 **tanpa** menabrak HashCredit.

---

## 🟠 RT3 — Demo punya 9 menit kekosongan

**Serangan:** momen pamungkas (tarik cadangan → minting membeku) butuh ~9 menit menunggu
attestation. Di video bisa dipotong; di demo langsung itu kematian.

**Perbaikan:**
- **Picu penarikan di menit pertama**, kerjakan bagian lain selama menunggu, kembali di akhir.
- Atau jalankan **dua treasury yang tidak sefase**, jadi selalu ada bukti yang mendarat.
- Jangan sembunyikan penantiannya — **tunjukkan sebagai fitur**: hitung mundur ke tinggi
  blok yang ter-attest, dengan penjelasan kenapa 33–42 blok. Kejujuran tentang latensi
  justru memperkuat, karena angkanya bisa diturunkan dari konfigurasi on-chain.

---

## 🟠 RT4 — "Ini kan cuma collateral ratio ala MakerDAO"

**Serangan:** *"Mencetak dibatasi rasio kolateral itu sudah ada sejak DAI 2017.
Apa yang baru?"*

**Kenapa berbahaya:** kalau dijawab lambat, produk terlihat turunan.

**Jawaban yang harus siap, satu kalimat:**

> Yang baru bukan rasionya. Yang baru adalah **kolateralnya ada di rantai lain, tidak
> pernah di-bridge, tidak pernah dilaporkan siapa pun, dan dibuktikan per-transaksi
> lewat bukti inklusi.** MakerDAO hanya bisa melihat kolateral yang ada di rantainya
> sendiri. Kami melihat kolateral yang tidak pernah pindah.

---

## 🟠 RT5 — "Chainlink PoR sudah melakukan ini"

**Serangan:** Chainlink PoR dan Chronicle Proof of Asset (BlackRock BUIDL, $1,7 M AUM)
sudah mapan dan berdana.

**Jawaban, satu kalimat — jangan buka tabel dulu:**

> Keduanya **menanyakan kabar cadangan kepada pihak yang sedang kita curigai** — kustodian
> dan administrator issuer, dan hanya kalau issuer setuju. Kami tidak bertanya kepada
> siapa pun, dan issuer tidak bisa menolak.

Tabel perbandingan disimpan untuk pertanyaan lanjutan, bukan untuk slide utama.

---

## 🟡 RT6 — Kedalaman teknisnya nyata tapi tidak kasat mata

**Serangan:** kontraknya kecil. Juri bisa menyimpulkan *"bagian sulitnya dikerjakan
Attestcoin, kalian cuma memanggilnya."*

**Kenapa berbahaya:** "kedalaman pemakaian Attestcoin" adalah kriteria penilaian utama.
Kalau kedalamannya tidak terbaca dalam 5 menit, nilainya hilang meski nyata.

**Perbaikan — perluas permukaan protokol yang dipakai, semuanya sudah terbukti bisa:**

| Permukaan | Sinyal ke juri |
|---|---|
| `verifyAndEmit` (bukan `verify`) | Jejak audit permanen on-chain |
| **Batch overload** `verifyAndEmit` | 21% hemat — dan hampir tidak ada yang tahu fungsi ini ada |
| `EvmV1Decoder` | Membaca log pihak ketiga, bukan kontrak sendiri |
| ChainInfo `0x0fd3` | Dashboard status attestation live |
| **Dua chainKey sekaligus** (1 = Sepolia **dan** 3 = ETH mainnet) | **Sinyal terkuat.** Satu sistem membaca dua chain sumber serentak. |
| Pallet `attestation` via Substrate RPC | Kita membaca model kepercayaannya sendiri dari state |

Menjalankan **Sepolia dan Ethereum mainnet berbarengan dalam satu sistem** adalah bukti
kedalaman yang paling gampang dilihat dan paling sulit dibantah.

---

## 🟡 RT7 — Argumen ekosistem/CEIP belum ada

**Serangan:** juri menilai lewat lensa "layak diinvestasikan". Produk yang berdiri
sendiri kalah dari produk yang membuat ekosistem tumbuh.

**Catatan:** **SnowBall** menang juara 3 musim lalu dengan argumen "mengisi kekosongan
infrastruktur ekosistem" — argumen yang sangat CEIP-minded.

**Perbaikan:** ekspos feed sebagai **primitive on-chain publik** yang bisa dibaca dApp
Creditcoin lain — dan buktikan dengan satu konsumen nyata (A2). Satu kalimat di deck:

⚠️ Istilahnya mengikuti RT11: *solvency* untuk vault, *proven collateral* untuk
observatory.

> Setiap protokol pinjaman di Creditcoin yang menerima aset ini sebagai kolateral bisa
> membaca solvabilitasnya langsung dari kontrak kami — tanpa integrasi, tanpa izin.

---

## 🟡 RT8 — Batas cakupan bisa dibaca sebagai mainan

**Serangan:** *"Jadi kalian cuma bisa lihat cadangan on-chain, cuma dari Ethereum, dan
telat 9 menit?"*

**Perbaikan — nyatakan duluan, jangan menunggu ditanya.** Slide "apa yang TIDAK kami
lakukan" menaikkan kredibilitas dan mencuri senjata penanya. Tutup dengan:

> Cadangan off-chain butuh kustodian yang dipercaya. Cadangan on-chain tidak — dan
> **di sanalah dua kegagalan tahun ini terjadi.** Kami mengunci pintu yang benar-benar
> dibobol.

### Slide "yang TIDAK kami cegah" — bentuk finalnya (A9, 9 Agt 2026)

Jangan berhenti di kalimat. **Tunjukkan tabelnya**, termasuk kolom gagalnya:

| Kejadian | Kelas kegagalan | Corolary? |
|---|---|---|
| Ankr, Des 2022 | kunci deployer dicuri → mint tanpa backing | ✅ dicegah |
| Resolv, 22 Mar 2026 | `SERVICE_ROLE` di EOA tunggal → ~80 jt USR dicetak | ✅ dicegah |
| StablR, 24 Mei 2026 | multisig 1-of-3 dibobol → $13,5 jt dicetak | ✅ dicegah |
| **apxUSD, Jun 2026** | nilai kolateral (saham preferen) jatuh | ❌ **tidak** |
| **Balance Coin, 22 Jul 2026** | oracle BTCB dimanipulasi → likuidasi salah, ~$912 rb | ❌ **tidak** |

> Kami menutup risiko **otoritas penerbitan**. Kami tidak menutup risiko **nilai
> kolateral**, dan kami tidak berpura-pura bisa — menutup yang kedua butuh price oracle,
> dan price oracle membatalkan seluruh klaim kami.

**Kenapa dua baris merah itu menaikkan skor, bukan menurunkan:** juri sudah tahu ada
kasus yang tidak muat. Menyebutnya duluan mengubah pertanyaan mereka dari *"apa yang
mereka sembunyikan?"* jadi *"mereka tahu persis batas produknya."* Dan kasus 22 Juli
membuat deck terasa **ditulis minggu ini**, bukan Agustus lalu.

---

## 🔴 RT9 — KRITIS: tombol upgrade adalah kunci mint yang menyamar

*Ditemukan 7 Agustus 2026. Disetujui untuk diterapkan.*

**Serangan juri:** *"Kunci admin yang dibajak memang tidak bisa mencetak. Tapi kunci itu
bisa meng-upgrade kontraknya, lalu mencetak sesukanya. Jadi jaminan kalian apa?"*

**Kenapa mematikan:** kalau `Corolary` memakai proxy, seluruh tesis produk bohong —
dan bohongnya di kalimat pertama deck. Ini bukan skenario karangan. Dari enam preseden
serangan yang dikumpulkan (lihat `02-keputusan-ide.md` addendum), **Zoth (Mar 2025) dan
UPCX (Apr 2025) dua-duanya persis pola ini**: kunci dicuri → upgrade proxy jahat → dana
keluar. Kita akan jatuh oleh serangan yang kita klaim cegah.

**Perbaikan — murah, dan justru jadi senjata:**

- **Tanpa proxy.** Tidak ada UUPS, tidak ada transparent proxy, tidak ada beacon.
- **Tanpa `selfdestruct`, tanpa `delegatecall`** ke alamat yang bisa diganti.
- **Tanpa fungsi admin selain `mint()`.** `minCollateralRatioBps`, daftar aset,
  `treasury`, dan `sourceChainKey` **immutable** setelah deploy.
- Owner tidak punya kemampuan mengubah apa pun yang mempengaruhi lantai kolateral.

Kalimat decknya:

> Kontrak ini tidak bisa di-upgrade. Bukan karena kami tidak sempat — tapi karena tombol
> upgrade adalah kunci mint yang menyamar.

Ini satu keputusan yang sama dengan `redeem()` tanpa syarat: dua-duanya membuang
kekuasaan kita sendiri, dan itu yang membuat jaminannya berarti.

⚠️ **Konsekuensi yang harus diterima:** bug = redeploy, bukan patch. Karena itu fixture
test di atas tx nyata (§8 no. 3) bukan kemewahan.

---

## 🟠 RT10 — Jendela ~9 menit tempat mint tanpa backing masih mungkin

*Ditemukan 7 Agustus 2026.*

**Serangan:** latensi bekerja dua arah. Cadangan **naik** telat = kontrak cuma terlalu
pelit sebentar, tidak berbahaya. Cadangan **turun** telat = kontrak mengira dirinya lebih
sehat dari kenyataan, dan di jendela itu `mint()` masih mau jalan.

```
menit 0   cadangan terbukti 1.000.000 · suplai 500.000  → ruang mint 500.000
menit 0   issuer tarik 1.000.000 dari treasury Ethereum
menit 1   kontrak MASIH melihat 1.000.000 → mint 500.000 lolos
menit 9   bukti penarikan mendarat → cadangan 0, suplai 1.000.000
```

**Bobot sebenarnya (jangan dibesar-besarkan, jangan disembunyikan):** penyerang butuh
**dua** kunci — treasury Ethereum *dan* mint di Creditcoin. Kalau dia sudah pegang kunci
treasury, dia toh sudah bisa mencuri cadangannya langsung. Kerugian tambahannya sebatas
ruang mint yang tersisa. Tetap nyata, dan juri yang tajam akan menemukannya.

**Yang harus diterima:** jendela ini **tidak bisa ditutup.** Itu konsekuensi protokol satu
arah dengan latensi menit — tidak ada apa pun di Creditcoin yang bisa tahu sesuatu sebelum
buktinya sampai. Sikap yang benar: **batasi kerugiannya, lalu sebut batasnya duluan.**

**Perbaikan — dua lapis. Lapis 1 wajib.**

**Lapis 1 — gerbang kesegaran.** `mint()` revert kalau pandangan kita basi: bandingkan
`lastIngestedHeight` dengan tinggi attestation terkini dari ChainInfo `0x0fd3`; kalau
selisihnya melebihi ambang wajar (lag normal + toleransi), tolak. Ini menutup kasus yang
**paling mungkin benar-benar terjadi** — worker mati, angka membeku, mint jalan terus di
atas data basi. Bonus: `mint()` jadi bergantung langsung pada state protokol Attestcoin,
sinyal kedalaman untuk RT6.

**Lapis 2 — batas mint per jendela.** Cap `mint()` maksimal `maxMintPerWindowBps` dari
cadangan terbukti per satu jendela attestation. Ini yang membatasi kasus adversarial.

❌ **`haircutBps` BUKAN solusi untuk RT10.** Haircut membayar terus-menerus dengan
efisiensi modal untuk risiko yang hanya muncul ~9 menit, dan tetap tidak membatasi apa pun
kalau penarikannya 100%. Haircut tetap dipakai untuk tujuan aslinya (kualitas aset),
bukan untuk ini.

⚠️ Panjang jendela **jangan di-hardcode** — turunkan dari konfigurasi. Nilai final
(dikunci 9 Agt, G14/G15): `attestationWindowBlocks` **42** testnet / **74** mainnet ·
`maxStalenessBlocks` **63** / **111** · `maxMintPerWindowBps` **500**.
Semuanya **batas atas pita**, bukan rata-rata — `01-riset-mendalam.md` §1.5d.

**Klaim decknya berubah jadi lebih kuat, bukan lebih lemah:**

> Penerbitan tanpa backing dibatasi X% per jendela ~9 menit, dan batas itu ditegakkan
> on-chain.

Itu klaim yang bisa dibuktikan. "Mustahil" tidak bisa.

---

## 🟠 RT11 — Observatory baru membuktikan setengah dari kata "solvabilitas"

*Ditemukan 7 Agustus 2026.*

**Serangan juri:** *"Solvabilitas itu cadangan dibagi kewajiban. Kalian menunjukkan
kolateral Ethena turun — turun terhadap apa? Mana suplai USDe-nya?"*

**Vault mode aman.** Kewajiban = suplai token kita sendiri di Creditcoin. `totalSupply()`,
gratis, eksak. Kata "solvabilitas" sah sepenuhnya di sini.

**Observatory mode timpang.** Suplai USDe ada di Ethereum dan tidak kita baca. Kita punya
pembilang tanpa penyebut → tidak ada rasio → tidak boleh ada kata "solvent".

**Kenapa "tinggal ingest mint/burn mereka juga" adalah jebakan:** kewajiban butuh **angka
awal**. Ledger cadangan kita mulai dari nol dan hanya naik lewat bukti — itu jujur, karena
hasilnya sebuah *lantai* ("cadangan terbukti minimal sekian"). Untuk kewajiban, lantai
justru arah yang **berbahaya**: kewajiban yang dihitung kurang membuat semuanya tampak
lebih sehat. Akuntansi konservatif menuntut kewajiban di-*over*count. Untuk mendapat angka
awalnya kita harus menyuntikkan satu `eth_call` yang **tidak terbukti** ke dalam sistem
yang seluruh premisnya "tidak ada yang masuk tanpa bukti".

**Itu RT1 yang kita buat sendiri. Jangan.**

**Perbaikan — turunkan bahasanya, jangan tambah fitur:**

| Mode | Istilah yang dipakai | Boleh bilang |
|---|---|---|
| Vault | **solvency / solvabilitas** | rasio, lantai kolateral, "backed" |
| Observatory | **proven collateral** — *bukan* solvency | arah & besar perubahan, alarm |

Tugas observatory jadi lebih tajam: bukan lembaga pemeringkat, tapi **alarm dini**.
*"Kolateral terbukti Resolv turun $X dalam 4 menit"* — persis alarm yang seharusnya
berbunyi Maret 2026. Cerita itu lebih hidup daripada sebuah rasio.

**Kalimat decknya:**

> Di vault mode kami membuktikan solvabilitas. Di observatory mode kami membuktikan
> pergerakan kolateral — karena tidak ada seorang pun yang bisa membuktikan kewajiban
> issuer lain tanpa kerja sama issuer itu, dan kami tidak akan berpura-pura bisa.

⚠️ **Ini keputusan penamaan di UI** — murah sekarang, mahal setelah frontend jadi.
Kunci **sebelum Fase 6a**: nama komponen, label, dan seluruh copy. Masuk janji API ke
frontend (`08-kerja-paralel.md` §6).

---

## 🟢 RT12 — Klaim inti hanya bisa dibuktikan oleh kita → **terbitkan kuncinya**

*Ditemukan 9 Agustus 2026. Disetujui untuk diterapkan.*

**Serangan juri:** *"Kalian bilang kunci admin yang dibajak tidak bisa mencetak. Tapi
yang mencoba di video itu kalian sendiri. Bagaimana saya tahu itu bukan pertunjukan?"*

A3 sudah setengah menjawabnya — siapa pun bisa memanggil `mint()` dan mendapat
`WouldBreachCollateralFloor`. Tapi mereka memanggilnya sebagai **orang asing**, bukan
sebagai **pemegang kunci**. Klaim kita bicara tentang kunci yang dibajak, jadi buktinya
harus melibatkan kunci.

**Perbaikan — nol baris kode, dan ini menutup pertanyaannya sepenuhnya:**

> **Terbitkan private key issuer di README.**

**Kenapa ini aman**, dan kenapa ini justru buah dari dua keputusan yang sudah diambil:

| Keputusan | Yang dihapusnya dari kunci issuer |
|---|---|
| **RT9** — immutable, tanpa proxy, tanpa setter, **tanpa fungsi admin selain `mint()`** | Tidak bisa menurunkan lantai kolateral · tidak bisa mengganti aset/treasury · tidak bisa upgrade · **tidak bisa membekukan `redeem()`** |
| **A3** — lantai kolateral dicek sebelum otorisasi | Kunci itu tidak memberi keistimewaan apa pun saat melanggar lantai |

Yang tersisa di tangan pemegang kunci: **mencetak di dalam cadangan terbukti** — dan itu
memang tidak merugikan siapa pun, karena setiap token yang lahir punya cadangan di
belakangnya. `maxMintPerWindowBps = 500` membatasi lajunya.

**Efeknya berlapis:**
- Klaim berubah dari pernyataan jadi **eksperimen publik yang bisa difalsifikasi**.
  Kalau sampai 18 September tidak ada satu token pun tercetak tanpa backing, itu bukan
  lagi klaim — itu **hasil**.
- Papan skor pembobolan (§9.2 no. 11) jadi punya arti: *kuncinya publik, N orang mencoba,
  0 berhasil.*
- Menutup RT6 tanpa juri perlu paham satu baris Attestcoin pun.
- Menutup RT2 sebagian: sekarang ada orang yang berinteraksi dengan produk kita, walau
  motifnya menyerang.

**Syarat mutlak — kalau salah satu dilanggar, ini berubah dari senjata jadi bencana:**

1. ✅ **Akun ketiga yang benar-benar terpisah** — sudah dibuat 9 Agt:
   `0x2d27Da63Bbe23633c82ff553CfF009D974294e08`. Bukan deployer `0x825003Ed…`,
   bukan operator `0x7C1195c7…`. **Cocokkan alamatnya lagi sebelum menerbitkan kunci.**
2. **Isi seadanya** — cukup untuk beberapa ratus transaksi, tidak lebih.
3. **Testnet-only.** Tidak pernah dipakai ulang di Creditcoin mainnet.
4. **Kontrak wajib sudah lolos test RT9** (nol setter, nol proxy, nol `delegatecall` ke
   alamat variabel) **sebelum** kuncinya diterbitkan. Terbitkan di Fase 3, bukan Fase 0.
5. **Tulis alasannya di README**, jangan cuma kuncinya. Kunci tanpa penjelasan terbaca
   sebagai kecerobohan; kunci dengan penjelasan terbaca sebagai argumen.

Kalimat decknya:

> Kunci issuer-nya ada di README kami. Silakan ambil. Kamu tidak akan bisa mencetak satu
> token pun tanpa cadangan — bukan karena kami mempercayaimu, tapi karena kuncinya
> memang tidak punya kekuasaan itu.

---

## 🟠 RT13 — "Saya `redeem()`, lalu uang saya keluar dari mana?"

*Ditemukan 9 Agustus 2026. Lubang produk nyata yang belum pernah dinamai di dokumen mana pun.*

**Serangan juri:** *"Token saya terbakar di Creditcoin. USDC saya ada di Ethereum.
Protokol kalian satu arah. Jadi `redeem()` sebenarnya melakukan apa?"*

**Kenapa berbahaya:** kita menjual `redeem()` sebagai jaminan utama bagi penabung —
"pintu keluar yang tidak bisa dikunci". Kalau ternyata pintu itu membuka ke tembok,
seluruh lapisan manusia (§9.2) runtuh, dan runtuhnya di depan orang yang menilai.

**Yang harus diterima:** benar, `redeem()` tidak memindahkan USDC di Ethereum. Tidak ada
apa pun di Creditcoin yang bisa melakukan itu hari ini.

**Perbaikan — nyatakan duluan, dan ubah bentuk klaimnya:**

> `Corolary` tidak menjamin issuer membayar. Yang dijamin adalah **klaimmu tidak pernah
> bisa diencerkan** — dan `redeem()` mencatat **permintaan tebus yang tidak bisa
> disangkal pernah diterima**: permanen, on-chain, dengan cap waktu, dan tidak bisa
> dihapus siapa pun.

Ini bukan tambalan, dan itu sebabnya jawabannya kuat: **catatan on-chain yang tidak
terbantahkan sebagai dasar recourse dunia nyata adalah model asli Creditcoin sejak 2017**
— persis yang dipakai Aella. Kita tidak sedang meminta maaf atas keterbatasan; kita
sedang memakai tesis tuan rumah.

Tambahan roadmap yang boleh disebut **satu kali, dan wajib dilabeli roadmap**: saat
writability Attestcoin rilis (sedang audit, belum tersedia), instruksi pembayaran itu
bisa didorong balik ke Ethereum — dan arsitektur kita sudah berbentuk untuk itu, karena
keputusannya sudah on-chain di Creditcoin.

⚠️ **Jangan pernah menyebut writability sebagai kemampuan hari ini.** Itu masuk kategori
RT1 dan akan membunuh deck.

---

## Vonis

Setelah RT1 diperbaiki, ide ini **cukup kuat untuk menang.** Skornya terhadap formula
juara (`02-keputusan-ide.md`):

| Sumbu | Nilai | Catatan |
|---|---|---|
| Kedalaman USC | **10** | Tak terbantahkan setelah RT6 (dua chainKey + batch) |
| Selaras tesis & CEIP | **9** | 8 tanpa RT2; 9 dengan protagonis penabung |
| Belum jenuh | **10** | Nol dari 76 BUIDL musim 1 menyentuh lahan ini |
| Kekuatan demo | **9** | Momen mint-revert sangat kuat; pacing dibereskan RT3 |
| Kematangan produk | **?** | **Murni soal eksekusi.** Tidak bisa dijamin dokumen. |
| Kejujuran | **9** | Setelah RT1. **Sebelumnya 5** — ada ranjau di dalamnya. |

**Risiko terbesar bukan idenya, tapi keterbacaannya.** Kedalaman teknis proyek ini nyata
tapi halus — "kami membaca event Circle di mainnet" terdengar sepele sampai orang paham
tidak ada seorang pun di musim 1 yang bisa melakukannya. Pekerjaan sesungguhnya dari
sini adalah **membuat yang halus itu menjadi jelas dalam 5 menit.**

Risiko terbesar kedua: **eksekusi**. Dokumen tidak bisa menjaminnya.

## Tindakan yang harus masuk rencana build

| # | Tindakan | Kapan |
|---|---|---|
| RT1 | ✅ Target observatory dikoreksi di semua dokumen | Selesai |
| RT2 | Adopsi protagonis penabung/fintech emerging-market di seluruh materi | Sebelum deck |
| RT6 | Jalankan chainKey 1 **dan** 3 serentak; pakai batch ingest | Fase 4–5 |
| RT7 | Ekspos feed sebagai primitive publik (istilah per RT11) | Fase 5 |
| RT3 | Rancang urutan demo yang menyembunyikan 9 menit tunggu | Sebelum rekaman |
| RT4/RT5/RT8 | Siapkan jawaban satu kalimat, hafalkan | Sebelum demo day |
| **RT9** | **Kontrak immutable** — tanpa proxy, tanpa fungsi admin selain `mint()` | **Fase 1, sebelum baris pertama** |
| **RT10** | Gerbang kesegaran di `mint()` (wajib) + batas mint per jendela | **Fase 1** — mengubah struktur state |
| **RT11** | Kunci istilah: vault = *solvency*, observatory = *proven collateral* | **Sebelum Fase 6a** |
| **A1** | **Replay serangan nyata sebagai test** — `test_Resolv_*` & `test_StablR_*` di atas fixture tx mainnet, harus `WouldBreachCollateralFloor` | Fase 3 |
| **A2** | Satu kontrak konsumen ~30 baris yang membaca feed → membuktikan RT7 bukan janji | Fase 5 |
| **A3** | ✅ **DIPUTUSKAN 7 Agt:** urutan cek `mint()` = lantai kolateral → kesegaran → batas jendela → otorisasi | Kode + alasannya di spek §7.4 |
| **A4** | Munculkan perintah `docker run` worker **di dashboard**, bukan cuma di README | Fase 6 |
| **RT12** | **Terbitkan private key issuer di README** — akun ketiga terpisah, setelah test RT9 hijau | **Fase 3**, tidak lebih awal |
| **RT13** | Nyatakan lubang `redeem()` duluan; posisikan sebagai **bukti permintaan tebus** | Sebelum deck |
| **A5** | **`mintWithProof()`** — ingest + mint atomik. `mint()` biasa TETAP ADA (A3) | Fase 3 |
| **A6** | **`IProvenReserve` + DUA konsumen** (`CollateralGatedVault` + `FreshnessGuard`) | Fase 5 |
| **A7** | **Holder view + tombol `redeem()`** yang berfungsi dari wallet pengunjung | Fase 6a/6b |
| **A8** | **Papan skor pembobolan** dari revert nyata di Blockscout | Fase 6b |
| **A9** | Slide **"yang TIDAK kami cegah"** — Balance Coin (Jul 2026) + apxUSD | Sebelum deck |

### A3 & A4 — mengubah klaim jadi sesuatu yang bisa diuji orang lain

Keduanya berangkat dari masalah yang sama: klaim terkuat kita saat ini hanya bisa
dibuktikan **oleh kita**. Juri diminta percaya video. Dua tindakan ini memindahkan
pembuktiannya ke tangan mereka.

**A3 — lantai kolateral dicek sebelum `onlyIssuer`.** Dengan `onlyIssuer` sebagai
modifier, penyerang yang mencoba dari wallet sendiri dapat `Unauthorized` — **error yang
salah**, dan adegan pamungkas jadi tidak bisa direproduksi siapa pun kecuali pemegang
kunci issuer. Kalau lantai dicek duluan, **siapa pun di dunia bisa memanggil `mint()`
melebihi cadangan dan mendapat `WouldBreachCollateralFloor` sungguhan dari node.**

Biayanya beberapa ribu gas pada transaksi yang toh akan revert. Imbalannya: panel serangan
di dashboard jadi **permissionless dan otomatis bebas mock** — tidak ada lagi godaan
menganimasikan revert, karena revert-nya bisa dipicu pengunjung mana pun.

✅ **Diputuskan 7 Agustus 2026.** Urutan final: **lantai kolateral → kesegaran (RT10 lapis 1)
→ batas jendela (RT10 lapis 2) → otorisasi issuer.** Kode dan alasannya sudah ditulis di
`03-spesifikasi-produk.md` §7.4; empat error terkait masuk Lampiran B.

⚠️ Jangan "merapikan" ini jadi `onlyIssuer` modifier saat ngoding — modifier berjalan
sebelum badan fungsi, jadi itu membalik urutannya dan diam-diam mengembalikan masalahnya.
Komentar peringatan sudah ditempel di kodenya.

**A4 — "jalankan worker-nya sendiri" di dashboard.** `ingest()` permissionless:
keamanannya dari bukti, bukan dari siapa pengirimnya. Satu blok berisi perintah
`docker run` sekali-jalan mengubah klaim itu dari kalimat di deck jadi sesuatu yang juri
bisa lakukan dalam 60 detik — dan membuktikan secara harfiah bahwa kalau worker issuer
mati, pemegang tokennya sendiri bisa menjaga angka cadangan tetap mutakhir.

### A1 & A2 — kenapa dua tindakan ini nilainya tinggi per jam

**A1 (replay serangan nyata).** Serangan Resolv dan StablR punya tx hash publik di
Ethereum mainnet. Bangun state cadangan dari event `Transfer` mainnet nyata di blok itu,
lalu panggil `mint()` dengan jumlah yang sungguh-sungguh dicetak penyerang:

```
test_Resolv_UnbackedMint_WouldHaveReverted()   → WouldBreachCollateralFloor
test_StablR_UnbackedMint_WouldHaveReverted()   → WouldBreachCollateralFloor
```

Bedanya besar: bukan *"kami bisa mencegah serangan seperti itu"*, tapi **"jalankan
`forge test` — ini transaksinya, ini bloknya, ini penolakannya."** Counterfactual yang
bisa dieksekusi juri sendiri. Ini juga menjawab RT6 dengan cara yang **tidak menuntut juri
paham Attestcoin sama sekali.**

**A2 (konsumen nyata).** RT7 menyarankan mengekspos feed sebagai primitive publik. Satu
kontrak contoh ~30 baris yang benar-benar mengonsumsinya — misalnya vault yang menolak
menerima token ini sebagai kolateral saat rasio turun di bawah ambang — mengubah "bisa
dibaca dApp lain" dari **janji** jadi **demonstrasi**.
