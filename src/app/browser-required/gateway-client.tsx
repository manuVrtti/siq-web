'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Copy, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SEB_DOWNLOAD_URL, isMobileUserAgent } from '@/lib/seb'

/**
 * Plan 017 — Layer 3 of exam link enforcement.
 *
 * Reached when the middleware catches a request for `/exam/<token>/attempt`
 * (or the exam API) coming from an ordinary browser instead of the SelectIQ
 * Secure Browser. Flow:
 *
 *   1. If we have a token, immediately fire a `selectiq://exam/<token>` deep
 *      link. If SEB is installed, the OS launches it and this tab loses
 *      focus — that's success.
 *   2. If nothing responds within ~2.5s (focus still here, tab still visible),
 *      show the Download panel + copy-URL fallback.
 *   3. Manual retry re-fires the deep link.
 *
 * `next` and `token` in the query string are attacker-controllable, so only
 * same-origin `next` paths and the alphanumeric shape of a token are accepted.
 */

const DOWNLOAD_URL = SEB_DOWNLOAD_URL

/** How long to wait for SEB to take focus before assuming it isn't installed. */
const LAUNCH_TIMEOUT_MS = 2500

function safeNextPath(raw: string | null): string {
  if (!raw) return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

function safeToken(raw: string | null): string | null {
  if (!raw) return null
  return /^[A-Za-z0-9_-]{6,}$/.test(raw) ? raw : null
}

export default function GatewayClient() {
  const searchParams = useSearchParams()
  const target = safeNextPath(searchParams.get('next'))
  const token = safeToken(searchParams.get('token'))

  const [copied, setCopied] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [mobile, setMobile] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const absoluteUrl = useMemo(
    () => (typeof window === 'undefined' ? target : `${window.location.origin}${target}`),
    [target],
  )
  const deepLink = token ? `selectiq://exam/${token}` : null

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Pure side effect: does NOT set state synchronously so it's safe to call
  // from the mount effect. The only state change is the deferred
  // `setTimedOut(true)` inside setTimeout.
  const fire = useCallback(() => {
    if (!deepLink) return
    clearTimer()
    timerRef.current = setTimeout(() => setTimedOut(true), LAUNCH_TIMEOUT_MS)
    window.location.href = deepLink
  }, [deepLink, clearTimer])

  const retry = useCallback(() => {
    setTimedOut(false)
    fire()
  }, [fire])

  useEffect(() => {
    // The moment the tab loses focus or is hidden, the OS handed off to SEB.
    // Cancel the fallback so we don't nag someone who is already inside SEB.
    const onBlur = () => clearTimer()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clearTimer()
    }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)

    if (isMobileUserAgent(navigator.userAgent)) {
      // Phones can't run the exam browser — explain instead of firing a dead link.
      queueMicrotask(() => {
        setMobile(true)
        setTimedOut(true)
      })
    } else if (deepLink) {
      fire()
    } else {
      // No token → nothing to hand off. Show the manual copy panel straight
      // away. Runs asynchronously so this isn't a sync setState in an effect.
      queueMicrotask(() => setTimedOut(true))
    }

    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimer()
    }
  }, [deepLink, fire, clearTimer])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.getElementById('gateway-url-input') as HTMLInputElement | null
      if (input) {
        input.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          /* ignore */
        }
      }
    }
  }, [absoluteUrl])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mobile ? 'Open this exam on a laptop or desktop' : timedOut ? 'SIQ-Browser required' : 'Opening SIQ-Browser…'}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {mobile
            ? 'Exams run only in SIQ-Browser, a desktop app — it can’t run on a phone or tablet. Open the exam from Assessments on your computer.'
            : timedOut
              ? 'Exams run inside SIQ-Browser. Install it (one time), then click below to try again.'
              : 'Chrome will ask “Open SIQ-Browser?” — tick Always allow and click Open.'}
        </p>
      </div>

      {timedOut && !mobile ? (
        <>
          <Button
            render={<a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />}
          >
            <Download className="size-4" aria-hidden />
            Download SIQ-Browser
          </Button>

          {deepLink ? (
            <Button type="button" variant="outline" onClick={retry}>
              Try opening it again
            </Button>
          ) : null}

          <div className="w-full text-left">
            <p className="text-muted-foreground mb-2 text-xs">
              Already installed? Copy this link and paste it into SIQ-Browser.
            </p>
            <div className="flex gap-2">
              <input
                id="gateway-url-input"
                readOnly
                value={absoluteUrl}
                className="border-input flex-1 rounded-md border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={copy} className="shrink-0">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          Waiting for SIQ-Browser to open…
        </p>
      )}
    </main>
  )
}
