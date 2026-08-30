import { ethers } from 'ethers';
import { sql } from '../db/client.js';
import { submitter, ETH_CHAIN_KEY, ethGetLogs, ethCall } from '../chain/providers.js';
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
 * Menyiapkan objek kontrak. TIDAK melakukan I/O apa pun — dan itulah
 * keseluruhan maksudnya.
 *
 * Versi sebelumnya memverifikasi feed lewat RPC di sini, sementara di `main.ts`
 * panggilan ini berbagi satu `try` dengan `initSubmitter()` yang loop-nya sudah
 * dinyalakan lebih dulu. Akibatnya satu kedipan RPC CC3 saat boot — satu
 * `assetOfAggregator` yang gagal — membuat `loop('prices')` TIDAK PERNAH
 * dijadwalkan untuk seumur hidup proses itu, sementara fakta terus mengalir dan
 * setiap dashboard tetap hijau.
 *
 * Terukur 2026-08-30: nol `recordPrice` selama 91,8 jam, `priceDataOf`
 * mengembalikan `recordedAt` empat hari lalu, dan `tryToUsd1e18` menjawab
 * `false` untuk tUSDC maupun tWETH — seluruh lapis pasar beku, tanpa satu pun
 * baris error. `ITERATION_TIMEOUT_MS` tidak menolong sedikit pun: tidak ada
 * iterasi yang pernah berjalan untuk di-timeout.
 *
 * Karena itu semua yang menyentuh jaringan pindah ke `verifyFeedsOnce()`, yang
 * dipanggil DARI DALAM loop dan boleh gagal berkali-kali tanpa mematikan apa pun.
 */
export function initPrices(): void {
  const { priceRegistry: address } = requireContracts();
  priceRegistry = new ethers.Contract(address, loadAbi('PriceRegistry'), submitter);
  log.info({ priceRegistry: address, feeds: FEEDS.map((f) => f.pair) }, 'jalur harga siap');
}

/**
 * Aggregator yang TERBUKTI tidak dipercaya PriceRegistry, dalam huruf kecil.
 *
 * Diisi hanya oleh jawaban on-chain yang definitif — tidak pernah oleh kegagalan
 * RPC, karena feed yang belum sempat diperiksa harus tetap disegarkan seperti
 * biasa.
 *
 * Melewatinya di putaran penyegaran adalah perbaikan tersendiri. Sebelumnya
 * verifikasi hanya MENCATAT ketidakpercayaan lalu `continue`, sementara
 * `refreshPricesOnce` tetap mengiterasi seluruh `FEEDS`: proof untuk aggregator
 * tak tepercaya tetap dibeli, lalu dibuang diam-diam oleh `recordPrice` yang
 * memang sengaja melewati emitter asing. Biaya terbayar, nol harga tercatat,
 * nol error.
 */
const untrustedAggregators = new Set<string>();

/**
 * Kapan putaran verifikasi terakhir selesai UTUH. `0` = belum pernah.
 *
 * Diulang berkala, bukan dikunci sekali. Alasannya operasional dan konkret:
 * feed baru ditambahkan ke `FEEDS` lebih dulu, lalu dipercayai on-chain lewat
 * `prices:trust` beberapa menit kemudian. Kalau verifikasi mengunci hasilnya
 * selamanya, feed itu masuk `untrustedAggregators` saat boot dan tetap
 * DILEWATI sampai proses di-restart — padahal kontraknya sudah mempercayainya.
 * Rotasi aggregator oleh Chainlink punya bentuk yang sama, hanya arah
 * sebaliknya.
 *
 * Biayanya sepele: dua eth_call per feed, sekali per 30 menit.
 */
let lastVerifiedAt = 0;
const REVERIFY_INTERVAL_MS = 30 * 60_000;

/**
 * Verifikasi yang dulu ada di `initPrices`, sekarang best-effort dan idempoten.
 *
 * Dua hal yang diperiksa gagal secara SENYAP kalau tidak diperiksa: log dari
 * aggregator tak tepercaya dilewati `recordPrice` tanpa revert, dan aggregator
 * yang sudah dirotasi Chainlink berhenti memancarkan log sama sekali. Keduanya
 * terlihat sama dari luar — "harga tidak pernah terbarui" — dan tidak satu pun
 * muncul di log error.
 *
 * Tiap feed dibungkus sendiri supaya satu feed yang bermasalah tidak
 * membatalkan pemeriksaan feed lain. `feedsVerified` baru disetel kalau SELURUH
 * putaran lolos tanpa kegagalan jaringan; kalau tidak, ia dicoba lagi putaran
 * berikutnya.
 */
async function verifyFeedsOnce(): Promise<void> {
  if (lastVerifiedAt !== 0 && Date.now() - lastVerifiedAt < REVERIFY_INTERVAL_MS) return;

  const proxyAbi = ['function aggregator() view returns (address)'];
  let complete = true;

  for (const feed of FEEDS) {
    try {
      const trusted = (await registry().getFunction('assetOfAggregator')(
        feed.aggregator,
      )) as string;

      if (trusted === ethers.ZeroAddress) {
        untrustedAggregators.add(feed.aggregator.toLowerCase());
        log.error(
          { pair: feed.pair, aggregator: feed.aggregator },
          'aggregator TIDAK dipercaya PriceRegistry — feed ini DILEWATI supaya proof-nya ' +
            'tidak dibeli lalu dibuang; jalankan `pnpm --filter @corolary/indexer prices:trust`',
        );
        continue;
      }

      if (ethers.getAddress(trusted) !== ethers.getAddress(feed.asset)) {
        untrustedAggregators.add(feed.aggregator.toLowerCase());
        log.error(
          { pair: feed.pair, expected: feed.asset, onChain: trusted },
          'aggregator dipetakan ke aset LAIN di kontrak — feeds.ts dan registry tidak sepakat',
        );
        continue;
      }

      untrustedAggregators.delete(feed.aggregator.toLowerCase());
    } catch (err) {
      // Kegagalan JARINGAN, bukan jawaban on-chain. Feed ini tidak boleh masuk
      // daftar tak-tepercaya karena kita belum tahu apa-apa tentangnya.
      complete = false;
      log.warn({ pair: feed.pair, err: String(err) }, 'gagal memeriksa kepercayaan aggregator');
      continue;
    }

    // Deteksi rotasi. Ini kegagalan yang paling sulit terlihat, jadi ia harus
    // berisik justru saat semuanya tampak baik-baik saja. Tidak menandai feed
    // sebagai tak-tepercaya: aggregator lama masih dipercaya kontrak, ia hanya
    // berhenti memancarkan.
    try {
      const live = await ethCall('aggregator', async (p) => {
        const proxy = new ethers.Contract(feed.proxy, proxyAbi, p);
        return (await proxy.getFunction('aggregator')()) as string;
      });
      if (ethers.getAddress(live) !== ethers.getAddress(feed.aggregator)) {
        log.error(
          { pair: feed.pair, configured: feed.aggregator, live },
          'Chainlink SUDAH merotasi aggregator — harga feed ini akan berhenti terbarui. ' +
            'Percayai alamat baru lewat trustAggregator lalu perbarui feeds.ts',
        );
      }
    } catch (err) {
      complete = false;
      log.warn({ pair: feed.pair, err: String(err) }, 'gagal memeriksa rotasi aggregator');
    }
  }

  // Mirror disamakan dengan chain. Tanpa ini, database yang di-reset akan tampak
  // tidak punya harga sama sekali sampai ronde berikutnya terbit — padahal harga
  // terbuktinya sudah ada di kontrak sepanjang waktu.
  for (const feed of FEEDS) {
    try {
      await mirrorPrice(feed, null);
    } catch (err) {
      complete = false;
      log.warn({ pair: feed.pair, err: String(err) }, 'gagal menyamakan mirror harga');
    }
  }

  // Hanya putaran yang UTUH yang memajukan penanda waktu. Putaran yang tersandung
  // RPC dicoba lagi di putaran loop berikutnya, bukan 30 menit kemudian.
  if (complete) {
    lastVerifiedAt = Date.now();
    log.info({ untrusted: [...untrustedAggregators] }, 'verifikasi feed selesai');
  }
}

/**
 * Umur harga terbukti PER FEED, dibaca langsung dari kontrak.
 *
 * Sengaja TIDAK dari tabel `prices` dan tidak dari cache di memori. Mirror
 * Postgres bisa terlihat sehat sementara registry on-chain kosong — itu sudah
 * pernah terjadi — dan cache di memori bernilai kosong justru pada satu-satunya
 * kasus yang penting: loop harga yang tidak pernah berjalan sama sekali.
 *
 * `budgetSeconds` diambil dari kontrak juga (`maxPriceAgeOf` per aset, jatuh ke
 * `maxPriceAge` global kalau nol) supaya ambangnya tidak pernah menyimpang dari
 * yang benar-benar berlaku. Terukur 2026-08-30: global 10.800 detik, dengan
 * override 100.800 khusus USDC.
 */
export interface FeedFreshness {
  pair: string;
  ageSeconds: number | null;
  budgetSeconds: number;
  /** Sisa anggaran; negatif berarti aset ini sudah basi di mata kontrak. */
  slackSeconds: number | null;
}

export async function priceFreshness(): Promise<FeedFreshness[]> {
  const globalBudget = Number(await registry().getFunction('maxPriceAge')());
  const now = Math.floor(Date.now() / 1000);
  const out: FeedFreshness[] = [];

  for (const feed of FEEDS) {
    const p = (await registry().getFunction('priceDataOf')(
      feed.asset,
    )) as unknown as OnChainPrice;
    const specific = Number(await registry().getFunction('maxPriceAgeOf')(feed.asset));
    const budget = specific > 0 ? specific : globalBudget;

    const age = p.roundId === 0n ? null : Math.max(0, now - Number(p.updatedAt));
    out.push({
      pair: feed.pair,
      ageSeconds: age,
      budgetSeconds: budget,
      slackSeconds: age === null ? null : budget - age,
    });
  }
  return out;
}

export async function refreshPricesOnce(): Promise<void> {
  // Verifikasi feed dipanggil DARI SINI, bukan dari `initPrices`, dan dibungkus
  // sendiri. Itu perbedaan yang membuat jalur harga tidak bisa lagi mati saat
  // boot: verifikasi yang gagal dicoba lagi putaran berikutnya alih-alih
  // membatalkan penjadwalan loop.
  try {
    await verifyFeedsOnce();
  } catch (err) {
    log.warn({ err: String(err) }, 'verifikasi feed gagal — dicoba lagi putaran berikutnya');
  }

  const head = await ethCall('getBlock', (p) => p.getBlock('finalized'));
  if (!head) return;

  // Satu transaksi Ethereum hanya boleh dikirim sekali per putaran: replay
  // protection PriceRegistry mengunci per (chainKey, blockHeight, txIndex),
  // jadi pengiriman kedua revert setelah proof-nya dibayar.
  const submittedThisPass = new Set<string>();

  for (const feed of FEEDS) {
    if (untrustedAggregators.has(feed.aggregator.toLowerCase())) continue;
    try {
      await refreshFeed(feed, head.number, submittedThisPass);
    } catch (err) {
      log.warn({ pair: feed.pair, err: String(err) }, 'penyegaran feed gagal');
    }
  }

  await reportFreshness();
}

/**
 * Denyut nadi jalur harga: satu baris per putaran yang selalu membawa umur
 * harga terbukti, dibaca dari kontrak.
 *
 * Ini yang absen selama 91,8 jam pada kejadian 2026-08-30. Loop harga yang mati
 * tidak menghentikan apa pun yang lain — fakta terus mengalir, watcher tetap di
 * head — jadi satu-satunya cara ia bisa terlihat adalah kalau ada baris yang
 * MEMANG diharapkan muncul dan berhenti muncul, dan kalau umurnya naik ke
 * `error` sebelum pasar membeku.
 *
 * Ambangnya diturunkan dari anggaran kontrak, bukan dipilih bulat: 50% anggaran
 * = `warn`, 80% = `error`. Untuk WETH/WBTC anggarannya 10.800 detik, untuk USDC
 * 100.800 — ambang tunggal apa pun akan salah untuk salah satunya.
 */
async function reportFreshness(): Promise<void> {
  let feeds: FeedFreshness[];
  try {
    feeds = await priceFreshness();
  } catch (err) {
    log.warn({ err: String(err) }, 'gagal membaca kesegaran harga dari kontrak');
    return;
  }

  const worst = feeds.reduce<FeedFreshness | null>((acc, f) => {
    if (f.slackSeconds === null) return f; // registry kosong: seburuk-buruknya
    if (acc === null || acc.slackSeconds === null) return acc ?? f;
    return f.slackSeconds < acc.slackSeconds ? f : acc;
  }, null);

  const line = { feeds };
  if (!worst || worst.slackSeconds === null || worst.slackSeconds <= worst.budgetSeconds * 0.2) {
    log.error(
      line,
      'harga terbukti nyaris/sudah basi — setiap operasi pasar akan revert. ' +
        'Verifikasi dengan `cast call tryToUsd1e18`, BUKAN lewat /v1/prices ' +
        '(itu mirror Postgres dan bisa tetap terlihat sehat)',
    );
  } else if (worst.slackSeconds <= worst.budgetSeconds * 0.5) {
    log.warn(line, 'harga terbukti menua');
  } else {
    log.info(line, 'harga terbukti segar');
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
      lookbackBlocks: feed.lookbackBlocks ?? MAX_LOOKBACK_BLOCKS,
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
  const floor = Math.max(0, head - (feed.lookbackBlocks ?? MAX_LOOKBACK_BLOCKS));

  for (let to = head; to > floor; to -= SCAN_CHUNK_BLOCKS) {
    const from = Math.max(floor, to - SCAN_CHUNK_BLOCKS + 1);

    const logs = await getLogsWithRetry({
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
 * Retry pendek untuk kedipan provider.
 *
 * drpc membalas `"Can't route your request to suitable provider"` (code 12,
 * HTTP 400) saat sedang dibebani — dan jalur harga berbagi RPC dengan watcher
 * serta submitter, jadi kedipan itu wajar terjadi. Tanpa retry, tiap kedipan
 * muncul sebagai `warn` setiap dua menit; log yang penuh peringatan yang
 * sembuh sendiri adalah log yang berhenti dibaca.
 *
 * Sengaja pendek: harga punya 24 jam sebelum basi, jadi menyerah cepat lalu
 * mencoba lagi di putaran berikutnya lebih baik daripada menahan loop.
 */
async function getLogsWithRetry(filter: ethers.Filter): Promise<ethers.Log[]> {
  let delay = 1_500;
  for (let attempt = 0; ; attempt++) {
    try {
      return await ethGetLogs(filter);
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
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
    const logs = await ethGetLogs({
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
