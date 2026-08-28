import type { ApiErrorCode } from '@/types';

/** Kegagalan yang DIJAWAB API dengan amplop `{ ok: false }`. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Kegagalan yang membuat API tidak pernah menjawab sama sekali — DNS mati,
 * service tidur, koneksi putus. Dibedakan dari ApiError karena tindakannya
 * berbeda: yang ini layak di-retry, dan pesannya untuk pengguna juga lain
 * ("tidak bisa menghubungi", bukan "permintaanmu ditolak").
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** Kesalahan permanen — mengulanginya tidak akan mengubah apa pun. */
const PERMANENT: ReadonlySet<string> = new Set(['NOT_FOUND', 'INVALID_ADDRESS', 'INVALID_PARAM']);

export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) return !PERMANENT.has(error.code);
  return error instanceof NetworkError;
}

/** Pesan siap-tampil. Sengaja tidak menggemakan pesan mentah API untuk kode
 *  yang punya padanan manusiawi — pesan API ditulis untuk developer. */
export function humanMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return "Can't reach the Corolary API. It may be starting up — try again in a moment.";
  }
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return 'Not found.';
      case 'INVALID_ADDRESS':
        return 'That is not a valid Ethereum address.';
      case 'RATE_LIMITED':
        return 'Too many requests. Wait a moment and try again.';
      case 'UPSTREAM_UNAVAILABLE':
        return 'A data source is temporarily unavailable.';
      default:
        return error.message;
    }
  }
  return 'Something went wrong.';
}
