'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, RotateCw, Wallet } from 'lucide-react';
import { useAccount, useConnect, useConnectors, type Connector } from 'wagmi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose } from '@/components/ui/dialog';

const TITLE_ID = 'connect-wallet-title';

/**
 * Hanya wallet yang BENAR-BENAR ada di browser pengguna yang ditawarkan.
 *
 * wagmi menemukannya lewat EIP-6963, lengkap dengan nama dan ikon resmi tiap
 * wallet. Menawarkan wallet yang tidak terpasang berarti menampilkan tombol
 * yang tidak bisa berbuat apa-apa — "fitur yang tidak berfungsi" yang dilarang
 * aturan nol-mock.
 *
 * Konektor `injected` generik disembunyikan begitu ada hasil EIP-6963, karena
 * keduanya menunjuk wallet yang sama dan akan tampil dobel.
 */
function useDetectedWallets(): Connector[] {
  const connectors = useConnectors();
  return useMemo(() => {
    const discovered = connectors.filter((c) => c.id !== 'injected');
    const list = discovered.length > 0 ? discovered : connectors;
    const seen = new Set<string>();
    return list.filter((c) => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [connectors]);
}

function WalletMark({ connector, size = 28 }: { connector: Connector; size?: number }) {
  if (connector.icon === undefined) {
    return (
      <span
        className="flex items-center justify-center rounded-[var(--radius-base)] bg-surface text-ink-500"
        style={{ width: size, height: size }}
      >
        <Wallet size={size * 0.55} strokeWidth={1.5} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URI dari wallet, bukan aset kita
    <img
      src={connector.icon}
      alt=""
      width={size}
      height={size}
      className="rounded-[var(--radius-base)]"
    />
  );
}

/** Cincin biru yang berjalan mengelilingi logo wallet selagi menunggu. */
function ConnectingMark({ connector }: { connector: Connector }) {
  return (
    <div className="relative mx-auto flex h-[92px] w-[92px] items-center justify-center">
      <svg viewBox="0 0 92 92" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect
          x="3"
          y="3"
          width="86"
          height="86"
          rx="26"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="26 74"
          className="ring-travel"
        />
      </svg>
      <WalletMark connector={connector} size={56} />
    </div>
  );
}

export function WalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const wallets = useDetectedWallets();
  const { connector: active, isConnected } = useAccount();
  const { connect, error, reset } = useConnect();
  const [pendingWallet, setPendingWallet] = useState<Connector | null>(null);

  // Modal yang ditutup lalu dibuka lagi harus mulai dari daftar, bukan dari
  // percobaan koneksi yang sudah ditinggalkan. Dibereskan di jalur penutupan
  // itu sendiri — bukan lewat useEffect yang mengintai `open`, yang berarti
  // satu render tambahan dan state yang menyusul belakangan.
  function handleClose() {
    setPendingWallet(null);
    reset();
    onClose();
  }

  function attempt(c: Connector) {
    setPendingWallet(c);
    reset();
    connect({ connector: c }, { onSuccess: handleClose });
  }

  function backToList() {
    setPendingWallet(null);
    reset();
  }

  return (
    <Dialog open={open} onClose={handleClose} labelledBy={TITLE_ID}>
      <div className="relative flex h-12 items-center px-4">
        {pendingWallet !== null && (
          <button
            type="button"
            onClick={backToList}
            aria-label="Back to wallet list"
            className="rounded-full p-1 text-ink-400 transition-colors hover:bg-bg hover:text-ink-900"
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
        )}
        <h2
          id={TITLE_ID}
          className="pointer-events-none absolute inset-x-0 text-center text-body font-semibold text-ink-900"
        >
          {pendingWallet?.name ?? 'Connect wallet'}
        </h2>
        <DialogClose onClose={handleClose} />
      </div>

      {pendingWallet !== null ? (
        // Layar kedua: satu tugas, satu pesan. Semua yang tidak membantu
        // pengguna menyelesaikan persetujuan di wallet-nya dihilangkan.
        <div key="connecting" className="dialog-view px-6 pb-8 pt-4 text-center">
          <ConnectingMark connector={pendingWallet} />

          <p className="mt-6 text-h3 font-semibold text-ink-900">
            Continue in {pendingWallet.name}
          </p>
          <p className="mt-1 text-small text-ink-500">
            {error === null
              ? 'Accept the connection request in your wallet'
              : 'The request was rejected or timed out'}
          </p>

          <Button variant="secondary" className="mt-5" onClick={() => attempt(pendingWallet)}>
            <RotateCw size={15} strokeWidth={1.75} />
            Try again
          </Button>
        </div>
      ) : (
        <div key="list" className="dialog-view px-6 pb-6 pt-1">
          <p className="mx-auto max-w-[22rem] text-center text-small text-ink-500">
            Connecting is only needed to supply, borrow, or repay. Reading proofs and scores never
            asks for a signature.
          </p>

          {wallets.length > 0 ? (
            <>
              <p className="mt-6 text-micro uppercase tracking-wide text-ink-400">Detected</p>
              <ul className="mt-2 space-y-1.5">
                {wallets.map((c) => {
                  const isActive = isConnected && active?.uid === c.uid;
                  return (
                    <li key={c.uid}>
                      <button
                        type="button"
                        onClick={() => attempt(c)}
                        className="flex w-full items-center gap-3 rounded-[var(--radius-base)] bg-bg px-3 py-3 text-left transition-colors hover:bg-accent-soft"
                      >
                        <WalletMark connector={c} />
                        <span className="flex-1 text-body font-medium text-ink-900">{c.name}</span>
                        {isActive ? <Badge tone="verified">Connected</Badge> : <Badge>Detected</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="mt-6 rounded-[var(--radius-base)] bg-bg px-4 py-6 text-center">
              <p className="text-body text-ink-900">No wallet detected</p>
              <p className="mt-1 text-small text-ink-500">
                Install a browser wallet, then reopen this dialog.
              </p>
            </div>
          )}

          <a
            href="https://ethereum.org/en/wallets/find-wallet/"
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex items-center justify-center gap-1.5 text-small font-medium text-accent hover:underline"
          >
            I don&apos;t have a wallet <ExternalLink size={13} strokeWidth={1.5} />
          </a>
        </div>
      )}
    </Dialog>
  );
}
