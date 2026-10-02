'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2, Search, UserPlus, Users, X } from 'lucide-react'

import { Initials, Pill } from '@/components/dashboard/bits'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Plan 013 — assign an assessment to students (picked or by batch), see who
 * has started / submitted, copy a student's exam link, revoke.
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

const STATUS: Record<string, { label: string; tone: 'muted' | 'info' | 'warning' | 'success' }> = {
  INVITED: { label: 'Not started', tone: 'muted' },
  STARTED: { label: 'In progress', tone: 'warning' },
  SUBMITTED: { label: 'Submitted', tone: 'success' },
  EXPIRED: { label: 'Expired', tone: 'muted' },
}

const fmt = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso))

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
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<Assignment | null>(null)

  const assignedIds = useMemo(() => new Set(assignments.map((a) => a.user.id)), [assignments])
  const addable = candidates.filter((c) => !assignedIds.has(c.id))
  const q = query.trim().toLowerCase()
  const visible = q ? addable.filter((c) => [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(q))) : addable
  const counts = {
    total: assignments.length,
    INVITED: assignments.filter((a) => a.status === 'INVITED').length,
    STARTED: assignments.filter((a) => a.status === 'STARTED').length,
    SUBMITTED: assignments.filter((a) => a.status === 'SUBMITTED').length,
  }

  async function call(key: string, url: string, method: string, body?: unknown) {
    setBusy(key)
    setMsg(null)
    try {
      const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Request failed')
      router.refresh()
      return json.data as { created?: number }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Request failed' })
      return null
    } finally {
      setBusy(null)
    }
  }

  async function assignSelected() {
    const r = await call('assign', `/api/assessments/${assessmentId}/assignments`, 'POST', { userIds: [...checked] })
    if (r) {
      setMsg({ kind: 'ok', text: `Assigned to ${r.created ?? 0} student${r.created === 1 ? '' : 's'}. They’ve been notified.` })
      setChecked(new Set())
      setQuery('')
    }
  }

  async function assignBatch(b: Batch) {
    const r = await call(`batch-${b.id}`, `/api/assessments/${assessmentId}/assignments`, 'POST', { batchId: b.id })
    if (r) setMsg({ kind: 'ok', text: `${b.name}: assigned to ${r.created ?? 0} new student${r.created === 1 ? '' : 's'}.` })
  }

  async function copyLink(token: string) {
    const url = `${baseUrl}/exam/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(token)
      window.setTimeout(() => setCopiedToken(null), 1500)
    } catch {
      setMsg({ kind: 'err', text: `Could not copy — the link is ${url}` })
    }
  }

  const allVisibleOn = visible.length > 0 && visible.every((c) => checked.has(c.id))

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: 'Assigned', v: counts.total, cls: '' },
          { k: 'Not started', v: counts.INVITED, cls: 'text-muted-foreground' },
          { k: 'In progress', v: counts.STARTED, cls: 'text-warning' },
          { k: 'Submitted', v: counts.SUBMITTED, cls: 'text-success' },
        ].map((s) => (
          <div key={s.k} className="siq-card px-4 py-3">
            <p className="text-muted-foreground text-xs">{s.k}</p>
            <p className={cn('font-display siq-numeric text-2xl font-semibold', s.cls)}>{s.v}</p>
          </div>
        ))}
      </div>

      {msg ? (
        <p role="status" className={cn('rounded-xl px-4 py-2.5 text-sm font-medium', msg.kind === 'ok' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
          {msg.text}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* Add students */}
        <section className="siq-card flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary grid size-8 place-items-center rounded-lg">
              <UserPlus className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold">Add students</h2>
              <p className="text-muted-foreground text-xs">{addable.length} not assigned yet</p>
            </div>
          </div>

          {batches.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs font-medium">Whole batch</p>
              <div className="flex flex-wrap gap-2">
                {batches.map((b) => (
                  <Button key={b.id} variant="outline" size="sm" disabled={busy !== null} onClick={() => assignBatch(b)}>
                    {busy === `batch-${b.id}` ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Users className="size-3.5" aria-hidden />}
                    {b.name} <span className="text-muted-foreground">· {b.membersCount}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium">Pick students</p>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or phone" className="pl-9" />
            </div>
            {addable.length === 0 ? (
              <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">Every student is already assigned.</p>
            ) : (
              <div className="rounded-xl border">
                <label className="bg-muted/40 flex items-center gap-3 border-b px-3 py-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={allVisibleOn}
                    onChange={() => {
                      const next = new Set(checked)
                      for (const c of visible) {
                        if (allVisibleOn) next.delete(c.id)
                        else next.add(c.id)
                      }
                      setChecked(next)
                    }}
                  />
                  {checked.size ? `${checked.size} selected` : `Select all${q ? ' matching' : ''} (${visible.length})`}
                </label>
                <ul className="max-h-72 divide-y overflow-y-auto">
                  {visible.map((c) => (
                    <li key={c.id}>
                      <label className={cn('flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors', checked.has(c.id) ? 'bg-primary/5' : 'hover:bg-muted/40')}>
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
                        <Initials name={c.name} email={c.email} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.name ?? c.email ?? c.phone}</span>
                          <span className="text-muted-foreground block truncate text-xs">{c.email ?? c.phone}</span>
                        </span>
                        {!c.claimed ? <span className="text-muted-foreground text-[11px]">not signed in yet</span> : null}
                      </label>
                    </li>
                  ))}
                  {visible.length === 0 ? <li className="text-muted-foreground px-3 py-4 text-center text-sm">No match for “{query}”.</li> : null}
                </ul>
              </div>
            )}
            <Button className="self-start" disabled={busy !== null || checked.size === 0} onClick={assignSelected}>
              {busy === 'assign' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
              {checked.size ? `Assign to ${checked.size}` : 'Assign'}
            </Button>
          </div>
        </section>

        {/* Assigned */}
        <section className="siq-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3">
            <h2 className="text-[15px] font-semibold">Assigned students</h2>
            <span className="text-muted-foreground text-xs">Students get a notification and see it under Assessments.</span>
          </div>
          {assignments.length === 0 ? (
            <div className="text-muted-foreground mx-5 mb-5 flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center text-sm">
              <Users className="size-6" aria-hidden />
              Nobody is assigned yet. Pick students or a batch on the left.
            </div>
          ) : (
            <ul className="divide-y border-t">
              {assignments.map((a) => {
                const st = STATUS[a.status] ?? { label: a.status.toLowerCase(), tone: 'muted' as const }
                return (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <Initials name={a.user.name} email={a.user.email} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.user.name ?? a.user.email ?? a.user.phone}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {a.user.email ?? a.user.phone} · assigned {fmt(a.invitedAt)}
                      </p>
                    </div>
                    <Pill tone={st.tone}>{st.label}</Pill>
                    <Button variant="ghost" size="sm" className={cn('text-xs', copiedToken === a.token && 'text-success')} onClick={() => copyLink(a.token)} title="Copy this student’s exam link">
                      {copiedToken === a.token ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                      {copiedToken === a.token ? 'Copied' : 'Link'}
                    </Button>
                    {a.status !== 'SUBMITTED' ? (
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive size-8" disabled={busy !== null} onClick={() => setRevoking(a)} aria-label="Remove assignment">
                        <X className="size-4" aria-hidden />
                      </Button>
                    ) : (
                      <span className="size-8" />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={revoking !== null}
        title={`Remove ${revoking?.user.name ?? revoking?.user.email ?? 'this student'} from the test?`}
        confirmLabel="Remove"
        busy={busy === 'revoke'}
        error={null}
        onCancel={() => setRevoking(null)}
        onConfirm={() =>
          revoking &&
          void call('revoke', `/api/assignments/${revoking.id}`, 'DELETE').then((r) => {
            if (r) setMsg({ kind: 'ok', text: 'Assignment removed.' })
            setRevoking(null)
          })
        }
        body="Their exam link stops working. You can assign them again later."
      />
    </div>
  )
}
