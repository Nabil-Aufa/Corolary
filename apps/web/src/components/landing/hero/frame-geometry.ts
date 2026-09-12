import type { FrameRect } from './coin-scene';
import { CONFIG } from './hero-config';
import type { FrameMeasure } from './hero-types';

export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Fallback clear color: `--color-panel` in the light theme. */
const PANEL_FALLBACK: FrameMeasure['color'] = [11 / 255, 14 / 255, 20 / 255];
/** Fallback page color: `--color-bg` in the light theme. */
const PAGE_FALLBACK: FrameMeasure['color'] = [246 / 255, 247 / 255, 250 / 255];

function parseRgb(value: string, fallback: FrameMeasure['color']): FrameMeasure['color'] {
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (match === null) return fallback;
  return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
}

/**
 * The placeholder relative to its section, so the numbers do not change while
 * the section is pinned (fixed) or scrolled. Call on refresh or resize, never
 * per frame.
 */
export function measureFrame(section: HTMLElement, placeholder: HTMLElement): FrameMeasure {
  const s = section.getBoundingClientRect();
  const p = placeholder.getBoundingClientRect();
  const style = getComputedStyle(placeholder);
  return {
    x: p.left - s.left,
    y: p.top - s.top,
    w: p.width,
    h: p.height,
    radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
    sectionWidth: s.width,
    sectionHeight: s.height,
    color: parseRgb(style.backgroundColor, PANEL_FALLBACK),
    // Read off the body rather than written down here, so the inner glow is the
    // page's own colour in either theme.
    pageColor: parseRgb(getComputedStyle(document.body).backgroundColor, PAGE_FALLBACK),
  };
}

/**
 * Frame rectangle for a zoom value: the placeholder at 0, the viewport plus a
 * bleed from `fullAt` on. Reaching the viewport at `fullAt` rather than
 * snapping there avoids a jump right where the eye watches the corners close;
 * the radius shrinks along with it.
 */
export function frameRectAt(measured: FrameMeasure, zoom: number): FrameRect {
  const { fullAt, edgeBleedPx } = CONFIG.frame;
  const reach = Math.min(Math.max(zoom, 0) / fullAt, 1);
  const bleed = edgeBleedPx * reach;
  return {
    x: lerp(measured.x, -bleed, reach),
    y: lerp(measured.y, -bleed, reach),
    w: lerp(measured.w, measured.sectionWidth + bleed * 2, reach),
    h: lerp(measured.h, measured.sectionHeight + bleed * 2, reach),
    radius: measured.radius * (1 - reach),
  };
}
