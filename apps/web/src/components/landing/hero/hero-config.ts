/**
 * Every tunable of the hero scroll animation.
 *
 * Timeline positions are fractions of the pinned scroll (0..1). The scene is a
 * dolly followed by a descent: the camera moves down −Z through coin layers
 * that never move, stops, then moves down −Y past the title to the paragraph
 * (coin-path.ts). The frame is only a mask over it (coin-scene.ts). Spring
 * constants are per second; velocity gains act on px/s.
 *
 * In development, `?debug=1` opens a tuning panel that edits a runtime copy of
 * some of these values (hero-tuning.ts) and copies them back out as a snippet.
 */

/** The five that compose the opening frame, nearest first. */
export const SKETCH_KINDS = ['eth', 'usdc', 'wbtc', 'usdt', 'dai'] as const;

/**
 * Depth fillers between the opening group and the closing one. Smaller than
 * either, so they read as the crowd a flight passes through rather than as
 * something to look at.
 */
export const FILLER_KINDS = ['mkr', 'comp', 'crv', 'ldo', 'snx', 'bal', 'frax', 'gho', 'reth', 'cbbtc'] as const;

/** The coins still around the title when the dolly stops. */
export const SCATTER_KINDS = ['aave', 'link', 'uni', 'wsteth'] as const;

/** Passed on the way down, one at a time, while the paragraph is rising. */
export const DESCENT_KINDS = ['pendle', 'yfi', 'ens', 'rpl'] as const;

/** Flanking the paragraph, clear of its box on both sides. */
export const PARAGRAPH_KINDS = ['cbeth', 'usds'] as const;

/**
 * Depth order, nearest first: it is the index into this list that decides a
 * coin's z (coin-path.ts), and the slots near the camera's resting place are
 * scarce. Only three of them read sharp, and the title and the paragraph each
 * need one in front of them, so the groups are interleaved by hand rather than
 * appended:
 *
 * - `reth` keeps the slot in front of the title.
 * - `cbeth` takes the next one, which is in front of the paragraph — the
 *   camera has descended past the title by then, so the same depth serves a
 *   different moment.
 * - the closing group keeps the four slots behind, within a slot of where it
 *   sat before the descent existed.
 * - `yfi` sits mid-field so the middle of the descent has something moving in
 *   it; the rest fall away into the background.
 */
export const COIN_KINDS = [
  ...SKETCH_KINDS,
  'mkr',
  'comp',
  'crv',
  'ldo',
  'snx',
  'bal',
  'frax',
  'gho',
  'reth',
  'cbeth',
  'cbbtc',
  'aave',
  'link',
  'yfi',
  'uni',
  'usds',
  'wsteth',
  'pendle',
  'ens',
  'rpl',
] as const;

export type CoinKind = (typeof COIN_KINDS)[number];

export const CONFIG = {
  /**
   * Long enough that the dolly, the pause on the title and the descent each get
   * room; the paragraph wipe is the last thing to finish.
   */
  pinEnd: '+=800%',

  timeline: {
    /** Frame from the placeholder to fullscreen. */
    zoom: { at: 0, duration: 0.2, ease: 'power3.inOut' },
    copyOut: { at: 0, duration: 0.16, y: -60 },
    /** Camera dolly from startZ to endZ, linear in scroll. */
    fly: { at: 0.05, duration: 0.5 },
    /**
     * Camera descent from y 0 to endY, after a held beat on the title
     * (0.55..0.62) in which nothing moves at all.
     */
    descend: { at: 0.62, duration: 0.33 },
    /** Paragraph reveal, per character. Finishes just before the pin releases. */
    wipe: { at: 0.75, duration: 0.23 },
  },

  render: {
    dprDesktop: 1.75,
    dprMobile: 1.5,
    mobileQuery: '(width < 768px), (pointer: coarse)',
    /** Longest frame a spring integrates in one step. */
    maxDt: 1 / 30,
  },

  camera: {
    fov: 45,
    near: 0.1,
    far: 140,
    /** On the Z axis, facing −Z. The first coin sits at z = 0. */
    startZ: 7,
    /**
     * One focus distance short of the title plane, which is what puts the title
     * at its focus distance — sharp — when the dolly stops.
     */
    endZ: -26.5,
    /**
     * Then straight down, same z, no rotation. Far enough that the title is
     * well clear of the top of the frame by the time the paragraph is centred.
     */
    endY: -7.5,
  },

  coins: {
    segments: 32,
    /** Power of two, so the faces mipmap for the depth-of-field bias. */
    textureSize: 512,
    /** A filler or a descent coin never fills much of the screen. */
    smallTextureSize: 256,
    logoScale: 0.55,
    backFaceShade: 0.45,
    /** coin-texture.ts draws the rim at 0.98 of the texture radius; planes are enlarged to compensate. */
    discScale: 0.98,
    /**
     * Depth spacing. One gap per step is drawn from this range by a seeded
     * PRNG, so no two coins share a z and no stretch of empty depth opens up
     * between the groups — the flight stays continuously layered.
     */
    zGap: [1.5, 3],
    zSeed: 20260913,
    /**
     * The opening group, in depth order, as the sketch composes it with the
     * frame fullscreen and the camera at startZ: centres as fractions of the
     * viewport from the left/top, diameters as fractions of its height. World
     * sizes are derived from each coin's distance to startZ, so this
     * composition holds for any spacing or startZ.
     *
     * ETH sits as close to the centre as the safe zone allows. It cannot get
     * much closer: every point within 0.15 of the centre is inside that ellipse,
     * because its shortest semi-axis is 0.16.
     */
    sketch: [
      { kind: 'eth', x: 0.288, y: 0.447, diameter: 0.381 },
      { kind: 'usdc', x: 0.755, y: 0.58, diameter: 0.264 },
      { kind: 'wbtc', x: 0.3, y: 0.615, diameter: 0.173 },
      { kind: 'usdt', x: 0.574, y: 0.85, diameter: 0.073 },
      { kind: 'dai', x: 0.497, y: 1, diameter: 0.0397 },
    ],
    /**
     * The fillers, placed by a seeded PRNG as they look at the camera's focus
     * distance. Four of them hold the corners of the frame: a golden-angle
     * spread alone leaves the corners empty, and empty corners are what makes
     * a scene read as a column rather than as a space. The rest take the spread.
     */
    filler: {
      kinds: FILLER_KINDS,
      seed: 20260914,
      /** Which entries take a corner, spread through the group so the corners fill at different depths. */
      cornerAt: [0, 3, 6, 9],
      /** Corner centres, as a fraction in from each edge: outside the middle 60% on both axes. */
      cornerInset: [0.08, 0.19],
      angleStart: 20,
      angleStep: 137.5,
      angleJitter: 18,
      radius: [0.45, 0.95],
      diameter: [0.12, 0.28],
    },
    /**
     * The closing group, one coin each, placed the same way: a golden-angle
     * spread around the centre with jitter.
     */
    scatter: {
      kinds: SCATTER_KINDS,
      seed: 20260912,
      angleStart: -35,
      angleStep: 137.5,
      angleJitter: 15,
      radius: [0.55, 0.85],
      diameter: [0.25, 0.45],
    },
    /**
     * The coins the descent passes. `at` is the descent progress at which each
     * is level with the middle of the frame, so they arrive one at a time
     * rather than all at once; x, y and diameter are exact on-screen values at
     * that moment, because a descent coin's distance never changes.
     */
    descent: {
      kinds: DESCENT_KINDS,
      seed: 20260915,
      at: [0.2, 0.45, 0.7, 0.88],
      x: [0.15, 0.85],
      y: [0.3, 0.7],
      diameter: [0.12, 0.26],
    },
    /**
     * The pair beside the paragraph, at the end of the descent. x is fixed
     * rather than seeded: they have to clear the paragraph's box by `margin` of
     * the viewport width, and a seeded x cannot promise that.
     */
    paragraphCoins: {
      kinds: PARAGRAPH_KINDS,
      x: [0.085, 0.915],
      y: [0.34, 0.66],
      diameter: 0.18,
      /** Clearance from the paragraph box, as a fraction of the viewport width. */
      margin: 0.06,
    },
    /** Kept clear for the title: an ellipse with these semi-axes, fractions of width/height. */
    safeZone: { rx: 0.22, ry: 0.16 },
    /** Aspect ratio of the sketch; narrower screens scale diameters by clamp(aspect / this, range). */
    sketchAspect: 1.677,
    diameterScaleRange: [0.55, 1],
  },

  /**
   * Both texts are planes in the scene rather than elements over it, so they
   * take the same fog and depth of field as the coins and can be crossed by the
   * ones in front of them. The DOM keeps both for screen readers.
   */
  text: {
    /** Above this device pixel ratio the textures double; still powers of two. */
    hiDprAbove: 1.5,
    /**
     * Entrance by approach only: alpha ramps from 0 at `appearFrom` to 1 at
     * `appearTo`, and the sharpening is the depth of field's doing. Nothing
     * translates — a slide would be the one motion in this scene the camera
     * does not explain.
     */
    appearFrom: 20,
    appearTo: 12,
    color: '#ffffff',
    /** The paragraph before the wipe has reached it: white at about 22%. */
    dimColor: '#39425a',
    title: {
      content: 'What this is',
      /** Powers of two, so the texture mipmaps for the depth-of-field bias. */
      textureWidth: 1024,
      textureHeight: 256,
      /** Fraction of the texture width left blank at each end. */
      padding: 0.04,
      weight: 500,
      /** Plane width as a fraction of the viewport width at the focus distance. */
      widthFraction: 0.44,
      /**
       * The title takes the coins' paper bend, scaled down: its plane is four
       * times wider than it is tall, so the same bend would read four times
       * stronger across it.
       */
      bendScale: 0.45,
    },
    paragraph: {
      content:
        'Every number on this page comes from an Ethereum mainnet transaction, proven cryptographically, not from our database.',
      textureWidth: 1024,
      textureHeight: 512,
      padding: 0.05,
      weight: 400,
      /** Wrapped to at most this many lines; the type size follows from the fit. */
      maxLines: 4,
      lineHeight: 1.32,
      widthFraction: 0.6,
      bendScale: 0.3,
    },
  },

  /** Depth cues per coin, from its distance to the camera along the view axis. Mirrored in the coin shader. */
  depth: {
    focusDist: 7,
    focusRange: 4,
    /** fog = exp(−max(dist − focusDist, 0) × fogDensity) */
    fogDensity: 0.07,
    /** Alpha of a fully fogged coin. */
    fogAlpha: 0.35,
    /**
     * Mip bias at a full circle of confusion. Depth is told by fog and opacity,
     * and the bokeh only supports it, so it stays low enough that a coin
     * several layers back is still recognisably that coin.
     */
    mipBias: 2,
    /** Rim softness as a fraction of the radius: base + coc × extra. */
    edgeSoftness: [0.01, 0.05],
    /** Closer than this a coin fades out and its circle of confusion opens up… */
    nearFade: 3,
    /** …and closer than camera.near + this it is discarded. */
    nearDiscard: 0.5,
  },

  /**
   * The starfield. Points in world space, one draw call, and every one of its
   * three motions lives in the vertex shader — nothing here is recomputed on
   * the CPU per frame.
   *
   * Reference is morpho.org: small sharp dots, not glowing spheres. No four
   * point glints, no oversized hero stars, no additive blending. What sells the
   * depth is density and parallax, and both of those are free.
   */
  stars: {
    countDesktop: 6080,
    countMobile: 2250,
    /**
     * Base positions cover the whole camera path — startZ + zAhead down to
     * endZ − zBeyond — which is also one period of the depth wrap, so folding a
     * star round the back lands it on a distance the distribution already had.
     */
    zAhead: 5,
    zBeyond: 30,
    /** Nearest a star comes before it wraps round to the back. */
    dMin: 1.5,
    /** Fade at both depth seams, as a fraction of the span: kills the pop. */
    fadeFraction: 0.15,
    /**
     * Height of the slab, which travels with the camera so the descent never
     * drops out of it, and its width as a multiple of that.
     *
     * Sized so that halfH − fadeY still covers the view at the FAR end of the
     * span: 2 tan(fov/2) × 70 ≈ 58. Anything shorter and the far half of the
     * field stops reaching the top and bottom of the frame, which reads as a
     * band of sky that thins out towards the edges — measurable long before it
     * is nameable.
     */
    fieldH: 68,
    fadeY: 6,
    widthFactor: 2.4,
    /**
     * Three tenths of the count is drawn around cluster centres with a gaussian
     * offset, the rest uniformly. A real sky has dense patches and empty ones;
     * a uniform scatter reads as a grid no matter how many points are in it.
     */
    clusterShare: 0.3,
    clusterCount: [8, 12],
    clusterSigma: 9,
    seed: 20260911,
    /** Point size in CSS px before DPR and perspective attenuation, and its ceiling. */
    sizeRange: [1.5, 3.2],
    /**
     * The brightest tier is sized outright rather than by a multiplier on
     * `sizeRange`: it is meant to be a different kind of star, not a larger
     * ordinary one.
     */
    brightSizeRange: [5, 9],
    /** Has to clear brightSizeRange, or the ceiling quietly flattens the tier it exists for. */
    maxPointPx: 8,
    /**
     * The brightest tier reads as a highlight: a size multiplier and one soft
     * falloff inside its own sprite. Deliberately not a bloom and not a glint —
     * it stops well before the sprite border, so the star still reads as a
     * point with a lit centre rather than as a ball of light.
     */
    /**
     * How much smaller a highlight's CORE is than its sprite. It has to track
     * the real size ratio — mean brightSizeRange over mean sizeRange, about 3 —
     * or a 9px bright star gets a 5px flat disc instead of a sharp point with a
     * skirt, and the tier stops reading as a highlight at all.
     */
    highlightSize: 3,
    highlightHalo: 0.55,
    /**
     * Distance at which a star is drawn at its nominal size. The wrap makes
     * distance uniform over the whole span, so half the field sits beyond 35
     * units; at a reference of 12 those stars all attenuate below one device
     * pixel and the sky reads as empty.
     */
    referenceDepth: 20,
    /** Shares of the count that are pale blue and pale violet; the rest is white. */
    blueShare: 0.15,
    violetShare: 0.08,
    blue: '#aec2ff',
    violet: '#c9b8ff',
    /**
     * Brightness in three tiers rather than one range: an even spread of alpha
     * reads as one grey haze, while tiers read as stars at different distances.
     * Shares are dim, mid, bright; the remainder of each pair is its range.
     */
    dimShare: 0.55,
    midShare: 0.33,
    /** Every tier raised by 15%; the bright one lands on the 1.0 ceiling and flattens there. */
    dimAlpha: [0.4, 0.63],
    midAlpha: [0.69, 0.92],
    brightAlpha: [1, 1],
    /** Peak alpha swing, and the seconds a full cycle takes. Anything more reads as flicker. */
    twinkleAmount: 0.08,
    twinklePeriod: [6, 12],
    /**
     * Stars get their own fog density, gentler than the coins': the coins are
     * meant to fall away, the sky behind them is not.
     */
    fogDensity: 0.01,
    /**
     * Idle motion. Both keep running while the page is scrolled — they stack on
     * top of the parallax rather than taking turns with it — and both only ever
     * run one way, so scrolling up slows the approach instead of reversing it.
     *
     * World units per second toward the camera, and world units per second
     * sideways. The sideways one is a TRANSLATION, not a rotation, and its unit
     * changed with it: a rotation puts the vanishing point off centre and the
     * approach then reads as diagonal.
     *
     * At 2.625 u/s the whole field cycles through the span every 26 seconds, so
     * the idle is no longer a drift so much as a slow flight. The seam fade is
     * 10.3 units wide, which at this speed is 3.9 s to cross — still far more
     * than enough to stay under any visible step.
     *
     * Still NOT calibrated against morpho.org, and the 0.88 trim from that
     * brief was never applied. driftSpeed is the briefed 0.35 raised on request
     * by 25%, then 50%, then doubled. slideSpeed cannot be traced the same way
     * because its unit changed; it is set to about twice the on-screen rate the
     * old yaw gave at mid depth.
     */
    driftSpeed: 2.625,
    slideSpeed: 0.27,
  },

  /**
   * From the `manifest.json` of cryptocurrency-icons where that set has the
   * coin; chosen here for the marks taken from the other two sets, so a light
   * mark never lands on a light rim. See public/coins/SOURCE.md.
   */
  brandColors: {
    eth: '#627eea',
    wbtc: '#201a2d',
    usdc: '#3e73c4',
    usdt: '#26a17b',
    dai: '#f4b731',
    aave: '#2ebac6',
    link: '#2a5ada',
    uni: '#ff007a',
    /** Not from the manifest: a light rim, so the Lido mark's blue gradient stays legible. */
    wsteth: '#e6eefa',
    mkr: '#1aab9b',
    comp: '#00d395',
    crv: '#40649f',
    snx: '#5fcdf9',
    bal: '#1e1e1e',
    /** Lido's coral, which is what tells LDO from wstETH at a glance: same mark, opposite rim. */
    ldo: '#f69988',
    /** The FRAX mark is white on nothing, so the rim has to carry the contrast. */
    frax: '#191a1f',
    /** Deeper than the lavender mark, for the same reason. */
    gho: '#6b4fbb',
    reth: '#ff8b5e',
    cbbtc: '#0052ff',
    /** The navy the Pendle mark itself is drawn in. */
    pendle: '#152e51',
    /** Deeper than the mark's two light blues. */
    ens: '#16306e',
    rpl: '#6b2c0e',
    /** Light, because the cbETH mark is a solid Coinbase blue that would vanish on its own colour. */
    cbeth: '#dfe7ff',
    yfi: '#0b2a52',
    /** The USDS mark is a white silhouette; the rim carries Sky's green. */
    usds: '#1e9e6a',
  },

  frame: {
    fullAt: 0.98,
    /**
     * Past the viewport at fullscreen, so every edge effect sits off screen
     * once the frame has opened. Wide enough for the inner glow, which reaches
     * much further in than the feather: at 40 it left a permanent light
     * vignette around a frame that no longer has a visible edge.
     */
    edgeBleedPx: 140,
    /** The only softness at the edge, besides the glow. */
    feather: 8,
    /**
     * Paper flex from the scroll spring, as a fraction of the frame height: the
     * peak displacement of the top edge, with the bottom following at 0.7 and
     * the sides at 0.35. It is the same spring the coins bend with, so the
     * frame snaps perfectly straight the moment the scroll settles.
     */
    bendAmount: 0.06,
    /**
     * Page-coloured light bleeding inward from the edge, alpha × exp(−d / width).
     * Outside the frame nothing is drawn at all.
     */
    innerGlow: 48,
    innerGlowAlpha: 0.22,
  },

  /**
   * Semi-implicit Euler, per second. 360 / 14.9 is the former per-frame
   * 0.1 / 0.78 at 60 Hz: damping ratio ~0.39, so it still overshoots.
   */
  spring: {
    stiffness: 360,
    damping: 14.9,
    scrollInputLimit: 6000,
    /** Below this the spring snaps to rest, so a settled scene is exactly still. */
    scrollRest: 0.5,
  },

  /** springScroll (px/s) → paper bend, for the coins, the texts and the frame alike, soft-limited with tanh. */
  bend: { gain: 0.004 / 60, max: 0.6 },
} as const;
