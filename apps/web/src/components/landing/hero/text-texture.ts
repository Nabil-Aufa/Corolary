import { CONFIG } from './hero-config';

/** Chrome, Safari 17+ and Firefox 138+ have it; older engines just draw untracked. */
type TrackedContext = CanvasRenderingContext2D & { letterSpacing?: string };

export interface ParagraphTextures {
  /** White glyphs on transparent; only the alpha is read. */
  text: HTMLCanvasElement;
  /** Per-character reading position in the red channel, over the same layout as `text`. */
  order: HTMLCanvasElement;
  charCount: number;
}

/**
 * The heading face as the page resolves it, rather than a name repeated here
 * that a font change would leave behind. Nothing is drawn until the face has
 * actually loaded: a texture is baked once, so drawing early would freeze the
 * fallback font into the scene with no reflow to correct it.
 */
async function displayFamily(weight: number): Promise<string> {
  const probe = document.createElement('span');
  probe.className = 'font-display';
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();

  try {
    // Pulls in the weight this actually draws at; fonts.ready then waits for
    // everything else the page has already asked for.
    await document.fonts.load(`${weight} 100px ${family}`);
  } catch {
    // A family string the Font Loading API will not parse is not a reason to
    // render nothing; fonts.ready below still covers the common case.
  }
  await document.fonts.ready;
  return family;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D is unavailable');
  return [canvas, ctx];
}

const textureScale = (dpr: number) => (dpr > CONFIG.text.hiDprAbove ? 2 : 1);

/**
 * "What this is", drawn once into a canvas and uploaded as a texture, so the
 * title lives inside the scene — taking its fog and its depth of field, and
 * passed in front of by the coins nearer the camera — rather than floating over
 * it in the DOM.
 */
export async function drawTitleTexture(dpr: number): Promise<HTMLCanvasElement> {
  const { content, textureWidth, textureHeight, padding, weight } = CONFIG.text.title;
  const scale = textureScale(dpr);
  const width = textureWidth * scale;
  const height = textureHeight * scale;
  const family = await displayFamily(weight);

  const [canvas, ctx] = makeCanvas(width, height);

  // Fit the line to the texture by measuring it. The display face is a webfont
  // whose metrics are not known here, and a guess that overflows would clip the
  // title in a way nothing downstream could recover from.
  const maxWidth = width * (1 - padding * 2);
  let fontSize = height * 0.78;
  ctx.font = `${weight} ${fontSize}px ${family}`;
  const measured = ctx.measureText(content).width;
  if (measured > maxWidth) {
    fontSize *= maxWidth / measured;
    ctx.font = `${weight} ${fontSize}px ${family}`;
  }

  // −0.02em, the tracking of --text-mkt-h2. Applied after the fit: negative
  // tracking only ever makes the line narrower.
  const tracked = ctx as TrackedContext;
  if (typeof tracked.letterSpacing === 'string') {
    tracked.letterSpacing = `${(-0.02 * fontSize).toFixed(2)}px`;
  }

  ctx.fillStyle = CONFIG.text.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(content, width / 2, height / 2);

  return canvas;
}

/** Greedy wrap on measured width; the face's real metrics, not a character count. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/**
 * The paragraph, as two textures over one layout.
 *
 * The first is the glyphs. The second is the reveal order: one flat value per
 * character, its reading position from 0 to 1, painted into the red channel
 * over exactly the box that character occupies. The shader compares that
 * against the scroll-driven wipe, which is what lets the reveal run character
 * by character and reverse when the scroll does — without the scene having to
 * know anything about where the characters are.
 *
 * Character boxes are taken from cumulative `measureText` of the line prefix
 * rather than per-character widths, so kerning is included and the boxes line
 * up with where `fillText` actually puts the glyphs.
 */
export async function drawParagraphTextures(dpr: number): Promise<ParagraphTextures> {
  const { content, textureWidth, textureHeight, padding, weight, maxLines, lineHeight } = CONFIG.text.paragraph;
  const scale = textureScale(dpr);
  const width = textureWidth * scale;
  const height = textureHeight * scale;
  const family = await displayFamily(weight);

  const [text, tc] = makeCanvas(width, height);
  const [order, oc] = makeCanvas(width, height);

  const maxWidth = width * (1 - padding * 2);
  const maxHeight = height * (1 - padding * 2);

  // Shrink until the wrap fits both the line budget and the texture. Measured,
  // not guessed, for the same reason as the title.
  let fontSize = height * 0.3;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 48; attempt++) {
    tc.font = `${weight} ${fontSize}px ${family}`;
    lines = wrapLines(tc, content, maxWidth);
    if (lines.length <= maxLines && lines.length * fontSize * lineHeight <= maxHeight) break;
    fontSize *= 0.94;
  }

  const step = fontSize * lineHeight;
  const top = (height - lines.length * step) / 2;
  const charCount = lines.reduce((total, line) => total + line.length, 0);

  tc.font = `${weight} ${fontSize}px ${family}`;
  tc.fillStyle = CONFIG.text.color;
  tc.textAlign = 'left';
  tc.textBaseline = 'middle';

  oc.fillStyle = '#000000';
  oc.fillRect(0, 0, width, height);

  let index = 0;
  lines.forEach((line, row) => {
    const lineWidth = tc.measureText(line).width;
    const x0 = (width - lineWidth) / 2;
    const lineTop = top + row * step;
    tc.fillText(line, x0, lineTop + step / 2);

    let pen = 0;
    for (let i = 0; i < line.length; i++) {
      const upTo = tc.measureText(line.slice(0, i + 1)).width;
      const value = Math.round((((index + 0.5) / charCount) * 255));
      oc.fillStyle = `rgb(${value}, 0, 0)`;
      // One px of overlap, so rounding cannot leave an unpainted seam between
      // two characters — a seam would read as a character that never lights up.
      oc.fillRect(x0 + pen, lineTop, upTo - pen + 1, step);
      pen = upTo;
      index++;
    }
  });

  return { text, order, charCount };
}
