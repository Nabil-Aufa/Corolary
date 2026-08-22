# Akun & Dana — JANGAN SAMPAI HILANG

Terakhir diverifikasi: **9 Agustus 2026** (saldo & nonce dicek langsung ke RPC).

---

## ✅ TIGA AKUN BARU — digenerate 9 Agustus 2026, fresh dari nol

**Keputusan user:** tidak memakai apa pun dari arsip lama. Mulai bersih.

Digenerate lokal dengan secp256k1 + keccak256 murni Python, entropi dari `secrets`
(CSPRNG). Implementasinya diverifikasi lebih dulu dengan dua vektor uji yang diketahui
(`priv=1` dan `priv=2` → alamat kanonik). Private key **ditulis langsung ke `.env`**,
tidak pernah dicetak ke layar mana pun.

```
Jaringan : Creditcoin CC3 Testnet — chainId 102031 (0x18e8f)
RPC      : https://rpc.cc3-testnet.creditcoin.network
Explorer : https://creditcoin-testnet.blockscout.com/address/<alamat>

DEPLOYER : 0x825003EdbE16AedfC63f99836553a15B1299f35e   ✅ 9.880 tCTC   nonce 2
OPERATOR : 0x7C1195c7e31ED2Dd4cE207D926d2fA3bA2e15Ff3   ✅   100 tCTC   nonce 0
ISSUER   : 0x2d27Da63Bbe23633c82ff553CfF009D974294e08   ✅    20 tCTC   nonce 0
                                                         KUNCI DIPUBLIKASIKAN (RT12)

Faucet masuk 9 Agt, lalu deployer mengisi dua akun lain. Semua terverifikasi di chain.
```

> ⚠️ **TESTNET-ONLY BURNER.** Private key tersimpan plaintext di `.env`.
> **Jangan pernah mengirim CTC mainnet, atau aset bernilai apa pun, ke alamat mana pun di atas.**

### 🔴 Dua langkah yang harus dilakukan SEKARANG

1. **Salin ketiga private key ke password manager.** Label:
   *"CTC hackathon — Creditcoin testnet — deployer / operator / issuer"*.
   **Ini yang tidak dilakukan bulan lalu, dan itulah kenapa akun lama hilang.**
   `.env` di-gitignore, artinya dia **tidak akan ikut ke GitHub** — dan artinya juga
   dia hilang bersama folder ini kalau folder ini kenapa-napa.

2. **Minta faucet untuk DEPLOYER** — Discord Creditcoin, channel `token-faucet`:
   ```
   /faucet address:0x825003EdbE16AedfC63f99836553a15B1299f35e
   ```
   Jalur cadangan: email **team@creditcoin.org**.
   ⏰ **Lakukan hari ini.** Faucet ini pernah jadi blocker sehari penuh, dan jendela
   9–13 Agustus memang tidak bisa dipakai ngoding (aturan lomba) — jadi itu waktu yang
   tepat untuk membereskannya. *(Selesai: faucet masuk 9 Agt.)*

Setelah deployer terisi, kirim sendiri ke dua akun lain: **~100 tCTC ke operator**,
**≤20 tCTC ke issuer**. Jangan minta faucet tiga kali.

### ⚰️ Akun lama — dianggap mati

```
0x4e83Fa344E529f4c03948691BDD5A9A83384ED05   10.000 tCTC   nonce 0
```

Saldonya masih utuh dan **akan tetap di sana selamanya**, tapi kuncinya tidak ada di
disk mana pun. **Jangan pakai alamat ini di konfigurasi apa pun.** Kalau suatu hari
kuncinya ketemu di password manager, itu bonus — bukan rencana.

## Kenapa ini penting

Faucet Creditcoin **hanya lewat Discord** (channel `token-faucet`, perintah
`/faucet address:0x…`, format EVM). Mendapatkannya kemarin memakan waktu dan sempat jadi
blocker tunggal yang menghentikan proyek ini selama sehari. Jalur cadangan satu-satunya:
email **team@creditcoin.org**.

Kalau kunci ini hilang, seluruh proses itu harus diulang dari awal.

Untuk konteks berapa berharganya: biaya `ingest` terukur **~0,00004 CTC**. Saldo 10.000
tCTC ini cukup untuk **ratusan juta** transaksi. Ini bukan "cukup" — ini praktis tak
terbatas untuk seluruh proyek.

## Kenapa akun lama hilang — dan aturan yang lahir dari situ

Dokumen 2 Agustus mencatat **tiga** salinan private key: `.env`, arsip `.tar.gz`, dan
password manager — yang ketiga ditandai *"❗ BELUM ADA — lakukan ini sekarang"* dan
**tidak pernah dikerjakan**.

Lalu `.env` hilang, arsipnya dihapus, dan tersisa nol salinan. Pencarian menyeluruh di
`D:/Web3`, scratchpad, Downloads, Desktop, dan Documents: tidak ada.

**Aturan yang mengikat sekarang, untuk ketiga akun:**

> Setiap kunci wajib masuk **password manager pada JAM YANG SAMA saat dibuat.**
> Bukan "nanti", bukan "besok". **Satu salinan di disk bukan cadangan.**

⛔ **Jangan bikin salinan cadangan di arsip terkompresi.** Arsip itu yang tadinya terasa
aman, dan justru yang pertama dihapus.

### Isi `.env` (sudah dibuat, di-gitignore)

```
CREDITCOIN_RPC / CREDITCOIN_CHAIN_ID
DEPLOYER_ADDRESS + DEPLOYER_PRIVATE_KEY
OPERATOR_ADDRESS + OPERATOR_PRIVATE_KEY
ISSUER_ADDRESS   + ISSUER_PRIVATE_KEY
```

⚠️ `.gitignore` sudah dibuat **sebelum** `.env` — pola `.env` dan `.env.*` ada di
dalamnya, plus `*.tar.gz`, `*.key`, dan `secrets/`.

## Aturan saat scaffold repo

1. **Jangan generate wallet baru lagi.** Tiga akun di atas sudah cukup untuk seluruh
   proyek — deployer, operator, issuer. Menambah akun cuma menambah kunci yang bisa hilang.
2. ✅ `.gitignore` **sudah dibuat lebih dulu** dan memuat `.env`, `.env.*`, `*.tar.gz`,
   `*.key`, `secrets/`. Jangan longgarkan.
3. Jangan pernah menaruh private key di file yang ter-commit — termasuk file dokumen,
   `foundry.toml`, script deploy, atau README.
   **Satu pengecualian yang disengaja: kunci ISSUER di README (RT12)** — dan itu hanya
   setelah seluruh checklist §3 hijau.
4. ✅ **Commit pertama 22 Agustus** — sesudah submission dibuka, aturan terpenuhi.
   ⛔ **Jangan pernah rewrite history**; riwayat itulah buktinya.

## Cara cek saldo kapan saja

```bash
for A in 0x825003EdbE16AedfC63f99836553a15B1299f35e \
         0x7C1195c7e31ED2Dd4cE207D926d2fA3bA2e15Ff3 \
         0x2d27Da63Bbe23633c82ff553CfF009D974294e08; do
  echo -n "$A  "
  curl -s -X POST https://rpc.cc3-testnet.creditcoin.network \
    -H 'content-type: application/json' -H 'user-agent: Mozilla/5.0' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBalance\",\"params\":[\"$A\",\"latest\"]}"
done
```

Per 9 Agustus 2026: deployer **9.880** · operator **100** · issuer **20** tCTC.

⚠️ **Cek saldo operator saat memeriksa dead-man's switch.** Kalau operator kehabisan gas,
worker berhenti, dashboard membeku, dan juri melihat angka basi (G13).

---

# TIGA AKUN, TIGA PERAN — dikunci 9 Agustus 2026

Sampai 7 Agustus proyek ini hanya punya satu akun. Itu tidak lagi cukup, karena salah
satu keputusan produk (RT12) **menerbitkan sebuah private key ke publik**.

✅ **Ketiganya sudah dibuat 9 Agustus 2026.**

| # | Peran | Alamat | Kunci di mana | Isi | Boleh melakukan apa |
|---|---|---|---|---|---|
| **1** | **Deployer** | `0x825003EdbE16AedfC63f99836553a15B1299f35e` | `.env` + password manager | dari faucet | Deploy kontrak. Tidak pernah dipakai untuk apa pun lagi. |
| **2** | **Operator worker** | `0x7C1195c7e31ED2Dd4cE207D926d2fA3bA2e15Ff3` | `EnvironmentFile` di VPS, permission `600` | **~100 tCTC** | Panggil `ingest()`. Itu saja. |
| **3** | **Issuer demo** | `0x2d27Da63Bbe23633c82ff553CfF009D974294e08` | **DITERBITKAN DI README** | **≤20 tCTC** | Panggil `mint()` — dan **tidak ada yang lain** (RT9) |

⚠️ **Ketiganya benar-benar terpisah — kunci berbeda, bukan turunan satu sama lain.**
Kalau kunci issuer yang diterbitkan ternyata sama dengan deployer, kita menyerahkan
kendali deployment ke internet. Itu bukan risiko teoretis — itu kesalahan copy-paste yang
paling mudah dibuat di seluruh proyek ini. **Cocokkan alamatnya sebelum menerbitkan.**

## §2 — Akun operator worker

- **Sudah dibuat.** Isi ~100 tCTC **dari deployer** (cukup untuk jutaan `ingest`) —
  jangan minta faucet terpisah.
- Kunci lewat systemd `EnvironmentFile` permission `600`. **Jangan** di dalam image
  Docker, repo, atau file yang ter-commit.
- Kalau dia habis, worker berhenti dan dashboard membeku — **cek saldonya saat memeriksa
  dead-man's switch.**

## §3 — Akun issuer demo: kuncinya sengaja dipublikasikan (RT12)

**Ini keputusan produk, bukan kecerobohan.** Alasan lengkap: `07-red-team.md` RT12.

Singkatnya: karena kontrak `immutable` tanpa fungsi admin selain `mint()` (RT9), dan
karena lantai kolateral dicek sebelum otorisasi (A3), **kunci issuer tidak punya
kekuasaan yang berbahaya.** Satu-satunya hal yang bisa dilakukan pemegangnya adalah
mencetak **di dalam** cadangan terbukti — yang memang tidak merugikan siapa pun.

**Checklist sebelum menerbitkan — semua wajib hijau, urutannya jangan dibalik:**

- [x] ✅ Akun ini **baru**, digenerate 9 Agt, nonce 0, tidak pernah dipakai
- [x] ✅ Alamatnya `0x2d27Da63Bbe23633c82ff553CfF009D974294e08` — **bukan** deployer
      `0x825003Ed…`, **bukan** operator `0x7C1195c7…`. Cocokkan lagi sebelum publish.
- [ ] Isi **≤20 tCTC**. Jangan lebih.
- [ ] Test RT9 hijau: nol setter · nol proxy · nol `selfdestruct` · nol `delegatecall`
      ke alamat variabel · nol fungsi admin selain `mint()`. **Grep manual juga.**
- [ ] Test A3 hijau: wallet acak melebihi cadangan → `WouldBreachCollateralFloor`
- [ ] `maxMintPerWindowBps = 500` sudah aktif di kontrak yang di-deploy
- [ ] README memuat **alasannya**, bukan cuma kuncinya
- [ ] **Testnet-only.** Tidak pernah dipakai ulang di Creditcoin mainnet.

⛔ **Kalau salah satu belum hijau, jangan terbitkan.** Kunci publik di atas kontrak yang
masih punya setter bukan demonstrasi — itu kerugian yang menunggu.

---

## Creditcoin mainnet

**Belum ada akun dan belum ada dana di Creditcoin mainnet** (chainId 102030). Belum
diperlukan — produk sudah terbukti mainnet-able (lihat `03-spesifikasi-produk.md` §12),
tapi seluruh pekerjaan hackathon berjalan di testnet sesuai syarat lomba.

Kalau nanti masuk produksi: **buat akun baru**. Jangan pernah memakai ulang burner ini
yang kuncinya sudah lama tersimpan plaintext di disk.
