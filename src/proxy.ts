import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-constants'

/**
 * SelectIQ proxy — auth enforcement (Plan 006) and exam link enforcement.
 *
 * Next.js allows exactly one proxy file, so both concerns live here. Plan 006
 * specifies `middleware.ts` at the project root; Next.js 16 renamed that
 * convention to `proxy.ts`, and this file already existed for exam gating.
 *
 * ⚠️  This is a coarse gate, not the security boundary. It checks only that a
 *     session cookie is PRESENT — it does not verify the signature or expiry,
 *     because that needs the Firebase Admin SDK, which cannot run here and
 *     would cost a network round trip on every asset request.
 *
 *     The real check is `requireAuth()` in API routes and `getCurrentUser()`
 *     in server components. A forged cookie value gets past this file and is
 *     rejected there. Never treat "the proxy let it through" as authenticated.
 */

/** Reachable with no session. */
const PUBLIC_ROUTES = new Set([
  '/',
  '/login',
  '/browser-required',
  '/api/auth/session',
  // Plan 005 — listed ahead of implementation so phone login is not locked out
  // the moment those routes land.
  '/api/auth/phone/send-otp',
  '/api/auth/phone/verify-otp',
])

/**
 * Health checks must be reachable without a session — an uptime monitor has no
 * credentials, and a probe that 401s reads as an outage. Matched by prefix so
 * new checks added under /api/health are public automatically rather than
 * silently returning 401 until someone notices.
 */
function isHealthRoute(pathname: string): boolean {
  return pathname === '/api/health' || pathname.startsWith('/api/health/')
}

/** Prefixes always allowed: framework internals and static assets. */
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/public', '/static']

/** Marker the Electron shell puts in its User-Agent. */
export const SECURE_BROWSER_UA = 'SelectIQBrowser'

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true
  if (isHealthRoute(pathname)) return true
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true

  // Files with an extension are static assets (favicon.ico, og.png, ...).
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value)

  if (!hasSession) {
    // API callers get JSON; a redirect would be unparseable to fetch().
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // --- Exam link enforcement (Layer 2) --------------------------------------
  // Exam routes additionally require the Electron secure browser.
  //
  // TODO(sprint-exam): enable once the Electron build ships its User-Agent.
  //
  // if (pathname.startsWith('/exam')) {
  //   const userAgent = request.headers.get('user-agent') ?? ''
  //   if (!userAgent.includes(SECURE_BROWSER_UA)) {
  //     const url = request.nextUrl.clone()
  //     url.pathname = '/browser-required'
  //     url.searchParams.set('next', pathname)
  //     return NextResponse.redirect(url)
  //   }
  // }

  return NextResponse.next()
}

export const config = {
  /**
   * Everything except framework internals. `isPublic()` does the finer-grained
   * allowlisting, so this only needs to exclude what should never even reach
   * the function.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
