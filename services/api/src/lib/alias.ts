import { ethers } from 'ethers';

/**
 * Resolusi alias harga: token pasar testnet meminjam harga aset mainnet.
 *
 * `tUSDC`/`tWETH` tidak punya feed Chainlink sendiri, dan satu aggregator hanya
 * bisa menunjuk satu aset — jadi pemetaannya hidup di kontrak sebagai
 * `PriceRegistry.setPriceAlias`. Dibaca dari KONTRAK, bukan disalin ke SQL:
 * aturan aliasnya milik kontrak, dan salinan kedua di query adalah salinan yang
 * akan menyimpang. Gejalanya kalau menyimpang bukan error melainkan `null` yang
 * terlihat seperti "harga belum ada", padahal `tryToUsd1e18` on-chain menjawab
 * benar.
 *
 * Dependensinya disuntikkan supaya logikanya bisa diuji tanpa RPC dan tanpa
 * Postgres. Yang diuji bukan aritmetikanya — melainkan aturan siapa yang boleh
 * ditimpa dan apa yang TIDAK ikut dipinjam.
 */

export interface PricedAsset {
  decimals: number;
  answer: string | null;
  priceDecimals: number | null;
  sourceTxHash: string | null;
}

export interface AliasDeps {
  /** Alamat kanonik dari kontrak, atau `ZeroAddress`/lempar kalau tidak ada. */
  aliasOf(address: string): Promise<string>;
  /** Harga terbukti untuk alamat kanonik, atau `null`. */
  priceOf(
    canonical: string,
  ): Promise<{ answer: string; priceDecimals: number; sourceTxHash: string | null } | null>;
}

/**
 * Cache seumur hidup proses, termasuk hasil NEGATIF.
 *
 * Menyimpan `null` sama pentingnya dengan menyimpan alamat: mayoritas aset
 * memang tidak punya alias, dan tanpa entri negatif setiap permintaan mengulang
 * satu `eth_call` per aset untuk mendapat jawaban yang sudah diketahui.
 */
export function createAliasCache(): Map<string, string | null> {
  return new Map();
}

export async function resolveAliasPrices(
  meta: Map<string, PricedAsset>,
  deps: AliasDeps,
  cache: Map<string, string | null>,
): Promise<void> {
  for (const [address, m] of meta) {
    // Aset yang SUDAH punya harga terbukti sendiri tidak pernah disentuh.
    // Menimpanya berarti harga pinjaman mengalahkan harga asli — persis
    // terbalik dari maksud alias.
    if (m.answer !== null) continue;

    let canonical = cache.get(address);
    if (canonical === undefined) {
      try {
        const resolved = await deps.aliasOf(address);
        canonical = resolved === ethers.ZeroAddress ? null : ethers.getAddress(resolved);
      } catch {
        // Kontrak lama tanpa `priceAliasOf`, atau RPC gagal. Keduanya berarti
        // "tidak ada alias yang diketahui", bukan alasan menjatuhkan seluruh
        // permintaan pasar.
        canonical = null;
      }
      cache.set(address, canonical);
    }
    if (!canonical) continue;

    const p = await deps.priceOf(canonical);
    if (!p) continue;

    // Hanya HARGA yang dipinjam. `decimals` tetap milik token itu sendiri:
    // tUSDC berdesimal 6, dan meminjam desimal dari aset kanonik akan
    // menggeser setiap saldo tanpa satu pun gejala di UI.
    m.answer = p.answer;
    m.priceDecimals = p.priceDecimals;
    m.sourceTxHash = p.sourceTxHash;
  }
}
