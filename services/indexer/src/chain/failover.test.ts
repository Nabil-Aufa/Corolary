import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ethers } from 'ethers';
import {
  splitRange,
  getLogsWithFailover,
  withFailover,
  FALLBACK_MAX_LOG_RANGE,
  FALLBACK_MAX_SPLITS,
  _resetDegradedState,
} from './failover.js';

/**
 * Failover RPC. Yang diuji di sini bukan "apakah bisa berpindah", melainkan
 * apakah perpindahannya JUJUR — provider cadangan tidak setara dengan yang
 * utama, dan berpura-pura setara adalah cara kehilangan event tanpa gejala.
 */

type P = ethers.JsonRpcProvider;

function provider(over: Partial<{ getLogs: (f: unknown) => Promise<unknown[]> }>): P {
  return { getLogs: async () => [], ...over } as unknown as P;
}

const log = (blockNumber: number): ethers.Log => ({ blockNumber }) as ethers.Log;

test('splitRange memecah inklusif dan tidak melewatkan satu blok pun', () => {
  assert.deepEqual(splitRange(100, 129, 10), [
    [100, 109],
    [110, 119],
    [120, 129],
  ]);
  // Sisa yang tidak bulat harus tetap terpanen, bukan dibuang.
  assert.deepEqual(splitRange(100, 122, 10), [
    [100, 109],
    [110, 119],
    [120, 122],
  ]);
  assert.deepEqual(splitRange(5, 5, 10), [[5, 5]]);
  assert.deepEqual(splitRange(10, 9, 10), []);
});

test('splitRange menutupi rentang secara utuh dan bersambung', () => {
  // Celah satu blok di sini berarti event di blok itu tidak pernah terbaca,
  // sementara cursor tetap maju melewatinya — kehilangan permanen.
  const parts = splitRange(1_000, 1_237, 10);
  assert.equal(parts[0]?.[0], 1_000);
  assert.equal(parts[parts.length - 1]?.[1], 1_237);
  for (let i = 1; i < parts.length; i++) {
    assert.equal(parts[i]![0], parts[i - 1]![1] + 1, 'potongan harus bersambung');
  }
});

test('primary sukses -> cadangan tidak pernah disentuh', async () => {
  _resetDegradedState();
  let fallbackCalls = 0;
  const out = await getLogsWithFailover(
    provider({ getLogs: async () => [log(1)] }),
    provider({
      getLogs: async () => {
        fallbackCalls++;
        return [];
      },
    }),
    { fromBlock: 1, toBlock: 2 },
  );
  assert.equal(out.length, 1);
  assert.equal(fallbackCalls, 0);
});

test('primary gagal -> rentang dipecah ke batas cadangan', async () => {
  _resetDegradedState();
  const seen: [number, number][] = [];
  const out = await getLogsWithFailover(
    provider({
      getLogs: async () => {
        throw new Error('method handler crashed');
      },
    }),
    provider({
      getLogs: async (f) => {
        const ff = f as { fromBlock: number; toBlock: number };
        seen.push([ff.fromBlock, ff.toBlock]);
        return [log(ff.fromBlock)];
      },
    }),
    { fromBlock: 100, toBlock: 129 },
  );

  assert.equal(seen.length, 3, `30 blok / ${FALLBACK_MAX_LOG_RANGE} = 3 permintaan`);
  assert.deepEqual(seen[0], [100, 109]);
  assert.deepEqual(seen[2], [120, 129]);
  // Hasil tiap potongan digabung, bukan hanya yang terakhir.
  assert.equal(out.length, 3);
});

test('rentang yang terlalu lebar untuk cadangan MELEMPAR, bukan mengembalikan kosong', async () => {
  // Ini pertahanan terhadap mode kegagalan yang sudah pernah menipu proyek ini:
  // llamarpc menjawab `result: []` untuk rentang berisi 711 log Aave. Kalau
  // failover meniru itu, watcher menyimpulkan protokolnya sepi lalu memajukan
  // cursor melewati event yang tidak pernah terbaca — hilang permanen, tanpa
  // satu pun gejala.
  _resetDegradedState();
  let fallbackCalls = 0;
  const span = (FALLBACK_MAX_SPLITS + 5) * FALLBACK_MAX_LOG_RANGE;

  await assert.rejects(
    () =>
      getLogsWithFailover(
        provider({
          getLogs: async () => {
            throw new Error('429');
          },
        }),
        provider({
          getLogs: async () => {
            fallbackCalls++;
            return [];
          },
        }),
        { fromBlock: 0, toBlock: span },
      ),
    /cadangan tidak sanggup/,
  );
  assert.equal(fallbackCalls, 0, 'jangan membanjiri cadangan sebelum menyerah');
});

test('tanpa cadangan, error primary diteruskan apa adanya', async () => {
  _resetDegradedState();
  await assert.rejects(
    () =>
      getLogsWithFailover(
        provider({
          getLogs: async () => {
            throw new Error('drpc mati');
          },
        }),
        null,
        { fromBlock: 1, toBlock: 2 },
      ),
    /drpc mati/,
  );
});

test('label blok non-numerik diteruskan tanpa dipecah', async () => {
  // 'finalized' tidak punya nomor untuk dipecah. Memaksanya jadi NaN akan
  // menghasilkan rentang karangan.
  _resetDegradedState();
  let received: unknown = null;
  await getLogsWithFailover(
    provider({
      getLogs: async () => {
        throw new Error('gagal');
      },
    }),
    provider({
      getLogs: async (f) => {
        received = f;
        return [];
      },
    }),
    { fromBlock: 'finalized', toBlock: 'finalized' } as unknown as ethers.Filter,
  );
  assert.deepEqual(received, { fromBlock: 'finalized', toBlock: 'finalized' });
});

test('withFailover memakai cadangan hanya setelah primary gagal', async () => {
  _resetDegradedState();
  const order: string[] = [];
  const primary = { tag: 'primary' } as unknown as P;
  const fallback = { tag: 'fallback' } as unknown as P;

  const ok = await withFailover('getBlock', primary, fallback, async (p) => {
    order.push((p as unknown as { tag: string }).tag);
    return 1;
  });
  assert.equal(ok, 1);
  assert.deepEqual(order, ['primary']);

  const out = await withFailover('getBlock', primary, fallback, async (p) => {
    const tag = (p as unknown as { tag: string }).tag;
    order.push(tag);
    if (tag === 'primary') throw new Error('mati');
    return 2;
  });
  assert.equal(out, 2);
  assert.deepEqual(order, ['primary', 'primary', 'fallback']);
});
