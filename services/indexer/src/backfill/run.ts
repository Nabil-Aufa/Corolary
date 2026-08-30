import { ethers } from 'ethers';
import { sql } from '../db/client.js';
import { ETH_CHAIN_KEY, ethGetLogs, ethCall } from '../chain/providers.js';
import { stageLogger } from '../logger.js';
import { insertLogs, blockTimestamps } from '../watcher/watch.js';
import { buildBatches, type ProvableTx } from '../prover/batching.js';
import { targetsFor, type BackfillTarget } from './filters.js';
import { recordCoverage } from './coverage.js';

const log = stageLogger('backfill');

/**
 * Backfill riwayat SATU subjek.
 *
 * `docs/indexer.md` §13.2 menjelaskan backfill berbasis RENTANG BLOK, memakai
 * `watchOnce` yang sama. Mode itu benar untuk tujuannya — menambahkan protokol
 * baru — tapi tidak bisa dipakai untuk tujuan yang sekarang.
 *
 * Alasannya aritmetika, bukan selera. Riwayat enam bulan adalah ~1,3 juta blok.
 * Dipindai tanpa filter subjek, Aave saja menghasilkan ratusan ribu log, dan
 * SETIAP transaksi di dalamnya akan dibuktikan pada tarif lazy 3,13×10⁻⁴ CTC —
 * puluhan ribu CTC untuk riwayat yang 99,99%-nya milik orang yang tidak
 * ditampilkan di mana pun.
 *
 * Karena subjek adalah parameter ber-`indexed` di keempat protokol, RPC bisa
 * menyaringnya di sisi server. Riwayat enam bulan satu dompet menyusut jadi
 * beberapa puluh log, dan biayanya jadi sebanding dengan aktivitas dompet itu —
 * bukan dengan aktivitas seluruh chain.
 *
 * Jalur INSERT-nya tetap sama persis dengan watcher live (`insertLogs`), jadi
 * tidak ada jalur kode kedua yang bisa menyimpang. Yang berbeda hanya cara log
 * ditemukan, dan bendera `backfill = true`.
 */

/**
 * Rentang AWAL per permintaan. Menyusut sendiri kalau provider menolak.
 *
 * 10.000 adalah batas keras drpc free untuk blok baru, bahkan dengan filter
 * topic. Tapi batas itu tidak tetap: untuk blok tua, permintaan yang sama
 * habis waktu. Terukur pada blok ~20,57 juta (≈24 bulan lalu), rentang 10.000
 * dijawab `"Request timeout on the free plan"` sementara rentang 1.000 dilayani
 * normal dengan 81 log.
 *
 * Artinya biaya per blok naik seiring umur — dan backfill justru bergerak
 * MUNDUR, makin lama makin tua. Karena itu rentangnya harus adaptif, bukan
 * konstan.
 */
const INITIAL_CHUNK = 10_000;

/** Di bawah ini menyusut lagi tidak menolong; providernya yang tidak sanggup. */
const MIN_CHUNK = 500;

/**
 * Di bawah ini backfill BERHENTI untuk protokol ini (dan melewati sisa
 * protokol lain di run yang sama), bukan terus merangkak selamanya.
 *
 * Aritmetika: kasus terpanjang yang benar-benar dipakai adalah 24 bulan
 * (lihat komentar `BackfillOptions.untilMonths` — dompet nyata dipindai 24
 * bulan lintas protokol). Itu ≈ 24 × 30,44 × 24 × 3600 / 12 = 5.260.032 blok.
 * `chunk` TIDAK PERNAH membesar kembali setelah menyusut (tidak ada logika
 * yang menaikkannya) — jadi begitu ia menyentuh sebuah nilai, nilai itu
 * berlaku untuk SISA seluruh rentang, bukan sesaat.
 *
 * Pada ambang 2.000 blok: 5.260.032 / 2.000 ≈ 2.631 panggilan HANYA untuk
 * SATU protokol SATU filter tersisa. Pada laju sehat terukur (~525
 * panggilan/protokol/tahun dalam ~20 menit lintas 4 protokol → ~1,75
 * panggilan/detik, lihat komentar `scanProtocol` di bawah), itu ≈25 menit
 * dalam kondisi TERBAIK — dan chunk yang sudah turun sejauh ini justru
 * membuktikan kondisinya BUKAN terbaik (RPC sedang menolak berulang kali,
 * itu sebabnya ia menyusut). Pada `MIN_CHUNK` (500, lantai keras di bawah
 * konstanta ini), sisa panggilan untuk rentang yang sama sudah 10.520 —
 * >3 jam bahkan pada laju sehat, dan job ini berbagi rate-limit RPC yang
 * sama dengan watcher live serta loop harga yang TIDAK BOLEH berhenti.
 *
 * Insiden yang memicu ini: chunk pernah menciut sampai 7 blok di produksi.
 * Pada ukuran itu, backfill 6 bulan (1.315.008 blok) = 1.315.008 / 7 ≈
 * 187.858 panggilan — praktis tidak akan pernah selesai, dan terus bersaing
 * dengan watcher/loop harga sepanjang percobaan sia-sia itu.
 */
const MIN_VIABLE_CHUNK_BLOCKS = 2_000;

/**
 * Jeda antar panggilan RPC.
 *
 * Bukan kehati-hatian berlebihan: 780 panggilan paralel membuat drpc membalas
 * HTTP 403 untuk SEMUA permintaan rentang lebar selama beberapa menit — dan
 * karena watcher live memakai RPC yang sama, backfill yang rakus bisa
 * menjatuhkan indexer produksi. Dijaga lambat dengan sengaja.
 */
const PACE_MS = 250;

/** Tarif proof di luar jendela 24 jam. Backfill SELALU kena tarif ini. */
const LAZY_PROOF_CTC = 3.13e-4;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface BackfillOptions {
  subject: string;
  /** Batas TERTUA yang dipindai, dalam bulan ke belakang dari head. */
  months: number;
  /**
   * Batas TERMUDA yang dipindai, dalam bulan ke belakang. 0 = sampai head.
   *
   * Ada karena skor tidak butuh riwayat yang LENGKAP, ia butuh riwayat yang
   * PANJANG. `repaymentCount` jenuh sekitar 40 pelunasan dan `repaymentVolume`
   * di 50 ribu USD; satu-satunya komponen yang benar-benar menuntut data lama
   * adalah `historyDuration`, dan itu ditentukan oleh satu angka saja —
   * `firstFactAt`.
   *
   * Terukur pada dompet nyata: 10% pertama dari rentang 24 bulan sudah
   * menghasilkan 1.277 transaksi, memproyeksikan ~3.200 batch atau ~23 jam
   * pengiriman CC3 untuk riwayat penuh. Memindai irisan tertua saja memberi
   * kenaikan skor yang sama dengan biaya sepersekian.
   */
  untilMonths: number;
  protocols: string[] | null;
  dryRun: boolean;
  /**
   * Didahulukan di antrean proving. Backfill demo berjalan di belakang ribuan
   * event latar, dan tanpa ini hasilnya baru terbaca berjam-jam kemudian.
   */
  priority: number;
}

function totalFound(found: Found[]): number {
  return found.reduce((n, f) => n + f.logs.length, 0);
}

interface Found {
  protocolName: string;
  protocolAddress: string;
  logs: ethers.Log[];
}

export interface BackfillResult {
  /** > 0 berarti riwayatnya BERLUBANG, bukan sekadar "ada yang lambat". */
  failedRanges: number;
  /** Log yang cocok subjek, sebelum dedup terhadap apa yang sudah tercatat. */
  logsFound: number;
  fromBlock: number;
  toBlock: number;
}

export async function backfillSubject(opts: BackfillOptions): Promise<BackfillResult> {
  const subject = ethers.getAddress(opts.subject);
  const targets = targetsFor(opts.protocols);

  const head = await ethCall('getBlock', (p) => p.getBlock('finalized'));
  if (!head) throw new Error('RPC Ethereum tidak mengembalikan blok finalized');

  const blocks = Math.round((opts.months * 30.44 * 24 * 3600) / 12);
  const skip = Math.round((opts.untilMonths * 30.44 * 24 * 3600) / 12);
  const floor = Math.max(0, head.number - blocks);
  const ceiling = Math.max(floor, head.number - skip);
  if (ceiling <= floor) throw new Error('--until-months harus lebih kecil dari --months');

  log.info(
    {
      subject,
      months: opts.months,
      fromBlock: floor,
      toBlock: ceiling,
      protocols: targets.map((t) => t.protocol.name),
      dryRun: opts.dryRun,
      priority: opts.priority,
    },
    'backfill mulai',
  );

  const found: Found[] = [];
  const failures: FailedRange[] = [];
  let inserted = 0;

  /**
   * Sekali RPC terbukti tidak sanggup (chunk turun ke bawah
   * `MIN_VIABLE_CHUNK_BLOCKS`) untuk satu protokol, mencoba protokol
   * berikutnya dari nol tidak akan berbeda hasilnya — provider yang menolak,
   * bukan protokolnya. Melewati sisanya TANPA memanggil RPC lagi mencegah run
   * yang sudah terbukti sia-sia membebani RPC yang sedang tertekan lebih jauh.
   */
  let unviable = false;

  /**
   * Transaksi yang sudah ada SEBELUM run ini menulis apa pun.
   *
   * Harus dikumpulkan di sini, bukan di `report()`. Karena insert terjadi per
   * potongan, laporan yang bertanya ke database setelah pemindaian selesai akan
   * menemukan SEMUANYA sudah ada — lalu melaporkan `txBaru: 0` dan biaya 0
   * untuk run yang baru saja menulis 66 baris. Angka yang salah di laporan
   * biaya lebih berbahaya daripada tidak ada laporan sama sekali.
   */
  const preExisting = opts.dryRun ? null : new Set<string>();

  for (const target of targets) {
    if (unviable) {
      // Tidak mencoba sama sekali — lihat komentar `unviable` di atas.
      failures.push({
        protocol: target.protocol.name,
        from: floor,
        to: ceiling,
        reason:
          'dilewati tanpa dicoba — RPC sudah terbukti tidak sanggup pada protokol sebelumnya di run yang sama',
      });
      found.push({ protocolName: target.protocol.name, protocolAddress: target.protocol.address, logs: [] });
      if (!opts.dryRun) {
        await recordCoverage({
          subject,
          protocol: target.protocol.address,
          fromBlock: floor,
          toBlock: ceiling,
          logsFound: 0,
          complete: false,
        });
      }
      continue;
    }

    const failedBefore = failures.length;
    const onChunk = opts.dryRun
      ? null
      : async (logs: ethers.Log[]): Promise<void> => {
          const hashes = [...new Set(logs.map((l) => l.transactionHash))];
          const rows = await sql<{ tx_hash: string }[]>`
            SELECT DISTINCT tx_hash FROM observed_events
            WHERE chain_key = ${ETH_CHAIN_KEY} AND tx_hash = ANY(${hashes})
          `;
          for (const r of rows) preExisting?.add(r.tx_hash.toLowerCase());

          const timestamps = await blockTimestamps(new Set(logs.map((l) => l.blockNumber)));
          await sql.begin(async (tx) => {
            inserted += await insertLogs(
              tx,
              target.protocol.address,
              logs,
              timestamps,
              true,
              opts.priority,
            );
          });
        };

    const { logs, aborted } = await scanProtocol(target, subject, floor, ceiling, onChunk, failures);
    found.push({
      protocolName: target.protocol.name,
      protocolAddress: target.protocol.address,
      logs,
    });

    // Dicatat per protokol begitu protokolnya selesai, bukan sekali di akhir.
    // Pemindaian empat protokol makan ~20 menit; kalau prosesnya mati di
    // protokol ketiga, dua protokol pertama sudah dibayar penuh dan tidak boleh
    // dilupakan hanya karena run-nya tidak sempat mencapai baris terakhir.
    //
    // `complete` otomatis `false` untuk protokol yang baru saja menyerah
    // karena chunk tidak layak: `scanProtocol` sudah men-push satu `FailedRange`
    // ke `failures` sebelum kembali, jadi `failures.length` di sini sudah
    // bertambah dan syarat `=== failedBefore` gagal dengan sendirinya.
    if (!opts.dryRun) {
      await recordCoverage({
        subject,
        protocol: target.protocol.address,
        fromBlock: floor,
        toBlock: ceiling,
        logsFound: logs.length,
        complete: failures.length === failedBefore,
      });
    }

    if (aborted) unviable = true;
  }

  await report(found, subject, preExisting, failures.length);

  if (failures.length > 0) {
    // Riwayat yang tidak lengkap tanpa ada yang tahu adalah kegagalan terburuk
    // di sini: skornya akan tampak sah, hanya lebih rendah dari seharusnya.
    log.error(
      { rentangGagal: failures.length, contoh: failures.slice(0, 5) },
      'sebagian rentang tidak terbaca — riwayat BELUM lengkap, jalankan ulang perintah yang sama',
    );
  }

  if (opts.dryRun) {
    log.info('dry-run: tidak ada yang ditulis ke database');
    return { failedRanges: failures.length, logsFound: totalFound(found), fromBlock: floor, toBlock: ceiling };
  }

  // Cursor TIDAK disentuh. Cursor menandai sampai mana watcher live sudah
  // memindai MAJU; memundurkannya karena backfill akan membuat watcher
  // memindai ulang berbulan-bulan sebagai lalu lintas live.
  log.info({ subject, inserted }, 'backfill selesai — event masuk antrean pipeline biasa');
  return { failedRanges: failures.length, logsFound: totalFound(found), fromBlock: floor, toBlock: ceiling };
}

/** Rentang yang tetap gagal setelah dipecah sampai batas bawah. */
export interface FailedRange {
  protocol: string;
  from: number;
  to: number;
  reason: string;
}

/**
 * Di bawah lebar ini, memecah lagi tidak masuk akal.
 *
 * Diukur, bukan ditebak. Pada pemindaian 12 bulan, drpc membalas
 * `method handler crashed` untuk sekumpulan blok di sekitar 24,46–24,48 juta —
 * dan tetap membalas hal yang sama pada rentang **312 blok**. Kegagalannya
 * melekat pada WILAYAH BLOK-nya, bukan pada lebar permintaannya.
 *
 * Dengan batas 500, tiap potongan bermasalah dipecah lima tingkat: 31 panggilan
 * yang semuanya gagal, untuk satu potongan. Dengan 2.500 batasnya dua tingkat —
 * cukup untuk menangkap kegagalan yang MEMANG soal ukuran, tanpa membakar
 * ratusan panggilan pada kegagalan yang bukan.
 */
const MIN_SPLIT = 2_500;

async function scanProtocol(
  target: BackfillTarget,
  subject: string,
  floor: number,
  head: number,
  onChunk: ((logs: ethers.Log[]) => Promise<void>) | null,
  failures: FailedRange[],
): Promise<{ logs: ethers.Log[]; aborted: boolean }> {
  const padded = ethers.zeroPadValue(subject, 32);
  const seen = new Map<string, ethers.Log>();
  const startedAt = Date.now();
  let calls = 0;
  let aborted = false;

  // Ukuran yang sudah terbukti dipakai ulang untuk potongan berikutnya, bukan
  // direset ke 10.000 tiap kali. Tanpa ini setiap potongan mengulang kegagalan
  // yang sama dari awal: gagal di 10.000, gagal di 5.000, baru berhasil — tiga
  // kali lipat panggilan untuk setiap potongan sepanjang sisa pemindaian.
  let chunk = INITIAL_CHUNK;

  outer: for (let to = head; to >= floor; to -= chunk) {
    const from = Math.max(floor, to - chunk + 1);
    const chunkLogs: ethers.Log[] = [];

    for (const filter of target.filters) {
      // topics: [topic0List, ...null padding..., subject]
      const topics: (string[] | string | null)[] = [filter.topics, null, null, null];
      topics[filter.position] = padded;
      const shape = topics.slice(0, filter.position + 1);

      const { logs, rpcCalls, workedAt } = await fetchRange(
        target.protocol.address,
        shape,
        from,
        to,
        target.protocol.name,
        failures,
      );
      calls += rpcCalls;
      if (workedAt !== null && workedAt < chunk) {
        log.info(
          { protocol: target.protocol.name, from: chunk, to: workedAt, block: from },
          'rentang dikecilkan untuk blok yang lebih tua',
        );
        chunk = Math.max(MIN_CHUNK, workedAt);

        // Lihat komentar `MIN_VIABLE_CHUNK_BLOCKS` untuk aritmetikanya. Rentang
        // [floor, to] yang belum terselesaikan dicatat sebagai SATU FailedRange
        // — sama seperti kegagalan biasa dari `fetchRange` — supaya rerun
        // nanti tahu persis apa yang masih perlu dipindai ulang, dan supaya
        // `recordCoverage` di pemanggil otomatis mencatat `complete: false`.
        if (chunk <= MIN_VIABLE_CHUNK_BLOCKS) {
          const remainingBlocks = to - floor + 1;
          const estimatedCalls = Math.ceil(remainingBlocks / chunk);
          const reason =
            `chunk adaptif turun ke ${chunk} blok (ambang minimum ${MIN_VIABLE_CHUNK_BLOCKS}) — ` +
            `sisa ${remainingBlocks} blok pada ukuran ini butuh ~${estimatedCalls} panggilan RPC ` +
            `lagi untuk protokol ini saja, dan chunk tidak pernah membesar kembali`;
          log.error(
            { protocol: target.protocol.name, chunk, remainingBlocks, estimatedCalls },
            'backfill dihentikan — chunk adaptif di bawah ambang layak',
          );
          failures.push({ protocol: target.protocol.name, from: floor, to, reason });
          aborted = true;
          break outer;
        }
      }

      // Satu log bisa cocok dua filter kalau posisinya kebetulan sama-sama
      // memuat subjek (mis. dompet melunasi utangnya sendiri di Morpho, di mana
      // `caller` dan `onBehalf` sama). Dedup per (tx, logIndex).
      for (const l of logs) {
        const key = `${l.transactionHash}:${l.index}`;
        if (!seen.has(key)) {
          seen.set(key, l);
          chunkLogs.push(l);
        }
      }
    }

    // Ditulis per POTONGAN, bukan setelah semuanya selesai.
    //
    // Pemindaian setahun atas empat protokol makan ~20 menit dan ~2.100
    // panggilan RPC. Kalau penulisan menunggu akhir, satu kegagalan di protokol
    // keempat membuang seluruh pekerjaan — dan itu persis yang terjadi pada
    // percobaan pertama. Insert-nya idempoten (observed_events_unique_log),
    // jadi menjalankan ulang hanya melanjutkan, bukan menduplikasi.
    if (onChunk && chunkLogs.length > 0) await onChunk(chunkLogs);
  }

  const out = [...seen.values()].sort((a, b) =>
    a.blockNumber !== b.blockNumber ? a.blockNumber - b.blockNumber : a.index - b.index,
  );
  log.info(
    { protocol: target.protocol.name, logs: out.length, rpcCalls: calls, durationMs: Date.now() - startedAt, aborted },
    'protokol dipindai',
  );
  return { logs: out, aborted };
}

/**
 * Mengambil satu rentang, memecahnya dua kalau provider gagal.
 *
 * Kegagalan di sini TIDAK menghentikan seluruh backfill. Pemindaian setahun
 * adalah ribuan panggilan; menjatuhkan semuanya karena satu rentang bermasalah
 * berarti pekerjaan ini tidak akan pernah selesai. Tapi rentang yang menyerah
 * juga tidak boleh hilang diam-diam — ia dicatat di `failures` dan dilaporkan
 * di akhir supaya bisa dijalankan ulang.
 */
async function fetchRange(
  address: string,
  topics: (string[] | string | null)[],
  from: number,
  to: number,
  protocolName: string,
  failures: FailedRange[],
): Promise<{ logs: ethers.Log[]; rpcCalls: number; workedAt: number | null }> {
  const width = to - from + 1;
  try {
    const logs = await getLogsWithRetry({ address, topics, fromBlock: from, toBlock: to });
    await sleep(PACE_MS);
    return { logs, rpcCalls: 1, workedAt: width };
  } catch (err) {
    if (width <= MIN_SPLIT) {
      log.error({ protocol: protocolName, from, to, err: String(err) }, 'rentang menyerah');
      failures.push({ protocol: protocolName, from, to, reason: String(err) });
      return { logs: [], rpcCalls: 1, workedAt: null };
    }
    const mid = Math.floor((from + to) / 2);
    log.warn({ protocol: protocolName, from, to, width }, 'rentang gagal, dipecah dua');
    const lo = await fetchRange(address, topics, from, mid, protocolName, failures);
    const hi = await fetchRange(address, topics, mid + 1, to, protocolName, failures);
    return {
      logs: [...lo.logs, ...hi.logs],
      rpcCalls: lo.rpcCalls + hi.rpcCalls,
      // Ukuran terkecil yang berhasil di antara kedua belahan — itulah yang
      // sanggup dilayani provider di wilayah blok ini.
      workedAt:
        lo.workedAt === null ? hi.workedAt
        : hi.workedAt === null ? lo.workedAt
        : Math.min(lo.workedAt, hi.workedAt),
    };
  }
}

/**
 * Retry dengan backoff.
 *
 * SEMUA error RPC diperlakukan transien di sini, dan itu disengaja. Percobaan
 * pertama gagal karena drpc membalas `-32000 "method handler crashed"` — bukan
 * 403, bukan 429, bukan timeout — sehingga daftar kata kunci yang sempit
 * melewatkannya dan menjatuhkan seluruh run 20 menit. Kegagalan yang benar-benar
 * struktural (rentang terlalu lebar) ditangani pemanggil dengan memecah
 * rentangnya, bukan di sini.
 *
 * Sengaja TIDAK mengembalikan array kosong saat gagal. RPC yang menjawab kosong
 * tanpa error adalah mode kegagalan yang sudah pernah menipu proyek ini
 * (llamarpc); menirunya di sini akan membuat backfill melaporkan "dompet tidak
 * punya riwayat" padahal permintaannya yang ditolak.
 */
async function getLogsWithRetry(filter: ethers.Filter): Promise<ethers.Log[]> {
  let delay = 2_000;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await ethGetLogs(filter);
    } catch (err) {
      if (attempt === 3) throw err;
      log.warn(
        { attempt, delayMs: delay, err: String(err).slice(0, 120) },
        'RPC gagal, mundur sejenak',
      );
      await sleep(delay);
      delay *= 2;
    }
  }
  throw new Error('unreachable');
}

/**
 * Perkiraan biaya dihitung dari batch SUNGGUHAN yang akan terbentuk, bukan dari
 * `ceil(tx / 10)`.
 *
 * Perbedaannya besar dan berlawanan dengan intuisi: batas span 999 blok berarti
 * transaksi yang terpisah berbulan-bulan TIDAK BISA satu batch. Riwayat 20
 * transaksi yang tersebar merata akan membentuk ~20 batch berisi satu, bukan 2
 * batch berisi sepuluh. Efisiensi batching — inti model biaya untuk lalu lintas
 * live — praktis hilang di backfill, dan perkiraan yang memakai ceil(tx/10)
 * akan meleset sepuluh kali lipat ke arah yang salah.
 */
async function report(
  found: Found[],
  subject: string,
  preExisting: Set<string> | null,
  failedRanges: number,
): Promise<void> {
  const allTx = new Map<string, ProvableTx>();
  let totalLogs = 0;

  for (const f of found) {
    totalLogs += f.logs.length;
    for (const l of f.logs) {
      allTx.set(`${l.blockNumber}:${l.transactionIndex}`, {
        txHash: l.transactionHash,
        blockHeight: l.blockNumber,
        txIndex: l.transactionIndex,
        observedAt: 0,
        priority: 0,
      });
    }
  }

  const txs = [...allTx.values()];
  if (txs.length === 0) {
    log.warn({ subject }, 'tidak ada satu pun log ditemukan untuk subjek ini');
    return;
  }

  // Sudah tercatat sebelumnya? Itu tidak akan dibayar dua kali — pipeline
  // menolaknya lewat observed_events_unique_log dan _markProcessed on-chain.
  //
  // Di dry-run tidak ada yang ditulis, jadi bertanya sekarang aman. Di run
  // sungguhan jawabannya sudah dikumpulkan sebelum insert pertama — lihat
  // `preExisting` di backfillSubject.
  let known: Set<string>;
  if (preExisting !== null) {
    known = preExisting;
  } else {
    const hashes = txs.map((t) => t.txHash);
    const existing = await sql<{ tx_hash: string }[]>`
      SELECT DISTINCT tx_hash FROM observed_events
      WHERE chain_key = ${ETH_CHAIN_KEY} AND tx_hash = ANY(${hashes})
    `;
    known = new Set(existing.map((e) => e.tx_hash.toLowerCase()));
  }
  const fresh = txs.filter((t) => !known.has(t.txHash.toLowerCase()));

  const batches = buildBatches(fresh);
  const heights = txs.map((t) => t.blockHeight);
  const spanDays = ((Math.max(...heights) - Math.min(...heights)) * 12) / 86_400;

  const sizes = new Map<number, number>();
  for (const b of batches) sizes.set(b.length, (sizes.get(b.length) ?? 0) + 1);

  log.info(
    {
      subject,
      totalLogs,
      totalTx: txs.length,
      sudahDiketahui: known.size,
      txBaru: fresh.length,
      perProtokol: Object.fromEntries(found.map((f) => [f.protocolName, f.logs.length])),
      rentangBlok: [Math.min(...heights), Math.max(...heights)],
      rentangHari: Number(spanDays.toFixed(1)),
      batchTerbentuk: batches.length,
      ukuranBatch: Object.fromEntries([...sizes.entries()].sort((a, b) => a[0] - b[0])),
      perkiraanBiayaProofCtc: Number((fresh.length * LAZY_PROOF_CTC).toFixed(6)),
      // Ikut di baris RINGKASAN, bukan hanya di baris error terpisah sesudahnya.
      // Ringkasan yang tidak menyebut lubang terbaca lengkap, dan itulah yang
      // membuat "127 tx" tampak final padahal satu rentang menyerah.
      rentangGagal: failedRanges,
    },
    'ringkasan backfill',
  );
}
