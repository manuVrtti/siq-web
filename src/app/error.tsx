'use client'

import { useEffect } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

/**
 * Plan 010 — global error boundary.
 *
 * Next.js renders this for any unhandled error in a route segment below it.
 *
 * `error.message` is deliberately NOT shown. In production Next replaces it
 * with a generic string anyway, but in development it can carry connection
 * strings and stack traces, and this component is the one most likely to be
 * screenshotted and shared while debugging.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sentry or similar goes here when monitoring lands (out of scope, Plan 010).
    console.error('[boundary]', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          An unexpected error occurred. Trying again often works; if it keeps
          happening, the reference below helps us find it.
        </p>
        {error.digest && (
          <p className="text-muted-foreground font-mono text-xs">
            Reference: {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          Back to dashboard
        </Button>
      </div>
    </main>
  )
}
