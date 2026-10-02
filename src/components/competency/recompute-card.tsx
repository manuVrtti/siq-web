'use client'

import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Plan 025 — rebuild every student's strengths & weaknesses from graded
 * results. Profiles already update on their own after grading; this is for
 * after bulk changes (or to double-check).
 */
export function RecomputeCard({ orgId, lastComputed, profiles }: { orgId: string; lastComputed: string | null; profiles: number }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/competency/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not recompute')
      const d = json.data
      setMsg({ ok: true, text: `Rebuilt ${d.students} student profile${d.students === 1 ? '' : 's'} from ${d.tests} test${d.tests === 1 ? '' : 's'}.` })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="siq-card siq-rise flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">Strengths &amp; weaknesses</h2>
        <p className="text-muted-foreground text-xs">
          Students’ topic and skill scores update automatically after grading.{' '}
          {profiles > 0
            ? `${profiles.toLocaleString('en-IN')} student${profiles === 1 ? ' has' : 's have'} a profile${lastComputed ? ` · last updated ${lastComputed}` : ''}.`
            : 'No profiles yet — they appear after a test that counts toward analytics is graded.'}{' '}
          Rebuild after retagging many questions.
        </p>
        {msg ? (
          <p role="status" className={msg.ok ? 'text-success mt-1 text-sm' : 'text-destructive mt-1 text-sm'}>
            {msg.text}
          </p>
        ) : null}
      </div>
      <Button variant="outline" onClick={run} disabled={busy} className="self-start sm:self-center">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
        Rebuild analytics
      </Button>
    </section>
  )
}
