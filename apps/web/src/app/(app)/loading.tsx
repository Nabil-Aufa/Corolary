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
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-3 h-4 w-[28rem] max-w-full" />
        </div>
        <Skeleton className="h-14 w-56" />
      </div>

      <Skeleton className="h-[320px]" />
    </div>
  );
}
