import { NextResponse, type NextRequest } from 'next/server';
import { APP_ORIGIN, SITE_ORIGIN, isAppPath } from '@/lib/hosts';

/**
 * Host split: the landing lives on SITE_ORIGIN, the app on APP_ORIGIN.
 *
 * Redirects, not rewrites. A rewrite would let the same page answer on both
 * hosts, and a wallet connection is scoped per origin — a user could connect on
 * one host, land on the other through an old link, and find themselves
 * disconnected with no visible reason.
 *
 * 307, not 308: browsers cache permanent redirects indefinitely, so a wrong
 * domain value would keep sending visitors to the old host even after the env
 * var is fixed and redeployed.
 */
export function proxy(request: NextRequest) {
  if (APP_ORIGIN === null || SITE_ORIGIN === null) return NextResponse.next();

  const host = request.headers.get('host');
  const { pathname, search } = request.nextUrl;

  if (host === new URL(APP_ORIGIN).host && pathname === '/') {
    return NextResponse.redirect(new URL(`/proofs${search}`, APP_ORIGIN));
  }

  if (host === new URL(SITE_ORIGIN).host && isAppPath(pathname)) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, APP_ORIGIN));
  }

  // Any other host — Vercel preview URLs above all — serves everything, so a
  // preview can be reviewed without its own pair of domains.
  return NextResponse.next();
}

export const config = {
  // Build assets and static files never need the split. Extensions are listed
  // rather than written as a character class: `matcher` goes through
  // path-to-regexp, and `[a-zA-Z0-9]+` silently turned the whole pattern into
  // one that matched only `/` — every app path skipped the proxy with no error.
  matcher: ['/((?!_next/static|_next/image|api/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)'],
};
