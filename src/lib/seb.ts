import { SecureBrowserRequiredError } from '@/lib/errors'

/**
 * Plan 017 — Secure Exam Browser (SEB) detection.
 *
 * The Electron shell (github.com/manuVrtti/siq-Secure-browser) advertises
 * itself two ways on every outbound request:
 *
 *   1. `User-Agent: SelectIQSecureBrowser/<version> (<platform>; Electron/…)`
 *   2. `X-SelectIQ-Browser: secure-browser-v1`
 *
 * We accept a request as coming from SEB only when BOTH match. Either alone is
 * cheap to spoof from curl; requiring both raises the bar without any real UX
 * cost, because a genuine SEB always sends both. This is defense in depth, not
 * a security boundary — the true guarantee is the Electron shell's lockdown
 * (no dev tools, no navigation, no clipboard). This check just refuses to
 * serve the attempt page to something that clearly isn't the shell.
 *
 * Detection lives here (not in `proxy.ts`) so middleware, API routes and
 * server components can all reuse the same rules.
 */

/** UA substring the Electron shell always injects (case-sensitive). */
export const SEB_USER_AGENT_MARKER = 'SelectIQSecureBrowser'

/** Custom header name (lowercase — Node/Next normalises header keys). */
export const SEB_HEADER_NAME = 'x-selectiq-browser'

/** Expected value of the header; bumped when the wire format changes. */
export const SEB_HEADER_VALUE = 'secure-browser-v1'

/** Where to send someone who does not have SEB installed. Env-overridable. */
export const SEB_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_SEB_DOWNLOAD_URL ||
  // The exam browser's repo. Its Releases must be downloadable by the public.
  'https://github.com/manuVrtti/siq-Secure-browser/releases/latest'

export type SebSignals = {
  userAgent: string | null
  header: string | null
}

/**
 * Pull the two signals off any Fetch-style Headers or a plain object.
 * Accepts `Headers` (Next request), `ReadonlyHeaders` (server components),
 * and a fallback record shape for tests.
 */
export function readSebSignals(
  headers: Headers | { get(name: string): string | null | undefined },
): SebSignals {
  return {
    userAgent: headers.get('user-agent') ?? null,
    header: headers.get(SEB_HEADER_NAME) ?? null,
  }
}

/** True only when BOTH the UA marker and the header value match. */
export function isSecureExamBrowser(signals: SebSignals): boolean {
  if (!signals.userAgent || !signals.userAgent.includes(SEB_USER_AGENT_MARKER)) return false
  if (signals.header !== SEB_HEADER_VALUE) return false
  return true
}

/** Convenience wrapper for callers that only have the Headers object. */
export function isSecureExamBrowserRequest(
  headers: Headers | { get(name: string): string | null | undefined },
): boolean {
  return isSecureExamBrowser(readSebSignals(headers))
}

/**
 * Assert the request came from SEB, or throw. API routes call this after
 * `requireAuth()` so the identity error, if any, fires first.
 */
export function requireSecureBrowser(
  headers: Headers | { get(name: string): string | null | undefined },
): void {
  if (isSecureExamBrowserRequest(headers)) return
  throw new SecureBrowserRequiredError()
}

/** Phones and tablets can't run the exam browser (desktop app). */
export function isMobileUserAgent(ua: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)
}

/**
 * A same-site path that is safe to redirect to after sign-in. Rejects
 * absolute URLs, protocol-relative (//host) and backslash tricks.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300) return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || raw.includes('://')) return null
  if (raw === '/login' || raw.startsWith('/login?')) return null
  return raw
}
