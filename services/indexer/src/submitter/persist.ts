import { ethers } from 'ethers';
import { sql } from '../db/client.js';
import { creditcoin, ETH_CHAIN_KEY, ethCall } from '../chain/providers.js';
import { loadAbi } from '../chain/abi.js';
import { requireContracts } from '../config.js';
import { stageLogger } from '../logger.js';

const log = stageLogger('submitter');

/**
 * Menyalin fakta yang baru tercatat dari chain ke Postgres.
 *
 * Chain tetap sumber kebenaran; tabel `facts` hanya mirror baca-cepat supaya
 * API tidak perlu memindai log Creditcoin untuk tiap permintaan halaman
 * (architecture.md §10).
 *
 * Sumber datanya adalah `getFact(factId)` on-chain, BUKAN field event. Event
 * FactRecorded tidak membawa `txLogIndex` maupun `observedAt`, dan menurunkan
 * ulang keduanya di sisi indexer berarti menebak apa yang sudah diketahui
 * kontrak dengan pasti.
 */

/**
 * Alamat token yang sudah pasti ada di tabel `assets`.
 *
 * `ensureAsset` dipanggil sekali per fakta, dan saat membangun ulang mirror itu
 * puluhan ribu SELECT untuk himpunan token yang isinya cuma puluhan.
 */
const knownAssets = new Set<string>();

/**
 * Hash transaksi Ethereum per blok, dibatasi jumlahnya.
 *
 * Dipakai saat `observed_events` tidak lagi punya barisnya — lihat
 * `txHashFor`. Satu blok mainnet memuat ~200 hash, jadi cache-nya dibatasi
 * supaya rebuild panjang tidak menumbuhkan memori tanpa batas.
 */
const BLOCK_TX_CACHE_MAX = 256;
const blockTxCache = new Map<number, readonly string[]>();

async function blockTxHashes(height: number): Promise<readonly string[]> {
  const hit = blockTxCache.get(height);
  if (hit) return hit;
  const block = await ethCall('getBlockTxHashes', (p) => p.getBlock(height));
  const hashes = block ? [...block.transactions] : [];
  if (blockTxCache.size >= BLOCK_TX_CACHE_MAX) {
    const oldest = blockTxCache.keys().next().value;
    if (oldest !== undefined) blockTxCache.delete(oldest);
  }
  blockTxCache.set(height, hashes);
  return hashes;
}

let registryIface: ethers.Interface | null = null;
let graphIface: ethers.Interface | null = null;
let registry: ethers.Contract | null = null;
let graph: ethers.Contract | null = null;

function ifaces() {
  if (!registryIface) {
    const { factRegistry } = requireContracts();
    const abi = loadAbi('FactRegistry');
    registryIface = new ethers.Interface(abi as ethers.InterfaceAbi);
    registry = new ethers.Contract(factRegistry, abi, creditcoin);
  }
  return { registryIface: registryIface, registry: registry as ethers.Contract };
}

async function graphContract(): Promise<ethers.Contract | null> {
  if (graph) return graph;
  const { registry: r } = ifaces();
  const addr: string = await r.getFunction('creditGraph')();
  if (addr === ethers.ZeroAddress) return null;
  const abi = loadAbi('CreditGraph');
  graphIface = new ethers.Interface(abi as ethers.InterfaceAbi);
  graph = new ethers.Contract(addr, abi, creditcoin);
  return graph;
}

interface OnChainFact {
  factId: string;
  chainKey: bigint;
  blockHeight: bigint;
  txIndex: bigint;
  txLogIndex: bigint;
  kind: bigint;
  subject: string;
  protocol: string;
  asset: string;
  amount: bigint;
  observedAt: bigint;
  recordedAt: bigint;
}

export interface PersistOptions {
  /**
   * Kalau diisi, skor TIDAK disegarkan di sini — subjeknya cuma dikumpulkan.
   *
   * Dipakai `mirror-rebuild`. Menyegarkan skor per-receipt berarti subjek yang
   * sama dihitung ulang puluhan kali (empat panggilan RPC tiap kali), dan
   * hasilnya toh ditimpa oleh perhitungan berikutnya. Menundanya ke akhir juga
   * LEBIH BENAR: `scoreOf` selalu menjawab keadaan TERKINI, jadi menyimpannya
   * dengan `at_block` sebuah receipt lama menulis skor hari ini ke dalam
   * riwayat dengan stempel blok masa lalu.
   */
  collectSubjects?: Set<string>;
}

/**
 * @returns jumlah fakta yang benar-benar DITULIS, bukan jumlah log FactRecorded
 *          yang terbaca. Keduanya sempat sama, dan itu menyembunyikan fakta
 *          yang dilewati: penghitungnya terus naik sementara tidak ada baris
 *          yang masuk.
 */
export async function persistReceipt(
  receipt: ethers.TransactionReceipt,
  batchId: string | null,
  opts: PersistOptions = {},
): Promise<number> {
  const { registryIface: iface, registry: reg } = ifaces();
  const registryAddress = (await reg.getAddress()).toLowerCase();
  const factIds: string[] = [];

  for (const l of receipt.logs) {
    if (l.address.toLowerCase() !== registryAddress) continue;
    let parsed: ethers.LogDescription | null;
    try {
      parsed = iface.parseLog({ topics: [...l.topics], data: l.data });
    } catch {
      continue;
    }
    if (parsed?.name === 'FactRecorded') factIds.push(parsed.args[0] as string);
  }

  if (factIds.length === 0) return 0;

  // Berurutan, ini satu round-trip per fakta. ethers v6 menggabungkan panggilan
  // yang berjalan bersamaan jadi satu JSON-RPC batch, dan node Creditcoin
  // melayani batch sampai 100 (diukur) — jadi satu receipt berisi 10 fakta
  // selesai dalam satu perjalanan, bukan sepuluh.
  const raws = (await Promise.all(
    factIds.map((id) => reg.getFunction('getFact')(id)),
  )) as unknown as OnChainFact[];

  const subjects = opts.collectSubjects ?? new Set<string>();
  let written = 0;

  for (let i = 0; i < factIds.length; i += 1) {
    const factId = factIds[i] as string;
    const raw = raws[i] as OnChainFact;
    const blockHeight = Number(raw.blockHeight);
    const txIndex = Number(raw.txIndex);

    const located = await txHashFor(blockHeight, txIndex, Number(raw.txLogIndex));
    if (!located) {
      log.warn({ factId, blockHeight, txIndex }, 'hash transaksi sumber tidak bisa dipulihkan');
      continue;
    }

    await ensureAsset(raw.asset);
    subjects.add(ethers.getAddress(raw.subject));

    await sql`
      INSERT INTO facts ${sql({
        fact_id: factId,
        chain_key: Number(raw.chainKey),
        block_height: blockHeight,
        tx_hash: located.txHash,
        tx_index: txIndex,
        tx_log_index: Number(raw.txLogIndex),
        log_index: located.logIndex,
        kind: Number(raw.kind),
        subject: ethers.getAddress(raw.subject),
        protocol: ethers.getAddress(raw.protocol),
        asset: ethers.getAddress(raw.asset),
        amount: raw.amount.toString(),
        observed_at: Number(raw.observedAt),
        recorded_at: Number(raw.recordedAt),
        creditcoin_tx_hash: receipt.hash,
        creditcoin_block: receipt.blockNumber,
        batch_id: batchId,
      })}
      ON CONFLICT (fact_id) DO NOTHING
    `;
    written += 1;
  }

  if (!opts.collectSubjects) await refreshScores([...subjects], receipt.blockNumber);
  return written;
}

/**
 * Hash transaksi Ethereum untuk sebuah fakta, plus `logIndex` kalau diketahui.
 *
 * `Fact` on-chain tidak memuat txHash — receipt Ethereum memang tidak
 * membawanya, dan kontrak tidak membutuhkannya. Sumber pertamanya
 * `observed_events`, yang gratis karena sudah ada di database kita.
 *
 * Tapi `observed_events` TIDAK boleh jadi satu-satunya sumber. Ia termasuk
 * tabel yang hilang saat volume Postgres produksi di-wipe pada 2026-09-01, dan
 * mirror-rebuild — satu-satunya jalan pulih dari kehilangan database — jadi
 * ikut lumpuh: setiap fakta lama dilewati karena baris pasangannya tidak ada
 * lagi, tanpa satu pun kegagalan yang terlihat. Karena itu ada jalur kedua:
 * `(blockHeight, txIndex)` sudah cukup untuk menanyakan hash-nya langsung ke
 * Ethereum. `logIndex` block-wide tidak bisa dipulihkan lewat jalur itu, dan
 * memang tidak perlu — ia cuma memperhalus tautan Etherscan, dan tautan
 * tingkat transaksi tetap benar tanpanya.
 */
async function txHashFor(
  blockHeight: number,
  txIndex: number,
  txLogIndex: number,
): Promise<{ txHash: string; logIndex: number | null } | null> {
  const rows = await sql<{ tx_hash: string; log_index: number }[]>`
    SELECT tx_hash, log_index FROM observed_events
    WHERE chain_key = ${ETH_CHAIN_KEY}
      AND block_height = ${blockHeight}
      AND tx_index = ${txIndex}
    ORDER BY log_index ASC
  `;
  const known = rows[0]?.tx_hash;
  if (known) {
    // Log ke-n yang kita pantau di transaksi itu bersesuaian dengan fakta ke-n,
    // karena FactRegistry memanen tepat himpunan log yang sama (emitter
    // terdaftar) yang watcher pantau.
    return { txHash: known, logIndex: rows[txLogIndex]?.log_index ?? rows[0]?.log_index ?? null };
  }

  const hashes = await blockTxHashes(blockHeight);
  const hash = hashes[txIndex];
  return hash ? { txHash: hash, logIndex: null } : null;
}

/** Urutan komponen mengikuti CreditGraph.componentsOf (dan ScoreComponentKey). */
const COMPONENT_KEYS = [
  'repaymentVolume',
  'repaymentCount',
  'historyDuration',
  'liquidationPenalty',
  'protocolDiversity',
  'activeStanding',
] as const;

/**
 * Poin MAKSIMUM yang bisa dicapai tiap komponen — bukan besar pengaruhnya.
 *
 * `liquidationPenalty` adalah 0, dan itu bukan salah ketik. Kontrak menuliskan
 * `points[3] = -penalty`, jadi komponen ini bergerak dari **-300 sampai 0**:
 * nilai terbaik yang mungkin adalah nol. Menulis 300 di sini membuat UI
 * merender dompet yang tidak pernah kena likuidasi sebagai "0 dari 300" —
 * terbaca seperti kehilangan 300 poin, padahal artinya justru bersih sempurna.
 * Batas bawahnya ada di `packages/shared` sebagai `LIQUIDATION_PENALTY_MIN`.
 */
const COMPONENT_MAX = [300, 200, 200, 0, 100, 200] as const;

/**
 * Skor dibaca ULANG dari kontrak, bukan dihitung ulang di sini.
 *
 * Menyalin rumus skoring ke TypeScript berarti dua implementasi yang harus
 * tetap sepakat selamanya, dan yang di UI-lah yang akan menyimpang diam-diam.
 */
export async function refreshScores(subjects: string[], atBlock: number): Promise<void> {
  if (subjects.length === 0) return;
  const g = await graphContract();
  if (!g) return;

  for (const subject of subjects) {
    // Empat panggilan yang tidak saling bergantung. Berurutan mereka empat
    // round-trip; bersamaan, ethers menggabungkannya jadi satu batch.
    const [[score, tier], bps, points, snap] = (await Promise.all([
      g.getFunction('scoreOf')(subject),
      g.getFunction('collateralRatioBpsOf')(subject),
      g.getFunction('componentsOf')(subject),
      g.getFunction('snapshotOf')(subject),
    ])) as [
      [bigint, bigint],
      bigint,
      bigint[],
      { firstFactAt: bigint; lastFactAt: bigint; factCount: bigint },
    ];

    const components = COMPONENT_KEYS.map((key, i) => ({
      key,
      points: Number(points[i] ?? 0n),
      maxPoints: COMPONENT_MAX[i],
    }));

    const now = Math.floor(Date.now() / 1000);
    await sql`
      INSERT INTO scores ${sql({
        subject,
        score: Number(score),
        tier: Number(tier),
        ratio_bps: Number(bps),
        components: sql.json(components as unknown as Parameters<typeof sql.json>[0]),
        fact_count: Number(snap.factCount),
        first_fact_at: snap.firstFactAt === 0n ? null : Number(snap.firstFactAt),
        last_fact_at: snap.lastFactAt === 0n ? null : Number(snap.lastFactAt),
        computed_at: now,
        onchain_block: atBlock,
      })}
      ON CONFLICT (subject) DO UPDATE SET
        score = EXCLUDED.score, tier = EXCLUDED.tier, ratio_bps = EXCLUDED.ratio_bps,
        components = EXCLUDED.components, fact_count = EXCLUDED.fact_count,
        first_fact_at = EXCLUDED.first_fact_at, last_fact_at = EXCLUDED.last_fact_at,
        computed_at = EXCLUDED.computed_at, onchain_block = EXCLUDED.onchain_block
    `;

    await sql`
      INSERT INTO score_history ${sql({
        subject, score: Number(score), tier: Number(tier), at_block: atBlock, at_time: now,
      })}
      ON CONFLICT (subject, at_block, score) DO NOTHING
    `;
  }
}

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

/**
 * Simbol dan desimal token di-cache karena keduanya praktis tidak pernah
 * berubah, dan memanggilnya ke RPC Ethereum di setiap permintaan halaman API
 * akan membuat daftar fakta bergantung pada RPC pihak ketiga.
 */
export async function ensureAsset(asset: string): Promise<void> {
  const address = ethers.getAddress(asset);
  if (knownAssets.has(address)) return;
  const existing = await sql`SELECT 1 FROM assets WHERE address = ${address}`;
  if (existing.length > 0) {
    knownAssets.add(address);
    return;
  }

  let symbol = '';
  let decimals = 18;
  try {
    const meta = await ethCall('erc20Metadata', async (p) => {
      const token = new ethers.Contract(address, ERC20_ABI, p);
      return {
        symbol: (await token.getFunction('symbol')()) as string,
        decimals: Number(await token.getFunction('decimals')()),
      };
    });
    symbol = meta.symbol;
    decimals = meta.decimals;
  } catch {
    // Sebagian token lama (mis. MKR) memakai bytes32 untuk symbol dan akan gagal
    // di-decode. Alamat terpotong lebih jujur daripada menebak nama.
    symbol = `${address.slice(0, 6)}…${address.slice(-4)}`;
  }

  await sql`
    INSERT INTO assets ${sql({ address, symbol, decimals })}
    ON CONFLICT (address) DO NOTHING
  `;
  knownAssets.add(address);
}
