# Corolary

> *Solvency isn't claimed. It follows.*

> Token yang **tidak bisa dicetak melebihi cadangan yang terbukti** — bahkan oleh
> pemegang kunci admin yang sudah dibajak sepenuhnya.

> **Pintu keluarnya tidak punya kunci.**

Entri **BUIDL CTC 2026 Fall** (Creditcoin & Credit Labs), track **RWA**.
Deadline submission: **6 September 2026**.

Status per **9 Agustus 2026**: **dokumentasi FINAL, kode nol, 0 blocker.**
Semua parameter `immutable` sudah punya angka terukur; semua prasyarat Fase 1 terpenuhi.
Repo sengaja direset ke nol pada 2 Agustus 2026 untuk dibangun ulang di atas arsitektur
yang lebih baik.

⚠️ **File ini masih bahasa Indonesia — dan itu disengaja untuk sekarang.**
README diterjemahkan ke Inggris **di Fase 8**, saat proyeknya sudah selesai.

Sampai saat itu dia tetap dipakai sebagai dokumen kerja — **tapi jangan ditulis ulang
dari nol nanti.** README menumpuk isinya sepanjang fase (kunci issuer masuk di Fase 3,
perintah `docker run` di Fase 4, URL dashboard di Fase 6c). Daftar lengkap apa yang harus
ada beserta fase asalnya: `docs/05-rencana-build.md` Fase 8.

---

## Masalahnya

Dua stablecoin runtuh tahun ini karena hal yang sama: satu kunci dibajak, token dicetak
tanpa cadangan.

- **Resolv (USR)** — 22 Maret 2026
- **StablR (USDR/EURR)** — 24 Mei 2026. Berlisensi Malta, patuh MiCA, didukung Tether.
  $13,5 juta dicetak tanpa backing. EURR jatuh ke **$0,548**.

Standar kepatuhan terbaik hari ini (GENIUS Act) mewajibkan pengungkapan cadangan
**bulanan**. Keduanya runtuh **dalam hitungan jam**. Laporan bulanan adalah foto;
yang dibutuhkan adalah kunci pada pintunya.

## Solusinya

Kontrak di Creditcoin memelihara saldo cadangan sebuah treasury di Ethereum. Saldo itu
**hanya** bergerak lewat event `Transfer` ERC-20 nyata yang dibuktikan secara
kriptografis ter-include di blok Ethereum final, lewat **Attestcoin Protocol**.

- `mint()` **revert** kalau melanggar lantai kolateral — bukan warning, **revert**.
- `redeem()` **selalu** terbuka, dan kontraknya **tidak bisa di-upgrade** — jadi tidak
  ada seorang pun yang bisa mengunci pintu keluarnya. Termasuk kami.
- Pembekuan terjadi **sendiri** saat penarikan terbukti mendarat.
- **Kunci issuer-nya kami terbitkan di README ini.** Silakan ambil — kamu tidak akan bisa
  mencetak satu token pun tanpa cadangan, karena kunci itu memang tidak punya kekuasaan
  itu. *(Terbit di Fase 3, setelah test immutability hijau.)*

Dan karena kita membaca rantai itu sendiri — bukan bertanya kepada issuer — **siapa pun
bisa mengarahkannya ke treasury issuer mana pun di Ethereum mainnet, tanpa izin mereka.**

## Kenapa mustahil tanpa Attestcoin

Kita membaca event dari kontrak ERC-20 **yang bukan milik kita** — misalnya USDC milik
Circle — di **Ethereum mainnet**, dari kontrak di **Creditcoin**. Tidak ada oracle
terpusat yang memberikan ini secara trustless, dan tidak ada bridge yang relevan.

Yang dibuktikan: **treasury issuer X memegang N USDC.** Bukan: "backing USDC itu sendiri"
— cadangan Circle ada di bank, dan tidak ada siapa pun on-chain yang bisa membuktikannya.

Sudah dibuktikan end-to-end (2 Agustus 2026): `verifySingle` atas transaksi USDC
Ethereum mainnet sungguhan → `true` dalam 1.357 ms.

---

## Dokumentasi

**Mulai dari [`PROGRESS.md`](PROGRESS.md)**, lalu:

| Dokumen | Isi |
|---|---|
| [`docs/00-hackathon.md`](docs/00-hackathon.md) | Aturan lomba, timeline, checklist submission |
| [`docs/01-riset-mendalam.md`](docs/01-riset-mendalam.md) | Riset teknis + pasar + kompetitif. Semua angka terukur sendiri. |
| [`docs/02-keputusan-ide.md`](docs/02-keputusan-ide.md) | Ranking 7 ide + alasan pemilihan |
| [`docs/03-spesifikasi-produk.md`](docs/03-spesifikasi-produk.md) | **PRD + arsitektur + desain kontrak.** Rujukan utama saat ngoding. |
| [`docs/04-gap-dan-blocker.md`](docs/04-gap-dan-blocker.md) | Gap terbuka + cara memverifikasinya |
| [`docs/05-rencana-build.md`](docs/05-rencana-build.md) | Build order berurutan + definition-of-done |
| [`docs/06-akun-dan-dana.md`](docs/06-akun-dan-dana.md) | **Akun deployer berdana. Jangan sampai hilang.** |
| [`docs/07-red-team.md`](docs/07-red-team.md) | **13 cara ide ini bisa kalah** + perbaikannya |
| [`docs/08-kerja-paralel.md`](docs/08-kerja-paralel.md) | **Tim 2 orang** — kepemilikan file, serah-terima, aturan |
| [`docs/09-narasi-dan-deck.md`](docs/09-narasi-dan-deck.md) | **Narasi, argumen pasar, urutan demo, jawaban hafalan.** Baca sebelum menulis copy apa pun. |

## Mulai membangun

Dikerjakan **2 orang** — kepemilikan file dipisah tegas, keduanya bisa mulai hari pertama.

1. **Baca [`CLAUDE.md`](CLAUDE.md) §0** — tentukan kamu pegang frontend atau backend
2. **Baca [`docs/08-kerja-paralel.md`](docs/08-kerja-paralel.md)** — kepemilikan file,
   artefak serah-terima, mock data, aturan yang tidak boleh dilanggar sepihak
3. Frontend mulai dari **Fase 6a**, backend dari **Fase 0**
   di [`docs/05-rencana-build.md`](docs/05-rencana-build.md)
4. **Jangan generate wallet baru** — pakai yang sudah berdana,
   lihat [`docs/06-akun-dan-dana.md`](docs/06-akun-dan-dana.md)

## Aturan yang tidak bisa ditawar

Satu klaim palsu membunuh seluruh submission. Sebelum menulis apa pun yang dilihat juri,
saring lewat daftar klaim terlarang di [`docs/01-riset-mendalam.md`](docs/01-riset-mendalam.md) §7.

Ringkasnya: **jangan** bilang "omnichain", "15 detik", "fully decentralized",
"proof of reserves lengkap", atau "real-time".

Ditambahkan 9 Agustus — **jangan** bilang:
- **"lag 44 blok"** → lag itu **pita**: 32–42 blok (testnet), 65–73 (CC mainnet)
- **"kami membuktikan saldo treasury"** → attestation tidak menyentuh `stateRoot`
  Ethereum. Kami membuktikan **setiap pergerakan**, bukan saldo (`01` §1.7)
- **"kami mengaudit Ethena"** → dicabut dari daftar target sah
- **"Attestcoin bisa menulis balik ke Ethereum"** → writability masih audit, belum rilis
