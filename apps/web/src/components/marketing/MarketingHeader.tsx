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
 * Scroll behaviour: transparent at the very top, hidden while scrolling down,
 * back with a blurred background as soon as the visitor scrolls up. Hiding on
 * the way down is what makes a light navbar workable on this page at all — half
 * of it is dark panels, and a bar that stayed put would sit unreadable on top
 * of them.
 */
export function MarketingHeader() {
  const strip = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [isFixed, setIsFixed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [active, setActive] = useState<SectionId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const barHeight = strip.current?.offsetHeight ?? 0;

      if (y <= 0) {
        setIsFixed(false);
        setIsVisible(false);
      } else if (y > lastY) {
        if (y > barHeight) {
          setIsFixed(true);
          setIsVisible(false);
        }
      } else if (y < lastY) {
        setIsVisible(true);
      }
      lastY = y;
    };

    // Lenis drives the page through window.scrollTo, so native scroll events
    // still fire. rAF coalesces them to one update per frame.
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    // A reload restores the scroll position mid-page. Treat that like scrolling
    // up, or the bar would float transparent over whatever section is there.
    const initial = requestAnimationFrame(() => {
      if (window.scrollY > 0) setIsVisible(true);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(initial);
      if (frame !== 0) cancelAnimationFrame(frame);
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
        isFixed && 'is-fixed',
        isVisible && 'is-visible',
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
