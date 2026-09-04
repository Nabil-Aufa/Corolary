'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isAddress } from 'viem';
import { ArrowRight } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/hooks/useIsMounted';
import { shortenAddress } from '@/lib/format';

const RECENT_KEY = 'corolary.recent-addresses';

/** Preferensi UI lokal, bukan data produk — karena itu localStorage boleh.
 *  Dibaca saat render (murah, tanpa efek samping) alih-alih lewat useEffect,
 *  supaya tidak ada render kedua dan tidak ada mismatch hydration. */
function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw === null ? [] : (JSON.parse(raw) as string[]);
  } catch {
    return [];
  }
}

export default function ScoreEntryPage() {
  const router = useRouter();
  const { address: connected } = useAccount();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mounted = useIsMounted();
  const recent = mounted ? readRecent() : [];

  function submit(raw: string) {
    const candidate = raw.trim();
    // Divalidasi di klien lebih dulu supaya alamat cacat tidak pernah jadi
    // request sia-sia — API tetap sumber kebenaran, ini hanya menghemat bolak-balik.
    if (!isAddress(candidate)) {
      setError('Enter a valid Ethereum address (0x + 40 hex characters).');
      return;
    }
    try {
      const next = [candidate, ...recent.filter((a) => a !== candidate)].slice(0, 5);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* diabaikan dengan sengaja */
    }
    router.push(`/score/${candidate}`);
  }

  return (
    <main className="mx-auto flex max-w-[640px] flex-col px-6 py-24 md:px-8">
      <h1 className="text-h1 font-semibold tracking-tight text-ink-900">Look up a proven score</h1>
      <p className="mt-2 text-body text-ink-500">
        Any Ethereum address. Scores are derived only from lending activity that has been
        cryptographically proven. Nothing is estimated.
      </p>

      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <label htmlFor="address" className="sr-only">
          Ethereum address
        </label>
        <input
          id="address"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={error !== null ? 'address-error' : undefined}
          className="num h-12 flex-1 rounded-[var(--radius-base)] border border-border bg-surface px-4 text-body text-ink-900 placeholder:text-ink-400"
        />
        <Button type="submit" size="lg">
          Check <ArrowRight size={16} strokeWidth={1.5} />
        </Button>
      </form>

      {error !== null && (
        <p id="address-error" className="mt-2 text-small text-danger">
          {error}
        </p>
      )}

      {connected !== undefined && (
        <Button
          variant="secondary"
          className="mt-4 self-start"
          onClick={() => router.push(`/score/${connected}`)}
        >
          Use my connected wallet · <span className="num">{shortenAddress(connected)}</span>
        </Button>
      )}

      {recent.length > 0 && (
        <div className="mt-10">
          <p className="text-micro uppercase tracking-wide text-ink-400">Recently checked</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recent.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => router.push(`/score/${a}`)}
                className="num rounded-[var(--radius-base)] border border-border px-3 py-1.5 text-small text-ink-700 transition-colors hover:border-border-strong hover:text-ink-900"
              >
                {shortenAddress(a)}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
