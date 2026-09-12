'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { claimBootGate, resolveBootGate } from '@/lib/boot';
import { connectLenisToScrollTrigger } from '@/lib/lenis-gsap';
import { cn } from '@/lib/utils';
import { coinBlur, coinFog, coinNearFade, projectCoins } from './coin-path';
import { frameRectAt, measureFrame } from './frame-geometry';
import { CONFIG } from './hero-config';
import { FramePlaceholder, HERO_TITLE_CLASS, HeroCopy } from './hero-markup';
import { DEFAULT_TUNING, type HeroTuning } from './hero-tuning';
import type { CanvasController, FrameMeasure, HeroState } from './hero-types';

gsap.registerPlugin(ScrollTrigger, useGSAP);

// A mobile address bar showing or hiding resizes the viewport height. Without
// this every such scroll triggers a full refresh — re-pinning, re-measuring and
// resizing the WebGL buffers mid-gesture, which is itself a visible jump.
ScrollTrigger.config({ ignoreMobileResize: true });

const CoinCanvas = dynamic(() => import('./CoinCanvas').then((m) => m.CoinCanvas), {
  ssr: false,
});

// Development only. The condition is a build-time constant, so production
// bundles drop the import — and the panel's chunk with it.
const HeroDebugPanel =
  process.env.NODE_ENV === 'production'
    ? null
    : dynamic(() => import('./debug/HeroDebugPanel').then((m) => m.HeroDebugPanel), { ssr: false });

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const readReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

/** The server renders the animated layout; reduced-motion clients switch once on hydration. */
const readReducedMotionOnServer = () => false;

const subscribeToNothing = () => () => {};
const readDebugFlag = () => new URLSearchParams(window.location.search).get('debug') === '1';
const readDebugFlagOnServer = () => false;

interface ScrollRange {
  start: number;
  end: number;
}

/**
 * Landing hero: headline, subline, and the black frame below them, pinned for
 * five screens. The frame opens to fullscreen like a window onto a scene that
 * stays put, while the camera dollies straight ahead through layers of
 * lending-market coins in a starfield, to "What this is".
 *
 * Three render modes, decided on the client:
 * - `webgl`: OGL canvas draws scene and frame (coin-scene.ts). The DOM
 *   placeholder stays for layout and is hidden after the first WebGL frame.
 * - `css`: WebGL unavailable. Same pin and timeline, but the frame is a DOM
 *   layer zoomed with `clip-path`, holding the coins where the dolly ends.
 * - `static`: reduced motion. No pin, no timeline; the frame shows the coins
 *   and "What this is" in place.
 *
 * In development, `?debug=1` adds the HUD and the tuning panel.
 */
export function HeroScroll() {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    readReducedMotionOnServer,
  );
  const debugRequested = useSyncExternalStore(subscribeToNothing, readDebugFlag, readDebugFlagOnServer);
  const [webglFailed, setWebglFailed] = useState(false);

  const section = useRef<HTMLElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const placeholder = useRef<HTMLDivElement>(null);
  const cssFrame = useRef<HTMLDivElement>(null);

  const state = useRef<HeroState>({ zoom: 0, fly: 0, descend: 0, wipe: 0 });
  const frame = useRef<FrameMeasure | null>(null);
  const visible = useRef(true);
  const controller = useRef<CanvasController | null>(null);
  const tuning = useRef<HeroTuning>(DEFAULT_TUNING);
  const scrollRange = useRef<ScrollRange | null>(null);

  const mode = reduced ? 'static' : webglFailed ? 'css' : 'webgl';

  /**
   * Lenis only moves ScrollTrigger if something has bridged the two, and that
   * bridge is refcounted per consumer (lib/lenis-gsap.ts). The hero claims its
   * own rather than relying on a section further down the page having mounted
   * first: this timeline is scrubbed frame by frame, and if the bridge happened
   * to be missing the pin would simply never advance.
   */
  useEffect(() => {
    if (mode === 'static') return;
    return connectLenisToScrollTrigger();
  }, [mode]);

  /**
   * Gerbang kesiapan untuk layar boot (components/marketing/BootScreen.tsx).
   *
   * Diklaim tanpa syarat saat mount dan diselesaikan dari DUA arah, karena
   * hero punya tiga mode dan hanya satu di antaranya yang pernah menggambar
   * frame WebGL. Menunggu `onReady` saja berarti klien reduced-motion dan
   * klien tanpa WebGL menatap layar boot sampai batas waktunya habis.
   */
  useEffect(() => claimBootGate('hero'), []);

  useEffect(() => {
    if (mode !== 'webgl') {
      resolveBootGate('hero');
      return;
    }

    // Arah ketiga: hero yang tidak ada di layar. Me-refresh dari tengah
    // halaman — `#registry`, misalnya — mengembalikan posisi gulir sebelum
    // efek ini berjalan, jadi ScrollTrigger sudah memutuskan hero berada di
    // luar jangkauan dan CoinCanvas mulai dalam keadaan tidak aktif. Ia tidak
    // menggambar, jadi `onReady` tidak terlambat — ia tidak akan pernah
    // datang.
    //
    // Gejalanya tidak terbaca sebagai macet, dan itu yang membuatnya lolos:
    // gerbang `fonts` tetap selesai, jadi logonya terisi PERSIS setengah lalu
    // berhenti, dan layarnya baru pergi delapan detik kemudian saat batas
    // waktu menyapunya. Terlihat seperti animasi yang lambat, bukan seperti
    // sesuatu yang menunggu hal yang tidak akan terjadi.
    //
    // Menyelesaikannya benar, bukan sekadar menyerah: yang ditutupi layar boot
    // adalah bagian halaman yang akan dilihat orang ini, dan di posisi itu
    // tidak ada satu pun piksel WebGL di antaranya.
    if (!visible.current) {
      resolveBootGate('hero');
      return;
    }

    // Dan arah keempat: dokumen yang tersembunyi. CoinCanvas menolak
    // menggambar selagi `document.hidden` benar, jadi di tab latar `onReady`
    // BUKAN sesuatu yang datang terlambat, ia tidak akan datang sama sekali
    // sampai tabnya dilihat. Menunggunya berarti layar boot bertahan sampai
    // batas waktunya habis untuk halaman yang tidak sedang ditonton siapa pun.
    const settleIfHidden = () => {
      if (document.hidden) resolveBootGate('hero');
    };
    settleIfHidden();
    document.addEventListener('visibilitychange', settleIfHidden);
    return () => document.removeEventListener('visibilitychange', settleIfHidden);
  }, [mode]);

  useGSAP(
    () => {
      const sectionEl = section.current;
      const copyEl = copy.current;
      const placeholderEl = placeholder.current;
      if (mode === 'static' || !sectionEl || !copyEl || !placeholderEl) return;

      const hero = state.current;

      // Runs on refresh only — never per frame.
      const measure = () => {
        frame.current = measureFrame(sectionEl, placeholderEl);
      };

      const applyClip = () => {
        const layer = cssFrame.current;
        const f = frame.current;
        if (layer === null || f === null) return;
        const r = frameRectAt(f, hero.zoom);
        layer.style.clipPath = `inset(${r.y}px ${f.sectionWidth - r.x - r.w}px ${
          f.sectionHeight - r.y - r.h
        }px ${r.x}px round ${r.radius}px)`;
      };

      /**
       * The navbar reads `data-nav` off whatever is under it, and for every
       * other section that is a constant. Here it is not: the frame opens from
       * a card on a light page to a black fullscreen, so the bar is over light
       * then over dark without the section itself moving.
       *
       * The test is the frame's top edge against the bar's bottom line. Written
       * only when it flips, so the header's MutationObserver wakes a handful of
       * times across the whole pin rather than every frame.
       */
      let navTone = '';
      const applyNavTone = () => {
        const f = frame.current;
        if (f === null) return;
        const barHeight = document.querySelector<HTMLElement>('.navbar-strip')?.offsetHeight ?? 0;
        const top = sectionEl.getBoundingClientRect().top + frameRectAt(f, hero.zoom).y;
        const next = top < barHeight ? 'dark' : 'light';
        if (next === navTone) return;
        navTone = next;
        sectionEl.dataset.nav = next;
      };

      measure();
      applyClip();
      applyNavTone();

      const t = CONFIG.timeline;
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate: mode === 'css' ? () => {
          applyClip();
          applyNavTone();
        } : applyNavTone,
        scrollTrigger: {
          trigger: sectionEl,
          start: 'top top',
          end: CONFIG.pinEnd,
          pin: true,
          // `true`, not a number: Lenis already smooths the scroll, and a
          // scrub lag on top reads as the frame trailing the wheel.
          scrub: true,
          // Rect, canvas size and render target are synced in this one place.
          // Resizing the canvas on its own debounce left them disagreeing for
          // ~1 s after every resize.
          onRefresh: (self) => {
            measure();
            applyClip();
            applyNavTone();
            scrollRange.current = { start: self.start, end: self.end };
            controller.current?.refresh();
          },
        },
      });

      // Total duration 1, so timeline progress equals pinned scroll progress.
      // Neither text is animated here. In WebGL both are planes in the scene:
      // the title is revealed by the camera closing on it, the paragraph by the
      // camera descending to it, and the wipe runs per character (coin-scene.ts).
      // In the CSS fallback they sit inside the clipped frame, revealed by the
      // same clip that opens the frame.
      const wipeEnd = t.wipe.at + t.wipe.duration;
      timeline
        .to(hero, { zoom: 1, duration: t.zoom.duration, ease: t.zoom.ease }, t.zoom.at)
        .to(copyEl, { y: t.copyOut.y, opacity: 0, duration: t.copyOut.duration }, t.copyOut.at)
        .to(hero, { fly: 1, duration: t.fly.duration }, t.fly.at)
        .to(hero, { descend: 1, duration: t.descend.duration }, t.descend.at)
        .to(hero, { wipe: 1, duration: t.wipe.duration }, t.wipe.at)
        // Pads the timeline back out to exactly 1, so its progress stays equal
        // to pinned scroll progress. The tail is the held beat after the last
        // character lights up and before the pin releases.
        .to(hero, { wipe: 1, duration: 1 - wipeEnd }, wipeEnd);

      const trigger = timeline.scrollTrigger;
      if (trigger !== undefined) scrollRange.current = { start: trigger.start, end: trigger.end };

      // Watches the pin spacer, not the section: the spacer spans the whole
      // pinned distance plus the section itself, which is exactly the range in
      // which any part of the canvas can be on screen.
      const watch = ScrollTrigger.create({
        trigger: sectionEl.parentElement ?? sectionEl,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          visible.current = self.isActive;
          controller.current?.setActive(self.isActive);
          // Sebagian browser memulihkan posisi gulir SETELAH hidrasi, jadi
          // pemeriksaan sekali saat mount bisa mendapati hero masih di layar
          // dan baru di sini ia keluar. Tanpa baris ini, urutan itu
          // menghidupkan kembali persis kebuntuan yang dijelaskan di gerbang
          // `hero` di atas. Aman dipanggil berkali-kali; gerbang yang sudah
          // selesai tidak berubah lagi.
          if (!self.isActive) resolveBootGate('hero');
        },
      });
      visible.current = watch.isActive;

      // ScrollTrigger refreshes only after a resize has settled (~200 ms).
      // Until then the pinned section keeps its old px width, so the whole
      // pinned layout — frame, coins, title — hangs off the resized window.
      // Refreshing on the next frame instead closes that gap; rAF keeps a
      // window drag to one refresh per frame. Height-only changes on touch
      // (the address bar) stay with ignoreMobileResize.
      let lastWidth = window.innerWidth;
      let lastHeight = window.innerHeight;
      let refreshFrame = 0;
      const coarse = window.matchMedia('(pointer: coarse)');
      const onResize = () => {
        const widthChanged = window.innerWidth !== lastWidth;
        const heightChanged = window.innerHeight !== lastHeight;
        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;
        if (!widthChanged && (!heightChanged || coarse.matches)) return;
        cancelAnimationFrame(refreshFrame);
        refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
      };
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('resize', onResize);
        cancelAnimationFrame(refreshFrame);
        scrollRange.current = null;
      };
    },
    { dependencies: [mode], scope: section, revertOnUpdate: true },
  );

  const handleController = (next: CanvasController | null) => {
    controller.current = next;
    if (next !== null) {
      next.refresh();
      next.setActive(visible.current);
    }
  };

  const handleReady = () => {
    if (placeholder.current !== null) placeholder.current.style.visibility = 'hidden';
    resolveBootGate('hero');
  };

  const handleUnavailable = () => {
    if (placeholder.current !== null) placeholder.current.style.visibility = '';
    setWebglFailed(true);
  };

  const handleTuning = useCallback((next: HeroTuning) => {
    tuning.current = next;
  }, []);
  const getScrollRange = useCallback(() => scrollRange.current, []);
  const resetMotion = useCallback(() => controller.current?.refresh(), []);

  return (
    <>
      <section
        ref={section}
        aria-labelledby="hero-title"
        // Rewritten as the frame opens; light is where it starts.
        data-nav="light"
        className={cn('relative isolate', mode !== 'static' && 'h-screen overflow-hidden')}
      >
        <HeroCopy ref={copy} />

        <FramePlaceholder ref={placeholder}>
          {mode === 'static' && (
            <>
              <StaticCoins />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
                <h2 className={HERO_TITLE_CLASS}>What this is</h2>
                <p className="max-w-[38ch] text-mkt-lead text-white/80">{CONFIG.text.paragraph.content}</p>
              </div>
            </>
          )}
        </FramePlaceholder>

        {mode === 'webgl' && (
          <CoinCanvas
            state={state}
            frame={frame}
            visible={visible}
            tuning={tuning}
            onController={handleController}
            onReady={handleReady}
            onUnavailable={handleUnavailable}
          />
        )}

        {mode === 'css' && (
          <div ref={cssFrame} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-panel">
            <StaticCoins />
            {/* Inside the clipped layer, so the clip that opens the frame is
                also what uncovers the title — white type on the white page
                would otherwise be invisible until it happened to land on the
                frame. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center">
              <h2 className={HERO_TITLE_CLASS}>What this is</h2>
              <p className="max-w-[36ch] text-mkt-lead text-white/80">{CONFIG.text.paragraph.content}</p>
            </div>
          </div>
        )}

        {/* Both WebGL texts are textures, which no screen reader or crawler can
            read. The words themselves stay in the document, off screen. */}
        {mode === 'webgl' && (
          <div className="sr-only">
            <h2>What this is</h2>
            <p>{CONFIG.text.paragraph.content}</p>
          </div>
        )}
      </section>

      {/* A sibling of the section: the pin transforms the section, which would
          make a fixed-position panel inside it scroll with the page. */}
      {HeroDebugPanel !== null && debugRequested && mode !== 'static' && (
        <HeroDebugPanel onChange={handleTuning} getScrollRange={getScrollRange} onJump={resetMotion} />
      )}
    </>
  );
}

/**
 * The coins where the dolly ends, for the fallbacks: the same projection the
 * WebGL scene uses, on the sketch's aspect ratio, with its fog and focus blur.
 * Layers the camera flew through are gone; the rest stack far to near. Centres
 * in % of the frame, diameters in % of its height.
 */
function StaticCoins() {
  const aspect = CONFIG.coins.sketchAspect;
  const tune = DEFAULT_TUNING;
  const coins = projectCoins(tune, tune.endZ, aspect, 1)
    .filter((coin) => coin.onScreen)
    .sort((a, b) => b.distance - a.distance);
  return (
    <>
      {coins.map((coin) => {
        const { fogAlpha } = CONFIG.depth;
        const opacity = (fogAlpha + (1 - fogAlpha) * coinFog(coin.distance, tune)) * coinNearFade(coin.distance);
        const blurPx = coinBlur(coin.distance, tune) * 4;
        return (
          // A plain <img>: tiny static SVGs that next/image cannot optimize anyway.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={coin.kind}
            src={`/coins/${coin.kind}.svg`}
            alt=""
            aria-hidden="true"
            className="absolute aspect-square -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(coin.x / aspect) * 100}%`,
              top: `${coin.y * 100}%`,
              height: `${coin.diameter * 100}%`,
              opacity,
              ...(blurPx > 0.1 ? { filter: `blur(${blurPx.toFixed(1)}px)` } : {}),
            }}
          />
        );
      })}
    </>
  );
}
