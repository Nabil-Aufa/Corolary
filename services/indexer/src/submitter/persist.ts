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

export async function persistReceipt(
  receipt: ethers.TransactionReceipt,
  batchId: string | null,
): Promise<number> {
  const { registryIface: iface, registry: reg } = ifaces();
  const factIds: string[] = [];

  for (const l of receipt.logs) {
    if (l.address.toLowerCase() !== (await reg.getAddress()).toLowerCase()) continue;
    let parsed: ethers.LogDescription | null;
    try {
      parsed = iface.parseLog({ topics: [...l.topics], data: l.data });
    } catch {
      continue;
    }
    if (parsed?.name === 'FactRecorded') factIds.push(parsed.args[0] as string);
  }

  if (factIds.length === 0) return 0;

  const subjects = new Set<string>();

  for (const factId of factIds) {
    const raw = (await reg.getFunction('getFact')(factId)) as unknown as OnChainFact;
    const blockHeight = Number(raw.blockHeight);
    const txIndex = Number(raw.txIndex);

    // txHash tidak ada di Fact on-chain — receipt Ethereum tidak memuatnya, dan
    // kontrak memang tidak membutuhkannya. Diambil dari baris yang sudah kita
    // punya untuk transaksi itu.
    const rows = await sql<{ tx_hash: string; log_index: number }[]>`
      SELECT tx_hash, log_index FROM observed_events
      WHERE chain_key = ${ETH_CHAIN_KEY}
        AND block_height = ${blockHeight}
        AND tx_index = ${txIndex}
      ORDER BY log_index ASC
    `;
    const txHash = rows[0]?.tx_hash;
    if (!txHash) {
      log.warn({ factId, blockHeight, txIndex }, 'fakta tanpa observed_event pasangannya');
      continue;
    }

    await ensureAsset(raw.asset);
    subjects.add(ethers.getAddress(raw.subject));

    await sql`
      INSERT INTO facts ${sql({
        fact_id: factId,
        chain_key: Number(raw.chainKey),
        block_height: blockHeight,
        tx_hash: txHash,
        tx_index: txIndex,
        tx_log_index: Number(raw.txLogIndex),
        // logIndex block-wide hanya untuk tautan Etherscan. Dipetakan lewat
        // urutan: log ke-n yang kita pantau di transaksi itu bersesuaian dengan
        // fakta ke-n, karena FactRegistry memanen tepat himpunan log yang sama
        // (emitter terdaftar) yang watcher pantau. Kalau tidak ketemu, NULL —
        // tautan tingkat transaksi tetap benar tanpa ini.
        log_index: rows[Number(raw.txLogIndex)]?.log_index ?? rows[0]?.log_index ?? null,
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
  }

  await refreshScores([...subjects], receipt.blockNumber);
  return factIds.length;
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
async function refreshScores(subjects: string[], atBlock: number): Promise<void> {
  if (subjects.length === 0) return;
  const g = await graphContract();
  if (!g) return;

  for (const subject of subjects) {
    const [score, tier] = (await g.getFunction('scoreOf')(subject)) as [bigint, bigint];
    const bps = (await g.getFunction('collateralRatioBpsOf')(subject)) as bigint;
    const points = (await g.getFunction('componentsOf')(subject)) as bigint[];
    const snap = (await g.getFunction('snapshotOf')(subject)) as unknown as {
      firstFactAt: bigint;
      lastFactAt: bigint;
      factCount: bigint;
    };

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
  const existing = await sql`SELECT 1 FROM assets WHERE address = ${address}`;
  if (existing.length > 0) return;

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
}
