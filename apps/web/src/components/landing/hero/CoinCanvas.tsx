'use client';

import gsap from 'gsap';
import { useEffect, useRef, type RefObject } from 'react';
import { lenisTickFrame } from '@/lib/lenis-gsap';
import { getLenis } from '@/lib/lenis-store';
import { createSpring } from '@/lib/spring';
import { cameraYAt, cameraZAt, textureSizeFor } from './coin-path';
import type { CoinScene } from './coin-scene';
import type { DebugHud, DebugOptions, SafeZoneOverlay } from './debug-hud';
import { frameRectAt } from './frame-geometry';
import { COIN_KINDS, CONFIG } from './hero-config';
import { DEFAULT_TUNING, type HeroTuning } from './hero-tuning';
import type { CanvasController, FrameMeasure, HeroState } from './hero-types';

interface CoinCanvasProps {
  state: RefObject<HeroState>;
  frame: RefObject<FrameMeasure | null>;
  visible: RefObject<boolean>;
  /** Receives the controller once the scene exists, and null on unmount. */
  onController: (controller: CanvasController | null) => void;
  /** Called on the tick after the first successful render. */
  onReady: () => void;
  /** WebGL context, OGL, or a coin texture failed. */
  onUnavailable: () => void;
  /** Runtime copy of CONFIG edited by the development tuning panel; DEFAULT_TUNING otherwise. */
  tuning?: RefObject<HeroTuning>;
}

interface DebugTools {
  hud: DebugHud;
  overlay: SafeZoneOverlay;
  options: DebugOptions;
}

/** Linear near zero, approaches ±limit without the hard corner of a clamp. */
const softLimit = (value: number, limit: number) => (limit > 0 ? limit * Math.tanh(value / limit) : 0);

/**
 * Probed before OGL is imported. Without it a browser with WebGL disabled
 * downloads the whole WebGL chunk only for OGL to log "unable to create webgl
 * context" and throw. The probe context is released at once, because browsers
 * cap how many live contexts a page may hold.
 */
function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (context === null) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

async function loadDebugTools(host: HTMLElement): Promise<DebugTools | null> {
  // Folds to `return null` in production builds, which drops the import.
  if (process.env.NODE_ENV === 'production') return null;
  if (new URLSearchParams(window.location.search).get('debug') !== '1') return null;
  const tools = await import('./debug-hud');
  return {
    hud: tools.mountDebugHud(),
    overlay: tools.mountSafeZoneOverlay(host),
    options: tools.readDebugOptions(window.location.search),
  };
}

/**
 * The WebGL layer of the hero. Loaded through next/dynamic with SSR off, and it
 * imports OGL itself only once mounted, so neither is in the initial bundle.
 *
 * It owns no animation state: the GSAP timeline writes `state`, and this loop
 * reads it and adds the one physical response a scrubbed timeline cannot
 * express — the paper bend, from how fast the scroll is actually moving. The
 * camera only ever travels down Z and then down Y; nothing shakes it and
 * nothing turns it.
 *
 * Runs inside gsap.ticker, after the prioritised Lenis tick (SmoothScroll), so
 * every frame renders the scroll position and timeline progress of that same
 * frame.
 */
export function CoinCanvas({ state, frame, visible, onController, onReady, onUnavailable, tuning }: CoinCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onController, onReady, onUnavailable });

  useEffect(() => {
    callbacks.current = { onController, onReady, onUnavailable };
  }, [onController, onReady, onUnavailable]);

  useEffect(() => {
    const parent = host.current;
    if (parent === null) return;
    const handlers = callbacks;

    let disposed = false;
    let scene: CoinScene | null = null;
    let debug: DebugTools | null = null;
    let tick: gsap.TickerCallback | null = null;
    let onVisibility: (() => void) | null = null;
    // The text textures are raster: they are only correct for the device pixel
    // ratio they were drawn at, and that changes when a window moves between
    // displays.
    let textDpr = 0;
    let drawText: typeof import('./text-texture') | null = null;

    const isMobile = () => window.matchMedia(CONFIG.render.mobileQuery).matches;
    // HeroScroll already routes a reduced-motion client to the static mode, so
    // this layer is normally not mounted at all for them. Checked here anyway:
    // the drift is the one thing in this scene that moves without being asked
    // to, and it should not depend on a decision made in another file.
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const start = async () => {
      if (!webglAvailable()) {
        handlers.current.onUnavailable();
        return;
      }

      const mobile = isMobile();
      let created: CoinScene;
      try {
        const [ogl, sceneModule, textureModule, titleModule] = await Promise.all([
          import('ogl'),
          import('./coin-scene'),
          import('./coin-texture'),
          import('./text-texture'),
        ]);
        const dpr = Math.min(
          window.devicePixelRatio || 1,
          mobile ? CONFIG.render.dprMobile : CONFIG.render.dprDesktop,
        );
        const [faces, title, paragraph] = await Promise.all([
          Promise.all(COIN_KINDS.map((kind) => textureModule.drawCoinFace(kind, textureSizeFor(kind)))),
          titleModule.drawTitleTexture(dpr),
          titleModule.drawParagraphTextures(dpr),
        ]);
        if (disposed) return;
        textDpr = dpr;
        drawText = titleModule;
        created = sceneModule.createCoinScene(ogl, {
          parent,
          faces,
          title,
          paragraph,
          mobile,
          dpr,
          width: parent.clientWidth,
          height: parent.clientHeight,
        });
      } catch {
        if (!disposed) handlers.current.onUnavailable();
        return;
      }
      scene = created;

      const tools = await loadDebugTools(parent);
      if (disposed) {
        tools?.hud.dispose();
        tools?.overlay.dispose();
        return;
      }
      debug = tools;
      if (debug !== null) {
        created.setStarsVisible(debug.options.stars);
        created.setCoinsVisible(debug.options.coins);
        debug.overlay.layout(parent.clientWidth, parent.clientHeight);
      }

      const live = created;
      const { spring } = CONFIG;
      const makeSpring = (inputLimit: number, restDelta: number) =>
        createSpring({ stiffness: spring.stiffness, damping: spring.damping, inputLimit, restDelta });
      const scrollSpring = makeSpring(spring.scrollInputLimit, spring.scrollRest);

      const currentTuning = () => tuning?.current ?? DEFAULT_TUNING;

      let lastScroll = window.scrollY;
      // Accumulated from the ticker's own dt, clamped like every other
      // integration here, so a hidden tab comes back where it left off rather
      // than jumping by however long it was away. It never resets: a reset
      // would teleport the whole field.
      let drift = 0;
      let active = visible.current;
      let presented = false;
      let announced = false;
      let fps = 0;

      // Springs carry momentum from the last frame they saw. After a refresh, a
      // hidden tab, a re-entry or a debug jump that frame is stale, and
      // integrating from it is exactly the lurch these resets prevent.
      const resetMotion = () => {
        scrollSpring.reset();
        lastScroll = window.scrollY;
      };

      const draw = (time: number, realDt: number): boolean => {
        const hero = state.current;
        const measured = frame.current;
        if (measured === null) return false;
        const tune = currentTuning();

        const dt = Math.min(realDt, CONFIG.render.maxDt);
        // Velocities divide by the real frame time, floored at 1/240 s, so a
        // zero-length tick cannot produce an infinite spike. realDt = 0 means an
        // out-of-band render with no motion information at all.
        const perSecond = realDt > 0 ? 1 / Math.max(realDt, 1 / 240) : 0;
        const scrollY = window.scrollY;
        // Lenis reports 0 on touch, where it does not smooth; the scroll delta
        // is the same quantity measured directly.
        const lenisVelocity = getLenis()?.velocity ?? 0;
        const scrollVelocity = (lenisVelocity !== 0 ? lenisVelocity : scrollY - lastScroll) * perSecond;

        const cameraZ = cameraZAt(hero.fly, tune);
        const cameraY = cameraYAt(hero.descend, tune);
        const rect = frameRectAt(measured, hero.zoom);
        lastScroll = scrollY;

        const springScroll = scrollSpring.step(scrollVelocity, dt);
        const bend = softLimit(springScroll * CONFIG.bend.gain, CONFIG.bend.max);
        // Only ever forward, and only while this loop is running — which is
        // exactly when the section is on screen and the tab is visible.
        drift += dt * (reducedMotion() ? 0 : tune.driftSpeed);

        live.render({
          time,
          cameraZ,
          cameraY,
          frame: rect,
          bend,
          drift,
          wipe: hero.wipe,
          clearColor: measured.color,
          pageColor: measured.pageColor,
          tuning: tune,
        });

        if (debug !== null) {
          if (realDt > 0) fps = fps === 0 ? 1 / realDt : fps * 0.9 + (1 / realDt) * 0.1;
          const section = parent.getBoundingClientRect();
          const canvas = parent.querySelector('canvas');
          debug.hud.update({
            frame: gsap.ticker.frame,
            time,
            fps,
            dtMs: realDt * 1000,
            scrollY,
            lenisVelocity,
            scrollVelocity,
            springScroll,
            zoom: hero.zoom,
            fly: hero.fly,
            descend: hero.descend,
            wipe: hero.wipe,
            cameraZ,
            cameraY,
            bend,
            bendPx: bend * tune.bendAmount * rect.h,
            drift,
            drawCalls: live.debugDrawCalls(),
            rect,
            camera: live.debugCamera(),
            coins: live.debugCoins(),
            sectionTop: section.top,
            sectionWidth: section.width,
            sectionHeight: section.height,
            measuredWidth: measured.sectionWidth,
            measuredHeight: measured.sectionHeight,
            canvasWidth: canvas?.width ?? 0,
            canvasHeight: canvas?.height ?? 0,
            lenisFirst: lenisTickFrame() === gsap.ticker.frame,
          });
        }
        return true;
      };

      tick = (time, deltaTime) => {
        // One tick late on purpose: the placeholder is hidden only after the
        // canvas holding the identical frame has been presented.
        if (presented && !announced) {
          announced = true;
          handlers.current.onReady();
        }
        if (!active || document.hidden) return;
        if (draw(time, deltaTime / 1000)) presented = true;
      };

      /**
       * Both text planes are baked bitmaps, so a device pixel ratio change —
       * dragging the window to a display with a different scale — is the one
       * layout event they cannot ride out. Redrawn off the render loop; until
       * the new pair arrives the old one keeps showing.
       */
      const redrawTextIfDprChanged = async () => {
        const next = Math.min(window.devicePixelRatio || 1, isMobile() ? CONFIG.render.dprMobile : CONFIG.render.dprDesktop);
        if (drawText === null || next === textDpr) return;
        textDpr = next;
        const [title, paragraph] = await Promise.all([
          drawText.drawTitleTexture(next),
          drawText.drawParagraphTextures(next),
        ]);
        if (disposed) return;
        live.setTextTextures(title, paragraph);
      };

      const controller: CanvasController = {
        setActive(next) {
          if (next === active) return;
          active = next;
          if (next) {
            // Draw now, inside the ScrollTrigger callback, so the first frame
            // the section is on screen is a fresh one and not the one it left.
            resetMotion();
            if (draw(gsap.ticker.time, 0)) presented = true;
          } else {
            live.clear();
          }
        },
        refresh() {
          live.resize(parent.clientWidth, parent.clientHeight, isMobile());
          debug?.overlay.layout(parent.clientWidth, parent.clientHeight);
          void redrawTextIfDprChanged();
          resetMotion();
          if (active && draw(gsap.ticker.time, 0)) presented = true;
        },
      };

      onVisibility = () => {
        if (!document.hidden) resetMotion();
      };
      document.addEventListener('visibilitychange', onVisibility);
      gsap.ticker.add(tick);
      handlers.current.onController(controller);
    };

    void start();

    return () => {
      disposed = true;
      handlers.current.onController(null);
      if (tick !== null) gsap.ticker.remove(tick);
      if (onVisibility !== null) document.removeEventListener('visibilitychange', onVisibility);
      debug?.hud.dispose();
      debug?.overlay.dispose();
      scene?.dispose();
    };
  }, [state, frame, visible, tuning]);

  return <div ref={host} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" />;
}
