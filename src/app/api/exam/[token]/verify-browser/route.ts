import { type NextRequest } from 'next/server'

import { successResponse } from '@/lib/api-response'
import { isSecureExamBrowserRequest, readSebSignals } from '@/lib/seb'

/**
 * Plan 017 — lightweight SEB self-check.
 *
 * The Electron shell hits this on startup (or right before entering the exam)
 * to confirm the server recognises it. It returns 200 with `ok: true|false`
 * and a `reason` string when false, rather than 403, so the shell can render
 * a helpful message ("your browser version is too old, please update") rather
 * than treat it as a hard fatal.
 *
 * The `token` param is unused for now — reserved so a future check can also
 * confirm the token is valid for this SEB session without exposing token
 * validity to a random UA.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const signals = readSebSignals(request.headers)
  const ok = isSecureExamBrowserRequest(request.headers)
  return successResponse({
    ok,
    reason: ok ? null : reasonFor(signals),
  })
}

function reasonFor(signals: { userAgent: string | null; header: string | null }): string {
  if (!signals.userAgent || !signals.userAgent.includes('SelectIQSecureBrowser')) {
    return 'user_agent_missing'
  }
  if (signals.header !== 'secure-browser-v1') {
    return signals.header ? 'header_version_mismatch' : 'header_missing'
  }
  return 'unknown'
}
