import { BaseError, ContractFunctionRevertedError } from 'viem';

/**
 * Custom error `EfficiencyMarket` → kalimat yang bisa ditindaklanjuti.
 *
 * Kontrak ini memakai custom error, bukan `require` berstring (lihat CLAUDE.md
 * §Gaya), jadi revert-nya sampai ke klien sebagai selector 4-byte. viem sudah
 * men-decode-nya kalau ABI-nya disertakan — yang hilang cuma penerjemahan ke
 * bahasa manusia. Tanpa itu pengguna membaca `HealthFactorTooLow(918273...)`,
 * yang secara teknis tepat dan secara praktis tidak berguna.
 *
 * Argumen error SENGAJA tidak ditampilkan mentah. Semuanya uint256 berskala WAD
 * atau USD-WAD; menempelkannya apa adanya berarti menampilkan angka 18 digit di
 * dialog yang sedang berusaha menenangkan seseorang yang transaksinya gagal.
 */
const MESSAGES: Record<string, string> = {
  ZeroAmount: 'Enter an amount greater than zero.',
  ZeroAddress: 'That asset address is not valid.',
  UnsupportedToken: 'This token is not listed in the Corolary market.',
  ReserveInactive: 'This market is not accepting deposits or borrows right now.',
  BorrowDisabled: 'Borrowing is disabled for this asset.',

  // Bukan kesalahan pengguna, dan kalimatnya harus mengatakan itu. Pasar
  // membeku ketika ronde Chainlink terakhir lebih tua dari anggaran kesegaran
  // aset ini — pengguna tidak bisa berbuat apa-apa selain menunggu.
  MarketFrozenStalePrice:
    'This market is paused until a fresher proven price arrives. Nothing is wrong with your wallet.',

  InsufficientCollateral: 'Not enough collateral for this borrow. Deposit more, or borrow less.',
  HealthFactorTooLow: 'This would push your position below the liquidation threshold.',
  InsufficientLiquidity: 'The pool does not hold enough of this asset right now.',
  NothingToRepay: 'You have no debt in this asset.',
  PositionHealthy: 'That position is healthy and cannot be liquidated.',
  CloseFactorExceeded: 'That repayment is larger than a single liquidation allows.',

  // FaucetToken, bukan EfficiencyMarket. Satu peta untuk semua kontrak yang
  // dipanggil dari UI: memisahkannya per kontrak berarti setiap penambahan
  // harus memilih peta yang benar lebih dulu, dan yang terlewat jatuh ke pesan
  // generik tanpa ada yang menyadarinya.
  ClaimTooSoon: 'The faucet allows one claim per hour for each wallet. Try again later.',
};

/**
 * Penolakan pengguna BUKAN kegagalan, dan tidak boleh terbaca seperti kegagalan.
 *
 * viem melaporkannya lewat `name`, sama seperti jalur connect di WalletDialog.
 */
function isUserRejection(error: Error): boolean {
  return (
    error.name === 'UserRejectedRequestError' ||
    ('cause' in error &&
      error.cause instanceof Error &&
      error.cause.name === 'UserRejectedRequestError')
  );
}

export interface DecodedTxError {
  message: string;
  /** Penolakan pengguna diperlakukan berbeda oleh UI: tanpa nada alarm. */
  rejected: boolean;
}

export function decodeTxError(error: unknown): DecodedTxError {
  if (!(error instanceof Error)) {
    return { message: 'The transaction failed. Try again.', rejected: false };
  }

  if (isUserRejection(error)) {
    return { message: 'You declined the transaction in your wallet.', rejected: true };
  }

  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name !== undefined && name in MESSAGES) {
        return { message: MESSAGES[name] as string, rejected: false };
      }
      // Custom error yang tidak dikenal tetap lebih berguna daripada kalimat
      // generik: namanya saja sudah menunjuk ke satu tempat di kontrak.
      if (name !== undefined) return { message: `Reverted: ${name}.`, rejected: false };
    }
    return { message: error.shortMessage, rejected: false };
  }

  return { message: error.message, rejected: false };
}
