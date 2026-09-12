'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { connectLenisToScrollTrigger } from '@/lib/lenis-gsap';

interface Reason {
  label: string;
  body: string;
}

/**
 * Lima alasan, dan semuanya klaim TENTANG produk ini, bukan kutipan.
 *
 * Tata letaknya meniru dinding testimonial, tapi isinya tidak boleh ikut:
 * menempelkan tanda kutip dan wordmark Aave atau Morpho di sekeliling kalimat
 * yang kita tulis sendiri akan membaca sebagai dukungan dari mereka, dan tidak
 * satu pun dari keempat protokol itu pernah menyatakan apa pun tentang kita.
 * Karena itu ikon kutip diganti nomor urut dan wordmark diganti label
 * kategori — ritme visualnya sama, klaimnya tidak dikarang.
 *
 * Tiga alasan pertama dipindahkan dari section lama yang judulnya sudah "Why
 * this is different" dan kini dihapus karena akan jadi judul kembar; dua
 * sisanya fakta yang sudah dipakai di tempat lain di repo ini (biaya proof
 * sepuluh kali lipat, dan pemisahan mainnet/testnet).
 */
const REASONS: Reason[] = [
  {
    label: 'Verification',
    body: 'These numbers do not come from our own database. Every fact is verified on-chain through the Attestcoin Block Prover precompile against an Ethereum mainnet transaction that actually settled.',
  },
  {
    label: 'Coverage',
    body: 'History is read from Aave V3, Morpho Blue, Compound and SparkLend. A record that has to hold across four protocols is far more expensive to fake.',
  },
  {
    label: 'Risk',
    body: 'This is not unsecured lending. Every loan stays over-collateralized, and a proven borrower simply locks up meaningfully less capital, from 150% down to 110%. That is how the protocol stays solvent.',
  },
  {
    label: 'Cost',
    body: 'A proof costs ten times less inside the first 24 hours, so events are proven while fresh and then stored permanently.',
  },
  {
    label: 'Sourcing',
    body: 'The market runs on Creditcoin testnet, but the credit history behind it is read from Ethereum mainnet. The tokens are stand-ins. The record is not.',
  },
];

const HEADING = 'Why this is different';

/**
 * Geseran tumpukan, dalam satuan vw, DI ATAS posisi kisi tiap kartu.
 *
 * Angkanya sengaja tidak simetris: tumpukan yang jarak gesernya rapi terbaca
 * sebagai kisi yang salah pasang, bukan sebagai setumpuk kartu. Yang menyatukan
 * mereka bukan angka angka ini melainkan penarikan ke titik tengah yang
 * dihitung di bawah — ini cuma yang membuat tumpukannya tidak rata.
 */
const SCATTER: { x: number; y: number; r: number }[] = [
  { x: -7.0, y: 1.6, r: -9 },
  { x: 0, y: -4.2, r: 0 },
  { x: 7.2, y: 2.0, r: 9 },
  // Kartu 4 dan 5 satu satunya pasangan SEWARNA yang bertindihan, dan sejak
  // bordernya dibuang tidak ada lagi yang memisahkan mereka. Jaraknya karena
  // itu dilebarkan dan arah miringnya dibalik: yang memberi mereka tepi
  // sekarang cuma sudut, bukan garis.
  { x: -6.2, y: 6.0, r: -15 },
  { x: 6.8, y: 6.6, r: 15 },
];

/** `useLayoutEffect` menyala sebelum browser melukis, `useEffect` sesudahnya.
 *  Bedanya menentukan di sini, tapi `useLayoutEffect` memperingatkan saat
 *  dirender di server, jadi dipilih per lingkungan. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function WhyDifferent() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Keadaan awal kata ditulis di sini, BUKAN di CSS.
  //
  // CSS akan lebih sederhana, tapi ia menyembunyikan judulnya sebelum tahu
  // apakah JavaScript akan datang. Kalau bundelnya gagal dimuat, yang tersisa
  // adalah section tanpa judul sama sekali, dan tidak ada yang error.
  // `useLayoutEffect` menulis keadaan awal sebelum frame pertama dilukis, jadi
  // tidak ada kedipan, dan tanpa JavaScript judulnya cuma tampil apa adanya.
  //
  // Alasan yang sama berlaku untuk tumpukan kartunya: bentuk tumpukan ditulis
  // GSAP, dan tanpa GSAP yang tersisa adalah kisi rapi yang terbaca normal.
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.set(root.querySelectorAll('.why-word-inner'), { yPercent: 120 });
  }, []);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const inners = root.querySelectorAll<HTMLElement>('.why-word-inner');
    const heading = root.querySelector<HTMLElement>('.why-heading');
    const wrap = root.querySelector<HTMLElement>('.why-cards');
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.why-card'));
    if (!heading || !wrap || inners.length === 0 || cards.length === 0) return;

    gsap.registerPlugin(ScrollTrigger);
    const disconnect = connectLenisToScrollTrigger();

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tween = gsap.to(inners, {
        yPercent: 0,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: {
          trigger: heading,
          start: 'top 85%',
          // Sekali jalan, bukan scrub. Kartunya memang di-scrub, tapi
          // menyamakan keduanya justru salah: scrub berarti judulnya turun
          // lagi begitu pembaca menggulir balik, dan judul yang ikut mundur
          // terbaca seperti halaman yang belum selesai memuat.
          once: true,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        gsap.set(inners, { clearProps: 'transform' });
      };
    });

    // Tumpukan hanya di desktop. Di bawah 768px kisinya satu kolom, dan
    // menarik lima kartu setinggi layar ke satu titik tengah berarti tumpukan
    // yang tingginya berkali lipat viewport — tidak ada yang bisa dibaca dari
    // keadaan itu.
    mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
      // Diukur, bukan ditebak: geseran yang membuat kartu menumpuk adalah
      // jarak tiap kartu ke titik tengah kisi, dan itu hanya diketahui setelah
      // kisinya benar benar dilayout. Menuliskannya sebagai nilai vw tetap
      // akan pas di satu lebar layar saja.
      let offsets = cards.map(() => ({ x: 0, y: 0, r: 0 }));

      const measure = () => {
        // Diukur pada posisi kisi yang sebenarnya, jadi transform apa pun yang
        // sedang terpasang harus dilepas dulu. Tanpa ini, pengukuran ulang
        // saat refresh akan menumpuk geseran di atas geseran.
        gsap.set(cards, { clearProps: 'transform' });
        const box = wrap.getBoundingClientRect();
        const unit = window.innerWidth / 100;
        offsets = cards.map((card, i) => {
          const r = card.getBoundingClientRect();
          const s = SCATTER[i % SCATTER.length] ?? { x: 0, y: 0, r: 0 };
          return {
            x: box.left + box.width / 2 - (r.left + r.width / 2) + s.x * unit,
            y: box.top + box.height / 2 - (r.top + r.height / 2) + s.y * unit,
            r: s.r,
          };
        });
      };

      const pileValues = {
        x: (i: number) => offsets[i]?.x ?? 0,
        y: (i: number) => offsets[i]?.y ?? 0,
        rotation: (i: number) => offsets[i]?.r ?? 0,
      };
      const gridValues = { x: 0, y: 0, rotation: 0 };

      // Timeline BERHENTI, bukan di-scrub.
      //
      // Bedanya bukan cuma rasa: dengan scrub, bentuk kartu adalah fungsi dari
      // posisi scroll, jadi pembaca yang berhenti di tengah jalur akan melihat
      // tumpukan setengah terurai selamanya, dan kecepatan membukanya
      // ditentukan oleh seberapa cepat dia menggulir. Di sini scroll cuma
      // memutuskan KAPAN animasinya mulai; sisanya animasi biasa yang selalu
      // selesai dengan durasi dan ease yang sama.
      //
      // Kelima kartu berangkat BERSAMAAN, tanpa `stagger`. Dengan stagger,
      // yang terbaca bukan satu tumpukan yang membuka melainkan lima kartu
      // yang dibereskan satu per satu, dan kartu terakhir baru sampai jauh
      // setelah yang pertama berhenti.
      const tl = gsap.timeline({ paused: true }).to(cards, {
        ...gridValues,
        duration: 1.2,
        // `power2.inOut`, bukan `expo.out`.
        //
        // Yang membuat `expo.out` terasa menyentak bukan durasinya melainkan
        // kecepatan awalnya: ia berangkat pada kecepatan tertinggi lalu
        // berekor panjang, jadi sebagian besar jarak sudah ditempuh sebelum
        // mata sempat mengikuti. Kartu di sini bergeser ratusan piksel
        // SEKALIGUS berputar sampai 15 derajat, dan pada perpindahan sebesar
        // itu kecepatan awal yang tinggi terbaca sebagai lompatan, bukan
        // sebagai gerak. `inOut` berangkat dan berhenti dari diam di kedua
        // ujung — dan karena tween yang sama dibalik untuk menumpuk kembali,
        // kedua arah mewarisi kehalusan itu sekaligus.
        ease: 'power2.inOut',
      });

      // Kondisi yang SAMA PERSIS dengan `start`/`end` di bawah, dihitung
      // sendiri dari geometri alih alih dibaca dari `st.isActive`.
      //
      // Bendera itu tidak bisa dipercaya di dalam penangan `refresh`: kalau
      // refresh datang tepat saat animasinya baru mulai, nilainya masih yang
      // lama, dan `reset` lalu menjeda timeline di ujung yang salah. Karena
      // ScrollTrigger menganggap pemicunya sudah aktif, `onToggle` tidak akan
      // pernah menyala lagi dan kartunya terkunci menumpuk selamanya —
      // terukur: satu kali muat ulang, persilangan pertama gagal membuka,
      // sementara keluar-masuk berikutnya normal. Tidak ada error apa pun.
      const shouldBeOpen = () => {
        const r = wrap.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        return mid >= 0 && mid <= window.innerHeight;
      };

      // Keadaan tumpukan ditulis lewat `gsap.set` DI LUAR timeline, bukan
      // sebagai `fromTo`, supaya ia terpasang begitu diukur dan tidak
      // bergantung pada kapan tween pertama kali dirender.
      const reset = () => {
        const open = shouldBeOpen();
        measure();
        // Tumpukan dipasang lebih dulu SEKALIPUN tujuannya keadaan terbuka.
        // Tween mencatat nilai awalnya dari keadaan elemen saat pertama kali
        // dirender sesudah `invalidate`; kalau yang terpasang sudah kisi rapi,
        // yang tercatat sebagai awal adalah kisi itu juga — dan tumpukannya
        // hilang tanpa jejak: `reverse()` berjalan normal tapi tidak
        // memindahkan apa pun.
        gsap.set(cards, pileValues);
        tl.invalidate();
        tl.progress(open ? 1 : 0).pause();
      };

      const st = ScrollTrigger.create({
        trigger: wrap,
        // Tepat "setengah kelihatan", dari kedua arah: `center bottom` adalah
        // saat titik tengah kisi menyentuh dasar layar, jadi separuh atasnya
        // sudah terlihat; `center top` saat titik tengahnya lewat ke atas
        // layar, menyisakan separuh bawahnya. Di antara keduanya, minimal
        // setengah bagian ini ada di layar.
        start: 'center bottom',
        end: 'center top',
        onToggle: (self) => {
          if (self.isActive) tl.play();
          else tl.reverse();
        },
      });

      // `onToggle` tidak dipanggil untuk keadaan AWAL, jadi halaman yang
      // dimuat dengan bagian ini sudah di layar akan membeku dalam tumpukan.
      reset();

      // Diukur ulang saat layout berubah, dan arahnya ikut keadaan yang
      // seharusnya berlaku: memaksa tumpukan pada bagian yang sedang terbuka
      // akan membuatnya runtuh di tengah pembacaan.
      ScrollTrigger.addEventListener('refresh', reset);

      return () => {
        ScrollTrigger.removeEventListener('refresh', reset);
        st.kill();
        tl.kill();
        gsap.set(cards, { clearProps: 'transform' });
      };
    });

    return () => {
      mm.revert();
      disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className="mkt-container py-[clamp(80px,10vw,160px)]">
      <h2
        className="why-heading text-center font-display font-medium text-panel-ink-900"
        style={{ fontSize: '5.625vw', lineHeight: 1 }}
      >
        {/* Dipecah per KATA, bukan per huruf: memecah per huruf memaksa pembaca
            layar mengeja judulnya satu per satu. `aria-label` menjaga judulnya
            tetap dibacakan sebagai satu kalimat utuh apa pun yang terjadi. */}
        <span aria-label={HEADING}>
          {HEADING.split(' ').map((word, i) => (
            <span key={`${word}-${i}`} aria-hidden="true">
              <span className="why-word">
                <span className="why-word-inner">{word}</span>
              </span>
              {i < HEADING.split(' ').length - 1 ? ' ' : null}
            </span>
          ))}
        </span>
      </h2>

      <div className="why-cards mt-[6vw]">
        {REASONS.map((reason, i) => (
          <div key={reason.label} className="why-card">
            <span className="why-card-index num">{String(i + 1).padStart(2, '0')}</span>
            <p className="why-card-text">{reason.body}</p>
            <div className="why-card-divider" />
            <span className="why-card-label">{reason.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
