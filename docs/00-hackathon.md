# BUIDL CTC 2026 Fall — "BUIDL For The Real World"

Sponsor: Creditcoin &amp; Credit Labs

Tema wajib: **Attestcoin Protocol** (sebelumnya bernama USC / Universal Smart Contract)

## Ringkasan

Bangun aplikasi cross-chain di Creditcoin. Setiap submission **wajib** memakai

Attestcoin Protocol: infrastruktur oracle terdesentralisasi yang membuat smart

contract di Creditcoin bisa memverifikasi event dari blockchain lain dan

menjalankan business logic cross-chain **tanpa oracle terpusat maupun bridge**.

Docs: [https://docs.creditcoin.org/creditcoin-usc](https://docs.creditcoin.org/creditcoin-usc)

## Timeline

*Diverifikasi ulang 9 Agustus 2026 langsung dari halaman DoraHacks.*


| Item                    | Tanggal                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Submission dibuka       | 13 Agustus 2026                                                                                                                         |
| **Online AMA**          | **18 Agustus 2026**, 20:00 KST / 07:00 ET ⚠️ **dikoreksi** — sebelumnya tertulis 13 Agt. Daftar: `https://luma.com/buidlctc-fall26-ama` |
| **Deadline submission** | **6 September 2026, 23:59 ET**                                                                                                          |
| Pengumuman pemenang     | 18 September 2026                                                                                                                       |
| CTC Ignition (Seoul)    | 28 September 2026                                                                                                                       |


Grand prize winner di luar Korea Selatan dapat tiket pesawat + hotel ke CTC Ignition.

## Prize Pool — $15,000

- Grand Prize: **$10,000**
- 2nd: **$3,000**
- 3rd: **$2,000**
- Semua pemenang: 8K credits CertiK repo audit + 3 bulan Skynet Boost

  (CMC listing support **tidak** termasuk)
- **Top 3 masuk CEIP fast-track**: langsung ke tahap due diligence untuk

  investasi dari Credit Labs (+ advisory engineering/produk + akses partner &amp; VC)

## Tracks

1. **DeFi** — lending, trading, liquidity, yield di Creditcoin.
2. **RWA** — tokenisasi / manajemen / pembiayaan aset dunia nyata.
3. **DePIN** — aplikasi DePIN yang memakai data cross-chain untuk insentif,

   settlement, atau koordinasi jaringan hardware/sensor.
4. **Gaming** — game atau infrastruktur game: in-game economy, asset ownership,

   marketplace player-driven.
5. **AI** — AI app yang memproses data cross-chain terverifikasi kriptografis

   untuk mengambil keputusan dan men-trigger transaksi on-chain otomatis,

   tanpa operator oracle terpusat.

## Requirement Wajib

- Karya **orisinal**, dibuat selama periode hackathon.
- **Harus deploy di testnet.**
- Attestcoin Protocol sebagai **core feature**, bukan tempelan.
- Kode integrasi Attestcoin yang **benar-benar jalan** di dalam project.
- Dokumentasi teknis: setup + penjelasan cara project memakai Attestcoin.
- **Kedalaman pemakaian Attestcoin = salah satu kriteria penilaian utama.**
- Tidak melanggar IP pihak ketiga.

## Eligibility

Semua anggota tim: tanpa catatan kriminal, tanpa kasus pidana berjalan, bukan

penduduk negara tersanksi, bukan individu tersanksi, dan legal ikut menurut

hukum setempat. Ukuran tim minimum: 1 orang.

## Submission Checklist

**Project**

- [ ] Project Name
- [ ] Project Logo (URL PNG/SVG/AI — opsional)
- [ ] Project Sector (DeFi / RWA / DePIN / Gaming / AI)
- [ ] Project Description
- [ ] **Attestcoin Protocol Integration Summary**
- [ ] GitHub repo URL (wajib ada README)
- [ ] Deck atau whitepaper (PDF URL)
- [ ] Prototype demo video URL

**Per anggota tim**

- [ ] Nama depan &amp; belakang, email, bio singkat, role
- [ ] Country of residence + country of citizenship
- [ ] Opsional: Telegram, X, LinkedIn, resume PDF

Kontak: [team@creditcoin.org](mailto:team@creditcoin.org)

## Developer Resources

⚠️ **URL docs pindah 2026** — halaman lomba masih menautkan yang lama (redirect).

Path baru: `/creditcoin-usc/*` → `**/attestcoin-protocol/***`

- Ringkasan protokol: [https://docs.creditcoin.org/attestcoin-protocol.md](https://docs.creditcoin.org/attestcoin-protocol.md)
- Chains &amp; Environments: [https://docs.creditcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments.md](https://docs.creditcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments.md)
- Readability (attestation, proving, gas): [https://docs.creditcoin.org/attestcoin-protocol/attestcoin-readability.md](https://docs.creditcoin.org/attestcoin-protocol/attestcoin-readability.md)
- **Writability**: [https://docs.creditcoin.org/attestcoin-protocol/attestcoin-writability.md](https://docs.creditcoin.org/attestcoin-protocol/attestcoin-writability.md)
- SDK: [https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-sdk-usc-sdk.md](https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-sdk-usc-sdk.md)
- Design patterns: [https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/dapp-design-patterns-readability.md](https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/dapp-design-patterns-readability.md)
- Sitemap: [https://docs.creditcoin.org/sitemap.md](https://docs.creditcoin.org/sitemap.md) · llms.txt: [https://docs.creditcoin.org/llms.txt](https://docs.creditcoin.org/llms.txt)
- Rilis runtime: [https://github.com/gluwa/creditcoin3/releases](https://github.com/gluwa/creditcoin3/releases)

**Tips membaca docs ini:** halaman `.md` menerima query `?ask=...`, dan `sitemap.md`

adalah cara tercepat menemukan halaman yang pindah.

## ⚠️ Attestcoin Writability — ADA, tapi BELUM tersedia

Halaman `attestcoin-writability` mendeskripsikan messaging **Creditcoin → chain tujuan**:

kontrak menerbitkan pesan ke outbox → attestor menandatangani setelah ⅔+1 sepakat →

relayer mengirim ke inbox chain tujuan → kontrak penerima memverifikasi lalu mengeksekusi.

**Statusnya eksplisit di docs: sedang menjalani pengujian &amp; audit pihak ketiga, belum**

**rilis di testnet.**

Konsekuensi untuk kita:

- ✅ Batasan **"protokol satu arah" tetap berlaku penuh** untuk lomba ini — jadi alasan

  menolak ide #2 (credit market, butuh likuidasi di Ethereum) tetap sah.
- ✅ Boleh disebut **satu kali sebagai roadmap** (jawaban RT13 tentang `redeem()`).
- ⛔ **HARAM disebut sebagai kemampuan.** Itu masuk daftar klaim terlarang.

---

# Catatan Teknis Attestcoin / USC (hasil riset docs)

**Primitive intinya:** buktikan bahwa sebuah **transaksi tertentu benar-benar**

**ter-include di sebuah blok di chain sumber**, lalu verifikasi bukti itu secara

on-chain di Creditcoin lewat precompile. Ini bukan messaging dua arah dan bukan

bridge aset — arahnya **satu arah: chain sumber → Creditcoin**.

**Anatomi proof:**

- *Merkle proof* — tx ada di merkle tree blok tersebut.
- *Continuity proof* — blok tersebut tersambung ke attestation point di Creditcoin.

**SDK** `@gluwa/usc-sdk` (TypeScript):

- `ProofBuilder` — ambil proof dari hosted Proof Builder API (jalur yang disarankan)
- `RawProofBuilder` — hitung proof lokal kalau butuh kontrol penuh
- `PrecompileChainInfoProvider` — query status attestation di Creditcoin
- `PrecompileBlockProver` — submit proof ke verifier on-chain

```ts
const prover = new blockProver.PrecompileBlockProver(creditcoinProvider);
const verified = await prover.verifySingle(
  chainKey, headerNumber, txBytes, merkleProof, continuityProof
);
```

**Alur kerja:**

1. Query supported chains → dapat `chainKey` chain sumber
2. Tunggu blok yang memuat tx ter-attest di Creditcoin
3. Generate proof via ProofBuilder
4. Submit on-chain via PrecompileBlockProver

> ⚠️ Bagian di bawah adalah **apa kata dokumentasi**, bukan hasil pengukuran kita.
>
> Beberapa di antaranya **terbukti menyesatkan** — angka yang sudah kita ukur sendiri
>
> ada di `01-riset-mendalam.md` dan itu yang dipakai.

**Batasan penting (harus dipikirkan saat desain produk):**

- Verifikasi selesai dalam ~1 blok (~15 detik) **setelah** blok sumber final &amp; ter-attest

  — ⚠️ **menyesatkan.** Itu hanya langkah verify. End-to-end terukur **32–42 blok**

  (~6,9–9,0 menit) di CC3 testnet; **65–73 blok** (~13–14,6 menit) di CC mainnet.

  Angkanya **pita, bukan titik** — `01-riset-mendalam.md` §1.5d.
- Batch maksimum **10 proof**, dan tx-nya harus berada dalam rentang **1000 blok**
- Polling timeout default 15 menit untuk menunggu attestation
- **Chain sumber yang didukung saat ini hanya Ethereum** — diverifikasi ulang 9 Agt

  langsung dari precompile, bukan docs. Testnet: Sepolia `chainKey 1`, Ethereum mainnet

  `chainKey 3`. CC mainnet: Ethereum mainnet `chainKey 1`. Tidak ada chain lain.
- Tersedia decoder contract untuk mem-parse isi tx yang sudah terbukti — **dan sekarang**

  **sudah terdeploy di kedua lingkungan** (`01` §8).
- ⚠️ **Yang dibuktikan adalah KEJADIAN, bukan KEADAAN.** Attestation berkomitmen pada

  pasangan (transaksi, receipt) saja — tanpa block header, tanpa `stateRoot`. Membuktikan

  **saldo** sebuah alamat di Ethereum **mustahil secara protokol**. Ini batas terdalam

  yang membentuk seluruh desain produk kita: `01-riset-mendalam.md` §1.7.

**Implikasi desain:** ide terbaik adalah yang menempatkan Creditcoin sebagai

**settlement / credit layer** yang *membaca kebenaran dari Ethereum*, bukan yang

butuh pesan balik ke Ethereum atau butuh banyak chain sumber.

---

# Dokumen Terkait

- `**01-riset-mendalam.md**` — riset teknis + pasar + kompetitif. Semua angka terukur

  sendiri. Termasuk daftar klaim terlarang (§7) yang wajib disaring sebelum submission.
- `**02-keputusan-ide.md**` — ranking 7 ide, alasan pemilihan, dan lahan yang harus dihindari.
- `**03-spesifikasi-produk.md**` — PRD, arsitektur, desain kontrak. Rujukan utama saat ngoding.
- `**04-gap-dan-blocker.md**` — gap terbuka + cara memverifikasinya.
- `**05-rencana-build.md**` — build order berurutan.
- `**06-akun-dan-dana.md**` — akun deployer berdana. Jangan sampai hilang.

