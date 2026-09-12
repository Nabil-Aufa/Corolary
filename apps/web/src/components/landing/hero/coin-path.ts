import { COIN_KINDS, CONFIG, type CoinKind, DESCENT_KINDS, FILLER_KINDS } from './hero-config';
import type { HeroTuning } from './hero-tuning';

/**
 * The hero scene as a dolly followed by a descent. The camera faces −Z the
 * whole time and never rotates: first it travels down the Z axis through coin
 * layers that never move, then straight down Y past the title to the paragraph.
 * Everything a coin does on screen — growing, sliding out past the edge — is
 * perspective. Pure math shared by the WebGL scene, the fallbacks and the
 * debug tools.
 */

export const TAN_HALF_FOV = Math.tan((CONFIG.camera.fov * Math.PI) / 360);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Seeded PRNG, so placements and the starfield are identical on every load and device. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inside the ellipse kept clear for the title; x and y are viewport fractions. */
export function insideSafeZone(x: number, y: number): boolean {
  const { rx, ry } = CONFIG.coins.safeZone;
  return ((x - 0.5) / rx) ** 2 + ((y - 0.5) / ry) ** 2 < 1;
}

/**
 * Where a coin's screen composition holds.
 * - `start`: seen from startZ, before the dolly moves.
 * - `focus`: at the camera's focus distance, with the camera still level.
 * - `descent`: at that coin's own (fixed) distance from endZ, at the moment
 *   `at` of the descent. The camera's z never changes down there, so these
 *   numbers are exactly what ends up on screen.
 */
export type CoinBasis = 'start' | 'focus' | 'descent';

export interface ScreenCoin {
  kind: CoinKind;
  /** Centre as viewport fractions, diameter as a fraction of its height. */
  x: number;
  y: number;
  diameter: number;
  basis: CoinBasis;
  /** `descent` basis: descent progress at which this coin is level with the frame's middle. */
  at: number;
}

type Range = readonly [number, number];

const pick = (range: Range, t: number) => range[0] + (range[1] - range[0]) * t;

interface SpreadConfig {
  readonly kinds: readonly CoinKind[];
  readonly seed: number;
  readonly angleStart: number;
  readonly angleStep: number;
  readonly angleJitter: number;
  readonly radius: Range;
  readonly diameter: Range;
}

/**
 * A golden-angle spread around the centre with jitter, retried until the centre
 * clears the safe zone. `random` is passed in so a caller can interleave other
 * draws into the same seeded stream.
 */
function spreadAt(config: SpreadConfig, kind: CoinKind, index: number, random: () => number): ScreenCoin {
  const { angleStart, angleStep, angleJitter, radius, diameter } = config;
  for (let attempt = 0; attempt < 64; attempt++) {
    const angle = ((angleStart + index * angleStep + (random() * 2 - 1) * angleJitter) * Math.PI) / 180;
    const r = pick(radius, random());
    const size = pick(diameter, random());
    const x = 0.5 + 0.5 * r * Math.cos(angle);
    const y = 0.5 + 0.5 * r * Math.sin(angle);
    if (!insideSafeZone(x, y)) return { kind, x, y, diameter: size, basis: 'focus', at: 0 };
  }
  return { kind, x: 0.5 + 0.5 * radius[1], y: 0.5, diameter: diameter[0], basis: 'focus', at: 0 };
}

function scatter(): ScreenCoin[] {
  const config = CONFIG.coins.scatter;
  const random = mulberry32(config.seed);
  return config.kinds.map((kind, i) => spreadAt(config, kind, i, random));
}

/**
 * The fillers. Four entries are pinned to the four corners of the frame — the
 * spread on its own leaves them empty — and the rest take the spread, with the
 * corner entries still stepping the golden angle so the spread does not bunch
 * up where they were skipped.
 */
function filler(): ScreenCoin[] {
  const config = CONFIG.coins.filler;
  const { cornerAt, cornerInset, diameter } = config;
  const random = mulberry32(config.seed);
  const corners = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const;
  return config.kinds.map((kind, i) => {
    const corner = (cornerAt as readonly number[]).indexOf(i);
    const spot = corners[corner];
    if (spot === undefined) return spreadAt(config, kind, i, random);
    const [cx, cy] = spot;
    const dx = pick(cornerInset, random());
    const dy = pick(cornerInset, random());
    const size = pick(diameter, random());
    return {
      kind,
      x: cx === 1 ? 1 - dx : dx,
      y: cy === 1 ? 1 - dy : dy,
      diameter: size,
      basis: 'focus' as const,
      at: 0,
    };
  });
}

/** The coins the descent passes, one at a time, seeded across the frame. */
function descent(): ScreenCoin[] {
  const config = CONFIG.coins.descent;
  const random = mulberry32(config.seed);
  return config.kinds.map((kind, i) => ({
    kind,
    x: pick(config.x, random()),
    y: pick(config.y, random()),
    diameter: pick(config.diameter, random()),
    basis: 'descent' as const,
    at: config.at[i] ?? 0.5,
  }));
}

/** The pair beside the paragraph, at the end of the descent. */
function paragraphCoins(): ScreenCoin[] {
  const config = CONFIG.coins.paragraphCoins;
  return config.kinds.map((kind, i) => ({
    kind,
    x: config.x[i] ?? 0.5,
    y: config.y[i] ?? 0.5,
    diameter: config.diameter,
    basis: 'descent' as const,
    at: 1,
  }));
}

/**
 * Every coin, keyed by kind so the depth order in COIN_KINDS is the single
 * place that decides which slot each one takes.
 */
const PLACED: ReadonlyMap<CoinKind, ScreenCoin> = new Map(
  [
    ...CONFIG.coins.sketch.map(
      (coin): ScreenCoin => ({
        kind: coin.kind,
        x: coin.x,
        y: coin.y,
        diameter: coin.diameter,
        basis: 'start',
        at: 0,
      }),
    ),
    ...filler(),
    ...scatter(),
    ...descent(),
    ...paragraphCoins(),
  ].map((coin) => [coin.kind, coin]),
);

/** Every coin in depth order: index n is layer n. */
export const LAYERS: readonly ScreenCoin[] = COIN_KINDS.map((kind) => {
  const coin = PLACED.get(kind);
  if (coin === undefined) throw new Error(`No placement for ${kind}`);
  return coin;
});

/**
 * Depth of each layer as a positive offset from the first coin, one seeded gap
 * per step. Drawn from `zGap` rather than laid on a grid, so no two coins share
 * a z and the flight never crosses a stretch of empty depth.
 */
export const Z_OFFSETS: readonly number[] = (() => {
  const { zGap, zSeed } = CONFIG.coins;
  const random = mulberry32(zSeed);
  const offsets = [0];
  for (let i = 1; i < LAYERS.length; i++) {
    offsets.push((offsets[i - 1] ?? 0) + pick(zGap, random()));
  }
  return offsets;
})();

/** Texture resolution for a kind: the small ones never fill much of the screen, and there are fourteen of them. */
export function textureSizeFor(kind: CoinKind): number {
  const small = [...FILLER_KINDS, ...DESCENT_KINDS] as readonly string[];
  return small.includes(kind) ? CONFIG.coins.smallTextureSize : CONFIG.coins.textureSize;
}

/**
 * Where the text planes sit. Both are one focus distance beyond the camera's
 * last z, which is what makes each sharp and centred at its own moment: the
 * title with the camera still level, the paragraph once it has descended to
 * endY. The camera stops short of them, so neither is ever flown past.
 */
export function textZAt(tuning: HeroTuning): number {
  return tuning.endZ - tuning.focusDist;
}

export function paragraphYAt(tuning: HeroTuning): number {
  return tuning.endY;
}

/**
 * Diameters are in vh, positions in % of the viewport. On a screen narrower
 * than the sketch the same vh would crowd the coins together, so diameters
 * shrink with the aspect ratio, within limits.
 */
export function diameterScale(width: number, height: number): number {
  const [min, max] = CONFIG.coins.diameterScaleRange;
  const aspect = width / Math.max(height, 1);
  return Math.min(max, Math.max(min, aspect / CONFIG.coins.sketchAspect));
}

export interface WorldCoin {
  kind: CoinKind;
  layer: number;
  x: number;
  y: number;
  z: number;
  /** Visible disc diameter, world units. */
  size: number;
}

/**
 * Screen composition lifted to world units: at distance d the viewport spans
 * H = 2 tan(fov/2) d by H × aspect, so a centre at (x, y) is
 * ((x − 0.5) H aspect, (0.5 − y) H) and a diameter D is D H. A descent coin
 * adds the camera's height at its own moment, which is what pins it to that
 * point of the way down.
 */
export function worldCoins(tuning: HeroTuning, width: number, height: number): WorldCoin[] {
  const aspect = width / Math.max(height, 1);
  const scale = diameterScale(width, height);
  return LAYERS.map((coin, layer) => {
    const z = -(Z_OFFSETS[layer] ?? 0) * tuning.zSpacing;
    const distance = Math.max(
      coin.basis === 'start' ? tuning.startZ - z : coin.basis === 'descent' ? tuning.endZ - z : tuning.focusDist,
      0.01,
    );
    const viewHeight = 2 * TAN_HALF_FOV * distance;
    return {
      kind: coin.kind,
      layer,
      z,
      x: (coin.x - 0.5) * viewHeight * aspect,
      y: (0.5 - coin.y) * viewHeight + coin.at * tuning.endY,
      size: coin.diameter * scale * viewHeight,
    };
  });
}

export function cameraZAt(fly: number, tuning: HeroTuning): number {
  return tuning.startZ + (tuning.endZ - tuning.startZ) * clamp01(fly);
}

export function cameraYAt(descend: number, tuning: HeroTuning): number {
  return tuning.endY * clamp01(descend);
}

// The three depth cues below are mirrored in the coin fragment shader.

/** 1 in front of the focus distance, falling off exponentially behind it. */
export function coinFog(distance: number, tuning: HeroTuning): number {
  return Math.exp(-Math.max(distance - tuning.focusDist, 0) * tuning.fogDensity);
}

/** 0 at the discard distance, 1 from `nearFade` out. */
export function coinNearFade(distance: number): number {
  return smoothstep(CONFIG.camera.near + CONFIG.depth.nearDiscard, CONFIG.depth.nearFade, distance);
}

/** Circle of confusion, 0 sharp to 1 fully blurred. */
export function coinBlur(distance: number, tuning: HeroTuning): number {
  const defocus = clamp01(Math.abs(distance - tuning.focusDist) / Math.max(tuning.focusRange, 0.001));
  return Math.max(defocus, 1 - coinNearFade(distance));
}

export interface ProjectedCoin {
  kind: CoinKind;
  layer: number;
  /** Centre and diameter in px of a `width` × `height` screen. */
  x: number;
  y: number;
  diameter: number;
  /** Along the view axis. */
  distance: number;
  /** Not yet discarded at the camera. */
  visible: boolean;
  onScreen: boolean;
}

export function projectCoins(
  tuning: HeroTuning,
  cameraZ: number,
  width: number,
  height: number,
  cameraY = 0,
): ProjectedCoin[] {
  const aspect = width / Math.max(height, 1);
  return worldCoins(tuning, width, height).map((coin) => {
    const distance = cameraZ - coin.z;
    const visible = distance > CONFIG.camera.near + CONFIG.depth.nearDiscard;
    const viewHeight = 2 * TAN_HALF_FOV * Math.max(distance, 1e-4);
    const x = (0.5 + coin.x / (viewHeight * aspect)) * width;
    const y = (0.5 - (coin.y - cameraY) / viewHeight) * height;
    const diameter = (coin.size / viewHeight) * height;
    const r = diameter / 2;
    return {
      kind: coin.kind,
      layer: coin.layer,
      x,
      y,
      diameter,
      distance,
      visible,
      onScreen: visible && x + r > 0 && x - r < width && y + r > 0 && y - r < height,
    };
  });
}
