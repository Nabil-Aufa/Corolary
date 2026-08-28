import type { ApiMeta, ApiResponse } from '@/types';
import { ApiError, NetworkError } from './errors';

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
// Garis miring di ujung menghasilkan `//v1/health`, yang dijawab 404 oleh
// beberapa router — kegagalan yang terlihat seperti endpoint hilang.
const BASE_URL = `${RAW_BASE.replace(/\/+$/, '')}/v1`;

export interface ApiResult<T> {
  data: T;
  meta: ApiMeta | undefined;
}

/**
 * Satu-satunya jalan keluar HTTP di apps/web.
 *
 * Setiap respons API — sukses maupun gagal — memakai amplop yang sama
 * (docs/api.md §0.3), jadi status HTTP saja tidak cukup: `ok: false` bisa
 * datang dengan status apa pun, dan membacanya lewat `res.ok` akan melewatkan
 * error yang sudah dijelaskan API dengan rapi.
 */
export async function apiFetchWithMeta<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  } catch (cause) {
    throw new NetworkError(cause instanceof Error ? cause.message : 'network request failed');
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    // Bukan JSON sama sekali — biasanya halaman error proxy/platform, bukan API.
    throw new ApiError('INTERNAL', `API returned a non-JSON response (HTTP ${res.status})`, res.status);
  }

  if (!json.ok) {
    throw new ApiError(json.error.code, json.error.message, res.status);
  }
  return { data: json.data, meta: json.meta };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiFetchWithMeta<T>(path, init)).data;
}

/** Rakit query string, membuang yang kosong supaya `?kind=&limit=` tidak lahir. */
export function toQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
