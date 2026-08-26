import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { config, VERSION } from './config.js';
import { ApiFailure, fail } from './lib/envelope.js';
import { rateLimit } from './lib/ratelimit.js';
import { facts } from './routes/facts.js';
import { score } from './routes/score.js';
import { status } from './routes/status.js';
import { marketRoutes } from './routes/market.js';
import { prices } from './routes/prices.js';
import { prove } from './routes/prove.js';
import { backfill } from './routes/backfill.js';

const logger = pino({ base: null, timestamp: pino.stdTimeFunctions.isoTime });

/** Hono menuntut variabel konteks dideklarasikan; tanpa ini c.set/c.get bertipe never. */
type Env = { Variables: { requestId: string } };

const app = new Hono<Env>();

// Data di sini seluruhnya publik dan berasal dari fakta on-chain yang bisa
// dibaca siapa pun, jadi tidak ada autentikasi maupun cookie di v1.
app.use('*', cors({ origin: '*' }));

app.use('*', async (c, next) => {
  const requestId = randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  const startedAt = Date.now();
  await next();
  logger.info(
    {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
    },
    'request',
  );
});

const v1 = new Hono<Env>();
v1.use('*', rateLimit({ perMinute: 120, burst: 20 }));
v1.route('/', status);
v1.route('/', facts);
v1.route('/', score);
v1.route('/', marketRoutes);
v1.route('/', prices);
v1.route('/', prove);
v1.route('/', backfill);
app.route('/v1', v1);

app.notFound((c) => fail(c, 'NOT_FOUND', `tidak ada route ${c.req.method} ${c.req.path}`));

app.onError((err, c) => {
  if (err instanceof ApiFailure) return fail(c, err.code, err.message);

  const message = err instanceof Error ? err.message : String(err);

  // Dependensi hilir yang mati bukan bug di API. Membedakannya membuat halaman
  // status bisa menunjuk penyebab sebenarnya alih-alih menyalahkan server.
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection|timeout|socket/i.test(message)) {
    logger.error({ requestId: c.get('requestId'), err: message }, 'upstream tidak tersedia');
    return fail(c, 'UPSTREAM_UNAVAILABLE', 'dependensi hilir tidak merespons');
  }

  logger.error({ requestId: c.get('requestId'), err: message, stack: (err as Error).stack }, 'error tak terduga');
  return fail(c, 'INTERNAL', `error tak terduga (requestId ${c.get('requestId')})`);
});

serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  logger.info({ port: info.port, version: VERSION }, 'api siap');
});
