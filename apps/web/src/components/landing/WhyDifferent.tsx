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
    body: 'The market runs on Creditcoin testnet, but the credit history behind it is read from Ethereum mainnet. The tokens are stand-ins; the record is not.',
  },
];

const HEADING = 'Why this is different';

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
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.set(root.querySelectorAll('.why-word-inner'), { yPercent: 120 });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const inners = root.querySelectorAll<HTMLElement>('.why-word-inner');
    const heading = root.querySelector<HTMLElement>('.why-heading');
    if (!heading || inners.length === 0) return;

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
          // Sekali jalan, bukan scrub. Section akordeon di atas memang
          // di-scrub, tapi menyamakan keduanya justru salah: scrub berarti
          // judulnya turun lagi begitu pembaca menggulir balik, dan judul yang
          // ikut mundur terbaca seperti halaman yang belum selesai memuat.
          once: true,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        gsap.set(inners, { clearProps: 'transform' });
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
