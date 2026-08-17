'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Layer 3 of exam link enforcement — the gateway.
 *
 * Reached when `src/proxy.ts` catches a request for /exam/* coming from an
 * ordinary browser instead of the Electron secure browser. This page tries to
 * hand the exam off via the `selectiq://` protocol, and falls back to a
 * download prompt when nothing picks it up.
 */

/**
 * Custom protocol registered by the Electron app (Layer 1).
 *
 * TODO(electron): confirm the URL shape the shipped app actually parses. The
 * Electron build predates this page, and CLAUDE.md documents only the scheme
 * name, not the path format. If it expects something other than
 * `selectiq://open?path=…`, this is the only line that needs to change.
 */
const PROTOCOL = 'selectiq'

/** TODO(release): point at the real installer once distribution is set up. */
const DOWNLOAD_URL = '/download'

/**
 * How long to wait before assuming nothing handled the deep link.
 * Long enough that a slow app launch is not mistaken for a missing install.
 */
const LAUNCH_TIMEOUT_MS = 2500

/**
 * Only same-origin, non-protocol-relative paths are forwarded into the deep
 * link. `next` arrives from the query string, so it is attacker-controllable —
 * without this an external URL could be smuggled into the Electron app.
 */
function safeNextPath(raw: string | null): string {
  if (!raw) return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

function buildDeepLink(path: string): string {
  return `${PROTOCOL}://open?path=${encodeURIComponent(path)}`
}

export default function GatewayClient() {
  const searchParams = useSearchParams()
  const target = safeNextPath(searchParams.get('next'))

  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /**
   * Fires the deep link and arms the fallback timer. Deliberately free of any
   * synchronous setState so it can be called straight from the mount effect —
   * the only state change is inside the timeout callback.
   */
  const launch = useCallback(() => {
    clearTimer()
    timerRef.current = setTimeout(() => setTimedOut(true), LAUNCH_TIMEOUT_MS)
    window.location.href = buildDeepLink(target)
  }, [target, clearTimer])

  /** Retry is user-initiated, so resetting the flag here is safe. */
  const retry = useCallback(() => {
    setTimedOut(false)
    launch()
  }, [launch])

  useEffect(() => {
    // When the OS hands off to Electron, this tab loses focus or is hidden.
    // Either signal means the handoff worked, so cancel the fallback.
    const onBlur = () => clearTimer()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clearTimer()
    }

    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)

    launch()

    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimer()
    }
  }, [launch, clearTimer])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {timedOut ? 'SelectIQ secure browser required' : 'Opening SelectIQ…'}
      </h1>

      {timedOut ? (
        <>
          <p className="text-sm leading-relaxed opacity-70">
            Exams run inside the SelectIQ secure browser. If it is installed,
            your browser may have asked for permission to open it — check for a
            prompt. Otherwise, install it and open this link again.
          </p>

          <div className="flex w-full flex-col gap-3">
            <a
              href={DOWNLOAD_URL}
              className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Download SelectIQ
            </a>

            <button
              type="button"
              onClick={retry}
              className="rounded-md border border-current/20 px-4 py-2.5 text-sm font-medium transition-colors hover:border-current/40"
            >
              Try opening it again
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm leading-relaxed opacity-70">
          Handing this exam to the SelectIQ secure browser. Approve the prompt if
          your browser asks.
        </p>
      )}

      <p className="text-xs opacity-40" aria-live="polite">
        {timedOut ? 'Nothing responded to the secure browser link.' : 'Waiting…'}
      </p>
    </main>
  )
}
