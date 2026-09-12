import { CONFIG, type CoinKind } from './hero-config';

type Rgb = readonly [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hex: string, toward: Rgb, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const channel = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return `rgb(${channel(r, toward[0])}, ${channel(g, toward[1])}, ${channel(b, toward[2])})`;
}

async function loadLogo(kind: CoinKind): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = `/coins/${kind}.svg`;
  await image.decode();
  return image;
}

/**
 * One coin face per kind, drawn once and uploaded as a texture.
 *
 * Canvas2D rather than shading the coin in GLSL: static images cost one upload
 * each, while a procedural shader would pay for the same gradients on every
 * pixel of every coin, every frame. The SVG is rasterized at the draw size, so
 * the logo stays sharp at 512px even though the source is a 32px icon. `size`
 * must be a power of two, so the texture mipmaps for the depth of field; the
 * fillers take a smaller one (coin-path.ts, textureSizeFor) because there are
 * ten of them and none of them ever fills much of the screen.
 */
export async function drawCoinFace(kind: CoinKind, size: number): Promise<HTMLCanvasElement> {
  const color = CONFIG.brandColors[kind];
  const logo = await loadLogo(kind);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D is unavailable');

  const c = size / 2;

  // Rim: lit edge top-left, shadowed edge bottom-right. The light end is mixed
  // far toward white so a near-black brand color (WBTC) still reads against
  // the dark frame.
  const rim = ctx.createLinearGradient(0, 0, size, size);
  rim.addColorStop(0, mix(color, WHITE, 0.55));
  rim.addColorStop(0.5, color);
  rim.addColorStop(1, mix(color, BLACK, 0.55));
  ctx.beginPath();
  ctx.arc(c, c, c * 0.98, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();

  // Face: a soft off-center highlight, inset so the rim reads as a raised band.
  const face = ctx.createRadialGradient(c * 0.72, c * 0.64, c * 0.05, c, c, c * 0.84);
  face.addColorStop(0, mix(color, WHITE, 0.3));
  face.addColorStop(1, mix(color, BLACK, 0.18));
  ctx.beginPath();
  ctx.arc(c, c, c * 0.84, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = mix(color, BLACK, 0.4);
  ctx.stroke();

  const logoSize = size * CONFIG.coins.logoScale;
  ctx.drawImage(logo, c - logoSize / 2, c - logoSize / 2, logoSize, logoSize);

  return canvas;
}
