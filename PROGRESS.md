# PROGRESS — Corolary

> *Solvency isn't claimed. It follows.*

**Baca ini pertama, setiap sesi.** Status + lingkungan terverifikasi.
Terakhir diperbarui: **9 Agustus 2026**.

---

## ⏳ YANG MASIH MENGGANTUNG (per 9 Agustus, sore)

- [x] ✅ Kunci di password manager
- [x] ✅ **Dana terdistribusi** — deployer 9.880 · operator 100 · issuer 20 tCTC
- [x] ✅ Runbook VPS (§8.5) & keputusan host dashboard (§9.4) **sudah ditulis lengkap**

**Butuh manusia — pembuatan akun & pembayaran tidak bisa didelegasikan:**
- [ ] **Sewa VPS** (Hetzner CX22 / DO Basic, Ubuntu 24.04, **sampai 30 Sept**) → G13.
      Setelah server ada, seluruh sisanya salin-tempel dari §8.5
- [ ] **Buat akun host statis** (Cloudflare Pages / Vercel / Netlify) → G21.
      Aturan & uji akhir sudah di §9.4
- [ ] **Akun healthchecks.io** — period 10 mnt, grace 20 mnt, alert email + Telegram
- [ ] Daftar AMA: `https://luma.com/buidlctc-fall26-ama` (18 Agt, 07:00 ET)
- [ ] Tanya rubrik di Discord `#buidl-ctc-qna`
- [ ] Data tim 2 orang (nama, email, bio, peran, domisili, kewarganegaraan)
- [x] ✅ Logo `logo-corolary.png` (PNG 1024×1024) — ⏳ masih perlu **URL publik**,
      form submission minta URL bukan berkas

---

## Status: 🟢 SIAP MULAI BUILD — 0 blocker, dana masuk

```
Dokumentasi  : ✅ final (10 dokumen + CLAUDE.md)
Ide          : ✅ dikunci permanen — #1 Solvency-Locked Issuance
Parameter    : ✅ semua parameter immutable sudah punya angka
Dana         : ✅ 10.000 tCTC di deployer 0x825003Ed…
Gap          : 25 pertanyaan tertutup · 12 gap ditutup · 10 terbuka · 0 BLOCKER
               7 butuh kode · 2 butuh akun+pembayaran (runbook sudah lengkap)
               1 sudah diputuskan isinya (G12)
Kode         : ❌ NOL — dan WAJIB tetap nol sampai 13 Agustus (aturan lomba)
Langkah      : Fase 0 di docs/05-rencana-build.md
```

---

## Lingkungan terverifikasi (9 Agustus 2026)

| Item | Status |
|---|---|
| CC3 testnet RPC · chainId 102031 · spec **131** | ✅ hidup |
| CC mainnet RPC · chainId 102030 · spec **131** | ✅ hidup |
| Proof Builder **testnet** | ✅ HTTP 200, ~0,9 dtk |
| Proof Builder **mainnet** `proofbuilder.cc3-mainnet-usc…` | ✅ HTTP 200, ~1,05 dtk, TLS valid |
| `EvmV1Decoder` testnet `0x731c345d…` | ✅ terdeploy |
| `EvmV1Decoder` **mainnet** `0x9D094C9f…` | ✅ terdeploy — **sudah ada** |
| Chain sumber | ✅ hanya Ethereum (testnet: key 1 Sepolia + 3 mainnet · CC mainnet: key 1) |
| **Deployer** `0x825003EdbE16AedfC63f99836553a15B1299f35e` | ✅ **9.880 tCTC**, nonce 2 |
| **Operator** `0x7C1195c7e31ED2Dd4cE207D926d2fA3bA2e15Ff3` | ✅ **100 tCTC** |
| **Issuer** `0x2d27Da63Bbe23633c82ff553CfF009D974294e08` | ✅ **20 tCTC** · **kunci dipublikasikan** (RT12) |
| Akun lama `0x4e83Fa…` (10.000 tCTC) | ⚰️ **kunci hilang — dianggap mati.** Jangan dipakai di konfigurasi apa pun |
| `.gitignore` + `.env` | ✅ dibuat 9 Agt · `.env` di-gitignore, kunci **belum** di password manager |

**Lag attestation terukur (pita, bukan titik):**

```
CC3 testnet ← Sepolia   : 32–41 blok
CC3 testnet ← ETH main  : 33–42 blok   (~6,9–9,0 mnt)
CC mainnet  ← ETH main  : 65–73 blok   (~13,0–14,6 mnt)
```

**Parameter kontrak (immutable — harus benar sebelum deploy):**

```
attestationWindowBlocks : 42  (CC3 testnet)  /  74  (CC mainnet)
maxStalenessBlocks      : 63  (CC3 testnet)  / 111  (CC mainnet)
maxMintPerWindowBps     : 500  (5%)
minCollateralRatioBps   : 10000 (100%)
```

**Fixture pertama (siap dipakai):**

```
tx   0x9dd3e53b0207d90ac01e02997148a4b9fc8f96ad1db4272935f53b60edc5ed70
blok 25.712.180 (Ethereum mainnet) · txIndex 0 · txBytes 10.849 B
terbukti bisa di-proof di KEDUA lingkungan
```

**Target observatory terverifikasi:**

```
⭐ Sky LitePSM "Pocket"  0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341
   4.251.196.990 USDC mentah · eth_getCode = 0x (EOA)
   Resolv (USR)          korban 22 Mar 2026, pemulihan sampai 26 Agt 2026
   Reserve eUSD          0xF014FEF4… — bersyarat, kolateral dibungkus
❌ Ethena                DICABUT · ❌ Aave  ANTI-CONTOH (8% backed by design)
```

---

## Riwayat keputusan

| Tanggal | Keputusan |
|---|---|
| 1 Agt | Prototipe pertama lolos test, lalu **sengaja dihapus** untuk arsitektur lebih baik |
| 2 Agt | Ide #1 dikunci · nama `Corolary` (satu L) · track RWA · repo direset ke nol |
| 2 Agt | Aturan **NOL MOCK** dikunci sebagai gerbang rilis |
| 7 Agt | RT9 immutable · RT10 gerbang kesegaran + cap jendela · A3 urutan cek `mint()` · RT11 istilah per mode |
| **9 Agt** | **5 kandidat ide baru diuji — tertinggi 96 vs 115. #1 dikunci PERMANEN** |
| **9 Agt** | **§1.7 ditemukan**: attestation tidak menyentuh `stateRoot` → membuktikan saldo di Ethereum mustahil |
| **9 Agt** | **G5 dibatalkan** — proof API mainnet tidak rusak, URL-nya berubah |
| **9 Agt** | **G14 diukur** (lag = pita) · **G15 diputuskan** (500 bps) · **G10 ditutup** (target terverifikasi) |
| **9 Agt** | **RT12** — kunci issuer diterbitkan publik · **RT13** — lubang `redeem()` dijawab |
| **9 Agt** | **A5–A9** ditambahkan: `mintWithProof`, `IProvenReserve` + 2 konsumen, holder view, papan skor, slide batas |
| **9 Agt** | **Babak 5** (state root Base) masuk sebagai Fase 9 opsional, di luar jalur kritis |
| **9 Agt** | Akun lama hilang kuncinya → **tiga akun baru fresh**, faucet masuk 10.000 tCTC |
| **9 Agt** | **G8 membantah docs**: biaya TIDAK naik terus — ada tebing (1→~61 root) lalu **datar sampai 30 hari**. Backfill jadi murah; satu baris "Jangan sentuh" dicabut |
| **9 Agt** | **G3, G16, G17, G18, G19, G20 ditutup** — proof API tanpa rate limit · slot `balanceOf` Base = **9** · `rootClaim` ada di **topic3** · bukti MPT 7,4 KB |

---

## 🔴 Aturan lomba yang menentukan KAPAN mulai

> *"Must be original work created during the hackathon."* — Submission dibuka **13 Agustus**.

**Kode kita masih nol, dan itu hadiah.** Artinya kepatuhan ini bisa dibuat **terbukti**:

- **Commit kode pertama pada atau setelah 13 Agustus.** Repo publik, riwayat utuh,
  jangan squash.
- ✅ **Arsip kode lama sudah dihapus (9 Agt)** — tidak ada kode lama tersisa di mana pun,
  jadi tidak ada yang bisa disalin. Kepatuhan jadi fakta, bukan janji.
- Nyatakan terus terang di README: riset & desain selesai sebelum submission dibuka,
  **seluruh kode ditulis selama periode lomba, riwayat git bisa diperiksa siapa pun.**

Sebelum 13 Agustus, yang boleh dikerjakan: dokumen, `tools/recon/` sebagai eksplorasi
lokal (jangan di-commit sebagai kode proyek), pembuatan akun, dan data tim.

## Langkah berikutnya — Fase 0

1. Scaffold repo (`03-spesifikasi-produk.md` §11) — **`.gitignore` memuat `.env*` dan
   `*.tar.gz` SEBELUM commit pertama**
2. Bangun `tools/recon/` (`01-riset-mendalam.md` §9) — **pool RPC + retry + header UA**
3. Buat **dua akun baru**: operator worker (~100 tCTC) dan issuer demo (≤20 tCTC)
4. Kunci istilah RT11 secara tertulis — frontend mulai Fase 6a di hari yang sama
5. Konfirmasi tertulis: kontrak immutable, bug = redeploy
6. **Kumpulkan data tim kedua orang** (nama, email, bio, peran, negara domisili &
   kewarganegaraan) — jangan tanggal 6 September
7. **Tanya di Discord `#buidl-ctc-qna`**: bagaimana "depth of Attestcoin utilization"
   dinilai? Jangan menunggu AMA 18 Agt

⚠️ **Sebelum deploy final:** jalankan `attestation-lag.mjs` ≥2 jam untuk memastikan pita
G14 belum bergeser. Kontrak `immutable` — angka salah hanya bisa diperbaiki dengan redeploy.

---

## Cara memperbarui dokumen ini

- Fase selesai → centang di `05-rencana-build.md`, ringkas di sini
- Gap tertutup → pindahkan ke §1 `04-gap-dan-blocker.md` **beserta angkanya**
- Angka baru → `01-riset-mendalam.md` (**ukur, jangan tebak**)
- Keputusan arah → `02-keputusan-ide.md` + baris di tabel riwayat di atas
