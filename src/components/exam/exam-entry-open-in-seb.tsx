'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CheckCircle2, Copy, Download, ExternalLink, Laptop, MonitorCheck, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { isMobileUserAgent } from '@/lib/seb'

/**
 * Plan 017 — panel shown on `/exam/[token]` when the request did NOT come from
 * the SelectIQ Secure Browser.
 *
 * On mount we fire the `selectiq://exam/<token>` deep link. A web page can't
 * tell whether SEB opened: Chrome's own prompt steals focus too, so a blur
 * is not proof of a handoff. The Download link is therefore visible from the
 * start, and after a few seconds we always switch to the full fallback
 * (download, retry, copy link). If SEB did open, this tab is behind it.
 */

/** Gives the student time to answer Chrome's “Open SIQ-Browser?” prompt. */
const LAUNCH_TIMEOUT_MS = 7000

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
  const [mobile, setMobile] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Pure side effect: does NOT touch state synchronously so it's safe to call
  // from the mount effect. The only state change is the deferred timeout.
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
    // Phones can't run the exam browser — don't fire a link that goes nowhere.
    if (isMobileUserAgent(navigator.userAgent)) queueMicrotask(() => setMobile(true))
    else fire()

    return clearTimer
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

  const linkBox = (
    <div className="flex gap-2">
      <input
        id="exam-url-input"
        readOnly
        value={examUrl}
        aria-label="Exam link"
        className="border-input bg-muted/40 min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-xs outline-none"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )

  if (mobile) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning/5 p-5">
        <div className="flex items-start gap-3">
          <span className="bg-warning/15 text-warning grid size-10 shrink-0 place-items-center rounded-xl">
            <Laptop className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">Open this exam on a laptop or desktop</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Exams run only in SIQ-Browser, a Windows app — it can’t run on a phone or tablet. On your computer, open the
              exam from Assessments, or use this link:
            </p>
          </div>
        </div>
        {linkBox}
      </div>
    )
  }

  return (
    <div className="from-primary/[0.06] to-highlight/[0.06] flex flex-col gap-4 rounded-2xl border bg-gradient-to-br p-5">
      <div className="flex items-start gap-3">
        <span className="bg-primary text-primary-foreground relative grid size-11 shrink-0 place-items-center rounded-xl shadow-sm">
          <MonitorCheck className="size-5" aria-hidden />
          {!timedOut ? <span className="bg-highlight absolute -top-1 -right-1 size-3 animate-ping rounded-full" /> : null}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{timedOut ? 'Didn’t open?' : 'Opening SIQ-Browser…'}</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {timedOut
              ? 'Install SIQ-Browser (one time, about 2 minutes), then open the exam again.'
              : 'Your exam runs in SIQ-Browser, SelectIQ’s secure exam app.'}
          </p>
        </div>
      </div>

      {!timedOut ? (
        <>
          <ol className="flex flex-col gap-2 text-sm">
            {[
              <>Chrome asks <b>“Open SIQ-Browser?”</b> — tick <i>Always allow</i> and click <b>Open SIQ-Browser</b>.</>,
              <>Sign in inside SIQ-Browser with this same account.</>,
              <>Pass the quick system check, then start your exam.</>,
            ].map((step, n) => (
              <li key={n} className="flex items-start gap-2.5">
                <span className="bg-background text-primary grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold">{n + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-xs">
            Don’t have SIQ-Browser, or Chrome didn’t ask?{' '}
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2">
              Download it here
            </a>
            .
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button render={<a href={downloadUrl} target="_blank" rel="noopener noreferrer" />}>
              <Download className="size-4" aria-hidden />
              Download SIQ-Browser
            </Button>
            <Button type="button" variant="outline" onClick={retry}>
              <RotateCw className="size-4" aria-hidden />
              Open it again
            </Button>
          </div>
          <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
            <li className="flex gap-1.5"><CheckCircle2 className="text-success mt-0.5 size-3.5 shrink-0" aria-hidden /> Already installed? Click <b className="text-foreground">Open it again</b> and allow Chrome’s prompt.</li>
            <li className="flex gap-1.5"><ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Or paste this link into SIQ-Browser:</li>
          </ul>
          {linkBox}
        </div>
      )}
    </div>
  )
}
