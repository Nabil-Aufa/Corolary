'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { CorolaryLogo } from '@/components/brand/CorolaryLogo';
import { getLenis } from '@/lib/lenis-store';
import { appHref } from '@/lib/hosts';
import { cn } from '@/lib/utils';

/**
 * Sections the navbar links to, in page order. Each `id` is set on the root
 * element of that section's component; renaming one here without renaming it
 * there turns the link into a dead hash with no error.
 */
const SECTIONS = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'proof', label: 'Proof' },
  { id: 'registry', label: 'Registry' },
  { id: 'faq', label: 'FAQ' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Landing navbar. Styles live in `styles/marketing-navbar.css`; sizes there are
 * fluid against a 1600px design width.
 *
 * The bar never hides. It used to duck out of the way while scrolling down,
 * which was the old answer to a light bar sitting on dark panels; the answer
 * now is that the bar takes the tone of whatever is behind it.
 *
 * Behind it means behind it, not near it: a one pixel sample line across the
 * middle of the bar, and whichever `[data-nav]` section crosses that line owns
 * the tone. A section's own bounds would hand over at its edge, which is up to
 * a bar's height away from where the eye sees the change.
 *
 * The hero is the one section whose tone is not fixed — its black frame grows
 * out of a light page — so it rewrites its own `data-nav` as the frame opens,
 * and a MutationObserver picks that up. An IntersectionObserver alone cannot:
 * nothing is entering or leaving the line while the hero is pinned.
 */
export function MarketingHeader() {
  const strip = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [atTop, setAtTop] = useState(true);
  const [tone, setTone] = useState<'light' | 'dark'>('light');
  const [active, setActive] = useState<SectionId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Only the very top is special now: there the bar keeps the page showing
  // through it, so the hero's first screen is not cut off by a band of colour.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setAtTop(window.scrollY <= 0);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  // Tone of whatever the bar is sitting on.
  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>('[data-nav]')];
    if (sections.length === 0) return;

    const barHeight = strip.current?.offsetHeight ?? 0;
    const mid = barHeight / 2;
    let behind: HTMLElement | null = null;

    const read = () => setTone(behind?.dataset.nav === 'dark' ? 'dark' : 'light');

    const crossing = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) crossing.add(el);
          else crossing.delete(el);
        }
        // Last in document order wins: sections overlap by a curtain radius,
        // and the one that comes later is the one drawn on top.
        behind = sections.filter((el) => crossing.has(el)).at(-1) ?? null;
        read();
      },
      // A 1px band across the middle of the bar. Collapsing the viewport to
      // that line is what makes "behind the bar" mean the pixels under it.
      { rootMargin: `-${mid}px 0px -${window.innerHeight - mid - 1}px 0px` },
    );
    for (const el of sections) observer.observe(el);

    // The hero rewrites its own tone while pinned, with no intersection change
    // to announce it.
    const mutations = new MutationObserver(read);
    for (const el of sections) mutations.observe(el, { attributeFilter: ['data-nav'] });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  useEffect(() => {
    const inView = new Set<string>();

    // A 1%-tall band just above the middle of the viewport: a section is active
    // while it crosses that line, so exactly one is active at a time and the
    // underline hands over at the moment a section takes over the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inView.add(entry.target.id);
          else inView.delete(entry.target.id);
        }
        const current = SECTIONS.filter((s) => inView.has(s.id)).at(-1);
        setActive(current === undefined ? null : current.id);
      },
      { rootMargin: '-40% 0px -59% 0px' },
    );

    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el !== null) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    // Rotating a tablet past 768px hides the menu button; a menu left open
    // would then have no visible way to close it.
    const wide = window.matchMedia('(width >= 768px)');
    const onWide = () => {
      if (wide.matches) setMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    wide.addEventListener('change', onWide);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      wide.removeEventListener('change', onWide);
    };
  }, [menuOpen]);

  function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: SectionId) {
    const target = document.getElementById(id);
    // Without the section the plain hash link is the better fallback.
    if (target === null) return;

    event.preventDefault();
    setMenuOpen(false);

    const offset = -(strip.current?.offsetHeight ?? 0);
    const lenis = getLenis();
    if (lenis !== null) {
      lenis.scrollTo(target, { offset });
    } else {
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY + offset,
        behavior: window.matchMedia(REDUCED_MOTION).matches ? 'auto' : 'smooth',
      });
    }
    window.history.replaceState(null, '', `#${id}`);
  }

  return (
    <header
      className={cn(
        'navbar',
        `is-${tone}`,
        atTop && !menuOpen && 'is-top',
        menuOpen && 'is-menu-open',
      )}
    >
      <div className="navbar-fill" aria-hidden="true" />

      <div ref={strip} className="navbar-strip">
        <div className="navbar-container">
          <div className="navbar-grid">
            <Link href="/" className="navbar-logo">
              <CorolaryLogo />
              <span className="navbar-logo-word">Corolary</span>
            </Link>

            <div className="navbar-right">
              <nav aria-label="Sections" className="navbar-links">
                {SECTIONS.map((section) => (
                  // aria-label because the roll's duplicate label comes from
                  // `::after { content: attr(data-text) }`, and Chrome folds
                  // generated content into the accessible name: without it a
                  // screen reader announces "Proof Proof".
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    aria-label={section.label}
                    aria-current={active === section.id ? 'location' : undefined}
                    onClick={(event) => scrollToSection(event, section.id)}
                    className={cn('nav-link', active === section.id && 'is-active')}
                  >
                    <span className="nav-title">
                      <span data-text={section.label}>{section.label}</span>
                    </span>
                  </a>
                ))}
              </nav>

              <LaunchAppButton />
            </div>

            <button
              type="button"
              className="navbar-burger"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X size={22} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Menu size={22} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div id={menuId} className="navbar-menu">
        <nav aria-label="Sections">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active === section.id ? 'location' : undefined}
              onClick={(event) => scrollToSection(event, section.id)}
              className={cn('navbar-menu-link', active === section.id && 'is-active')}
            >
              {section.label}
            </a>
          ))}
        </nav>
        <LaunchAppButton />
      </div>
    </header>
  );
}

/**
 * A plain <a>, not next/link: the app is served on its own host
 * (src/lib/hosts.ts), and next/link assumes same-origin navigation.
 */
function LaunchAppButton() {
  return (
    <a href={appHref('/proofs')} aria-label="Launch App" className="btn-cta">
      <span className="btn-ripple" aria-hidden="true">
        <span />
      </span>
      <span className="btn-title">
        <span data-text="Launch App">Launch App</span>
      </span>
    </a>
  );
}
