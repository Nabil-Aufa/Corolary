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
  /** Starfield idle: toward the camera and sideways, both in world units per second. */
  driftSpeed: number;
  slideSpeed: number;
  starCount: number;
  starCountMobile: number;
  starSpan: number;
  starFade: number;
  starSizeMin: number;
  starSizeMax: number;
  starTwinkle: number;
  starFogDensity: number;
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
    slideSpeed: CONFIG.stars.slideSpeed,
    starCount: CONFIG.stars.countDesktop,
    starCountMobile: CONFIG.stars.countMobile,
    // One period of the depth wrap is the whole camera path, so a star folded
    // round the back lands on a distance the distribution already had.
    starSpan: CONFIG.camera.startZ + CONFIG.stars.zAhead - (CONFIG.camera.endZ - CONFIG.stars.zBeyond),
    // 15% of the span, as briefed. A slider of its own because the two are
    // worth pulling apart while tuning; drift them too far and the seams
    // reappear, which is the whole thing the fade exists to prevent.
    starFade:
      (CONFIG.camera.startZ + CONFIG.stars.zAhead - (CONFIG.camera.endZ - CONFIG.stars.zBeyond)) *
      CONFIG.stars.fadeFraction,
    starSizeMin: CONFIG.stars.sizeRange[0],
    starSizeMax: CONFIG.stars.sizeRange[1],
    starTwinkle: CONFIG.stars.twinkleAmount,
    starFogDensity: CONFIG.stars.fogDensity,
  };
}

export const DEFAULT_TUNING: HeroTuning = defaultTuning();
