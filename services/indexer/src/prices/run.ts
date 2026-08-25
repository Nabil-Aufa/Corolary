import { ethers } from 'ethers';
import { sql } from '../db/client.js';
import { ethereum, submitter, ETH_CHAIN_KEY } from '../chain/providers.js';
import { loadAbi } from '../chain/abi.js';
import { requireContracts } from '../config.js';
import { stageLogger } from '../logger.js';
import { chainInfoProvider, proofBuilder } from '../prover/client.js';
import { claimNextNonce, releaseNonce } from '../submitter/nonce.js';
import { classifySubmitError } from '../submitter/errors.js';
import { ensureAsset } from '../submitter/persist.js';
import { ANSWER_UPDATED_TOPIC, FEEDS, type FeedConfig } from './feeds.js';

const log = stageLogger('prices');

/**
 * Jalur harga sengaja TIDAK memakai pipeline fakta.
 *
 * Dua alasan yang berdiri sendiri:
 *
 * 1. Bentuk datanya berbeda. `observed_events` mengejar KELENGKAPAN — setiap
 *    log pinjaman harus tercatat, karena skor dihitung dari himpunan penuhnya.
 *    Harga tidak begitu: yang dibutuhkan hanya ronde TERBARU per aset, dan
 *    PriceRegistry sendiri membuang apa pun dengan `roundId` lebih kecil.
 *    Mengalirkan harga lewat pipeline fakta berarti membeli proof untuk setiap
 *    ronde setiap feed selamanya — ETH/USD saja ~18 ronde per 3.000 blok —
 *    lalu membuang hampir semuanya di kontrak.
 *
 * 2. Tujuannya kontrak lain. `recordPrice` ada di PriceRegistry dan hanya punya
 *    varian tunggal; submitter fakta memanggil `recordFactBatch` di
 *    FactRegistry. Tidak ada jalan menggabungkan keduanya dalam satu batch.
 *
 * Konsekuensinya loop ini TANPA STATE: tidak ada cursor, tidak ada antrean.
 * Tiap putaran bertanya ke chain "ronde apa yang sudah kupunya?", lalu memindai
 * mundur dari `finalized` untuk yang lebih baru. Restart di titik mana pun aman.
 */

/**
 * Ambang penyegaran, jauh di bawah `maxPriceAge` on-chain (86.400 detik).
 *
 * Menunggu sampai hampir basi berarti setiap kegagalan sementara — RPC down,
 * prover lambat — langsung berubah jadi pasar yang membeku. Satu jam memberi
 * 23 jam ruang pemulihan.
 */
const REFRESH_AFTER_SECONDS = 3_600;

/**
 * Aggregator adalah kontrak yang SANGAT jarang memancarkan log, jadi rentang
 * lebar di sini murah — terukur <500 ms untuk 3.000 blok di drpc, berbeda jauh
 * dari Aave yang harus dipotong ke 500.
 */
const SCAN_CHUNK_BLOCKS = 3_000;

/**
 * Batas mundur ~20 jam (6.000 blok × 12 detik).
 *
 * Bukan angka kenyamanan: proof untuk transaksi < 24 jam berharga 2,59×10⁻⁵ CTC,
 * di atas itu 3,13×10⁻⁴ — 12x lebih mahal. Batas ini menjaga jalur harga tetap
 * di dalam jendela eager-proving. Feed yang tidak terbarui selama 20 jam adalah
 * masalah yang harus DILAPORKAN, bukan dibayar mahal diam-diam.
 */
const MAX_LOOKBACK_BLOCKS = 6_000;

/**
 * Ambang "mulai khawatir": setengah dari `maxPriceAge` on-chain.
 *
 * Di bawah ini, tidak adanya ronde baru sama sekali bukan masalah — feed
 * Chainlink memang hanya memancarkan saat harga menyimpang atau heartbeat
 * jatuh tempo. Di atasnya, diam berarti pasar akan membeku dalam beberapa jam.
 */
const STALE_CONCERN_SECONDS = 43_200;

let priceRegistry: ethers.Contract | null = null;

function registry(): ethers.Contract {
  if (!priceRegistry) throw new Error('initPrices() belum dipanggil');
  return priceRegistry;
}

interface OnChainPrice {
  answer: bigint;
  roundId: bigint;
  updatedAt: bigint;
  recordedAt: bigint;
  sourceBlock: bigint;
  feedDecimals: bigint;
}

/**
 * Verifikasi sekali di awal bahwa setiap feed yang dipantau benar-benar
 * dipercaya kontrak, dan bahwa aggregator-nya belum dirotasi Chainlink.
 *
 * Keduanya gagal secara SENYAP kalau tidak diperiksa: log yang dipanen dari
 * aggregator tak tepercaya dilewati `recordPrice` tanpa revert, dan aggregator
 * yang sudah dirotasi berhenti memancarkan log sama sekali. Dua-duanya terlihat
 * sama dari luar — "harga tidak pernah terbarui" — dan tidak ada yang muncul
 * di log error.
 */
export async function initPrices(): Promise<void> {
  const { priceRegistry: address } = requireContracts();
  priceRegistry = new ethers.Contract(address, loadAbi('PriceRegistry'), submitter);

  const proxyAbi = ['function aggregator() view returns (address)'];

  for (const feed of FEEDS) {
    const trusted = (await registry().getFunction('assetOfAggregator')(
      feed.aggregator,
    )) as string;

    if (trusted === ethers.ZeroAddress) {
      log.error(
        { pair: feed.pair, aggregator: feed.aggregator, registry: address },
        'aggregator TIDAK dipercaya PriceRegistry — proof-nya akan dibeli lalu dibuang; ' +
          'panggil trustAggregator(asset, aggregator, 8) sebagai CURATOR_ROLE',
      );
      continue;
    }

    if (ethers.getAddress(trusted) !== ethers.getAddress(feed.asset)) {
      log.error(
        { pair: feed.pair, expected: feed.asset, onChain: trusted },
        'aggregator dipetakan ke aset LAIN di kontrak — feeds.ts dan registry tidak sepakat',
      );
      continue;
    }

    // Deteksi rotasi. Ini kegagalan yang paling sulit terlihat, jadi ia harus
    // berisik justru saat semuanya tampak baik-baik saja.
    try {
      const proxy = new ethers.Contract(feed.proxy, proxyAbi, ethereum);
      const live = (await proxy.getFunction('aggregator')()) as string;
      if (ethers.getAddress(live) !== ethers.getAddress(feed.aggregator)) {
        log.error(
          { pair: feed.pair, configured: feed.aggregator, live },
          'Chainlink SUDAH merotasi aggregator — harga feed ini akan berhenti terbarui. ' +
            'Percayai alamat baru lewat trustAggregator lalu perbarui feeds.ts',
        );
      }
    } catch (err) {
      log.warn({ pair: feed.pair, err: String(err) }, 'gagal memeriksa rotasi aggregator');
    }
  }

  // Mirror disamakan dengan chain saat start. Tanpa ini, database yang di-reset
  // akan tampak tidak punya harga sama sekali sampai ronde berikutnya terbit —
  // padahal harga terbuktinya sudah ada di kontrak sepanjang waktu.
  for (const feed of FEEDS) {
    try {
      await mirrorPrice(feed, null);
    } catch (err) {
      log.warn({ pair: feed.pair, err: String(err) }, 'gagal menyamakan mirror harga');
    }
  }

  log.info({ priceRegistry: address, feeds: FEEDS.map((f) => f.pair) }, 'jalur harga siap');
}

export async function refreshPricesOnce(): Promise<void> {
  const head = await ethereum.getBlock('finalized');
  if (!head) return;

  // Satu transaksi Ethereum hanya boleh dikirim sekali per putaran: replay
  // protection PriceRegistry mengunci per (chainKey, blockHeight, txIndex),
  // jadi pengiriman kedua revert setelah proof-nya dibayar.
  const submittedThisPass = new Set<string>();

  for (const feed of FEEDS) {
    try {
      await refreshFeed(feed, head.number, submittedThisPass);
    } catch (err) {
      log.warn({ pair: feed.pair, err: String(err) }, 'penyegaran feed gagal');
    }
  }
}

async function refreshFeed(
  feed: FeedConfig,
  head: number,
  submittedThisPass: Set<string>,
): Promise<void> {
  const current = (await registry().getFunction('priceDataOf')(
    feed.asset,
  )) as unknown as OnChainPrice;

  const now = Math.floor(Date.now() / 1000);
  const ageSeconds = current.updatedAt === 0n ? Infinity : now - Number(current.updatedAt);

  if (current.roundId !== 0n && ageSeconds < REFRESH_AFTER_SECONDS) {
    return; // masih segar; tidak ada yang perlu dibayar
  }

  const found = await findNewerRound(feed, head, current.roundId);
  if (!found) {
    // Ini keadaan NORMAL: ambang penyegaran (1 jam) sengaja jauh lebih ketat
    // daripada maxPriceAge (24 jam), jadi sebagian besar putaran memang tidak
    // menemukan ronde baru. Menaikkannya jadi warn akan membuat log penuh
    // alarm palsu dan menenggelamkan yang sungguhan.
    const line = {
      pair: feed.pair,
      lookbackBlocks: MAX_LOOKBACK_BLOCKS,
      onChainRound: current.roundId.toString(),
      ageSeconds: ageSeconds === Infinity ? null : ageSeconds,
    };
    if (ageSeconds >= STALE_CONCERN_SECONDS) {
      log.warn(
        line,
        'feed tidak memancarkan ronde baru dan harganya mendekati basi — periksa ' +
          'apakah aggregator-nya sudah dirotasi Chainlink',
      );
    } else {
      log.info(line, 'belum ada ronde baru; harga yang ada masih berlaku');
    }
    return;
  }

  if (submittedThisPass.has(found.txHash)) return;

  // Blok harus sudah ter-attest di Creditcoin sebelum proof-nya bisa dipakai.
  // `finalized` biasanya sudah jauh melewati lag ~38 blok, tapi memeriksanya
  // tetap lebih murah daripada membeli proof yang pasti ditolak.
  const bounds = await chainInfoProvider.getContinuityBounds(ETH_CHAIN_KEY, found.blockNumber);
  if (!bounds.isAttested) {
    log.info({ pair: feed.pair, height: found.blockNumber }, 'blok harga belum ter-attest');
    return;
  }

  const proof = await proofBuilder.getProof(found.txHash);
  if (!proof.success || !proof.data) {
    log.warn({ pair: feed.pair, txHash: found.txHash, error: proof.error }, 'prover menolak');
    return;
  }

  submittedThisPass.add(found.txHash);
  const d = proof.data;
  const nonce = await claimNextNonce();

  try {
    const tx = await registry().getFunction('recordPrice')(
      {
        chainKey: ETH_CHAIN_KEY,
        blockHeight: d.headerNumber,
        merkleRoot: d.merkleProof.root,
        siblings: d.merkleProof.siblings.map((s) => ({ hash: s.hash, isLeft: s.isLeft })),
        lowerEndpointDigest: d.continuityProof.lowerEndpointDigest,
        continuityRoots: d.continuityProof.roots,
      },
      d.txBytes,
      { nonce },
    );

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`recordPrice revert on-chain: ${tx.hash}`);
    }

    await mirrorPrice(feed, receipt.hash);

    log.info(
      {
        pair: feed.pair,
        sourceTx: found.txHash,
        sourceBlock: found.blockNumber,
        roundId: found.roundId.toString(),
        answer: found.answer.toString(),
        creditcoinTx: tx.hash,
        gasUsed: receipt.gasUsed?.toString(),
        proofAgeSeconds: now - found.updatedAt,
      },
      'harga tercatat',
    );
  } catch (err) {
    await releaseNonce(nonce);
    const verdict = classifySubmitError(err, false);
    const line = { pair: feed.pair, sourceTx: found.txHash, reason: verdict.reason };
    if (verdict.verdict === 'skip') {
      log.info(line, 'harga dilewati (bukan error)');
    } else {
      log.warn(line, 'recordPrice gagal — dicoba lagi putaran berikutnya');
    }
  }
}

interface FoundRound {
  txHash: string;
  blockNumber: number;
  roundId: bigint;
  answer: bigint;
  updatedAt: number;
}

/**
 * Mencari ronde TERBARU yang lebih baru dari `afterRound`, memindai mundur dari
 * `head` per potongan.
 *
 * Potongan terbaru diperiksa lebih dulu karena itulah yang hampir selalu
 * berisi jawabannya — semua feed yang dipantau memperbarui dalam < 600 blok
 * pada pengukuran 2026-08-25. Mundur lebih jauh hanya terjadi kalau feed
 * benar-benar diam.
 */
async function findNewerRound(
  feed: FeedConfig,
  head: number,
  afterRound: bigint,
): Promise<FoundRound | null> {
  const floor = Math.max(0, head - MAX_LOOKBACK_BLOCKS);

  for (let to = head; to > floor; to -= SCAN_CHUNK_BLOCKS) {
    const from = Math.max(floor, to - SCAN_CHUNK_BLOCKS + 1);

    const logs = await ethereum.getLogs({
      address: feed.aggregator,
      topics: [ANSWER_UPDATED_TOPIC],
      fromBlock: from,
      toBlock: to,
    });

    // Terbaru dulu. Ronde yang lebih lama tidak berguna: kontrak membuangnya,
    // dan membeli proof untuknya berarti membayar untuk sesuatu yang pasti
    // ditolak.
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if (!l) continue;
      const decoded = decodeAnswerUpdated(l);
      if (!decoded) continue;
      if (decoded.roundId <= afterRound) continue;
      return { ...decoded, txHash: l.transactionHash, blockNumber: l.blockNumber };
    }
  }

  return null;
}

/**
 * Cerminan TypeScript dari ChainlinkDecoder.sol — sengaja dibuat sama persis
 * supaya indexer tidak pernah mengirim log yang kontraknya lewati.
 *
 *   topics[1] = current  (int256, HARGA)
 *   topics[2] = roundId
 *   data[0]   = updatedAt
 */
function decodeAnswerUpdated(
  l: ethers.Log,
): { roundId: bigint; answer: bigint; updatedAt: number } | null {
  if (l.topics.length !== 3 || l.topics[0] !== ANSWER_UPDATED_TOPIC) return null;
  if (l.data.length < 66) return null;

  const t1 = l.topics[1];
  const t2 = l.topics[2];
  if (!t1 || !t2) return null;

  // `current` bertipe int256. Harga non-positif berarti feed rusak; kontrak
  // menolaknya dengan revert NonPositiveAnswer, jadi mengirimnya hanya membakar
  // biaya proof.
  const answer = BigInt.asIntN(256, BigInt(t1));
  if (answer <= 0n) return null;

  return {
    roundId: BigInt(t2),
    answer,
    updatedAt: Number(BigInt(l.data.slice(0, 66))),
  };
}

/**
 * Mirror dibaca ULANG dari `priceDataOf`, bukan dari log Ethereum yang tadi
 * dipakai.
 *
 * Alasannya sama seperti di persist.ts: kontrak sudah memutuskan apa yang
 * berlaku — termasuk melewati ronde lama dan memilih `feedDecimals` milik
 * aggregator — dan menurunkan ulang keputusan itu di TypeScript berarti dua
 * kebenaran yang harus tetap sepakat selamanya.
 *
 * Bisa dipanggil tanpa transaksi Creditcoin (`creditcoinTxHash = null`) untuk
 * membangun ulang mirror dari chain saja, mis. setelah database di-reset.
 */
async function mirrorPrice(feed: FeedConfig, creditcoinTxHash: string | null): Promise<boolean> {
  const p = (await registry().getFunction('priceDataOf')(feed.asset)) as unknown as OnChainPrice;
  if (p.roundId === 0n) return false;

  const asset = ethers.getAddress(feed.asset);
  await ensureAsset(asset);

  // Transaksi sumber ditemukan dari blok yang DISIMPAN KONTRAK, bukan dari
  // variabel yang kebetulan ada di memori pemanggil. Satu getLogs pada satu
  // blok — dan hasilnya benar juga saat mirror dibangun ulang dari nol.
  const sourceTxHash = await resolveSourceTx(feed, Number(p.sourceBlock), p.roundId);

  await sql`
    INSERT INTO prices ${sql({
      asset,
      aggregator: ethers.getAddress(feed.aggregator),
      pair: feed.pair,
      answer: p.answer.toString(),
      decimals: Number(p.feedDecimals),
      round_id: p.roundId.toString(),
      updated_at: Number(p.updatedAt),
      source_block: Number(p.sourceBlock),
      source_tx_hash: sourceTxHash,
      creditcoin_tx_hash: creditcoinTxHash,
      recorded_at: Number(p.recordedAt),
    })}
    ON CONFLICT (asset) DO UPDATE SET
      aggregator = EXCLUDED.aggregator, pair = EXCLUDED.pair, answer = EXCLUDED.answer,
      decimals = EXCLUDED.decimals, round_id = EXCLUDED.round_id,
      updated_at = EXCLUDED.updated_at, source_block = EXCLUDED.source_block,
      -- COALESCE supaya sinkronisasi dari chain tidak menghapus jejak yang
      -- sudah kita punya dari pengiriman sebelumnya.
      source_tx_hash = COALESCE(EXCLUDED.source_tx_hash, prices.source_tx_hash),
      creditcoin_tx_hash = COALESCE(EXCLUDED.creditcoin_tx_hash, prices.creditcoin_tx_hash),
      recorded_at = EXCLUDED.recorded_at
  `;
  return true;
}

/** Menemukan transaksi Ethereum yang memancarkan ronde `roundId` di `blockNumber`. */
async function resolveSourceTx(
  feed: FeedConfig,
  blockNumber: number,
  roundId: bigint,
): Promise<string | null> {
  try {
    const logs = await ethereum.getLogs({
      address: feed.aggregator,
      topics: [ANSWER_UPDATED_TOPIC],
      fromBlock: blockNumber,
      toBlock: blockNumber,
    });
    for (const l of logs) {
      const decoded = decodeAnswerUpdated(l);
      if (decoded && decoded.roundId === roundId) return l.transactionHash;
    }
  } catch (err) {
    log.warn({ pair: feed.pair, blockNumber, err: String(err) }, 'gagal menemukan tx sumber harga');
  }
  return null;
}
