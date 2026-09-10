import { Plus } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const ITEMS: FaqItem[] = [
  {
    question: 'Apa yang sebenarnya dibuktikan?',
    answer:
      'Attestcoin membuktikan bahwa sebuah transaksi benar-benar termasuk dalam blok Ethereum tertentu. Corolary menambahkan dua pemeriksaan yang tidak dilakukan precompile: status transaksi sumber harus sukses, dan alamat pemancar log harus cocok dengan protokol terdaftar. Tanpa keduanya, transaksi yang revert atau kontrak peniru bisa lolos.',
  },
  {
    question: 'Kenapa Ethereum mainnet, padahal deploy-nya di testnet?',
    answer:
      'Hackathon mewajibkan deploy di testnet, tapi produk ini tidak boleh memakai data karangan. CC3 Testnet bisa membaca Ethereum mainnet asli, jadi kedua syarat terpenuhi sekaligus.',
  },
  {
    question: 'Apakah skornya bisa dipalsukan?',
    answer:
      'Setiap fakta harus melewati verifikasi precompile dan dibayar dengan CTC. Log dari kontrak yang bukan protokol terdaftar ditolak, dan transaksi yang gagal ditolak.',
  },
  {
    question: 'Kenapa kolateralnya tidak nol?',
    answer:
      'Tidak ada identitas dan tidak ada jalur hukum di balik dompet. Reputasi memangkas modal terkunci, ia tidak menghapus risiko gagal bayar.',
  },
  {
    question: 'Berapa lama sampai transaksi baru terlihat?',
    answer:
      'Sekitar 38 blok (kurang lebih 8 menit) sampai jaringan Attestcoin menyepakati blok itu, lalu proof dibangun dan dikirim.',
  },
  {
    question: 'Apakah Corolary bisa menulis ke Ethereum?',
    answer: 'Tidak. Writability belum rilis; alirannya searah.',
  },
];

/**
 * FAQ di atas panel gelap.
 *
 * Memakai <details>/<summary> asli alih-alih state React yang mengetuk-buka
 * div: keduanya sudah bisa dioperasikan lewat keyboard tanpa penanganan
 * tambahan, sudah diumumkan screen reader sebagai "expanded/collapsed" tanpa
 * ARIA manual, dan tetap berfungsi sebelum JavaScript termuat — akordeon
 * bukan interaksi yang butuh state klien untuk bekerja dengan benar.
 */
export function Faq() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-24 md:px-8 md:pb-32">
      <h2 className="font-display text-mkt-h2 text-panel-ink-900">
        Pertanyaan yang pantas ditanyakan
      </h2>

      <div className="mt-10">
        {ITEMS.map((item) => (
          <details key={item.question} className="group border-b border-panel-border">
            <summary
              className="flex list-none cursor-pointer items-center justify-between gap-6 py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"
            >
              <span className="text-body font-display text-panel-ink-900 md:text-mkt-statement">
                {item.question}
              </span>
              <Plus
                className="h-5 w-5 shrink-0 text-panel-ink-500 transition-transform group-open:rotate-45"
                aria-hidden="true"
              />
            </summary>
            <p className="max-w-3xl pb-6 text-body text-panel-ink-700">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
