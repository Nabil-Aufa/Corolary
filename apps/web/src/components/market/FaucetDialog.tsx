'use client';

import { useCallback, useState } from 'react';
import { Check, Droplet } from 'lucide-react';
import { useAccount, useConfig, useReadContracts } from 'wagmi';
import { waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { FaucetTokenAbi } from '@corolary/shared/abis';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose } from '@/components/ui/dialog';
import { useNow } from '@/hooks/useNow';
import { useWrongNetwork } from '@/hooks/useWrongNetwork';
import { decodeTxError } from '@/lib/contract-errors';
import { formatDuration, formatTokenAmount } from '@/lib/format';
import type { Address, Reserve } from '@/types';

const TITLE_ID = 'faucet-title';

/**
 * Mengambil token testnet untuk pasar.
 *
 * Ada karena tanpa ini alur produk berhenti sebelum bagian yang menjelaskannya:
 * pengunjung dengan dompet kosong tidak bisa menyetor kolateral, jadi tidak bisa
 * meminjam, jadi tidak pernah melihat rasio yang diturunkan skornya. `claim()`
 * memang terbuka untuk siapa pun di `FaucetToken` — yang belum ada hanyalah
 * jalannya dari UI.
 *
 * Pengungkapan token testnet diulang di sini, bukan hanya di dialog transaksi.
 * Ini titik pertama seseorang MEMILIKI token itu, dan salah paham soal apa yang
 * palsu paling murah diperbaiki sebelum ia punya, bukan sesudah.
 */
export function FaucetDialog({
  open,
  onClose,
  reserves,
}: {
  open: boolean;
  onClose: () => void;
  reserves: Reserve[];
}) {
  const { address } = useAccount();
  const { isWrong } = useWrongNetwork();
  const config = useConfig();
  const [busy, setBusy] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Set<Address>>(new Set());

  // Hitung mundur cooldown butuh waktu yang benar-benar berjalan; `0` berarti
  // belum terukur, dan selama itu tidak ada tombol yang ditandai cooling supaya
  // cat pertama tidak salah menonaktifkan semuanya.
  const now = useNow();

  // Saldo dan waktu klaim terakhir dibaca sekaligus: satu multicall untuk
  // seluruh tabel, bukan dua panggilan per token.
  const reads = useReadContracts({
    contracts: reserves.flatMap((r) => [
      { address: r.asset, abi: FaucetTokenAbi, functionName: 'balanceOf', args: [address] },
      { address: r.asset, abi: FaucetTokenAbi, functionName: 'lastClaimAt', args: [address] },
      { address: r.asset, abi: FaucetTokenAbi, functionName: 'CLAIM_AMOUNT' },
    ]),
    query: { enabled: address !== undefined && open },
  });

  const claim = useCallback(
    async (asset: Address) => {
      setBusy(asset);
      setError(null);
      try {
        const hash = await writeContract(config, {
          address: asset,
          abi: FaucetTokenAbi,
          functionName: 'claim',
        });
        await waitForTransactionReceipt(config, { hash });
        // Dibaca ulang dari chain, bukan ditambahkan sendiri ke saldo lokal:
        // `CLAIM_AMOUNT` bisa saja bukan satu-satunya hal yang berubah, dan
        // menebak saldo adalah cara termurah membuat angka yang salah.
        await reads.refetch();
        setClaimed((prev) => new Set(prev).add(asset));
      } catch (err) {
        setError(decodeTxError(err).message);
      } finally {
        setBusy(null);
      }
    },
    [config, reads],
  );

  return (
    <Dialog open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <div className="relative flex h-12 items-center px-4">
        <h2
          id={TITLE_ID}
          className="pointer-events-none absolute inset-x-0 text-center text-body font-semibold text-ink-900"
        >
          Get testnet tokens
        </h2>
        <DialogClose onClose={onClose} />
      </div>

      <div className="dialog-view px-6 pb-6">
        <p className="text-small text-ink-500">
          Both tokens are claimable by anyone, once per hour, straight from the contract.
        </p>

        <ul className="mt-5 space-y-2">
          {reserves.map((r, i) => {
            const balance = reads.data?.[i * 3]?.result as bigint | undefined;
            const lastClaim = reads.data?.[i * 3 + 1]?.result as bigint | undefined;
            const amount = reads.data?.[i * 3 + 2]?.result as bigint | undefined;

            const readyAt = lastClaim === undefined || lastClaim === 0n ? 0 : Number(lastClaim) + 3600;
            const waitSeconds = now === 0 ? 0 : Math.max(0, readyAt - now);
            const cooling = waitSeconds > 0;

            return (
              <li
                key={r.asset}
                className="flex items-center gap-3 rounded-[var(--radius-base)] bg-bg px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-ink-900">{r.symbol}</p>
                  <p className="num text-micro text-ink-400">
                    {balance === undefined
                      ? 'balance unknown'
                      : `balance ${formatTokenAmount(balance.toString(), r.decimals)}`}
                    {amount !== undefined &&
                      ` · claims ${formatTokenAmount(amount.toString(), r.decimals)}`}
                  </p>
                </div>

                {claimed.has(r.asset) && !cooling ? (
                  <span className="flex items-center gap-1.5 text-small text-verified">
                    <Check size={15} strokeWidth={2} />
                    Claimed
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={address === undefined || isWrong || cooling || busy !== null}
                    onClick={() => void claim(r.asset)}
                  >
                    {busy === r.asset
                      ? 'Claiming…'
                      : cooling
                        ? `in ${formatDuration(waitSeconds)}`
                        : 'Claim'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {address === undefined && (
          <p className="mt-4 text-small text-ink-500">Connect a wallet to claim.</p>
        )}
        {isWrong && (
          <p className="mt-4 text-small text-warning">Switch to Creditcoin CC3 Testnet first.</p>
        )}
        {error !== null && (
          <p className="mt-4 text-small text-danger" role="alert">
            {error}
          </p>
        )}

        <p className="mt-5 text-micro leading-relaxed text-ink-400">
          These are testnet ERC-20s with no value. What is real is everything they are measured
          against: the credit history, the Chainlink prices, and the scores, all proven from
          Ethereum mainnet.
        </p>
      </div>
    </Dialog>
  );
}

export function FaucetButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      <Droplet size={15} strokeWidth={1.75} />
      Get testnet tokens
    </Button>
  );
}
