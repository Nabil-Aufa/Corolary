import type { Context, Next } from 'hono';
import { fail } from './envelope.js';

/**
 * Token bucket per IP, in-memory (docs/api.md §0.7).
 *
 * In-memory disengaja: API ini stateless dan hanya berjalan satu instance di
 * skala testnet. Menambah Redis untuk rate limit berarti satu dependensi lagi
 * yang bisa mati saat demo, demi kuota yang tidak pernah tercapai.
 */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  perMinute: number;
  burst: number;
}

export function rateLimit(opts: RateLimitOptions) {
  const refillPerMs = opts.perMinute / 60_000;

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown';
    const key = `${opts.perMinute}:${ip}`;
    const now = Date.now();

    const bucket = buckets.get(key) ?? { tokens: opts.burst, updatedAt: now };
    bucket.tokens = Math.min(opts.burst, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
    bucket.updatedAt = now;

    c.header('X-RateLimit-Limit', String(opts.perMinute));

    if (bucket.tokens < 1) {
      const waitMs = (1 - bucket.tokens) / refillPerMs;
      const retryAfter = Math.max(1, Math.ceil(waitMs / 1000));
      buckets.set(key, bucket);
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(Math.ceil((now + waitMs) / 1000)));
      c.header('Retry-After', String(retryAfter));
      return fail(c, 'RATE_LIMITED', `Rate limit exceeded, retry after ${retryAfter}s`);
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket);
    c.header('X-RateLimit-Remaining', String(Math.floor(bucket.tokens)));
    c.header('X-RateLimit-Reset', String(Math.ceil((now + 60_000) / 1000)));

    await next();
  };
}

/** Ember IP yang lama diam dibuang supaya map tidak tumbuh tanpa batas. */
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [k, b] of buckets) if (b.updatedAt < cutoff) buckets.delete(k);
}, 60_000).unref();
