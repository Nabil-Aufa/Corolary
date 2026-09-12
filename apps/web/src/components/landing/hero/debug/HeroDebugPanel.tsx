'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getLenis } from '@/lib/lenis-store';
import { defaultTuning, type HeroTuning } from '../hero-tuning';

const STORAGE_KEY = 'corolary.hero-debug.tuning.v1';

interface ScrollRange {
  start: number;
  end: number;
}

interface HeroDebugPanelProps {
  /** Receives every edit; the render loop reads it on its next frame. */
  onChange: (tuning: HeroTuning) => void;
  /** Pinned scroll range of the hero timeline, or null before it exists. */
  getScrollRange: () => ScrollRange | null;
  /** After a programmatic jump: resets the loop's springs so the jump is not read as a flick. */
  onJump: () => void;
}

/** Test hook on `window.__heroTuning`. */
export interface HeroTuningBridge {
  get(): HeroTuning;
  set(patch: Partial<HeroTuning>): void;
  freeze(progress: number): void;
  unfreeze(): void;
}

type DebugWindow = Window & { __heroTuning?: HeroTuningBridge };

interface Field {
  key: keyof HeroTuning;
  label: string;
  min: number;
  max: number;
  step: number;
}

const GROUPS: readonly { title: string; fields: readonly Field[] }[] = [
  {
    title: 'Camera dolly',
    fields: [
      { key: 'startZ', label: 'startZ', min: -20, max: 40, step: 0.1 },
      { key: 'endZ', label: 'endZ', min: -120, max: 20, step: 0.1 },
      { key: 'endY', label: 'endY (descent)', min: -24, max: 0, step: 0.1 },
    ],
  },
  {
    title: 'Depth',
    fields: [
      { key: 'zSpacing', label: 'z spacing ×', min: 0.3, max: 2.5, step: 0.05 },
      { key: 'focusDist', label: 'focusDist', min: 1, max: 30, step: 0.1 },
      { key: 'focusRange', label: 'focusRange', min: 0.5, max: 20, step: 0.1 },
      { key: 'fogDensity', label: 'fog density', min: 0, max: 0.3, step: 0.001 },
    ],
  },
  {
    title: 'Frame',
    fields: [
      { key: 'bendAmount', label: 'paper bend (× height)', min: 0, max: 0.2, step: 0.002 },
      { key: 'feather', label: 'feather (px)', min: 0, max: 60, step: 0.5 },
      { key: 'innerGlow', label: 'inner glow (px)', min: 0, max: 240, step: 1 },
      { key: 'innerGlowAlpha', label: 'inner glow alpha', min: 0, max: 0.6, step: 0.005 },
    ],
  },
  {
    title: 'Starfield',
    fields: [
      { key: 'starCount', label: 'count', min: 200, max: 6000, step: 50 },
      { key: 'driftSpeed', label: 'driftSpeed (units/s)', min: 0, max: 1, step: 0.01 },
      { key: 'slideSpeed', label: 'slideSpeed (units/s)', min: 0, max: 0.5, step: 0.002 },
      { key: 'starSpan', label: 'span', min: 10, max: 140, step: 1 },
      { key: 'starFade', label: 'fade', min: 0, max: 30, step: 0.5 },
      { key: 'starSizeMin', label: 'sizeMin (px)', min: 0.4, max: 4, step: 0.05 },
      { key: 'starSizeMax', label: 'sizeMax (px)', min: 0.4, max: 6, step: 0.05 },
      { key: 'starTwinkle', label: 'twinkleAmount', min: 0, max: 0.4, step: 0.005 },
      { key: 'starFogDensity', label: 'star fogDensity', min: 0, max: 0.12, step: 0.001 },
    ],
  },
];


function isTuning(value: unknown): value is HeroTuning {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(defaultTuning()).every((key) => typeof record[key] === 'number');
}

function configSnippet(t: HeroTuning): string {
  const n = (v: number) => String(Math.round(v * 10000) / 10000);
  return [
    '// apps/web/src/components/landing/hero/hero-config.ts',
    `camera: { startZ: ${n(t.startZ)}, endZ: ${n(t.endZ)}, endY: ${n(t.endY)} }`,
    `// z spacing ×${n(t.zSpacing)} — scale coins.zGap by this, it is not a CONFIG field`,
    `depth: { focusDist: ${n(t.focusDist)}, focusRange: ${n(t.focusRange)}, fogDensity: ${n(t.fogDensity)} }`,
    `stars: { countDesktop: ${n(t.starCount)}, driftSpeed: ${n(t.driftSpeed)}, slideSpeed: ${n(t.slideSpeed)}, sizeRange: [${n(t.starSizeMin)}, ${n(t.starSizeMax)}], twinkleAmount: ${n(t.starTwinkle)}, fogDensity: ${n(t.starFogDensity)} }`,
    `// span ${n(t.starSpan)} is derived from camera.startZ/endZ + stars.zAhead/zBeyond, not stored`,
    `frame: { bendAmount: ${n(t.bendAmount)}, feather: ${n(t.feather)}, innerGlow: ${n(t.innerGlow)}, innerGlowAlpha: ${n(t.innerGlowAlpha)} }`,
  ].join('\n');
}

/**
 * Development tuning panel for the hero (`?debug=1`). Edits a runtime copy of
 * CONFIG, saved in this browser, and can freeze the timeline at any progress:
 * the page is scrolled to that point of the pin and Lenis is stopped, so the
 * DOM (headline, title) and the canvas stay consistent.
 */
export function HeroDebugPanel({ onChange, getScrollRange, onJump }: HeroDebugPanelProps) {
  const [values, setValues] = useState<HeroTuning>(defaultTuning);
  const [open, setOpen] = useState(true);
  const [frozen, setFrozen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const loaded = useRef(false);
  const latest = useRef(values);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          const parsed: unknown = JSON.parse(raw);
          if (isTuning(parsed)) setValues(parsed);
        }
      } catch {
        // Unreadable storage: start from CONFIG.
      }
      loaded.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    latest.current = values;
    onChange(values);
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // Storage can be unavailable (private mode); the panel still works.
    }
  }, [values, onChange]);

  const jumpTo = useCallback(
    (target: number) => {
      const range = getScrollRange();
      if (range === null) return;
      const y = range.start + (range.end - range.start) * target;
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      requestAnimationFrame(onJump);
    },
    [getScrollRange, onJump],
  );

  useEffect(() => {
    if (!frozen) return;
    const lenis = getLenis();
    lenis?.stop();
    return () => {
      lenis?.start();
    };
  }, [frozen]);

  useEffect(() => {
    if (frozen) jumpTo(progress);
  }, [frozen, progress, jumpTo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key.toLowerCase() === 'p') setOpen((isOpen) => !isOpen);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const debugWindow = window as DebugWindow;
    debugWindow.__heroTuning = {
      get: () => latest.current,
      set: (patch) => setValues((current) => ({ ...current, ...patch })),
      freeze: (target) => {
        setProgress(Math.max(0, Math.min(1, target)));
        setFrozen(true);
      },
      unfreeze: () => setFrozen(false),
    };
    return () => {
      delete debugWindow.__heroTuning;
    };
  }, []);

  const notify = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 1400);
  };

  return (
    <>
      <button
        type="button"
        data-hero-debug="toggle"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="fixed right-3 top-3 z-[210] rounded-md bg-black/80 px-3 py-1.5 font-mono text-xs text-white"
      >
        {open ? 'Hide panel (P)' : 'Show panel (P)'}
      </button>

      {open && (
        <aside
          data-hero-debug="panel"
          className="fixed right-3 top-12 z-[210] max-h-[calc(100vh-60px)] w-[340px] overflow-y-auto rounded-lg bg-[rgba(8,10,16,0.92)] p-4 font-mono text-[11px] leading-relaxed text-white/90 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Hero tuning</p>
            {flash !== null && <span className="text-emerald-400">{flash}</span>}
          </div>

          <Section title="Progress">
            <label className="flex cursor-pointer items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={frozen}
                onChange={(event) => setFrozen(event.target.checked)}
                className="accent-[#5b85ff]"
              />
              <span>Freeze progress (stops scrolling)</span>
            </label>
            <Slider
              label="progress"
              value={progress}
              min={0}
              max={1}
              step={0.001}
              onChange={(next) => {
                setProgress(next);
                setFrozen(true);
              }}
            />
          </Section>

          {GROUPS.map((group) => (
            <Section key={group.title} title={group.title}>
              {group.fields.map((field) => (
                <Slider
                  key={field.key}
                  label={field.label}
                  value={values[field.key]}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={(next) => setValues((current) => ({ ...current, [field.key]: next }))}
                />
              ))}
            </Section>
          ))}

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(configSnippet(values)).then(() => notify('Copied'));
              }}
              className="rounded-md bg-[#1d4fd8] px-3 py-2 text-xs font-semibold text-white"
            >
              Copy CONFIG snippet
            </button>
            <button
              type="button"
              onClick={() => {
                setValues(defaultTuning());
                notify('Reset');
              }}
              className="rounded-md bg-white/10 px-3 py-2 text-xs text-white/80"
            >
              Reset to CONFIG
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3 border-t border-white/10 pt-2">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">{title}</p>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mb-1.5 block">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <input
          type="number"
          value={Number(value.toFixed(4))}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className="w-[76px] rounded bg-white/10 px-1 py-0.5 text-right text-white"
        />
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#5b85ff]"
      />
    </label>
  );
}
