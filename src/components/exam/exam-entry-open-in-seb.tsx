'use client'

import { useState } from 'react'
import { Copy, Download, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Plan 017 — panel shown on `/exam/[token]` when the request did NOT come from
 * the SelectIQ Secure Browser.
 *
 * The Electron shell does not register a `selectiq://` protocol, so we cannot
 * hand the URL off with a deep link. Instead: copy the URL, launch SIQ Secure
 * Browser, paste it into the address bar (which the shell already accepts).
 * A download link covers the "not installed yet" case.
 */
export default function ExamEntryOpenInSeb({
  examUrl,
  downloadUrl,
}: {
  examUrl: string
  downloadUrl: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(examUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Older browsers / permissions-denied — do a manual selection fallback.
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
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <p className="font-medium">Secure browser required</p>
        <p className="text-muted-foreground mt-1">
          Exams run inside the SelectIQ Secure Browser. Open it, then paste
          this link into its address bar.
        </p>
      </div>

      <div>
        <label htmlFor="exam-url-input" className="text-muted-foreground mb-1 block text-xs">
          Exam URL
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

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          render={<a href={downloadUrl} target="_blank" rel="noopener noreferrer" />}
        >
          <Download className="size-4" aria-hidden />
          Download SelectIQ Secure Browser
        </Button>
      </div>
    </div>
  )
}
