import { NextResponse, type NextRequest } from 'next/server'

/**
 * SelectIQ proxy — PLACEHOLDER (Sprint 1 scaffold).
 *
 * Formerly `src/middleware.ts`. Next.js 16 renamed the convention to
 * `proxy.ts`; behaviour is identical, only the filename and exported function
 * name changed.
 *
 * Target behaviour (Layer 2 of the 3-layer exam link enforcement):
 *   - intercept every /exam/* route
 *   - require the Electron secure browser's User-Agent (SelectIQBrowser/{version})
 *   - redirect any normal browser to /browser-required
 *
 * Layer 1 is the Electron app (registers selectiq:// and sets the User-Agent).
 * Layer 3 is the /browser-required gateway page.
 *
 * Nothing is enforced yet — this file currently passes all traffic through so
 * the scaffold builds and routes normally. The check below is written out but
 * left disabled until the Electron User-Agent string is pinned down.
 */

/** Marker the Electron shell puts in its User-Agent. */
export const SECURE_BROWSER_UA = 'SelectIQBrowser'

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `request` is used by the enforcement block below, which is still commented out.
export default function proxy(request: NextRequest) {
  // TODO(sprint-exam): enable once the Electron build ships its User-Agent.
  //
  // const userAgent = request.headers.get('user-agent') ?? ''
  // if (!userAgent.includes(SECURE_BROWSER_UA)) {
  //   const url = request.nextUrl.clone()
  //   url.pathname = '/browser-required'
  //   url.searchParams.set('next', request.nextUrl.pathname)
  //   return NextResponse.redirect(url)
  // }

  return NextResponse.next()
}

export const config = {
  /**
   * Scoped to /exam/* only. Static assets, the API and the gateway page itself
   * must never be intercepted, or the redirect would loop.
   */
  matcher: ['/exam/:path*'],
}
