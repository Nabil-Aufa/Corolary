import type { proofProvider } from '@gluwa/usc-sdk';

/**
 * Bentuk argumen yang diterima FactRegistry.recordFactBatch, siap di-JSON-kan
 * dan disimpan di proof_batches.payload.
 *
 * Struct Solidity-nya (AttestcoinReader.BatchProofBundle) memakai nama field
 * yang sama persis dengan tipe SDK — `hash`/`isLeft`, `root`/`siblings`,
 * `lowerEndpointDigest`/`roots` — jadi pemetaannya 1:1 tanpa penamaan ulang.
 *
 * Hati-hati: paket usc-contracts memuat DUA struct MerkleProofEntry berbeda.
 * Yang dipakai precompile adalah milik INativeQueryVerifier (field `hash`);
 * BlockProverTypes memakai `sibling`. Keduanya bertipe (bytes32, bool) sehingga
 * ABI-nya IDENTIK — kompiler tidak akan menolong kalau salah pilih.
 */
export interface MerkleProofEntryJson {
  hash: string;
  isLeft: boolean;
}

export interface MerkleProofJson {
  root: string;
  siblings: MerkleProofEntryJson[];
}

export interface ContinuityProofJson {
  lowerEndpointDigest: string;
  roots: string[];
}

export interface BatchBundleJson {
  chainKey: number;
  heights: number[];
  merkleProofs: MerkleProofJson[];
  sharedContinuityProof: ContinuityProofJson;
  encodedTransactions: string[];
  observedAts: number[];
  /** Hanya untuk ketertelusuran log; tidak dikirim ke kontrak. */
  txHashes: string[];
}

/** Bundle transaksi tunggal — bentuk pipih yang diminta ProofBundle. */
export interface SingleBundleJson {
  chainKey: number;
  blockHeight: number;
  merkleRoot: string;
  siblings: MerkleProofEntryJson[];
  lowerEndpointDigest: string;
  continuityRoots: string[];
  encodedTransaction: string;
  observedAt: number;
  txHash: string;
}

type Merkle = proofProvider.merkle.TransactionMerkleProof;

function toMerkleJson(mp: Merkle): MerkleProofJson {
  return {
    root: mp.root,
    siblings: mp.siblings.map((s) => ({ hash: s.hash, isLeft: s.isLeft })),
  };
}

/**
 * SDK mendeklarasikan merkleProofs sebagai Map bersarang, tapi respons yang
 * melewati JSON bisa tiba sebagai objek biasa. Menangani keduanya lebih murah
 * daripada mendiagnosis "map.get is not a function" saat demo.
 */
function lookup<T>(container: unknown, key: number | string): T | undefined {
  if (container instanceof Map) {
    return (container.get(key as never) ?? container.get(String(key) as never)) as T | undefined;
  }
  if (container && typeof container === 'object') {
    return (container as Record<string, T>)[String(key)];
  }
  return undefined;
}

export interface BatchMember {
  txHash: string;
  blockHeight: number;
  txIndex: number;
  observedAt: number;
}

/**
 * Menyusun payload batch dari respons prover.
 *
 * Kesejajaran indeks adalah syarat keselamatan, bukan kerapian: kontrak
 * memasangkan heights[i] dengan merkleProofs[i] dan encodedTransactions[i].
 * Kalau tidak sejajar dan proof-nya kebetulan tetap lolos, fakta tercatat
 * dengan tinggi blok yang salah — korupsi diam-diam, bukan revert.
 */
export function buildBatchBundle(
  chainKey: number,
  members: BatchMember[],
  response: proofProvider.BatchContinuityResponse,
): BatchBundleJson {
  const heights: number[] = [];
  const merkleProofs: MerkleProofJson[] = [];
  const encodedTransactions: string[] = [];
  const observedAts: number[] = [];
  const txHashes: string[] = [];

  for (const m of members) {
    const byTxIndex = lookup<unknown>(response.merkleProofs, m.blockHeight);
    const entry = lookup<proofProvider.BatchMerkleProofEntry>(byTxIndex, m.txIndex);
    if (!entry) {
      throw new Error(
        `prover tidak mengembalikan proof untuk tx ${m.txHash} ` +
          `(blok ${m.blockHeight}, index ${m.txIndex})`,
      );
    }
    if (entry.txHash.toLowerCase() !== m.txHash.toLowerCase()) {
      // Prover mengembalikan proof untuk transaksi LAIN di posisi yang kita
      // minta. Kalau diteruskan, fakta akan dicatat atas transaksi yang salah.
      throw new Error(
        `prover mengembalikan txHash ${entry.txHash} untuk posisi ${m.blockHeight}/${m.txIndex}, ` +
          `diharapkan ${m.txHash}`,
      );
    }

    heights.push(m.blockHeight);
    merkleProofs.push(toMerkleJson(entry.merkleProof));
    encodedTransactions.push(entry.txBytes);
    observedAts.push(m.observedAt);
    txHashes.push(m.txHash);
  }

  return {
    chainKey,
    heights,
    merkleProofs,
    sharedContinuityProof: {
      lowerEndpointDigest: response.continuityProof.lowerEndpointDigest,
      roots: response.continuityProof.roots,
    },
    encodedTransactions,
    observedAts,
    txHashes,
  };
}

/** Memecah payload batch menjadi bundle tunggal — jalur fallback saat batch gagal. */
export function splitToSingles(bundle: BatchBundleJson): SingleBundleJson[] {
  return bundle.heights.map((height, i) => {
    const mp = bundle.merkleProofs[i];
    const encoded = bundle.encodedTransactions[i];
    const observedAt = bundle.observedAts[i];
    const txHash = bundle.txHashes[i];
    if (!mp || encoded === undefined || observedAt === undefined || txHash === undefined) {
      throw new Error(`payload batch tidak sejajar di indeks ${i}`);
    }
    return {
      chainKey: bundle.chainKey,
      blockHeight: height,
      merkleRoot: mp.root,
      siblings: mp.siblings,
      // Continuity proof batch dipakai ulang apa adanya. BELUM DIVERIFIKASI
      // apakah precompile menerima proof yang root-nya melampaui tinggi target
      // saat dipanggil tunggal — kalau ditolak, submitter membeli proof tunggal
      // baru untuk transaksi ini (lihat submitter/submit.ts). Mencoba yang gratis
      // dulu, karena kalau diterima kita menghemat satu panggilan prover.
      lowerEndpointDigest: bundle.sharedContinuityProof.lowerEndpointDigest,
      continuityRoots: bundle.sharedContinuityProof.roots,
      encodedTransaction: encoded,
      observedAt,
      txHash,
    };
  });
}
