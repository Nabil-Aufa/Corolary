import { Skeleton } from '@/components/ui/skeleton';

/**
 * Ditampilkan selagi segmen route ini dimuat — sebelum komponen halamannya
 * sendiri sempat berjalan.
 *
 * Ini BUKAN pengganti skeleton di dalam tiap halaman. Keduanya menutup jendela
 * yang berbeda: yang di sini menutup waktu memuat bundel JS route-nya, yang di
 * halaman menutup waktu menunggu API. Pada navigasi pertama ke sebuah route,
 * hanya yang di sini yang ada.
 *
 * Satu berkas untuk seluruh `(app)`, bukan satu per halaman. Skeleton yang
 * meniru tata letak tiap halaman akan menyimpang diam-diam begitu halamannya
 * berubah — dan skeleton yang berbohong soal bentuk halaman lebih buruk
 * daripada skeleton yang jujur soal ketidaktahuannya. Yang ditiru di sini hanya
 * geometri yang dipakai keempat halaman: judul, baris statistik, lalu kartu.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-12 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-8">
        {/* `min-w-0` pada item flex, dan lebar subjudulnya `w-full` dengan
            `max-w`, bukan `w-[28rem]` dengan `max-w-full`. Yang kedua tidak
            pernah menyusut: `max-w-full` berarti 100% dari div ini, dan div ini
            ikut melebar mengikuti anaknya yang 448px. Terukur di 390px —
            halaman menggulir 97px ke samping sebelum satu baris data pun
            dimuat. */}
        <div className="min-w-0">
          <Skeleton className="h-9 w-48 max-w-full" />
          <Skeleton className="mt-3 h-4 w-full max-w-[28rem]" />
        </div>
        <Skeleton className="h-14 w-56 max-w-full shrink-0" />
      </div>

      <Skeleton className="h-[320px]" />
    </div>
  );
}
