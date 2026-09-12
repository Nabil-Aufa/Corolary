'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Route } from 'next';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';

import { FeatureArt, type FeatureArtVariant } from '@/components/landing/FeatureArt';
import { connectLenisToScrollTrigger } from '@/lib/lenis-gsap';

interface Feature {
  title: string;
  body: string;
  /** Bentuknya mengikuti isi kartu, jadi ia tidak bisa ditukar tukar antar
   *  kartu tanpa jadi salah. Kelimanya berbeda. */
  art: FeatureArtVariant;
  href: Route;
  linkLabel: string;
}

/**
 * Lima tahap pipeline, satu baris akordeon masing-masing.
 *
 * Urutannya sebab-akibat, bukan daftar fitur — dan itu yang membuat bentuk
 * akordeon yang dibuka oleh scroll terasa tepat: membaca ke bawah sama dengan
 * mengikuti satu transaksi dari mainnet sampai ke rasio kolateralnya.
 */
const FEATURES: Feature[] = [
  {
    title: 'Real mainnet activity',
    body: 'A watcher follows Aave V3, Morpho Blue, Compound and SparkLend on Ethereum mainnet. Nothing is simulated and nothing is seeded. The only input is a transaction that actually settled.',
    art: 'activity',
    href: '/proofs',
    linkLabel: 'See the source events',
  },
  {
    title: 'Attestation',
    body: 'Attestcoin attestors reach consensus on the block that contains the transaction. That takes roughly eight minutes, and until it lands there is nothing to prove.',
    art: 'consensus',
    href: '/proofs',
    linkLabel: 'Follow a proof',
  },
  {
    title: 'Eager proving',
    body: 'A proof costs ten times less inside the first 24 hours, so events are proven while they are fresh and batched up to ten at a time. Nothing is ever proven on demand.',
    art: 'batch',
    href: '/proofs',
    linkLabel: 'Inspect a batch',
  },
  {
    title: 'Permanent facts',
    body: 'FactRegistry verifies the proof against the Block Prover precompile, checks the source transaction actually succeeded, confirms the emitting contract, and stores the fact forever.',
    art: 'layers',
    href: '/score',
    linkLabel: 'Read a wallet’s facts',
  },
  {
    title: 'Collateral efficiency',
    body: 'CreditGraph turns those facts into a score from 0 to 1000, and the market prices required collateral against it: 150% for an unproven wallet, 110% at the top tier.',
    art: 'ratio',
    href: '/market',
    linkLabel: 'Open the market',
  },
];

/** Kueri desktop. Ditulis sekali karena dipakai oleh GSAP maupun oleh
 *  penentu bentuk `<head>` di bawah, dan dua salinan yang bisa menyimpang
 *  berarti markup interaktif yang tidak pernah bisa diklik. */
const DESKTOP = '(min-width: 768px)';

/**
 * Akordeon yang dibuka oleh posisi scroll.
 *
 * ── Kenapa "fakes + items", bukan `pin` ──
 * Cara biasa menahan sesuatu selama beberapa layar adalah `ScrollTrigger.pin`,
 * dan cara itu bekerja dengan menyuntik elemen pengganti serta mengubah posisi
 * elemen aslinya jadi `fixed`. Di halaman yang sudah punya panel bersudut dan
 * header sticky, itu berarti tata letak yang tiba-tiba diambil alih.
 *
 * Pola di sini tidak menahan apa pun. `.feature-fakes` adalah lima div KOSONG
 * di aliran normal yang seluruh tugasnya adalah memberi tinggi pada section;
 * merekalah yang jadi trigger. Barisnya sendiri, `.feature-items`, diletakkan
 * `absolute` menimpa deretan itu.
 *
 * Yang membuatnya menyatu adalah satu invarian: **tinggi tiap fake = tinggi
 * item itu saat terbuka penuh.** Akibatnya, saat pembaca sampai di fake ke-i,
 * item 0..i-1 sudah terbuka semua, jadi tepi atas item ke-i mendarat persis di
 * tepi atas fake ke-i — trigger dan yang dipicu berada di tempat yang sama
 * tanpa satu pun perhitungan offset. Item di bawahnya, yang belum terbuka,
 * tertarik ke atas dan terbaca sebagai daftar ringkas yang menunggu giliran.
 *
 * Karena itu tingginya WAJIB diukur, bukan ditetapkan: satu `height` yang
 * ditebak membuat invariannya meleset sedikit demi sedikit, dan pada item
 * kelima selisihnya sudah cukup besar untuk terbaca sebagai "animasinya
 * menyala di waktu yang salah".
 */
export function FeatureAccordion() {
  const rootRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<number | null>(0);
  const [interactive, setInteractive] = useState(false);
  const { resolvedTheme } = useTheme();

  // Di bawah 768px tidak ada scrub sama sekali, jadi kepalanya harus benar-benar
  // bisa diklik — dan hanya di sana. Membuatnya selalu `<button>` akan
  // mengumumkan `aria-expanded` yang bohong di desktop, tempat mengkliknya tidak
  // melakukan apa pun.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setInteractive(!mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    gsap.registerPlugin(ScrollTrigger);
    const disconnect = connectLenisToScrollTrigger();

    const fakes = Array.from(root.querySelectorAll<HTMLElement>('.feature-fake'));
    const items = Array.from(root.querySelectorAll<HTMLElement>('.feature-item'));

    // Warna diambil dari custom property, bukan dituliskan sebagai hex di sini.
    // GSAP butuh nilai konkret — ia tidak bisa men-tween `var(...)` — tapi
    // menyalin hex ke JavaScript berarti tema gelap menganimasikan ke warna
    // tema terang dan tidak ada yang akan menandainya. Efek ini bergantung pada
    // `resolvedTheme`, jadi mengganti tema membangun ulang timeline-nya.
    const css = getComputedStyle(root);
    const token = (name: string) => css.getPropertyValue(name).trim();

    const fillFrom = token('--fa-fill-from');
    const fillTo = token('--fa-fill-to');
    const inkTo = token('--fa-ink-to');

    /**
     * Menyalin tinggi-terbuka tiap item ke fake-nya.
     *
     * Kelas `-measuring` memaksa SEMUA akordeon ke `1fr` dengan `!important`;
     * tanpa `!important` ia kalah dari nilai inline yang sedang ditulis GSAP,
     * dan yang terukur adalah tinggi setengah terbuka — berbeda tiap kali
     * diukur, yang jauh lebih membingungkan daripada salah yang konsisten.
     */
    const measure = () => {
      root.classList.add('-measuring');
      // Jarak antar kartu ikut dihitung. Kalau hanya `offsetHeight` yang
      // dipakai, deretan fake jadi lebih pendek daripada deretan kartu sebanyak
      // satu jarak per kartu, dan invarian "kartu ke-i mendarat di fake ke-i"
      // meleset makin jauh tiap turun satu baris — pada kartu kelima sudah
      // sebesar empat jarak, cukup untuk terbaca sebagai animasi yang menyala
      // di waktu yang salah.
      const measured = items.map((item) => ({
        open: item.offsetHeight,
        withGap: item.offsetHeight + parseFloat(getComputedStyle(item).marginBottom || '0'),
      }));
      root.classList.remove('-measuring');
      measured.forEach((m, i) => {
        const fake = fakes[i];
        if (fake) fake.style.height = `${m.withGap}px`;
      });

      // Tinggi art dipatok ke tinggi kartu TERBUKA, bukan dibiarkan `100%`.
      // Kalau ia mengikuti kartu, kotaknya berubah ukuran tiap frame selama
      // scrub, dan SVG menghitung ulang skalanya tiap kali itu terjadi: art
      // tampak merayap dan menyusut sendiri padahal tidak ada yang
      // menganimasikannya. Dipatok sekali, ia diam, dan kartu yang membesar
      // berperan sebagai jendela yang menyingkapnya.
      measured.forEach((m, i) => {
        const art = items[i]?.querySelector<HTMLElement>('.feature-item-bg');
        if (art) art.style.height = `${m.open}px`;
      });
    };

    const mm = gsap.matchMedia();

    // `prefers-reduced-motion` ikut di dalam kueri, bukan diperiksa lebih dulu
    // lalu di-`return`: dengan begini, seseorang yang mengubah preferensinya
    // saat halaman terbuka akan mendapat versi statis tanpa perlu me-reload.
    mm.add(`${DESKTOP} and (prefers-reduced-motion: no-preference)`, () => {
      measure();

      // `refreshInit` menyala sebelum ScrollTrigger menghitung ulang posisi —
      // saat resize, saat font mendarat, saat `refresh()` dipanggil tangan.
      // Mengukur di sini berarti tinggi fake selalu dihitung ulang TEPAT
      // sebelum start/end dibaca dari layout, bukan sesudahnya.
      ScrollTrigger.addEventListener('refreshInit', measure);

      const timelines = items.map((item, i) => {
        const fake = fakes[i];
        const accordion = item.querySelector<HTMLElement>('.feature-item-accordion');
        const fill = item.querySelector<HTMLElement>('.feature-item-fill');
        const bg = item.querySelector<HTMLElement>('.feature-item-bg');
        if (!fake || !accordion || !fill || !bg) return null;

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: fake,
            start: 'top center+=20%',
            end: 'bottom center+=30%',
            // Angka, bukan `true`. `scrub: true` menempel persis di posisi
            // scroll dan mewarisi setiap getaran roda mouse; `1` memberi
            // pengejaran ~1 detik, dan pengejaran itulah yang terbaca sebagai
            // bobot. Ia juga satu-satunya sumber easing di sini.
            scrub: 1,
          },
        });

        // Semua di posisi 0: satu gerakan yang punya empat rupa, bukan empat
        // gerakan berurutan. `ease: 'none'` karena easing sudah datang dari
        // scrub — menumpuknya lagi membuat ujungnya terasa molor.
        tl.fromTo(
          accordion,
          { gridTemplateRows: '0fr' },
          { gridTemplateRows: '1fr', duration: 1, ease: 'none' },
          0,
        )
          .fromTo(
            fill,
            { backgroundColor: fillFrom },
            { backgroundColor: fillTo, duration: 1, ease: 'none' },
            0,
          )
          // Nomor urut tidak ikut disebut: ia mewarisi `color` dari item ini,
          // jadi ia sudah berada di tween yang sama persis.
          .to(item, { color: inkTo, duration: 1, ease: 'none' }, 0)
          .fromTo(bg, { opacity: 0 }, { opacity: 1, duration: 1, ease: 'none' }, 0);

        return tl;
      });

      return () => {
        ScrollTrigger.removeEventListener('refreshInit', measure);
        for (const tl of timelines) {
          tl?.scrollTrigger?.kill();
          tl?.kill();
        }
        // Tinggi fake dan gaya inline dari GSAP dilepas bersama-sama. Yang
        // tertinggal akan tampak seperti item yang setengah terbuka permanen
        // setelah resize ke mobile.
        for (const fake of fakes) fake.style.height = '';
        for (const item of items) {
          const art = item.querySelector<HTMLElement>('.feature-item-bg');
          if (art) art.style.height = '';
        }
        gsap.set(items, { clearProps: 'color' });
        for (const item of items) {
          gsap.set(item.querySelectorAll('.feature-item-accordion, .feature-item-fill'), {
            clearProps: 'all',
          });
          gsap.set(item.querySelectorAll('.feature-item-bg'), { clearProps: 'opacity' });
        }
      };
    });

    // Tinggi fake diturunkan dari layout, jadi ia hanya sebenar layout yang
    // dipakai mengukurnya. Font fallback punya metrik berbeda dari font asli,
    // dan gambar tanpa dimensi tidak punya tinggi sama sekali sampai ia
    // mendarat — keduanya menggeser tinggi terbuka setelah pengukuran pertama.
    let alive = true;
    const settle = () => {
      if (alive) ScrollTrigger.refresh();
    };

    // `document.fonts.ready` TIDAK cukup, dan cara gagalnya halus.
    //
    // Ia menjanjikan "tidak ada font yang sedang dimuat", bukan "font finalnya
    // sudah dipakai" — kalau berkasnya belum sempat diminta saat ia ditanya, ia
    // resolve saat itu juga. Terukur di halaman ini: `refresh()` berjalan lebih
    // dulu, lalu pada ~3,8 detik font aslinya mendarat dan SETIAP blok teks
    // memanjang serentak (tinggi anak `main` 438→472, 611→679, 1415→1552;
    // dokumen 7.912→8.898px). Section ini ikut turun 166px sementara
    // `start`/`end` yang sudah terlanjur dihitung tetap di tempat lama.
    //
    // Gejalanya tidak terbaca sebagai posisi yang meleset: item sudah `1fr`
    // sebelum pembaca sampai kepadanya, jadi yang terlihat adalah "animasinya
    // tidak jalan". Terukur 129px selama verifikasi, sama persis di tiap reload
    // — dan justru keterulangan itu yang membuatnya mudah dikira benar.
    //
    // Yang diamati elemen DI ATAS section, bukan tinggi dokumen: reflow bisa
    // menggeser section tanpa mengubah total tinggi. Dan bukan item di dalam
    // section: item berubah tinggi tiap frame selama scrub, jadi mengamatinya
    // berarti observer yang memicu refresh atas gerakannya sendiri. Item
    // `absolute`, jadi mereka tidak pernah menggerakkan apa pun di luar.
    const above = new Set<Element>([document.body]);
    for (let node: Element | null = root; node && node !== document.body; node = node.parentElement) {
      for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
        above.add(sib);
      }
    }

    const topOf = () => Math.round(root.getBoundingClientRect().top + window.scrollY);
    let lastTop = topOf();
    let queued: ReturnType<typeof setTimeout> | undefined;

    // Ditunda lewat timer, BUKAN `requestAnimationFrame`.
    //
    // rAF terasa seperti pilihan yang benar untuk sesuatu yang menyentuh
    // layout, dan di sini ia salah: rAF tidak berjalan sama sekali di tab yang
    // tidak terlihat. Kalau halaman dimuat di tab latar — pranala yang dibuka
    // di tab baru, tab yang dipulihkan saat browser dibuka — data mendarat,
    // section bergeser, refresh masuk antrean rAF, dan antrean itu tidak
    // pernah dijalankan. Yang tersisa adalah trigger yang meleset permanen,
    // dan pembaca pertama kali melihatnya justru saat ia berpindah ke tab itu.
    // Terukur selama verifikasi: geseran 129px yang bertahan di setiap reload.
    const resizeObserver = new ResizeObserver(() => {
      const top = topOf();
      if (top === lastTop) return;
      lastTop = top;
      clearTimeout(queued);
      queued = setTimeout(() => {
        settle();
        lastTop = topOf();
      }, 0);
    });
    for (const el of above) resizeObserver.observe(el);

    const pending: Promise<unknown>[] = [document.fonts.ready];
    for (const img of root.querySelectorAll('img')) {
      if (!img.complete) {
        pending.push(
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
        );
      }
    }
    void Promise.all(pending).then(settle);

    return () => {
      alive = false;
      resizeObserver.disconnect();
      clearTimeout(queued);
      mm.revert();
      disconnect();
    };
  }, [resolvedTheme]);

  return (
    <section id="pipeline" ref={rootRef} className="feature mkt-container">
      <div className="feature-main">
        {/* Spacer. Kosong dengan sengaja — inilah yang memberi section-nya
            tinggi dan inilah yang dipicu ScrollTrigger. */}
        <div className="feature-fakes" aria-hidden="true">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-fake" />
          ))}
        </div>

        <div className="feature-items">
          {FEATURES.map((f, i) => {
            const headId = `feature-head-${i}`;
            const panelId = `feature-panel-${i}`;
            const expanded = open === i;

            const head = (
              <>
                <h3 className="feature-item-title">{f.title}</h3>
                <span className="feature-item-num num">{String(i + 1).padStart(2, '0')}</span>
              </>
            );

            return (
              <div
                key={f.title}
                className={`feature-item${interactive && expanded ? ' -active' : ''}`}
              >
                <div className="feature-item-fill" aria-hidden="true" />

                <div className="feature-item-bg" aria-hidden="true">
                  <FeatureArt variant={f.art} />
                </div>

                {interactive ? (
                  <button
                    type="button"
                    id={headId}
                    className="feature-item-head"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(expanded ? null : i)}
                  >
                    {head}
                  </button>
                ) : (
                  <div className="feature-item-head">{head}</div>
                )}

                <div
                  className="feature-item-accordion"
                  id={panelId}
                  {...(interactive ? { role: 'region', 'aria-labelledby': headId } : {})}
                >
                  {/* `overflow: hidden` ada di sini, dan ia bukan kerapian:
                      trik 0fr→1fr bekerja dengan mengecilkan BARIS grid, dan
                      isi yang tidak dipotong akan tetap tergambar penuh di
                      luar baris setinggi nol. */}
                  <div className="feature-item-content">
                    {/* Padding ada di sini, bukan di `-content`: `overflow:
                        hidden` memotong isi, bukan padding pemiliknya. */}
                    <div className="feature-item-inner">
                      <p className="feature-item-body">{f.body}</p>
                      <Link className="feature-item-link" href={f.href}>
                        {f.linkLabel}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
