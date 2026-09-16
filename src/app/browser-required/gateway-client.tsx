'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Copy, Download, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Plan 017 — Layer 3 of exam link enforcement.
 *
 * Reached when the middleware catches a request for `/exam/<token>/attempt`
 * (or the exam API) coming from an ordinary browser instead of the SelectIQ
 * Secure Browser. The Electron shell does not register a `selectiq://`
 * protocol handler, so we cannot deep-link the URL. Instead:
 *
 *   1. Show the destination URL and a copy button.
 *   2. Offer a download link for the shell.
 *   3. Instruct the candidate to paste the URL into SEB's address bar.
 *
 * The `next` and `token` search params are attacker-controllable, so we only
 * accept a same-origin path and rebuild the absolute URL against the current
 * `window.location.origin`.
 */

const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_SEB_DOWNLOAD_URL ||
  'https://github.com/manuVrtti/siq-Secure-browser/releases/latest'

function safeNextPath(raw: string | null): string {
  if (!raw) return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export default function GatewayClient() {
  const searchParams = useSearchParams()
  const target = safeNextPath(searchParams.get('next'))
  const [copied, setCopied] = useState(false)
  // 'use client' — origin is only read in the browser. useMemo keeps the URL
  // stable across renders without a useEffect + setState round-trip.
  const absoluteUrl = useMemo(
    () => (typeof window === 'undefined' ? target : `${window.location.origin}${target}`),
    [target],
  )

  async function copy() {
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
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Secure browser required</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Exams run inside the SelectIQ Secure Browser. Open it, then paste
          this link into its address bar.
        </p>
      </div>

      <div className="w-full text-left">
        <label
          htmlFor="gateway-url-input"
          className="text-muted-foreground mb-1 block text-xs"
        >
          Exam URL
        </label>
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

      <Button
        variant="outline"
        render={<a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />}
      >
        <Download className="size-4" aria-hidden />
        Download SelectIQ Secure Browser
      </Button>

      <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-left text-sm">
        <li>Install the SelectIQ Secure Browser (link above) if you haven&apos;t already.</li>
        <li>Open it — it launches to an address bar.</li>
        <li>Paste the exam URL and press Enter.</li>
      </ol>
    </main>
  )
}
