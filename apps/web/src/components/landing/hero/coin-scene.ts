import type * as OGL from 'ogl';
import { LAYERS, mulberry32, paragraphYAt, TAN_HALF_FOV, textZAt, worldCoins } from './coin-path';
import { COIN_KINDS, CONFIG, type CoinKind } from './hero-config';
import { DEFAULT_TUNING, type HeroTuning } from './hero-tuning';
import type { ParagraphTextures } from './text-texture';

type Ogl = typeof OGL;
type Rgb = readonly [number, number, number];

/** Frame rectangle in CSS px relative to the canvas, origin top-left. */
export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}

export interface RenderInput {
  /** Seconds, from gsap.ticker. Star twinkle. */
  time: number;
  /** The camera's position on the Z axis; it never turns. */
  cameraZ: number;
  /** …and on the Y axis, once the dolly has stopped. */
  cameraY: number;
  frame: FrameRect;
  /** Paper bend from the scroll spring, shared by the coins, the texts and the frame mask. */
  bend: number;
  /** Accumulated world units the starfield has drifted toward the camera; only ever grows. */
  drift: number;
  /** 0..1 paragraph reveal, per character, left to right and top to bottom. */
  wipe: number;
  /** The frame's own background: the scene's clear colour and its fog. */
  clearColor: Rgb;
  /** The page behind the frame. The inner glow is this colour soaking inward. */
  pageColor: Rgb;
  /** Read every frame; coins and stars are re-placed only when this object or the size changes. */
  tuning: HeroTuning;
}

/** Projected coin centre and visible diameter, CSS px. Debug only. */
export interface CoinProjection {
  kind: CoinKind;
  x: number;
  y: number;
  diameter: number;
  distance: number;
  visible: boolean;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export interface CoinScene {
  render(input: RenderInput): void;
  resize(width: number, height: number, mobile: boolean): void;
  /** Replaces the text textures after a device pixel ratio change. */
  setTextTextures(title: HTMLCanvasElement, paragraph: ParagraphTextures): void;
  /** Transparent canvas, so a paused layer never shows a stale frame. */
  clear(): void;
  setStarsVisible(visible: boolean): void;
  /** Debug only: hide every coin, e.g. to measure the frame edge on its own. */
  setCoinsVisible(visible: boolean): void;
  debugCoins(): CoinProjection[];
  debugCamera(): CameraPose;
  /** Meshes the scene pass actually drew, plus the one that masks it. Debug only. */
  debugDrawCalls(): number;
  dispose(): void;
}

interface SceneOptions {
  parent: HTMLElement;
  /** One face per entry of COIN_KINDS, in the same order. */
  faces: readonly HTMLCanvasElement[];
  /** "What this is", drawn by text-texture.ts. */
  title: HTMLCanvasElement;
  paragraph: ParagraphTextures;
  mobile: boolean;
  dpr: number;
  width: number;
  height: number;
}

/** A uniform whose value is rewritten every frame, widened from CONFIG's literal type. */
const uniform = (value: number): { value: number } => ({ value });

const COIN_VERTEX = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uBend;

varying vec2 vUv;

const float PI = 3.141592653589793;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Paper bend driven by scroll speed: the plane curves across its width, its
  // middle lags behind the pull, and it flexes slightly along the other axis.
  float curve = sin(uv.x * PI);
  pos.z += curve * uBend * 1.2;
  pos.y -= curve * uBend * 0.35;
  pos.x += sin(uv.y * PI) * uBend * 0.15;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

// Depth cues mirror coinFog / coinNearFade / coinBlur in coin-path.ts.
const COIN_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D tMap;       // premultiplied on upload, mipmapped
uniform float uDist;          // this coin to the camera along the view axis
uniform float uFocusDist;
uniform float uFocusRange;
uniform float uFogDensity;
uniform float uFogAlpha;
uniform float uMipBias;
uniform vec2 uEdgeSoftness;
uniform float uNearFade;
uniform float uNearDiscard;   // camera.near + depth.nearDiscard
uniform float uDiscScale;
uniform vec3 uFogColor;
uniform float uBackShade;

varying vec2 vUv;

void main() {
  if (uDist < uNearDiscard) discard;

  float nearFade = smoothstep(uNearDiscard, uNearFade, uDist);
  float coc = max(clamp(abs(uDist - uFocusDist) / uFocusRange, 0.0, 1.0), 1.0 - nearFade);
  float fog = exp(-max(uDist - uFocusDist, 0.0) * uFogDensity);

  // Depth of field in support of the fog, not instead of it: a blurrier mip
  // level and a rim that softens with the circle of confusion, both kept mild
  // enough that a coin several layers back is still readable. 0.5 is the drawn rim.
  vec4 texel = texture2D(tMap, vUv, coc * uMipBias);
  float r = length(vUv - 0.5) / uDiscScale;
  float softness = uEdgeSoftness.x + coc * uEdgeSoftness.y;
  float edge = 1.0 - smoothstep(0.5 - softness, 0.5, r);

  float alpha = texel.a * edge * mix(uFogAlpha, 1.0, fog) * nearFade;
  // The plane's transparent corners must not write depth or colour over the
  // stars behind them.
  if (alpha < 0.01) discard;

  vec3 color = texel.rgb / max(texel.a, 0.0001);
  if (!gl_FrontFacing) color *= uBackShade;
  color = mix(uFogColor, color, fog);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

// The title plane. Same depth cues as a coin, plus the one thing that makes it
// an entrance: alpha tied to how close the camera has come.
const TEXT_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D tMap;
uniform float uDist;
uniform float uFocusDist;
uniform float uFocusRange;
uniform float uFogDensity;
uniform float uFogAlpha;
uniform float uMipBias;
uniform float uNearFade;
uniform float uNearDiscard;
uniform vec3 uFogColor;
uniform float uAppearFrom;    // invisible at and beyond this distance…
uniform float uAppearTo;      // …fully opaque at and within this one

varying vec2 vUv;

void main() {
  if (uDist < uNearDiscard) discard;

  float nearFade = smoothstep(uNearDiscard, uNearFade, uDist);
  float coc = max(clamp(abs(uDist - uFocusDist) / uFocusRange, 0.0, 1.0), 1.0 - nearFade);
  float fog = exp(-max(uDist - uFocusDist, 0.0) * uFogDensity);
  // The entrance is the approach itself. Sharpness arrives on its own, from
  // the circle of confusion closing as the focus distance is reached.
  float approach = 1.0 - smoothstep(uAppearTo, uAppearFrom, uDist);

  vec4 texel = texture2D(tMap, vUv, coc * uMipBias);
  float alpha = texel.a * mix(uFogAlpha, 1.0, fog) * nearFade * approach;
  if (alpha < 0.004) discard;

  vec3 color = texel.rgb / max(texel.a, 0.0001);
  color = mix(uFogColor, color, fog);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

/**
 * The paragraph. Same depth cues again, and the reveal on top: `uOrderMap`
 * holds one flat value per character — its reading position, 0 at the first
 * character and 1 at the last — laid out over exactly the same glyph positions
 * as the text texture. Comparing that against `uWipe` lights the characters one
 * at a time, left to right and line by line, and reverses when the scroll does.
 * The transition is one character wide: enough to take the stairstep off the
 * boundary, not enough to turn it into a gradient.
 */
const PARAGRAPH_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D tMap;
uniform sampler2D uOrderMap;
uniform float uDist;
uniform float uFocusDist;
uniform float uFocusRange;
uniform float uFogDensity;
uniform float uFogAlpha;
uniform float uMipBias;
uniform float uNearFade;
uniform float uNearDiscard;
uniform vec3 uFogColor;
uniform float uAppearFrom;
uniform float uAppearTo;
uniform vec3 uTextColor;
uniform vec3 uDimColor;
uniform float uWipe;          // already padded by one character at each end
uniform float uCharStep;      // 1 / character count

varying vec2 vUv;

void main() {
  if (uDist < uNearDiscard) discard;

  float nearFade = smoothstep(uNearDiscard, uNearFade, uDist);
  float coc = max(clamp(abs(uDist - uFocusDist) / uFocusRange, 0.0, 1.0), 1.0 - nearFade);
  float fog = exp(-max(uDist - uFocusDist, 0.0) * uFogDensity);
  float approach = 1.0 - smoothstep(uAppearTo, uAppearFrom, uDist);

  vec4 texel = texture2D(tMap, vUv, coc * uMipBias);
  float alpha = texel.a * mix(uFogAlpha, 1.0, fog) * nearFade * approach;
  if (alpha < 0.004) discard;

  float order = texture2D(uOrderMap, vUv).r;
  float on = 1.0 - smoothstep(uWipe, uWipe + uCharStep, order);
  vec3 color = mix(uDimColor, uTextColor, on);
  color = mix(uFogColor, color, fog);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

/**
 * The starfield is a slab in front of the camera, wrapped at both ends, so it
 * can be flown through forever without running out. `position` is a base point
 * that never changes on the CPU: one period's worth of the wrap in y and z.
 *
 * The drift and the scroll are the same expression, not two mechanisms. A star
 * closes on the camera at `uDrift` even while the page sits still, and `uCamZ`
 * closes it faster or slower on top of that — so scrolling up slows the
 * approach rather than fighting it, and the drift is always forward.
 */
const STAR_VERTEX = /* glsl */ `
attribute vec3 position;
attribute float aRandom;
attribute float aSize;
attribute float aBright;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uDpr;
uniform float uReferenceDepth;
uniform float uMaxPoint;
uniform float uCamZ;
uniform float uCamY;
uniform float uDrift;         // accumulated world units, monotonically forward
uniform float uDMin;          // nearest a star comes before wrapping round
uniform float uSpan;          // depth of the slab
uniform float uFade;          // seam fade, world units
uniform float uFieldH;        // height of the slab, carried along with the camera
uniform float uFadeY;

varying float vRandom;
varying float vBright;
varying float vDepth;
varying float vFade;

void main() {
  float d = uCamZ - (position.z + uDrift);
  d = uDMin + mod(d - uDMin, uSpan);
  float dMax = uDMin + uSpan;

  // The slab travels with the camera, so the descent never drops out of it.
  float halfH = uFieldH * 0.5;
  float yPos = mod(position.y - uCamY + halfH, uFieldH) - halfH + uCamY;

  vec4 viewPosition = modelViewMatrix * vec4(position.x, yPos, uCamZ - d, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  vDepth = d;

  // Faded at every seam, or a star would snap into being at the far edge and
  // blink out at the near one. The upper bounds are written as 1.0 - smoothstep
  // rather than with the edges swapped: GLSL ES leaves smoothstep undefined
  // when edge0 >= edge1.
  float near = smoothstep(uDMin, uDMin + uFade, d);
  float far = 1.0 - smoothstep(dMax - uFade, dMax, d);
  float vertical = 1.0 - smoothstep(halfH - uFadeY, halfH, abs(yPos - uCamY));
  vFade = near * far * vertical;

  // Perspective size: near stars are larger and, for the same camera motion,
  // sweep across the frame faster — that difference is the parallax.
  gl_PointSize = clamp(aSize * uDpr * uReferenceDepth / max(d, 0.001), 1.0, uMaxPoint);
  vRandom = aRandom;
  vBright = aBright;
}
`;

const STAR_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uBlueShare;

varying float vRandom;
varying float vBright;
varying float vDepth;
varying float vFade;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);

  // smoothstep(0.12, 0.0, r) written the other way round: GLSL ES leaves
  // smoothstep undefined when edge0 >= edge1.
  float core = 1.0 - smoothstep(0.0, 0.12, r);
  float glow = exp(-r * r * 18.0) * 0.6;

  // Four-point glint on bright stars. Faded before the sprite border, or the
  // arms would end in a visible square.
  float spark = max(
    exp(-abs(c.x) * 40.0) * exp(-abs(c.y) * 4.0),
    exp(-abs(c.y) * 40.0) * exp(-abs(c.x) * 4.0)
  ) * 0.8;
  spark *= vBright * (1.0 - smoothstep(0.38, 0.5, max(abs(c.x), abs(c.y))));

  float wave = 0.5 + 0.5 * sin(uTime * mix(0.6 + vRandom * 1.8, 0.3 + vRandom * 0.5, vBright) + vRandom * 6.28);
  float twinkle = mix(mix(0.7, 1.0, wave), mix(0.5, 1.0, wave), vBright);

  float blue = step(1.0 - uBlueShare, fract(vRandom * 91.7));
  vec3 glowColor = mix(vec3(1.0), vec3(0.72, 0.8, 0.98), blue);
  float depthFade = mix(1.0, 0.6, smoothstep(12.0, 40.0, vDepth));

  vec3 color = (vec3(core) + glowColor * (glow + spark)) * twinkle * depthFade * vFade;
  // Additive (ONE, ONE): colour only, alpha untouched.
  gl_FragColor = vec4(color, 0.0);
}
`;

const FRAME_VERTEX = /* glsl */ `
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/**
 * The frame is a window and nothing else: a rounded rectangle bent like paper,
 * a feathered edge, and the page's own light soaking inward from it. No grain,
 * no edge noise, no motion blur — every one of those was a texture laid over
 * the scene rather than something the scene does.
 */
const FRAME_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;   // the scene, fullscreen
uniform vec2 uResolution;     // device px
uniform vec3 uPageColor;      // the page behind the frame

uniform vec4 uRect;           // x, y, w, h in device px, origin top-left
uniform float uRadius;        // device px
uniform float uBendPx;        // peak edge displacement from the scroll spring, device px, signed

uniform float uFeather;       // device px
uniform float uInnerGlow;     // device px
uniform float uInnerGlowAlpha;

const float PI = 3.141592653589793;

/**
 * Signed distance in device px to the frame outline, negative inside.
 *
 * The outline is a plain rounded rectangle bent like a sheet of paper by the
 * same scroll spring the coins use. The sample point is pulled back into the
 * straight rectangle's frame of reference, which curves every edge by exactly
 * the amount it displaces the point: the top edge leads, the bottom follows at
 * 0.7 and the sides flex at 0.35, each with its middle lagging. When the spring
 * settles the displacement is zero and the rectangle is exactly straight again.
 */
float frameDistance(vec2 p) {
  vec2 halfSize = max(uRect.zw * 0.5, vec2(1.0));
  vec2 centre = uRect.xy + uRect.zw * 0.5;
  vec2 t = clamp((p - uRect.xy) / max(uRect.zw, vec2(1.0)), 0.0, 1.0);
  float dy = uBendPx * sin(t.x * PI) * mix(1.0, 0.7, t.y);
  float dx = uBendPx * sin(t.y * PI) * 0.35;

  vec2 q = abs(p - vec2(dx, dy) - centre) - halfSize;
  float radius = min(uRadius, min(halfSize.x, halfSize.y));
  q += radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

// The scene at a screen position: the frame is only a window onto it. The bend
// never appears here, so the coins stay pinned to the screen while the mask moves.
vec3 scene(vec2 p) {
  vec2 uv = clamp(vec2(p.x / uResolution.x, 1.0 - p.y / uResolution.y), 0.0, 1.0);
  return texture2D(uTexture, uv).rgb;
}

void main() {
  // gl_FragCoord.y counts from the bottom; the rect is top-left based.
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  float feather = max(uFeather, 1.0);
  float d = frameDistance(p);
  // Outside the frame the page is left exactly as it is: no glow, no shadow.
  float mask = 1.0 - smoothstep(-0.5 * feather, 0.5 * feather, d);
  if (mask <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec3 color = scene(p) * mask;

  // Inner glow: the page's own light soaking in from the edge.
  float inward = max(-d, 0.0);
  float glow = uInnerGlowAlpha * exp(-inward / max(uInnerGlow, 1.0));
  // mix, not add: premultiplied colour may never exceed its alpha.
  color = mix(color, uPageColor * mask, clamp(glow, 0.0, 1.0));

  gl_FragColor = vec4(clamp(color, 0.0, mask), mask);
}
`;

/**
 * Two passes per frame.
 *
 * 1. The scene — stars (additive, one POINTS draw call), then the coins and the
 *    two text planes far to near — renders fullscreen into a canvas-sized
 *    RenderTarget cleared to the frame colour, seen by a camera on the screen's
 *    centre axis. It knows nothing about the frame.
 * 2. One fullscreen triangle masks it with the frame. The scene is sampled at
 *    each fragment's own screen position, so the frame is a window opening onto
 *    a scene that stays put. The same pass bends the mask like paper, feathers
 *    it, and adds the inner glow.
 *
 * Premultiplied alpha end to end, so soft edges composite without a dark fringe
 * on the light page.
 */
export function createCoinScene(ogl: Ogl, options: SceneOptions): CoinScene {
  const { parent, faces, dpr } = options;
  let { width, height, mobile } = options;

  const renderer = new ogl.Renderer({
    dpr,
    width,
    height,
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    depth: true,
    powerPreference: 'high-performance',
  });
  const gl = renderer.gl;
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.setAttribute('aria-hidden', 'true');

  // OGL writes a fixed px size on every setSize. 100% keeps the canvas glued to
  // the section between a resize and the refresh that re-syncs the buffer.
  const fitCanvas = () => {
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  };
  fitCanvas();
  parent.appendChild(canvas);

  const camera = new ogl.Camera(gl, {
    fov: CONFIG.camera.fov,
    near: CONFIG.camera.near,
    far: CONFIG.camera.far,
    aspect: width / Math.max(height, 1),
  });
  const scene = new ogl.Transform();

  // ── Stars ──────────────────────────────────────────────────────────────
  const createStarGeometry = (tuning: HeroTuning) => {
    const { countDesktop, countMobile, fieldH, widthFactor, seed, sizeRange, brightSizeRange, brightShare } =
      CONFIG.stars;
    const count = mobile ? countMobile : countDesktop;
    const halfH = fieldH * 0.5;
    const halfW = halfH * widthFactor;

    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count);
    const sizes = new Float32Array(count);
    const brights = new Float32Array(count);
    const random = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      // x is never wrapped and never drifts, so it is the only axis that needs
      // to cover the widest viewport outright. y and z only have to be uniform
      // over one period of their wrap; where they land is the shader's problem.
      positions[i * 3] = (random() * 2 - 1) * halfW;
      positions[i * 3 + 1] = (random() * 2 - 1) * halfH;
      positions[i * 3 + 2] = random() * tuning.starSpan;
      randoms[i] = random();
      const bright = random() < brightShare;
      const [min, max] = bright ? brightSizeRange : sizeRange;
      sizes[i] = min + (max - min) * random();
      brights[i] = bright ? 1 : 0;
    }
    return new ogl.Geometry(gl, {
      position: { size: 3, data: positions },
      aRandom: { size: 1, data: randoms },
      aSize: { size: 1, data: sizes },
      aBright: { size: 1, data: brights },
    });
  };
  // The field is placed relative to the camera now, so the dolly's own numbers
  // no longer change it; only the span it is generated over does.
  const starKey = (tuning: HeroTuning) => `${tuning.starSpan}|${mobile}`;

  const starTime = { value: 0 };
  const starField = {
    uCamZ: uniform(0),
    uCamY: uniform(0),
    uDrift: uniform(0),
    uSpan: uniform(CONFIG.stars.span),
    uFade: uniform(CONFIG.stars.fade),
  };
  const starProgram = new ogl.Program(gl, {
    vertex: STAR_VERTEX,
    fragment: STAR_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    cullFace: false,
    uniforms: {
      ...starField,
      uTime: starTime,
      uDpr: { value: dpr },
      uReferenceDepth: { value: CONFIG.stars.referenceDepth },
      uMaxPoint: { value: CONFIG.stars.maxPointPx * dpr },
      uDMin: { value: CONFIG.stars.dMin },
      uFieldH: { value: CONFIG.stars.fieldH },
      uFadeY: { value: CONFIG.stars.fadeY },
      uBlueShare: { value: CONFIG.stars.blueShare },
    },
  });
  starProgram.setBlendFunc(gl.ONE, gl.ONE);
  let starsBuiltFor = starKey(DEFAULT_TUNING);
  const starMesh = new ogl.Mesh(gl, {
    geometry: createStarGeometry(DEFAULT_TUNING),
    program: starProgram,
    mode: gl.POINTS,
    frustumCulled: false,
    renderOrder: -1,
  });
  starMesh.setParent(scene);

  const rebuildStars = (tuning: HeroTuning) => {
    const key = starKey(tuning);
    if (key === starsBuiltFor) return;
    starsBuiltFor = key;
    const previous = starMesh.geometry;
    starMesh.geometry = createStarGeometry(tuning);
    previous.remove();
  };

  // ── Coins and texts ────────────────────────────────────────────────────
  const planeGeometry = new ogl.Plane(gl, {
    widthSegments: CONFIG.coins.segments,
    heightSegments: CONFIG.coins.segments,
  });
  const focusDist = uniform(CONFIG.depth.focusDist);
  const focusRange = uniform(CONFIG.depth.focusRange);
  const fogDensity = uniform(CONFIG.depth.fogDensity);
  const fogColor = { value: [0, 0, 0] };
  const shared = {
    uFocusDist: focusDist,
    uFocusRange: focusRange,
    uFogDensity: fogDensity,
    uFogAlpha: { value: CONFIG.depth.fogAlpha },
    uMipBias: { value: CONFIG.depth.mipBias },
    uEdgeSoftness: { value: [...CONFIG.depth.edgeSoftness] },
    uNearFade: { value: CONFIG.depth.nearFade },
    uNearDiscard: { value: CONFIG.camera.near + CONFIG.depth.nearDiscard },
    uDiscScale: { value: CONFIG.coins.discScale },
    uFogColor: fogColor,
    uBackShade: { value: CONFIG.coins.backFaceShade },
    uAppearFrom: { value: CONFIG.text.appearFrom },
    uAppearTo: { value: CONFIG.text.appearTo },
  };

  // Premultiplied on upload: linear filtering then blends the rim into
  // transparency instead of into black. Mipmapped for the depth-of-field bias.
  const glyphTexture = (image: HTMLCanvasElement) =>
    new ogl.Texture(gl, {
      image,
      generateMipmaps: true,
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      premultiplyAlpha: true,
    });

  /**
   * The order map is data, not a picture: mipmapping it would average the
   * reading positions of neighbouring characters together and smear the
   * boundary the wipe is built on.
   */
  const orderTexture = (image: HTMLCanvasElement) =>
    new ogl.Texture(gl, {
      image,
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      premultiplyAlpha: false,
    });

  const textures = faces.map(glyphTexture);

  const rigs = LAYERS.map((coin, layer) => {
    const texture = textures[COIN_KINDS.indexOf(coin.kind)];
    if (texture === undefined) throw new Error(`No coin face for ${coin.kind}`);
    const dist = { value: 1 };
    const bend = { value: 0 };
    const program = new ogl.Program(gl, {
      vertex: COIN_VERTEX,
      fragment: COIN_FRAGMENT,
      transparent: true,
      cullFace: false,
      uniforms: { ...shared, tMap: { value: texture }, uDist: dist, uBend: bend },
    });
    const mesh = new ogl.Mesh(gl, { geometry: planeGeometry, program });
    mesh.setParent(scene);
    return { layer, kind: coin.kind, program, mesh, dist, bend, z: 0, scale: 1 };
  });

  // The title: one plane on the axis, sharp when the dolly stops.
  let titleTexture = glyphTexture(options.title);
  let titleAspect = options.title.width / Math.max(options.title.height, 1);
  const titleDist = { value: 1 };
  const titleBend = { value: 0 };
  const titleMap = { value: titleTexture };
  const titleProgram = new ogl.Program(gl, {
    vertex: COIN_VERTEX,
    fragment: TEXT_FRAGMENT,
    transparent: true,
    cullFace: false,
    uniforms: { ...shared, tMap: titleMap, uDist: titleDist, uBend: titleBend },
  });
  const titleMesh = new ogl.Mesh(gl, { geometry: planeGeometry, program: titleProgram });
  titleMesh.setParent(scene);

  // The paragraph: the same z, one descent below.
  let paragraphText = glyphTexture(options.paragraph.text);
  let paragraphOrder = orderTexture(options.paragraph.order);
  let paragraphAspect = options.paragraph.text.width / Math.max(options.paragraph.text.height, 1);
  const paragraphDist = { value: 1 };
  const paragraphBend = { value: 0 };
  const paragraphMap = { value: paragraphText };
  const paragraphOrderMap = { value: paragraphOrder };
  const paragraphWipe = { value: 0 };
  const paragraphCharStep = { value: 1 / Math.max(options.paragraph.charCount, 1) };
  const paragraphProgram = new ogl.Program(gl, {
    vertex: COIN_VERTEX,
    fragment: PARAGRAPH_FRAGMENT,
    transparent: true,
    cullFace: false,
    uniforms: {
      ...shared,
      tMap: paragraphMap,
      uOrderMap: paragraphOrderMap,
      uDist: paragraphDist,
      uBend: paragraphBend,
      uTextColor: { value: hexToRgb(CONFIG.text.color) },
      uDimColor: { value: hexToRgb(CONFIG.text.dimColor) },
      uWipe: paragraphWipe,
      uCharStep: paragraphCharStep,
    },
  });
  const paragraphMesh = new ogl.Mesh(gl, { geometry: planeGeometry, program: paragraphProgram });
  paragraphMesh.setParent(scene);

  let titleZ = textZAt(DEFAULT_TUNING);
  let titleScale = 1;
  let paragraphScale = 1;

  let placedFor: { tuning: HeroTuning; width: number; height: number } | null = null;

  /** World placement for this tuning and size; per frame only the camera moves. */
  const place = (tuning: HeroTuning) => {
    for (const coin of worldCoins(tuning, width, height)) {
      const rig = rigs[coin.layer];
      if (rig === undefined) continue;
      const scale = coin.size / CONFIG.coins.discScale;
      rig.mesh.position.set(coin.x, coin.y, coin.z);
      rig.mesh.scale.set(scale, scale, scale);
      rig.z = coin.z;
      rig.scale = scale;
    }

    // Both texts sit on the axis at the same z, sized from how wide the
    // viewport is where they are sharp. z is scaled with the height, so the
    // paper bow across a plane stays proportional to its short side rather than
    // to how wide the line happens to be.
    const aspect = width / Math.max(height, 1);
    const viewHeight = 2 * TAN_HALF_FOV * Math.max(tuning.focusDist, 0.01);
    titleZ = textZAt(tuning);

    const titleWidth = CONFIG.text.title.widthFraction * viewHeight * aspect;
    const titleHeight = titleWidth / Math.max(titleAspect, 0.01);
    titleScale = titleHeight;
    titleMesh.position.set(0, 0, titleZ);
    titleMesh.scale.set(titleWidth, titleHeight, titleHeight);

    const paragraphWidth = CONFIG.text.paragraph.widthFraction * viewHeight * aspect;
    const paragraphHeight = paragraphWidth / Math.max(paragraphAspect, 0.01);
    paragraphScale = paragraphHeight;
    paragraphMesh.position.set(0, paragraphYAt(tuning), titleZ);
    paragraphMesh.scale.set(paragraphWidth, paragraphHeight, paragraphHeight);

    rebuildStars(tuning);
    placedFor = { tuning, width, height };
  };

  // ── Render target + frame pass ─────────────────────────────────────────
  const createTarget = () =>
    new ogl.RenderTarget(gl, {
      width: Math.max(1, Math.round(width * dpr)),
      height: Math.max(1, Math.round(height * dpr)),
      depth: true,
    });

  const deleteTarget = (renderTarget: OGL.RenderTarget) => {
    gl.deleteFramebuffer(renderTarget.buffer);
    for (const texture of renderTarget.textures) gl.deleteTexture(texture.texture);
    if (renderTarget.depthBuffer) gl.deleteRenderbuffer(renderTarget.depthBuffer);
  };

  let target = createTarget();

  const { frame: frameConfig } = CONFIG;
  const u = {
    uTexture: { value: target.texture },
    uResolution: { value: [canvas.width, canvas.height] },
    uPageColor: { value: [1, 1, 1] },
    uRect: { value: [0, 0, 0, 0] },
    uRadius: { value: 0 },
    uBendPx: { value: 0 },
    uFeather: { value: frameConfig.feather * dpr },
    uInnerGlow: { value: frameConfig.innerGlow * dpr },
    uInnerGlowAlpha: uniform(frameConfig.innerGlowAlpha),
  };

  const frameProgram = new ogl.Program(gl, {
    vertex: FRAME_VERTEX,
    fragment: FRAME_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    cullFace: false,
    uniforms: u,
  });
  const frameGeometry = new ogl.Triangle(gl);
  const frameMesh = new ogl.Mesh(gl, {
    geometry: frameGeometry,
    program: frameProgram,
    frustumCulled: false,
  });

  const projected = new ogl.Vec3();
  const projectedEdge = new ogl.Vec3();
  const clearance = CONFIG.camera.near + CONFIG.depth.nearDiscard;
  let coinsVisible = true;
  let drawCalls = 0;

  /** The bend lifts a plane's middle toward the camera by 1.2 × bend × scale; never let that reach the discard distance. */
  const safeBend = (bend: number, distance: number, scale: number) => {
    const limit = Math.max(0, distance - clearance) / (1.2 * Math.max(scale, 1e-4));
    return Math.max(-limit, Math.min(limit, bend));
  };

  return {
    render(input) {
      const { frame, tuning } = input;
      if (
        placedFor === null ||
        placedFor.tuning !== tuning ||
        placedFor.width !== width ||
        placedFor.height !== height
      ) {
        place(tuning);
      }

      // Down the axis, then straight down. Never rotated: every on-screen
      // motion of a coin is perspective.
      camera.position.set(0, input.cameraY, input.cameraZ);

      for (const rig of rigs) {
        const distance = input.cameraZ - rig.z;
        rig.dist.value = distance;
        rig.mesh.visible = coinsVisible && distance > clearance;
        rig.bend.value = safeBend(input.bend, distance, rig.scale);
      }

      const textDistance = input.cameraZ - titleZ;
      titleDist.value = textDistance;
      paragraphDist.value = textDistance;
      titleMesh.visible = textDistance > clearance;
      paragraphMesh.visible = textDistance > clearance;
      // Both planes are several times wider than they are tall, so the same
      // bend would read several times stronger across them than across a coin.
      titleBend.value = safeBend(input.bend * CONFIG.text.title.bendScale, textDistance, titleScale);
      paragraphBend.value = safeBend(input.bend * CONFIG.text.paragraph.bendScale, textDistance, paragraphScale);
      // Padded by one character at each end, so the first character is still
      // dim at 0 and the last is fully lit at 1.
      const step = paragraphCharStep.value;
      paragraphWipe.value = input.wipe * (1 + 2 * step) - step;

      focusDist.value = tuning.focusDist;
      focusRange.value = Math.max(tuning.focusRange, 0.001);
      fogDensity.value = tuning.fogDensity;

      starTime.value = input.time;
      starField.uCamZ.value = input.cameraZ;
      starField.uCamY.value = input.cameraY;
      starField.uDrift.value = input.drift;
      starField.uSpan.value = Math.max(tuning.starSpan, 1);
      starField.uFade.value = tuning.starFade;

      const [r, g, b] = input.clearColor;
      fogColor.value[0] = r;
      fogColor.value[1] = g;
      fogColor.value[2] = b;

      gl.clearColor(r, g, b, 1);
      renderer.render({ scene, camera, target });

      // After the render, so the camera's frustum is the one that was used.
      drawCalls = starMesh.visible ? 1 : 0;
      for (const mesh of [...rigs.map((rig) => rig.mesh), titleMesh, paragraphMesh]) {
        if (mesh.visible && camera.frustumIntersectsMesh(mesh)) drawCalls++;
      }

      u.uPageColor.value[0] = input.pageColor[0];
      u.uPageColor.value[1] = input.pageColor[1];
      u.uPageColor.value[2] = input.pageColor[2];
      u.uRect.value[0] = frame.x * dpr;
      u.uRect.value[1] = frame.y * dpr;
      u.uRect.value[2] = frame.w * dpr;
      u.uRect.value[3] = frame.h * dpr;
      u.uRadius.value = frame.radius * dpr;
      u.uBendPx.value = input.bend * tuning.bendAmount * frame.h * dpr;
      u.uFeather.value = tuning.feather * dpr;
      u.uInnerGlow.value = tuning.innerGlow * dpr;
      u.uInnerGlowAlpha.value = tuning.innerGlowAlpha;

      gl.clearColor(0, 0, 0, 0);
      renderer.render({ scene: frameMesh });
      drawCalls++;
    },

    resize(nextWidth, nextHeight, nextMobile) {
      const sizeChanged = nextWidth !== width || nextHeight !== height;
      width = nextWidth;
      height = nextHeight;
      mobile = nextMobile;

      if (sizeChanged) {
        renderer.setSize(width, height);
        fitCanvas();
        camera.perspective({ aspect: width / Math.max(height, 1) });
        deleteTarget(target);
        target = createTarget();
        u.uTexture.value = target.texture;
        u.uResolution.value[0] = canvas.width;
        u.uResolution.value[1] = canvas.height;
      }
      placedFor = null;
    },

    setTextTextures(title, paragraph) {
      gl.deleteTexture(titleTexture.texture);
      gl.deleteTexture(paragraphText.texture);
      gl.deleteTexture(paragraphOrder.texture);
      titleTexture = glyphTexture(title);
      paragraphText = glyphTexture(paragraph.text);
      paragraphOrder = orderTexture(paragraph.order);
      titleMap.value = titleTexture;
      paragraphMap.value = paragraphText;
      paragraphOrderMap.value = paragraphOrder;
      titleAspect = title.width / Math.max(title.height, 1);
      paragraphAspect = paragraph.text.width / Math.max(paragraph.text.height, 1);
      paragraphCharStep.value = 1 / Math.max(paragraph.charCount, 1);
      placedFor = null;
    },

    clear() {
      renderer.bindFramebuffer();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },

    setStarsVisible(visible) {
      starMesh.visible = visible;
    },

    setCoinsVisible(visible) {
      coinsVisible = visible;
    },

    debugCoins() {
      const toX = (ndc: number) => (ndc * 0.5 + 0.5) * width;
      const toY = (ndc: number) => (0.5 - ndc * 0.5) * height;
      return rigs.map((rig) => {
        projected.copy(rig.mesh.position);
        projectedEdge.copy(rig.mesh.position);
        projectedEdge.x += (rig.mesh.scale.x * CONFIG.coins.discScale) / 2;
        camera.project(projected);
        camera.project(projectedEdge);
        return {
          kind: rig.kind,
          x: toX(projected.x),
          y: toY(projected.y),
          diameter: Math.abs(toX(projectedEdge.x) - toX(projected.x)) * 2,
          distance: rig.dist.value,
          visible: rig.mesh.visible,
        };
      });
    },

    debugCamera() {
      return {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        rotationX: camera.rotation.x,
        rotationY: camera.rotation.y,
        rotationZ: camera.rotation.z,
      };
    },

    debugDrawCalls() {
      return drawCalls;
    },

    dispose() {
      for (const texture of textures) gl.deleteTexture(texture.texture);
      gl.deleteTexture(titleTexture.texture);
      gl.deleteTexture(paragraphText.texture);
      gl.deleteTexture(paragraphOrder.texture);
      for (const rig of rigs) rig.program.remove();
      titleProgram.remove();
      paragraphProgram.remove();
      starProgram.remove();
      frameProgram.remove();
      planeGeometry.remove();
      starMesh.geometry.remove();
      frameGeometry.remove();
      deleteTarget(target);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}

function hexToRgb(hex: string): number[] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
