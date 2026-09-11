'use client';

import { BrandMark } from '@/components/shared/BrandMark';
import { useIndexerStatus } from '@/hooks/useApi';

function SkeletonGrid() {
  return (
    <ul className="mt-[clamp(40px,6vw,80px)] grid grid-cols-1 gap-x-8 gap-y-[clamp(40px,5vw,72px)] sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex justify-center">
          <div className="h-11 w-44 animate-pulse rounded-card bg-border" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Protokol yang benar-benar diindeks, satu kisi.
 *
 * Dulu ini pita berjalan. Bentuk kisi lebih baik untuk isi sebanyak ini:
 * empat protokol tidak pernah cukup banyak untuk perlu bergerak, dan pita yang
 * berputar terus membuat pembaca menunggu giliran hanya untuk memastikan tidak
 * ada yang terlewat.
 *
 * ── Daftarnya tetap datang dari indexer ──
 * Nomor blok per protokol sudah tidak ditampilkan, tapi protokol MANA yang
 * muncul tetap dibaca dari `/v1/indexer/status`, bukan ditulis sebagai daftar
 * di berkas ini. Bedanya penting: dinding logo yang ditulis tangan akan tetap
 * memajang sebuah protokol setelah indexernya berhenti membacanya, dan tidak
 * ada yang akan menyadarinya.
 *
 * Karena angka bloknya hilang, judulnya tidak lagi boleh mengklaim "block by
 * block": tidak ada apa pun di layar ini yang membuktikannya lagi. Judulnya
 * juga sengaja TIDAK berbentuk "dipercaya oleh". Keempat protokol ini tidak
 * bermitra dengan kita dan tidak pernah menyetujui apa pun; kita hanya membaca
 * event publik mereka, dan menyusunnya seperti dinding logo pelanggan akan
 * mengklaim dukungan yang tidak ada.
 *
 * Logo diambil lewat `BrandMark`, bukan dipetakan ulang di sini. Pemetaan nama
 * ke berkas yang hidup di dua tempat akan menyimpang, dan gejalanya logo yang
 * salah di satu halaman saja.
 */
export function ProtocolGrid() {
  const { data, isPending, isError } = useIndexerStatus();

  // Kisi kosong lebih buruk daripada tidak ada kisi, jadi section-nya tidak
  // dirender sama sekali kalau tidak ada yang bisa ditunjukkan.
  if (!isPending && (isError || data === undefined || data.cursors.length === 0)) {
    return null;
  }

  return (
    // Jeda bawah lebih lebar daripada jeda atas, dan itu disengaja. Bagian
    // berikutnya adalah panel gelap bersudut yang meluncur MENUTUPI bagian ini;
    // ia butuh ruang ancang ancang supaya terbaca sebagai sesuatu yang datang
    // menutup, bukan sebagai bagian yang kebetulan menempel di bawah kisi.
    <section className="pb-[clamp(96px,12vw,184px)] pt-[clamp(48px,6vw,96px)]">
      <div className="mkt-container">
        {/* `text-mkt-h2`, sama seperti judul section lain di landing ini.
            Sebelumnya `text-mkt-h3`, yang di halaman ini adalah ukuran
            SUB-judul (judul pilar, pertanyaan FAQ, judul kartu) — jadi satu
            satunya judul section yang berpakaian sub-judul, dan itu yang
            membuat logo di bawahnya tampak lebih besar daripada judulnya. */}
        <h2 className="text-center font-display text-mkt-h2 text-ink-900">
          Every fact starts on Ethereum mainnet
        </h2>

        {isPending || data === undefined ? (
          <SkeletonGrid />
        ) : (
          <ul className="mt-[clamp(40px,6vw,80px)] grid grid-cols-1 gap-x-8 gap-y-[clamp(40px,5vw,72px)] sm:grid-cols-2">
            {data.cursors.map((c) => (
              <li key={c.protocol} className="flex items-center justify-center gap-3">
                <BrandMark name={c.protocolName} size={40} className="logo-bw protocol-mark" />
                <span className="text-mkt-h3 text-ink-900">{c.protocolName}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
