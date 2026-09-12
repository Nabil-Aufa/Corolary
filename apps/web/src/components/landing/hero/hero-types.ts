/**
 * Animated by the GSAP timeline, read by the render loop. The object is never
 * replaced, only mutated in place, so the loop can hold a reference to it.
 */
export interface HeroState {
  zoom: number;
  /** Camera along −Z, through the coins, to the title. */
  fly: number;
  /** Then straight down −Y, from the title to the paragraph. */
  descend: number;
  /** Paragraph reveal, per character. */
  wipe: number;
}

/**
 * The black frame placeholder, measured relative to the pinned section, in CSS
 * px. Measured once per ScrollTrigger refresh (which includes resizes), never
 * per frame: reading layout while the pin is moving is how a frame jumps.
 */
export interface FrameMeasure {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  sectionWidth: number;
  sectionHeight: number;
  /** Placeholder background as 0..1 RGB, used as the scene's clear color. */
  color: readonly [number, number, number];
  /** Page background as 0..1 RGB: the colour the frame's inner glow soaks in. */
  pageColor: readonly [number, number, number];
}

/** What HeroScroll drives on the WebGL layer, from ScrollTrigger callbacks. */
export interface CanvasController {
  /** Section entered or left the viewport. */
  setActive(active: boolean): void;
  /** Layout changed or the scroll jumped: sync canvas and render target to the section, reset springs. */
  refresh(): void;
}
