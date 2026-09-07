'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

/**
 * Plan 015 — the Start button on the entry page.
 *
 * On first click, POST /api/exam/{token}/start to create the attempt
 * (server-authoritative deadline) then route to the attempt page. On subsequent
 * loads the attempt already exists — server returns it idempotently and we go
 * straight to the runtime.
 */
export default function ExamEntryStart({
  token,
  started,
}: {
  token: string
  started: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/exam/${token}/start`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Could not start')
      router.push(`/exam/${token}/attempt`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={go} disabled={busy} className="self-start">
        {busy ? 'Loading…' : started ? 'Resume exam' : 'Start exam'}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
