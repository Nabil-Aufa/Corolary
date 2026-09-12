import { CONFIG } from './hero-config';

/**
 * The values the development tuning panel (`?debug=1`) changes at runtime.
 * Everything else renders DEFAULT_TUNING, which is CONFIG as written. The render
 * loop reads the current object every frame and re-places coins and stars only
 * when the object itself is replaced.
 */
export interface HeroTuning {
  startZ: number;
  endZ: number;
  endY: number;
  /** Multiplies every seeded gap in coin-path.ts; 1 is CONFIG as written. */
  zSpacing: number;
  focusDist: number;
  focusRange: number;
  fogDensity: number;
  feather: number;
  innerGlow: number;
  innerGlowAlpha: number;
  bendAmount: number;
  /** Starfield idle drift, world units per second. */
  driftSpeed: number;
  starSpan: number;
  starFade: number;
}

export function defaultTuning(): HeroTuning {
  return {
    startZ: CONFIG.camera.startZ,
    endZ: CONFIG.camera.endZ,
    endY: CONFIG.camera.endY,
    zSpacing: 1,
    focusDist: CONFIG.depth.focusDist,
    focusRange: CONFIG.depth.focusRange,
    fogDensity: CONFIG.depth.fogDensity,
    feather: CONFIG.frame.feather,
    innerGlow: CONFIG.frame.innerGlow,
    innerGlowAlpha: CONFIG.frame.innerGlowAlpha,
    bendAmount: CONFIG.frame.bendAmount,
    driftSpeed: CONFIG.stars.driftSpeed,
    starSpan: CONFIG.stars.span,
    starFade: CONFIG.stars.fade,
  };
}

export const DEFAULT_TUNING: HeroTuning = defaultTuning();
