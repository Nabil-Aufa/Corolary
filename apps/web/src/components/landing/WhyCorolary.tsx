import { Reveal } from '@/components/marketing/Reveal';

interface Pillar {
  title: string;
  body: string;
}

// Tiga sudut yang membedakan pendekatan ini dari "dashboard reputasi" pada
// umumnya. Ditulis sebagai sebab-akibat, bukan daftar fitur lepas.
const PILLARS: Pillar[] = [
  {
    title: 'Proven, not reported',
    body: 'These numbers do not come from our own database. Every fact is verified on-chain through the Attestcoin Block Prover precompile against an Ethereum mainnet transaction that actually settled. Anyone can re-check the same proof independently.',
  },
  {
    title: 'Four protocols, not one',
    body: 'History is read from Aave V3, Morpho Blue, Compound and SparkLend. A reputation built on a single protocol is shallow and easy to game; one that has to hold across four is far more expensive to fake.',
  },
  {
    title: 'Still over-collateralized',
    body: 'This is not unsecured lending. Every loan stays over-collateralized — a proven borrower just locks up meaningfully less capital, from 150% down to 110%. That is why the protocol stays solvent without identity or legal recourse.',
  },
];

interface Limit {
  title: string;
  body: string;
}

// Batasan nyata, dinyatakan terbuka. Diakui di sini alih-alih dibiarkan
// ditemukan sendiri oleh juri atau pengguna.
const LIMITS: Limit[] = [
  {
    title: 'Testnet market tokens',
    body: 'Market tokens are testnet ERC-20s; the credit history, prices, and score behind them come from real, proven mainnet activity.',
  },
  {
    title: 'One direction only',
    body: 'Attestcoin reads Ethereum from Creditcoin. Writing back to Ethereum is not live yet, so nothing here is designed to need it.',
  },
  {
    title: 'Attestation takes time',
    body: 'A new transaction can only be proven once attestors reach consensus on it, roughly eight minutes. No score updates instantly.',
  },
];

/**
 * Bagian "kenapa berbeda" di atas latar halaman terang.
 *
 * Grid tiga pilar diikuti satu baris batasan yang diakui terbuka — urutan ini
 * disengaja: klaim baru terasa dipercaya setelah batasannya sendiri sudah
 * dinyatakan lebih dulu, bukan disembunyikan di bagian lain halaman.
 */
export function WhyCorolary() {
  return (
    <section className="py-[clamp(80px,10vw,160px)]">
      <div className="mkt-container">
        <Reveal>
          <h2 className="font-display font-medium text-mkt-h2 text-ink-900">
            Why this is different
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-3 md:gap-y-0">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 0.08}>
              <span className="num text-micro text-ink-400">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 text-mkt-h3 text-ink-900">{pillar.title}</h3>
              <p className="mt-4 max-w-[42ch] text-body text-ink-700">{pillar.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.24}>
          <div className="mt-[clamp(48px,6vw,96px)] flex flex-wrap gap-x-12 gap-y-6 border-t border-border pt-10">
            {LIMITS.map((limit) => (
              <div key={limit.title}>
                <h4 className="text-small font-medium text-ink-900">{limit.title}</h4>
                <p className="mt-1 max-w-[32ch] text-small text-ink-500">{limit.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
