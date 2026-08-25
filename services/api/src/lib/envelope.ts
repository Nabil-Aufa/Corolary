import type { Context } from 'hono';
import type { ApiErrorCode, ApiMeta, ApiResponse } from '@corolary/shared';

/**
 * Setiap respons — sukses maupun gagal — memakai amplop yang sama, termasuk
 * /v1/health (docs/api.md §0.3). Endpoint yang "cuma satu nilai" lalu
 * mengembalikan bentuk telanjang adalah endpoint yang memaksa frontend menulis
 * dua jalur parsing.
 */
export function ok<T>(c: Context, data: T, meta?: ApiMeta, status = 200) {
  const body: ApiResponse<T> = meta ? { ok: true, data, meta } : { ok: true, data };
  return c.json(body, status as 200);
}

const STATUS_OF: Record<ApiErrorCode, number> = {
  NOT_FOUND: 404,
  INVALID_ADDRESS: 400,
  INVALID_PARAM: 400,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export function fail(c: Context, code: ApiErrorCode, message: string) {
  const body: ApiResponse<never> = { ok: false, error: { code, message } };
  return c.json(body, STATUS_OF[code] as 400);
}

/** Dilempar dari mana saja; ditangkap onError dan diubah jadi amplop. */
export class ApiFailure extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(what: string): never {
  throw new ApiFailure('NOT_FOUND', `${what} tidak ditemukan`);
}

export function invalidParam(message: string): never {
  throw new ApiFailure('INVALID_PARAM', message);
}
