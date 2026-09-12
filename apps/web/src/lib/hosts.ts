/**
 * Landing and app are served by the SAME build, split only by host.
 *
 * One Vercel project with two domains, not two projects: a second project
 * would duplicate every env var and build, and the two could drift to
 * different commits — a landing advertising features the app it links to no
 * longer has.
 *
 * `null` means the split is not configured (a Vercel preview URL, or a
 * production build without the env vars). Everything then works as one site
 * with relative links, instead of pointing visitors at a host that may not
 * exist.
 */
const IS_DEV = process.env.NODE_ENV === 'development';

function toOrigin(value: string | undefined, devFallback: string): string | null {
  const raw = value ?? (IS_DEV ? devFallback : undefined);
  if (raw === undefined || raw === '') return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

// Chrome and Firefox resolve every `*.localhost` to loopback with no hosts
// file entry, so the split can be exercised locally on one dev server.
export const SITE_ORIGIN = toOrigin(process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000');
export const APP_ORIGIN = toOrigin(process.env.NEXT_PUBLIC_APP_URL, 'http://app.localhost:3000');

/** Path prefixes that belong to the app host. */
export const APP_PATHS = ['/proofs', '/market', '/portfolio', '/score'] as const;

export function isAppPath(pathname: string): boolean {
  return APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * An app path as an absolute URL on the app host, or the bare path when the
 * split is not configured.
 *
 * Absolute on purpose: `next/link` and `router.push` assume same-origin
 * navigation, and across hosts they would fetch an RSC payload from the
 * landing host that the proxy then redirects away.
 */
export function appHref(path: `/${string}`): string {
  return APP_ORIGIN === null ? path : `${APP_ORIGIN}${path}`;
}
