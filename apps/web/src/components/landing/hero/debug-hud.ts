import { CONFIG } from './hero-config';

/**
 * `?debug=1` tools for the hero render loop. Imported only behind a
 * `process.env.NODE_ENV !== 'production'` guard in CoinCanvas, so production
 * builds never load this module. The tuning panel is separate
 * (debug/HeroDebugPanel.tsx).
 *
 * - HUD panel with the loop's live values; the last few thousand samples are
 *   kept on `window.__heroDebug` for automated checks.
 * - Overlay: the centre safe zone kept clear for the title.
 * - `&stars=0` hides the starfield; `&coins=0` hides the coins, so the frame
 *   edge can be measured on its own.
 */
export interface DebugOptions {
  stars: boolean;
  coins: boolean;
}

export function readDebugOptions(search: string): DebugOptions {
  const params = new URLSearchParams(search);
  return {
    stars: params.get('stars') !== '0',
    coins: params.get('coins') !== '0',
  };
}

export interface CoinProjection {
  kind: string;
  x: number;
  y: number;
  diameter: number;
  distance: number;
  visible: boolean;
}

export interface HeroDebugSample {
  frame: number;
  time: number;
  fps: number;
  dtMs: number;
  scrollY: number;
  lenisVelocity: number;
  scrollVelocity: number;
  springScroll: number;
  zoom: number;
  fly: number;
  descend: number;
  wipe: number;
  cameraZ: number;
  cameraY: number;
  bend: number;
  /** Peak displacement of the frame's bent edge, CSS px. */
  bendPx: number;
  /** World units the starfield has drifted toward the camera. */
  drift: number;
  /** Scene-pass draws plus the mask pass. */
  drawCalls: number;
  rect: { x: number; y: number; w: number; h: number; radius: number };
  camera: { x: number; y: number; z: number; rotationX: number; rotationY: number; rotationZ: number };
  /** Projected coin centres and diameters, CSS px. */
  coins: CoinProjection[];
  /** Layout reads below exist only in debug mode. */
  sectionTop: number;
  sectionWidth: number;
  sectionHeight: number;
  measuredWidth: number;
  measuredHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  /** Lenis's tick already ran in this ticker frame. */
  lenisFirst: boolean;
}

export interface DebugHud {
  update(sample: HeroDebugSample): void;
  dispose(): void;
}

export interface SafeZoneOverlay {
  layout(width: number, height: number): void;
  dispose(): void;
}

const HISTORY = 4000;

type DebugWindow = Window & { __heroDebug?: HeroDebugSample[] };

const fixed = (value: number, digits: number) => value.toFixed(digits).padStart(9);

export function mountDebugHud(): DebugHud {
  const panel = document.createElement('pre');
  panel.dataset.heroDebug = 'hud';
  Object.assign(panel.style, {
    position: 'fixed',
    left: '12px',
    bottom: '12px',
    zIndex: '200',
    margin: '0',
    padding: '10px 12px',
    font: '11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    color: '#d8f3ff',
    background: 'rgba(8, 10, 16, 0.84)',
    borderRadius: '8px',
    pointerEvents: 'none',
    whiteSpace: 'pre',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(panel);

  const history: HeroDebugSample[] = [];
  (window as DebugWindow).__heroDebug = history;
  let lastPaint = 0;

  return {
    update(sample) {
      history.push(sample);
      if (history.length > HISTORY) history.splice(0, history.length - HISTORY);

      // Repainted at 10 Hz: faster only costs layout and cannot be read.
      const now = performance.now();
      if (now - lastPaint < 100) return;
      lastPaint = now;

      const r = sample.rect;
      const nearest = sample.coins
        .filter((coin) => coin.visible)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map((coin) => `${coin.kind} ${coin.distance.toFixed(1)}`)
        .join('  ');
      panel.textContent = [
        `fps        ${fixed(sample.fps, 1)}`,
        `dt ms      ${fixed(sample.dtMs, 2)}`,
        `zoom       ${fixed(sample.zoom, 4)}`,
        `fly        ${fixed(sample.fly, 4)}`,
        `descend    ${fixed(sample.descend, 4)}`,
        `wipe       ${fixed(sample.wipe, 4)}`,
        `camera     z ${sample.cameraZ.toFixed(2)}  y ${sample.cameraY.toFixed(2)}`,
        `draws      ${fixed(sample.drawCalls, 0)}`,
        `lenisFirst ${sample.lenisFirst ? '     yes' : '      NO'}`,
        `uBend      ${fixed(sample.bend, 4)}  frame ${sample.bendPx.toFixed(1)}px`,
        `drift      ${fixed(sample.drift, 2)}`,
        `rect       ${r.x.toFixed(1)}, ${r.y.toFixed(1)}  ${r.w.toFixed(1)}×${r.h.toFixed(1)}  r${r.radius.toFixed(1)}`,
        `nearest    ${nearest}`,
      ].join('\n');
    },
    dispose() {
      panel.remove();
      delete (window as DebugWindow).__heroDebug;
    },
  };
}

/** The ellipse the scattered coins keep clear of, in the pinned section's px. */
export function mountSafeZoneOverlay(host: HTMLElement): SafeZoneOverlay {
  const zone = document.createElement('div');
  zone.dataset.heroDebugOverlay = '';
  Object.assign(zone.style, {
    position: 'absolute',
    zIndex: '3',
    pointerEvents: 'none',
    border: '1.5px dashed rgba(250, 204, 21, 0.9)',
    borderRadius: '50%',
    boxSizing: 'border-box',
    color: 'rgba(250, 204, 21, 0.9)',
    font: '11px ui-monospace, monospace',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  } satisfies Partial<CSSStyleDeclaration>);
  zone.textContent = 'safe zone';
  host.appendChild(zone);

  return {
    layout(width, height) {
      const { rx, ry } = CONFIG.coins.safeZone;
      zone.style.left = `${(0.5 - rx) * width}px`;
      zone.style.top = `${(0.5 - ry) * height}px`;
      zone.style.width = `${2 * rx * width}px`;
      zone.style.height = `${2 * ry * height}px`;
    },
    dispose() {
      zone.remove();
    },
  };
}
