import { Suspense } from 'react'
import type { Metadata } from 'next'

import GatewayClient from './gateway-client'

/**
 * /browser-required — Layer 3 of exam link enforcement.
 *
 * The interactive work lives in `GatewayClient`, which reads the `next` query
 * param. `useSearchParams` needs a Suspense boundary, otherwise this route
 * cannot be prerendered.
 */

export const metadata: Metadata = {
  title: 'Secure browser required — SelectIQ',
  // Exam links must never be indexed.
  robots: { index: false, follow: false },
}

export default function BrowserRequiredPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Opening SelectIQ…</h1>
        </main>
      }
    >
      <GatewayClient />
    </Suspense>
  )
}
