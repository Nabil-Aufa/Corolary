'use client';

import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { AlertTriangle, Wallet } from 'lucide-react';
import { creditcoinTestnet } from '@corolary/shared/chains';
import { WalletAvatar } from '@/components/shared/WalletAvatar';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { useIsMounted } from '@/hooks/useIsMounted';
import { useWrongNetwork } from '@/hooks/useWrongNetwork';
import { shortenAddress } from '@/lib/format';
import { WalletDialog } from './WalletDialog';
import { WalletMenu } from './WalletMenu';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { isWrong } = useWrongNetwork();
  const { disconnect } = useDisconnect();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // wagmi memulihkan koneksi setelah hydration, jadi status di server selalu
  // "belum connect". Merendernya langsung akan berkedip dari Connect ke alamat.
  const mounted = useIsMounted();

  if (!mounted) return <div className="h-10 w-[132px]" />;

  /**
   * Memutus koneksi mengembalikan tombol ke keadaan "Connect" dan berhenti di
   * sana. Dialog pemilih wallet ikut ditutup secara eksplisit: kalau tidak,
   * `dialogOpen` yang masih `true` dari sesi sebelumnya akan membuat pemilih
   * wallet muncul sendiri begitu komponen kembali ke cabang belum-tersambung —
   * memaksa pengguna menutupnya, padahal yang ia minta justru keluar.
   */
  function handleDisconnect() {
    disconnect();
    setMenuOpen(false);
    setDialogOpen(false);
  }

  if (isConnected && address !== undefined) {
    return (
      <div className="relative flex items-center gap-1.5">
        {/* Peringatan jaringan hidup DI SINI, bukan sebagai spanduk selebar
            halaman. Spanduk itu mendorong seluruh konten ke bawah setiap kali
            muncul, dan berteriak lebih keras daripada kepentingannya —
            pengguna yang cuma membaca bukti tidak butuh jaringan yang benar. */}
        {isWrong && (
          <Tooltip
            content={
              <>
                <p className="font-medium text-ink-900">Wrong network</p>
                <p className="mt-1">
                  Your wallet is connected to a different chain. Reading proofs and scores still
                  works — supplying, borrowing, and repaying do not.
                </p>
                <p className="mt-2 text-ink-500">
                  Corolary runs on {creditcoinTestnet.name}{' '}
                  <span className="num">(chainId {creditcoinTestnet.id})</span>.
                </p>
              </>
            }
          >
            <span
              tabIndex={0}
              role="button"
              aria-label="Network warning"
              className="rounded-[var(--radius-sm)] p-1 text-warning"
            >
              <AlertTriangle size={16} strokeWidth={2} />
            </span>
          </Tooltip>
        )}

        <button
          type="button"
          data-popover-trigger
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          className="flex h-10 items-center gap-2 rounded-[var(--radius-base)] border border-border bg-surface px-3 transition-colors hover:border-border-strong"
        >
          <WalletAvatar address={address} size={20} />
          <span className="num text-small font-medium text-ink-900">
            {shortenAddress(address)}
          </span>
        </button>

        <Popover open={menuOpen} onClose={() => setMenuOpen(false)}>
          <WalletMenu
            address={address}
            isWrongNetwork={isWrong}
            onDisconnect={handleDisconnect}
          />
        </Popover>
      </div>
    );
  }

  return (
    <>
      <Button variant="brand" onClick={() => setDialogOpen(true)}>
        <Wallet size={16} strokeWidth={1.5} />
        Connect
      </Button>
      <WalletDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
