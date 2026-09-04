'use client';

import { useCallback, useState } from 'react';
import { useAccount, useConfig } from 'wagmi';
import { readContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { parseUnits } from 'viem';
import { EfficiencyMarketAbi } from '@corolary/shared/abis';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/query-keys';
import { decodeTxError } from '@/lib/contract-errors';
import type { Address, Hex } from '@/types';

/** Enam aksi, berpasangan sesuai ember yang disentuhnya di kontrak. */
export type MarketAction =
  | 'supply'
  | 'withdraw'
  | 'depositCollateral'
  | 'withdrawCollateral'
  | 'borrow'
  | 'repay';

/**
 * Aksi yang MENARIK token dari dompet, jadi butuh allowance lebih dulu.
 *
 * Tiga sisanya mengirim token KE dompet (`withdraw`, `withdrawCollateral`,
 * `borrow`) dan tidak pernah menyentuh `approve`. Membedakannya di satu tempat
 * mencegah dialog meminta persetujuan untuk transaksi yang tidak
 * membutuhkannya — langkah tambahan yang membuat pengguna curiga.
 */
const PULLS_TOKENS: ReadonlySet<MarketAction> = new Set([
  'supply',
  'depositCollateral',
  'repay',
]);

const ERC20_ABI = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

export const MARKET_ADDRESS = process.env.NEXT_PUBLIC_EFFICIENCY_MARKET_ADDRESS as
  | Address
  | undefined;

export type ActionStep =
  | 'idle'
  | 'approving'
  | 'executing'
  | 'done'
  | 'error';

export interface ActionState {
  step: ActionStep;
  /** Hash transaksi aksi utama — bukan approve. Ditampilkan setelah sukses. */
  txHash: Hex | null;
  error: string | null;
  /** Penolakan di dompet tidak digambar sebagai kegagalan sistem. */
  rejected: boolean;
}

const IDLE: ActionState = { step: 'idle', txHash: null, error: null, rejected: false };

export function useMarketAction() {
  const config = useConfig();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ActionState>(IDLE);

  const reset = useCallback(() => setState(IDLE), []);

  const run = useCallback(
    async (action: MarketAction, asset: Address, amount: string, decimals: number) => {
      if (address === undefined || MARKET_ADDRESS === undefined) return;

      let value: bigint;
      try {
        value = parseUnits(amount, decimals);
      } catch {
        setState({ ...IDLE, step: 'error', error: 'That amount is not a valid number.' });
        return;
      }
      if (value === 0n) {
        setState({ ...IDLE, step: 'error', error: 'Enter an amount greater than zero.' });
        return;
      }

      try {
        if (PULLS_TOKENS.has(action)) {
          const allowance = (await readContract(config, {
            address: asset,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, MARKET_ADDRESS],
          })) as bigint;

          // Hanya disetujui sebesar yang dipakai. Approve tak terbatas menghemat
          // satu transaksi dan menyerahkan seluruh saldo token itu kepada
          // kontrak selamanya — pertukaran yang tidak pantas ditawarkan diam-diam
          // di produk yang seluruh pitch-nya soal bukti dan kehati-hatian.
          if (allowance < value) {
            setState({ ...IDLE, step: 'approving' });
            const approveHash = await writeContract(config, {
              address: asset,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [MARKET_ADDRESS, value],
            });
            await waitForTransactionReceipt(config, { hash: approveHash });
          }
        }

        setState({ ...IDLE, step: 'executing' });
        const hash = await writeContract(config, {
          address: MARKET_ADDRESS,
          abi: EfficiencyMarketAbi,
          functionName: action,
          args: [asset, value],
        });
        await waitForTransactionReceipt(config, { hash });

        // Baris posisi, reserve, dan skor semuanya berubah setelah aksi apa pun
        // di sini — rasio kolateral bahkan bisa bergeser lewat `refreshRatio`.
        // Dibatalkan bersama supaya tidak ada satu panel pun yang tertinggal
        // menampilkan keadaan sebelum transaksi.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.positions(address) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.marketReserves() }),
          queryClient.invalidateQueries({ queryKey: queryKeys.marketSummary() }),
          queryClient.invalidateQueries({ queryKey: queryKeys.score(address) }),
        ]);

        setState({ step: 'done', txHash: hash as Hex, error: null, rejected: false });
      } catch (err) {
        const { message, rejected } = decodeTxError(err);
        setState({ step: 'error', txHash: null, error: message, rejected });
      }
    },
    [address, config, queryClient],
  );

  return { state, run, reset };
}
