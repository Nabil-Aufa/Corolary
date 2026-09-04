'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ExternalLink } from 'lucide-react';
import { parseUnits } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { BASELINE_COLLATERAL_RATIO_BPS } from '@corolary/shared';
import { AmountField } from '@/components/market/AmountField';
import { HealthFactorBar } from '@/components/market/HealthFactorBar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose } from '@/components/ui/dialog';
import { Segments } from '@/components/ui/segments';
import { useMarketAction, MARKET_ADDRESS, type MarketAction } from '@/hooks/useMarketAction';
import { useWrongNetwork } from '@/hooks/useWrongNetwork';
import { creditcoinTx } from '@/lib/explorer';
import { formatBps, formatRatio, formatTokenAmount, formatUsd } from '@/lib/format';
import type { AccountPositions, Address, PositionEntry, Reserve } from '@/types';

const TITLE_ID = 'market-action-title';

/**
 * Enam aksi, tiga pasang — dan pasangannya mengikuti EMBER di kontrak, bukan
 * arah uangnya.
 *
 * `supply`/`withdraw` menyentuh saldo pemberi pinjaman yang berbunga;
 * `depositCollateral`/`withdrawCollateral` menyentuh kolateral yang menopang
 * utang. Keduanya terlihat seperti "menyetor token" dari luar, dan justru itu
 * bahayanya: menyetor lewat `supply` lalu mencoba `borrow` akan gagal karena
 * kolateralnya nol. Memisahkan keduanya di UI adalah satu-satunya cara
 * pembedaan itu sampai ke pengguna sebelum ia menandatangani.
 */
const PAIRS = {
  lend: [
    { value: 'supply', label: 'Supply' },
    { value: 'withdraw', label: 'Withdraw' },
  ],
  collateral: [
    { value: 'depositCollateral', label: 'Add' },
    { value: 'withdrawCollateral', label: 'Remove' },
  ],
  debt: [
    { value: 'borrow', label: 'Borrow' },
    { value: 'repay', label: 'Repay' },
  ],
} as const satisfies Record<string, readonly { value: MarketAction; label: string }[]>;

export type ActionGroup = keyof typeof PAIRS;

const GROUP_LABEL: Record<ActionGroup, string> = {
  lend: 'Lend',
  collateral: 'Collateral',
  debt: 'Borrow',
};

const VERB: Record<MarketAction, string> = {
  supply: 'Supply',
  withdraw: 'Withdraw',
  depositCollateral: 'Add collateral',
  withdrawCollateral: 'Remove collateral',
  borrow: 'Borrow',
  repay: 'Repay',
};

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export function MarketActionDialog({
  open,
  onClose,
  reserve,
  group,
  account,
}: {
  open: boolean;
  onClose: () => void;
  reserve: Reserve;
  group: ActionGroup;
  account: AccountPositions | undefined;
}) {
  const { address } = useAccount();
  const { isWrong } = useWrongNetwork();
  const { state, run, reset } = useMarketAction();
  const options = PAIRS[group];
  const [action, setAction] = useState<MarketAction>(options[0].value);
  const [amount, setAmount] = useState('');

  const { data: walletBalance } = useReadContract({
    address: reserve.asset,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address === undefined ? undefined : [address],
    query: { enabled: address !== undefined && open },
  });

  const position = account?.positions.find((p) => p.asset === reserve.asset);
  const max = useMemo(
    () => maxFor(action, reserve, position, account, walletBalance),
    [action, reserve, position, account, walletBalance],
  );

  function close() {
    setAmount('');
    reset();
    onClose();
  }

  function switchTo(next: MarketAction) {
    setAction(next);
    setAmount('');
    reset();
  }

  const busy = state.step === 'approving' || state.step === 'executing';

  return (
    <Dialog open={open} onClose={close} labelledBy={TITLE_ID}>
      <div className="relative flex h-12 items-center px-4">
        <h2
          id={TITLE_ID}
          className="pointer-events-none absolute inset-x-0 text-center text-body font-semibold text-ink-900"
        >
          {state.step === 'done' ? 'Done' : `${GROUP_LABEL[group]} · ${reserve.symbol}`}
        </h2>
        {!busy && <DialogClose onClose={close} />}
      </div>

      {state.step === 'done' ? (
        <DoneView action={action} txHash={state.txHash} onClose={close} />
      ) : state.step === 'approving' || state.step === 'executing' ? (
        <BusyView step={state.step} action={action} symbol={reserve.symbol} />
      ) : (
        <div className="dialog-view px-6 pb-6">
          <Segments value={action} onChange={switchTo} options={options} className="mb-5" />

          <AmountField
            value={amount}
            onChange={setAmount}
            symbol={reserve.symbol}
            decimals={reserve.decimals}
            max={max.value}
            maxLabel={max.label}
            priceUsd={reserve.priceUsd}
          />

          <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-small">
            {summaryFor(action, reserve, position, account).map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-ink-500">{row.label}</dt>
                <dd className={row.numeric === false ? 'text-ink-900' : 'num text-ink-900'}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          {account?.healthFactorBps != null && (action === 'borrow' || action === 'withdrawCollateral') && (
            <div className="mt-4">
              <HealthFactorBar healthFactorBps={account.healthFactorBps} />
            </div>
          )}

          {state.error !== null && (
            <p
              className={`mt-4 text-small ${state.rejected ? 'text-ink-500' : 'text-danger'}`}
              role="alert"
            >
              {state.error}
            </p>
          )}

          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={isWrong || amount === '' || max.value === '0' || MARKET_ADDRESS === undefined}
            onClick={() => void run(action, reserve.asset, amount, reserve.decimals)}
          >
            {isWrong ? 'Switch to Creditcoin CC3 first' : VERB[action]}
          </Button>

          {/* Pengungkapan berdiri tepat di atas tanda tangan, bukan di kaki
              halaman. Di sinilah seseorang benar-benar berurusan dengan token
              itu, dan di sinilah klaim produk paling mudah disalahpahami. */}
          <p className="mt-4 text-micro leading-relaxed text-ink-400">
            {reserve.symbol} is a testnet ERC-20. Prices, credit history, and scores come from real
            Ethereum mainnet activity proven through Attestcoin.
          </p>
        </div>
      )}
    </Dialog>
  );
}

function BusyView({
  step,
  action,
  symbol,
}: {
  step: 'approving' | 'executing';
  action: MarketAction;
  symbol: string;
}) {
  return (
    <div className="dialog-view px-6 pb-10 pt-2 text-center">
      <div className="relative mx-auto flex h-[72px] w-[72px] items-center justify-center">
        <svg viewBox="0 0 72 72" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <rect
            x="3"
            y="3"
            width="66"
            height="66"
            rx="22"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="26 74"
            className="ring-travel"
          />
        </svg>
      </div>
      <p className="mt-6 text-h3 font-semibold text-ink-900">
        {step === 'approving' ? `Approving ${symbol}` : `${VERB[action]} in progress`}
      </p>
      <p className="mt-1 text-small text-ink-500">
        {step === 'approving'
          ? 'One-time permission for exactly this amount. Confirm it in your wallet.'
          : 'Confirm in your wallet, then wait for the Creditcoin block.'}
      </p>
    </div>
  );
}

function DoneView({
  action,
  txHash,
  onClose,
}: {
  action: MarketAction;
  txHash: string | null;
  onClose: () => void;
}) {
  return (
    <div className="dialog-view px-6 pb-8 pt-2 text-center">
      <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-verified-soft text-verified">
        <Check size={30} strokeWidth={2} />
      </span>
      <p className="mt-6 text-h3 font-semibold text-ink-900">{VERB[action]} confirmed</p>

      {txHash !== null && (
        <a
          href={creditcoinTx(txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-small font-medium text-accent hover:underline"
        >
          View on Creditcoin explorer <ExternalLink size={13} strokeWidth={1.5} />
        </a>
      )}

      <Button variant="secondary" className="mt-6 w-full" onClick={onClose}>
        <ArrowLeft size={15} strokeWidth={1.75} />
        Back to market
      </Button>
    </div>
  );
}

interface MaxSource {
  value: string;
  label: string;
}

/**
 * Batas atas tiap aksi, dalam satuan terkecil token.
 *
 * `borrow` diberi potongan 0,5%. Bunga terus berjalan di antara saat angka ini
 * dihitung dan saat transaksinya masuk blok, jadi meminjam PERSIS sebesar
 * headroom akan revert dengan `InsufficientCollateral` — kegagalan yang
 * terlihat seperti bug padahal murni selisih waktu. Sekeluarga dengan catatan
 * di CLAUDE.md soal melunasi persis sebesar yang dipinjam.
 */
function maxFor(
  action: MarketAction,
  reserve: Reserve,
  position: PositionEntry | undefined,
  account: AccountPositions | undefined,
  walletBalance: bigint | undefined,
): MaxSource {
  const wallet = walletBalance ?? 0n;

  switch (action) {
    case 'supply':
    case 'depositCollateral':
      return { value: wallet.toString(), label: 'Wallet' };

    case 'withdraw':
      return { value: position?.supplied ?? '0', label: 'Supplied' };

    case 'withdrawCollateral':
      return { value: position?.collateral ?? '0', label: 'Collateral' };

    case 'repay': {
      // Kontrak sudah meng-clamp `amount > debt` ke debt, jadi kelebihan aman
      // terhadap UTANG — tapi tidak terhadap SALDO: kalau saldo kurang,
      // `transferFrom` revert dan gejalanya terbaca seperti bug kontrak.
      const debt = BigInt(position?.borrowed ?? '0');
      return { value: (debt < wallet ? debt : wallet).toString(), label: 'Debt' };
    }

    case 'borrow': {
      if (account === undefined || reserve.priceUsd === null) return { value: '0', label: 'Max' };
      const collateralCents = toCents(account.totalCollateralUsd);
      const debtCents = toCents(account.totalDebtUsd);
      const allowedCents = (collateralCents * 10_000n) / BigInt(account.collateralRatioBps);
      const headroomCents = allowedCents > debtCents ? allowedCents - debtCents : 0n;

      const price = parseUnits(reserve.priceUsd, 6);
      if (price === 0n) return { value: '0', label: 'Max' };
      const tokens =
        (headroomCents * 10_000n * 10n ** BigInt(reserve.decimals) * 995n) / price / 1000n;

      const liquidity = BigInt(reserve.totalSupplied) - BigInt(reserve.totalBorrowed);
      const capped = tokens < liquidity ? tokens : liquidity;
      return { value: (capped > 0n ? capped : 0n).toString(), label: 'Max' };
    }
  }
}

interface SummaryRow {
  label: string;
  value: string;
  numeric?: boolean;
}

function summaryFor(
  action: MarketAction,
  reserve: Reserve,
  position: PositionEntry | undefined,
  account: AccountPositions | undefined,
): SummaryRow[] {
  const amountOf = (raw: string) => formatTokenAmount(raw, reserve.decimals);

  switch (action) {
    case 'supply':
    case 'withdraw':
      return [
        { label: 'Supply APY', value: formatBps(reserve.supplyApyBps) },
        { label: 'Your supply', value: `${amountOf(position?.supplied ?? '0')} ${reserve.symbol}` },
      ];

    case 'depositCollateral':
    case 'withdrawCollateral':
      return [
        {
          label: 'Your collateral',
          value: `${amountOf(position?.collateral ?? '0')} ${reserve.symbol}`,
        },
        { label: 'Collateral value', value: formatUsd(account?.totalCollateralUsd ?? null) },
      ];

    case 'borrow':
    case 'repay':
      return [
        { label: 'Borrow APY', value: formatBps(reserve.borrowApyBps) },
        { label: 'Your debt', value: `${amountOf(position?.borrowed ?? '0')} ${reserve.symbol}` },
        {
          label: 'Collateral ratio',
          value:
            account === undefined
              ? '–'
              : `${formatRatio(account.collateralRatioBps)} vs ${formatRatio(BASELINE_COLLATERAL_RATIO_BPS)}`,
        },
      ];
  }
}

/** "12284.96" → 1228496n. UsdAmount selalu dua desimal (docs/api.md §0.8). */
function toCents(usd: string): bigint {
  const [whole = '0', frac = ''] = usd.split('.');
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0').slice(0, 2));
}
