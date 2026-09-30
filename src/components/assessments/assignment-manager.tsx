'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Plan 013 — assignment manager UI.
 *
 * Assign an assessment to individual candidates or an entire batch, view the
 * status table, copy per-candidate invite links, and revoke.
 *
 * Actual invitation SENDING (email + SMS) is deferred — email needs a
 * provider and SMS needs the MSG91 client-side integration from Plan 005.
 * The invite link is the deliverable; a "Send" button will attach later.
 */

type Candidate = { id: string; email: string | null; phone: string | null; name: string | null; claimed: boolean }
type Batch = { id: string; name: string; membersCount: number }
type Assignment = {
  id: string
  token: string
  status: string
  invitedAt: string
  user: { id: string; email: string | null; phone: string | null; name: string | null }
}

const STATUS_VARIANT: Record<string, 'secondary' | 'outline'> = {
  INVITED: 'outline',
  STARTED: 'secondary',
  SUBMITTED: 'secondary',
  EXPIRED: 'outline',
}

export default function AssignmentManager({
  assessmentId,
  candidates,
  batches,
  assignments,
  baseUrl,
}: {
  assessmentId: string
  candidates: Candidate[]
  batches: Batch[]
  assignments: Assignment[]
  baseUrl: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const alreadyAssigned = new Set(assignments.map((a) => a.user.id))
  const addable = candidates.filter((c) => !alreadyAssigned.has(c.id))

  async function call(url: string, method: string, body?: unknown, okMessage?: string) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Request failed')
      router.refresh()
      if (okMessage) setMsg({ kind: 'ok', text: okMessage })
      return json.data as { created?: number; revoked?: boolean }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Request failed' })
      return null
    } finally {
      setBusy(false)
    }
  }

  async function assignSelected() {
    if (checked.size === 0) return
    const r = await call(
      `/api/assessments/${assessmentId}/assignments`,
      'POST',
      { userIds: [...checked] },
      undefined,
    )
    if (r) {
      setMsg({
        kind: 'ok',
        text: `Assigned to ${r.created ?? 0} candidate${r.created === 1 ? '' : 's'}.`,
      })
      setChecked(new Set())
      setPickerOpen(false)
    }
  }

  async function assignBatch(batchId: string) {
    const r = await call(
      `/api/assessments/${assessmentId}/assignments`,
      'POST',
      { batchId },
      undefined,
    )
    if (r) setMsg({ kind: 'ok', text: `Assigned to ${r.created ?? 0} batch members.` })
  }

  async function copyLink(token: string) {
    const url = `${baseUrl}/exam/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(token)
      window.setTimeout(() => setCopiedToken(null), 1500)
    } catch {
      setMsg({ kind: 'err', text: 'Could not copy — the URL is: ' + url })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {msg && (
        <p role="status" className={msg.kind === 'ok' ? 'text-sm text-success' : 'text-destructive text-sm'}>
          {msg.text}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Assign</h2>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setPickerOpen((v) => !v)}>
            {pickerOpen ? 'Close picker' : 'Add candidates'}
          </Button>
        </div>

        {batches.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground">Or assign a batch:</span>
            {batches.map((b) => (
              <Button
                key={b.id}
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => assignBatch(b.id)}
              >
                {b.name} ({b.membersCount})
              </Button>
            ))}
          </div>
        )}

        {pickerOpen && (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            {addable.length === 0 ? (
              <p className="text-muted-foreground text-sm">Every candidate is already assigned.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {addable.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 p-1 text-sm">
                    <input
                      type="checkbox"
                      checked={checked.has(c.id)}
                      onChange={(e) => {
                        const next = new Set(checked)
                        if (e.target.checked) next.add(c.id)
                        else next.delete(c.id)
                        setChecked(next)
                      }}
                    />
                    <span className="flex-1 truncate">{c.name ?? c.email ?? c.phone}</span>
                    <span className="text-muted-foreground text-xs">{c.email ?? c.phone}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || checked.size === 0} onClick={assignSelected}>
                Assign {checked.size || ''}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPickerOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          Assignments ({assignments.length})
        </h2>
        {assignments.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nobody is assigned yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-current/10 rounded-lg border">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="flex-1 truncate">
                  {a.user.name ?? a.user.email ?? a.user.phone}
                </span>
                <Badge variant={STATUS_VARIANT[a.status] ?? 'outline'} className="text-[10px]">
                  {a.status.toLowerCase()}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('text-xs', copiedToken === a.token && 'text-success')}
                  onClick={() => copyLink(a.token)}
                >
                  {copiedToken === a.token ? 'Copied' : 'Copy link'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    call(`/api/assignments/${a.id}`, 'DELETE', undefined, 'Revoked.')
                  }
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
        {assignments.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Email + SMS sending arrives with Plan 005 (MSG91) and a transactional-email provider.
            Copy the link above and send it manually until then.
          </p>
        )}
      </section>
    </div>
  )
}
