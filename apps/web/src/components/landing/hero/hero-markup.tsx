import type { ReactNode, Ref } from 'react';
import { Reveal } from '@/components/marketing/Reveal';

/** Hero markup for HeroScroll: the copy above the frame and the frame's DOM placeholder. */

/** The big white title, shared by the animated and static versions. */
export const HERO_TITLE_CLASS =
  'font-display text-mkt-h2 font-medium text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.55)]';

export function HeroCopy({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="pb-6 pt-[clamp(64px,11vw,150px)]">
      <div className="mkt-container text-center">
        <Reveal distance={32}>
          <h1 id="hero-title" className="font-display text-mkt-display font-medium text-ink-900">
            Reputation that
            <br />
            follows from proof
          </h1>
        </Reveal>

        <Reveal delay={0.08} distance={20}>
          {/* Four protocols named: the only part of this sentence a reader
              can check for themselves. */}
          <p className="mx-auto mt-8 max-w-[46ch] text-mkt-lead text-ink-700">
            Lending history from Aave, Morpho, Compound and Spark on Ethereum mainnet, proven
            cryptographically and used to cut required collateral from 150% to 110%.
          </p>
        </Reveal>
      </div>
    </div>
  );
}

export function FramePlaceholder({ ref, children }: { ref?: Ref<HTMLDivElement>; children?: ReactNode }) {
  return (
    <div className="pb-[clamp(48px,6vw,96px)] pt-[clamp(32px,4vw,64px)]">
      <div className="mkt-container">
        {/* Same box as the score card it replaced. The height is explicit
            because that card was sized by its content; the clamp matches its
            measured height at 390, 1140, 1440 and 1920px. */}
        <div
          ref={ref}
          className="relative h-[clamp(423px,calc(318px+13.33vw),519px)] overflow-hidden rounded-card bg-panel"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
