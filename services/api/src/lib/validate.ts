import { ethers } from 'ethers';
import { ApiFailure } from './envelope.js';
import type { Address, Hex } from '@corolary/shared';

/**
 * Alamat punya kode error sendiri karena ini kesalahan paling umum dari
 * frontend (checksum salah, ENS belum di-resolve), dan UI menanganinya berbeda
 * dari parameter lain — highlight kolom input, bukan pesan generik.
 *
 * Dinormalkan ke checksum-case: DB menyimpannya checksum, jadi pencarian
 * lowercase akan diam-diam tidak menemukan apa pun.
 */
export function parseAddress(raw: string | undefined): Address {
  if (!raw || !/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    throw new ApiFailure('INVALID_ADDRESS', `alamat tidak valid: ${raw ?? '(kosong)'}`);
  }
  try {
    return ethers.getAddress(raw) as Address;
  } catch {
    throw new ApiFailure('INVALID_ADDRESS', `checksum alamat tidak cocok: ${raw}`);
  }
}

export function parseHash32(raw: string | undefined, what: string): Hex {
  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new ApiFailure('INVALID_PARAM', `${what} harus hex 32 byte berawalan 0x`);
  }
  return raw.toLowerCase() as Hex;
}

/** Di atas 100 DITOLAK, bukan dipangkas diam-diam (docs/api.md §0.6). */
export function parseLimit(raw: string | undefined, def = 20, max = 100): number {
  if (raw === undefined) return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new ApiFailure('INVALID_PARAM', `limit harus bilangan bulat >= 1, dapat "${raw}"`);
  }
  if (n > max) {
    throw new ApiFailure('INVALID_PARAM', `limit maksimum ${max}, diminta ${n}`);
  }
  return n;
}

export interface FactCursor {
  blockHeight: number;
  txIndex: number;
  logIndex: number;
}

/** Buram bagi klien; Base64URL dari JSON posisi item terakhir. */
export function encodeCursor(c: FactCursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(raw: string | undefined): FactCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as FactCursor;
    if (
      !Number.isInteger(parsed.blockHeight) ||
      !Number.isInteger(parsed.txIndex) ||
      !Number.isInteger(parsed.logIndex)
    ) {
      throw new Error('bentuk salah');
    }
    return parsed;
  } catch {
    // Cursor yang tidak bisa didecode adalah parameter tidak valid, bukan 404:
    // klien mengarang atau memotongnya.
    throw new ApiFailure('INVALID_PARAM', 'cursor tidak valid');
  }
}
