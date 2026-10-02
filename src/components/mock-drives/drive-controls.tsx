'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Check, Flag, Loader2, Play, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Plans 023/024 — the interactive parts of the drive pages: lifecycle
 * buttons, the rounds editor, enrolment, round open/close, overrides.
 * Every action is a call to the drive APIs; the server enforces the rules.
 */

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Something went wrong')
  return json.data
}

function useAction() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  async function run(key: string, fn: () => Promise<unknown>, done?: (d: unknown) => string | void) {
    setBusy(key)
    setError(null)
    setNote(null)
    try {
      const d = await fn()
      const n = done?.(d)
      if (n) setNote(n)
      router.refresh()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(null)
    }
  }
  return { busy, error, note, run }
}

function Feedback({ error, note }: { error: string | null; note: string | null }) {
  if (error) return <p role="alert" className="text-destructive text-sm">{error}</p>
  if (note) return <p role="status" className="text-success text-sm">{note}</p>
  return null
}

const STATUS_ACTIONS: Record<string, { to: string; label: string; primary?: boolean }[]> = {
  DRAFT: [
    { to: 'REGISTRATION_OPEN', label: 'Open registration', primary: true },
    { to: 'SCHEDULED', label: 'Mark scheduled' },
  ],
  SCHEDULED: [
    { to: 'REGISTRATION_OPEN', label: 'Open registration', primary: true },
    { to: 'DRAFT', label: 'Back to draft' },
  ],
  REGISTRATION_OPEN: [
    { to: 'IN_PROGRESS', label: 'Start the drive', primary: true },
    { to: 'SCHEDULED', label: 'Pause registration' },
  ],
  COMPLETED: [{ to: 'ARCHIVED', label: 'Archive' }],
}

export function LifecycleButtons({ driveId, status, canManage, slug }: { driveId: string; status: string; canManage: boolean; slug: string }) {
  const { busy, error, note, run } = useAction()
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!canManage) return null
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {(STATUS_ACTIONS[status] ?? []).map((a) => (
          <Button key={a.to} size="sm" variant={a.primary ? 'default' : 'outline'} disabled={busy !== null} onClick={() => run(a.to, () => call(`/api/mock-drives/${driveId}/status`, 'POST', { status: a.to }))}>
            {busy === a.to ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {a.label}
          </Button>
        ))}
        {status === 'DRAFT' ? (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-3.5" aria-hidden /> Delete
          </Button>
        ) : null}
      </div>
      <Feedback error={error} note={note} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this draft drive?"
        body="Its rounds and settings are removed. The tests themselves stay in Assessments."
        confirmLabel="Delete drive"
        busy={busy === 'delete'}
        error={error}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          void run('delete', () => call(`/api/mock-drives/${driveId}`, 'DELETE')).then((ok) => {
            if (ok) router.push(`/${slug}/mock-drives`)
          })
        }
      />
    </div>
  )
}

export type RoundRow = {
  id: string
  order: number
  name: string
  testTitle: string
  testStatus: string
  cutoff: number | null
  activated: boolean
  evaluated: boolean
  /** Plan 017b — identity check + camera on this round's test. */
  proctored: boolean
}

export function RoundsEditor({
  driveId,
  rounds,
  tests,
  editable,
  canProctor,
}: {
  driveId: string
  rounds: RoundRow[]
  tests: { id: string; title: string; status: string }[]
  editable: boolean
  /** May change proctoring of rounds not opened yet. */
  canProctor: boolean
}) {
  const { busy, error, note, run } = useAction()
  const [assessmentId, setAssessmentId] = useState('')
  const [cutoff, setCutoff] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const available = tests.filter((t) => !rounds.some((r) => r.testTitle === t.title))

  const unproctored = rounds.filter((r) => !r.proctored && !r.activated)
  const setProctoring = (body: Record<string, unknown>, key: string) =>
    run(key, () => call(`/api/mock-drives/${driveId}/proctoring`, 'PATCH', body), (d) => {
      const n = (d as { changed: number }).changed
      return n ? `Proctoring updated for ${n} round${n === 1 ? '' : 's'}` : 'Nothing to change'
    })

  return (
    <div className="flex flex-col gap-3">
      {canProctor && rounds.length > 0 ? (
        <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs">
          <ShieldCheck className="text-primary size-4" aria-hidden />
          <span className="flex-1">
            {unproctored.length
              ? `Proctoring is optional. ${unproctored.length} round${unproctored.length === 1 ? ' is' : 's are'} off. On = identity check before the exam + camera checks during it. Activity is logged either way.`
              : 'Every round is proctored: identity check before the exam + camera checks during it.'}
          </span>
          {unproctored.length ? (
            <Button size="sm" disabled={busy !== null} onClick={() => setProctoring({ all: true, enabled: true }, 'all')}>
              {busy === 'all' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ShieldCheck className="size-3.5" aria-hidden />}
              Proctor all rounds
            </Button>
          ) : null}
        </div>
      ) : null}
      {rounds.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
          No rounds yet. Each round is one of your tests — e.g. Aptitude → Technical → Coding.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rounds.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
              <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold">{r.order}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-muted-foreground text-xs">
                  {r.proctored ? <span className="text-primary font-medium">Proctored · </span> : <span className="text-muted-foreground">Not proctored · </span>}
                  Test: {r.testTitle}
                  {r.testStatus !== 'PUBLISHED' ? <span className="text-warning font-medium"> · not published yet</span> : null}
                  {r.evaluated ? ' · closed' : r.activated ? ' · open now' : ''}
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                Cutoff
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={edits[r.id] ?? (r.cutoff ?? '').toString()}
                  disabled={r.evaluated || busy !== null}
                  onChange={(e) => setEdits((x) => ({ ...x, [r.id]: e.target.value }))}
                  onBlur={() => {
                    const v = edits[r.id]
                    if (v === undefined || v === (r.cutoff ?? '').toString()) return
                    void run(`cut-${r.id}`, () => call(`/api/mock-drives/${driveId}/rounds/${r.id}`, 'PATCH', { cutoffScore: v === '' ? null : Number(v) }), () => 'Cutoff saved')
                  }}
                  className="h-8 w-20"
                  placeholder="none"
                />
                %
              </label>
              {canProctor ? (
                <label className={cn('flex items-center gap-1.5 text-xs', r.activated && 'opacity-50')} title={r.activated ? 'Opened rounds can’t change' : undefined}>
                  <input
                    type="checkbox"
                    checked={r.proctored}
                    disabled={r.activated || busy !== null}
                    onChange={(e) => setProctoring({ roundIds: [r.id], enabled: e.target.checked }, `p-${r.id}`)}
                  />
                  Proctored
                </label>
              ) : null}
              {editable ? (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="size-8" disabled={i === 0 || busy !== null} aria-label="Move up" onClick={() => run(`up-${r.id}`, () => call(`/api/mock-drives/${driveId}/rounds/${r.id}`, 'PATCH', { move: 'up' }))}>
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" disabled={i === rounds.length - 1 || busy !== null} aria-label="Move down" onClick={() => run(`dn-${r.id}`, () => call(`/api/mock-drives/${driveId}/rounds/${r.id}`, 'PATCH', { move: 'down' }))}>
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive size-8" disabled={busy !== null} aria-label="Remove round" onClick={() => run(`rm-${r.id}`, () => call(`/api/mock-drives/${driveId}/rounds/${r.id}`, 'DELETE'))}>
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {editable ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
            Add a round — choose a test
            <select className="w-full rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
              <option value="">Choose a test…</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.status !== 'PUBLISHED' ? ' (draft)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Cutoff %
            <Input type="number" min={0} max={100} value={cutoff} onChange={(e) => setCutoff(e.target.value)} placeholder="e.g. 60" className="w-24" />
          </label>
          <Button
            size="sm"
            disabled={!assessmentId || busy !== null}
            onClick={() =>
              void run('add', () => call(`/api/mock-drives/${driveId}/rounds`, 'POST', { assessmentId, cutoffScore: cutoff === '' ? null : Number(cutoff) })).then((ok) => {
                if (ok) {
                  setAssessmentId('')
                  setCutoff('')
                }
              })
            }
          >
            <Plus className="size-3.5" aria-hidden /> Add round
          </Button>
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">Cutoff = minimum score (%) to clear the round. Leave it empty and everyone who finishes the round advances.</p>
      <Feedback error={error} note={note} />
    </div>
  )
}

export function EnrolButton({ driveId, eligible }: { driveId: string; eligible: number }) {
  const { busy, error, note, run } = useAction()
  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={eligible === 0 || busy !== null}
        onClick={() =>
          run('enrol', () => call(`/api/mock-drives/${driveId}/bulk-register`, 'POST', { all: true }), (d) => {
            const x = d as { registered: number }
            return `Enrolled ${x.registered} student${x.registered === 1 ? '' : 's'}`
          })
        }
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Users className="size-3.5" aria-hidden />}
        Enrol all {eligible} eligible
      </Button>
      <Feedback error={error} note={note} />
    </div>
  )
}

export function RoundRunButtons({ driveId, round, canRun }: { driveId: string; round: { id: string; name: string; activated: boolean; evaluated: boolean; ready: boolean }; canRun: boolean }) {
  const { busy, error, note, run } = useAction()
  if (!canRun || round.evaluated) return null
  return (
    <div className="flex flex-col items-end gap-1">
      {!round.activated ? (
        <Button size="sm" disabled={!round.ready || busy !== null} onClick={() => run('open', () => call(`/api/mock-drives/${driveId}/rounds/${round.id}/activate`, 'POST'), (d) => `Assigned to ${(d as { assigned: number }).assigned} students`)}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          Open round
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() =>
            run('close', () => call(`/api/mock-drives/${driveId}/rounds/${round.id}/evaluate`, 'POST'), (d) => {
              const x = d as { shortlisted: number; eliminated: number; noShows: number }
              return `${x.shortlisted} shortlisted · ${x.eliminated} out${x.noShows ? ` (${x.noShows} didn’t take it)` : ''}`
            })
          }
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
          Close round
        </Button>
      )}
      <Feedback error={error} note={note} />
    </div>
  )
}

export function CompleteButton({ driveId, ready }: { driveId: string; ready: boolean }) {
  const { busy, error, note, run } = useAction()
  return (
    <div className="flex flex-col items-end gap-1">
      <Button disabled={!ready || busy !== null} onClick={() => run('complete', () => call(`/api/mock-drives/${driveId}/complete`, 'POST'), (d) => `Drive complete — ${(d as { finalists: number }).finalists} on the final shortlist`)}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Flag className="size-4" aria-hidden />}
        Complete drive
      </Button>
      <Feedback error={error} note={note} />
    </div>
  )
}

export function OverrideButton({ roundResultId, outcome, studentName }: { roundResultId: string; outcome: 'SHORTLISTED' | 'ELIMINATED'; studentName: string }) {
  const { busy, error, run } = useAction()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const target = outcome === 'SHORTLISTED' ? 'ELIMINATED' : 'SHORTLISTED'
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('text-xs font-medium hover:underline', target === 'SHORTLISTED' ? 'text-primary' : 'text-destructive')}>
        {target === 'SHORTLISTED' ? 'Reinstate' : 'Remove'}
      </button>
      <ConfirmDialog
        open={open}
        title={target === 'SHORTLISTED' ? `Reinstate ${studentName}?` : `Remove ${studentName} from the drive?`}
        confirmLabel={target === 'SHORTLISTED' ? 'Reinstate' : 'Remove'}
        busy={busy !== null}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={() => void run('ov', () => call(`/api/mock-round-results/${roundResultId}/override`, 'POST', { outcome: target, reason })).then((ok) => ok && setOpen(false))}
        body={
          <div className="flex flex-col gap-2">
            <p>This overrides the cutoff for this round. The student is notified, and the change is logged with your reason.</p>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. network failure during the round" maxLength={300} />
          </div>
        }
      />
    </>
  )
}

export function StudentDriveButtons({ driveId, registered, canRegister, canWithdraw }: { driveId: string; registered: boolean; canRegister: boolean; canWithdraw: boolean }) {
  const { busy, error, note, run } = useAction()
  return (
    <div className="flex flex-col items-start gap-1">
      {!registered && canRegister ? (
        <Button onClick={() => run('reg', () => call(`/api/mock-drives/${driveId}/register`, 'POST'), () => 'You’re in! Rounds will appear here when they open.')} disabled={busy !== null}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Register for this drive
        </Button>
      ) : null}
      {registered && canWithdraw ? (
        <Button variant="ghost" size="sm" onClick={() => run('wd', () => call(`/api/mock-drives/${driveId}/register`, 'DELETE'))} disabled={busy !== null}>
          Withdraw
        </Button>
      ) : null}
      <Feedback error={error} note={note} />
    </div>
  )
}
