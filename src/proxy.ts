import { NextResponse, type NextRequest } from 'next/server'

import { DEV_USER_COOKIE, devBypassEnabled, isLocalHost } from '@/lib/auth/dev-bypass'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-constants'
import { isSecureExamBrowserRequest } from '@/lib/seb'

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

/**
 * Only the exam ATTEMPT surface is SEB-only. The entry page (`/exam/[token]`)
 * must stay reachable in an ordinary browser so a candidate who clicks their
 * invite link sees the "Open in SelectIQ Secure Browser" instructions.
 */
function requiresSecureBrowser(pathname: string): boolean {
  // Page: /exam/<token>/attempt (and any deeper sub-path if we add one)
  if (/^\/exam\/[^/]+\/attempt(\/|$)/.test(pathname)) return true
  // API: /api/exam/<token>/{start,answer,submit}
  if (/^\/api\/exam\/[^/]+\/(start|answer|submit)$/.test(pathname)) return true
  return false
}

function extractExamToken(pathname: string): string | null {
  const m = pathname.match(/^\/(?:api\/)?exam\/([^/]+)\//)
  return m ? m[1] : null
}

/**
 * The SEB self-check endpoint (`/api/exam/<token>/verify-browser`) must be
 * reachable without a session — the Electron shell hits it on startup, before
 * the candidate has signed in, to confirm the server recognises it.
 */
function isSebVerifyRoute(pathname: string): boolean {
  return /^\/api\/exam\/[^/]+\/verify-browser$/.test(pathname)
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true
  // Dev-login route (itself 404s outside `next dev` on localhost).
  if (devBypassEnabled() && (pathname === '/api/dev/login' || pathname.startsWith('/dev/'))) return true
  if (isHealthRoute(pathname)) return true
  if (isSebVerifyRoute(pathname)) return true
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true

  // Files with an extension are static assets (favicon.ico, og.png, ...).
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  // LOCAL DEV ONLY: the dev-login cookie counts as a session (lib/auth/dev-bypass.ts).
  const devSession =
    devBypassEnabled() &&
    isLocalHost(request.headers.get('host')) &&
    Boolean(request.cookies.get(DEV_USER_COOKIE)?.value)
  const hasSession = devSession || Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value)

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
  // Attempt routes are SEB-only. Everything else (including the entry page and
  // /api/exam/[token] for token metadata) stays reachable so a candidate can
  // read the instructions.
  if (requiresSecureBrowser(pathname) && !isSecureExamBrowserRequest(request.headers)) {
    // API callers get JSON with a stable error code — the SEB itself uses this
    // response to decide whether to prompt the user to reopen in SEB.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: { code: 'SECURE_BROWSER_REQUIRED', message: 'Secure browser required' } },
        { status: 403 },
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = '/browser-required'
    url.search = ''
    url.searchParams.set('next', pathname)
    const token = extractExamToken(pathname)
    if (token) url.searchParams.set('token', token)
    return NextResponse.redirect(url)
  }

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
