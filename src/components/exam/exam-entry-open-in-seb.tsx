'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Plan 017 — panel shown on `/exam/[token]` when the request did NOT come from
 * the SelectIQ Secure Browser.
 *
 * On mount we fire the `selectiq://exam/<token>` deep link. If SEB is
 * installed, the OS launches it and this tab loses focus — done. If nothing
 * responds in ~2.5s, we show the Download panel + a manual copy fallback so
 * a candidate can still paste the URL into SEB's address bar as a last resort.
 */

const LAUNCH_TIMEOUT_MS = 2500

export default function ExamEntryOpenInSeb({
  token,
  examUrl,
  downloadUrl,
}: {
  token: string
  examUrl: string
  downloadUrl: string
}) {
  const [copied, setCopied] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Pure side effect: does NOT touch state synchronously so it's safe to call
  // from the mount effect. State changes only occur later from the timeout or
  // from the external `blur`/`visibilitychange` listeners.
  const fire = useCallback(() => {
    clearTimer()
    timerRef.current = setTimeout(() => setTimedOut(true), LAUNCH_TIMEOUT_MS)
    window.location.href = `selectiq://exam/${token}`
  }, [token, clearTimer])

  const retry = useCallback(() => {
    setTimedOut(false)
    fire()
  }, [fire])

  useEffect(() => {
    // Blur / visibilitychange = OS handed off, we're done.
    const onBlur = () => clearTimer()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clearTimer()
    }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)

    fire()

    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimer()
    }
  }, [fire, clearTimer])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(examUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.getElementById('exam-url-input') as HTMLInputElement | null
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
  }, [examUrl])

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <p className="font-medium">
          {timedOut ? 'Secure browser required' : 'Opening SelectIQ Secure Browser…'}
        </p>
        <p className="text-muted-foreground mt-1">
          {timedOut
            ? 'It looks like the secure browser isn’t installed on this device yet. Download it, then click below to try again.'
            : 'Your OS is being asked to launch the secure browser. Approve the prompt if it appears.'}
        </p>
      </div>

      {timedOut ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              render={<a href={downloadUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <Download className="size-4" aria-hidden />
              Download SelectIQ Secure Browser
            </Button>
            <Button type="button" variant="outline" onClick={retry}>
              Try opening it again
            </Button>
          </div>

          <div>
            <label htmlFor="exam-url-input" className="text-muted-foreground mb-1 block text-xs">
              Already installed? Paste this URL into the SEB address bar.
            </label>
            <div className="flex gap-2">
              <input
                id="exam-url-input"
                readOnly
                value={examUrl}
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
      ) : null}
    </div>
  )
}
