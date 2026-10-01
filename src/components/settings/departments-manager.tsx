'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, GraduationCap, Loader2, MoreHorizontal, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type Head = { id: string; name: string | null; email: string | null; pending: boolean }
type Dept = { id: string; name: string; code: string; students: number; assessments: number; batches: number; heads: Head[] }

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Something went wrong')
  return json.data
}

/**
 * College Admin's department console: who picks a student's department,
 * the departments themselves, and the HOD(s) of each. One HOD can head
 * several departments — add the same email to each.
 */
export function DepartmentsManager({
  orgId,
  studentsPickDepartment,
  departments,
}: {
  orgId: string
  studentsPickDepartment: boolean
  departments: Dept[]
}) {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-6">
      <PickMode orgId={orgId} initial={studentsPickDepartment} onSaved={() => router.refresh()} />

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Departments</h2>
            <p className="text-muted-foreground text-sm">
              {departments.length === 0
                ? 'Add your first department — e.g. CSE, IT, ECE.'
                : `${departments.length} department${departments.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <AddDepartment orgId={orgId} onAdded={() => router.refresh()} />
        <div className="grid gap-4 md:grid-cols-2">
          {departments.map((d, i) => (
            <DeptCard key={d.id} dept={d} index={i} onChange={() => router.refresh()} />
          ))}
        </div>
      </section>
    </div>
  )
}

function PickMode({ orgId, initial, onSaved }: { orgId: string; initial: boolean; onSaved: () => void }) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(v: boolean) {
    if (v === value) return
    setBusy(true)
    setError(null)
    const prev = value
    setValue(v)
    try {
      await call('/api/departments/settings', 'PATCH', { orgId, studentsPickDepartment: v })
      onSaved()
    } catch (e) {
      setValue(prev)
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const options = [
    {
      v: true,
      title: 'Students choose it',
      body: 'Students pick their department when they register. You and HODs can still move them.',
    },
    {
      v: false,
      title: 'The college assigns it',
      body: 'Set from the import sheet or “Move to…” on Candidates. Until then a student is Unassigned.',
    },
  ]

  return (
    <section className="siq-card siq-rise p-5">
      <div className="mb-4 flex items-center gap-2">
        <GraduationCap className="text-primary size-4" aria-hidden />
        <h2 className="text-[15px] font-semibold">Who sets a student&apos;s department?</h2>
        {busy ? <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden /> : null}
      </div>
      <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            disabled={busy}
            onClick={() => void choose(o.v)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
              value === o.v ? 'border-primary bg-accent/50 ring-primary/20 ring-3' : 'hover:border-primary/30 hover:bg-muted/40',
            )}
          >
            <span
              className={cn(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
                value === o.v ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
              )}
            >
              {value === o.v ? <Check className="size-3" aria-hidden /> : null}
            </span>
            <span>
              <span className="block text-sm font-semibold">{o.title}</span>
              <span className="text-muted-foreground mt-0.5 block text-sm leading-snug">{o.body}</span>
            </span>
          </button>
        ))}
      </div>
      {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}
    </section>
  )
}

function AddDepartment({ orgId, onAdded }: { orgId: string; onAdded: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await call('/api/departments', 'POST', { orgId, code, name })
      setCode('')
      setName('')
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={add} className="siq-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <Building2 className="text-muted-foreground hidden size-4 shrink-0 sm:block" aria-hidden />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Code (CSE)"
        maxLength={12}
        aria-label="Department code"
        className="border-input bg-card focus-visible:border-ring h-10 rounded-lg border px-3 text-sm font-semibold uppercase outline-none sm:w-32"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (Computer Science & Engineering)"
        maxLength={100}
        aria-label="Department name"
        className="border-input bg-card focus-visible:border-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none"
      />
      <Button type="submit" disabled={busy || code.trim().length < 2 || name.trim().length < 2} className="h-10">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        Add department
      </Button>
      {error ? <p className="text-destructive basis-full text-sm">{error}</p> : null}
    </form>
  )
}

function DeptCard({ dept: d, index, onChange }: { dept: Dept; index: number; onChange: () => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState(d.code)
  const [name, setName] = useState(d.name)
  const [deleting, setDeleting] = useState(false)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChange()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="siq-card siq-rise flex flex-col" style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}>
      <div className="flex items-start gap-3 p-5 pb-4">
        <span className="bg-primary text-primary-foreground grid h-10 min-w-10 shrink-0 place-items-center rounded-xl px-2 text-xs font-bold tracking-wide">
          {d.code}
        </span>
        {editing ? (
          <form
            className="flex min-w-0 flex-1 flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => call(`/api/departments/${d.id}`, 'PATCH', { code, name })).then((ok) => ok && setEditing(false))
            }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} aria-label="Code" className="border-input h-9 rounded-lg border px-2 text-sm font-semibold uppercase outline-none" />
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} aria-label="Name" className="border-input h-9 rounded-lg border px-2 text-sm outline-none" />
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={busy}>
                Save
              </Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{d.name}</p>
            <p className="text-muted-foreground text-xs">
              {d.students.toLocaleString('en-IN')} students · {d.assessments} tests · {d.batches} batches
            </p>
          </div>
        )}
        {!editing ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.code}`} />}>
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 border-t px-5 py-4">
        <p className="text-muted-foreground text-xs font-medium">Head{d.heads.length === 1 ? '' : 's'} of department</p>
        {d.heads.length === 0 ? <p className="text-muted-foreground text-sm">No HOD yet — this department is managed by College Admins only.</p> : null}
        <ul className="flex flex-col gap-1.5">
          {d.heads.map((h) => (
            <li key={h.id} className="bg-muted/50 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
              <span className="bg-highlight text-highlight-foreground grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold uppercase">
                {(h.name ?? h.email ?? '?').slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{h.name ?? h.email}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {h.pending ? 'Invited · hasn’t signed in yet' : h.email}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => call(`/api/departments/${d.id}/heads?userId=${h.id}`, 'DELETE'))}
                className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-md transition-colors"
                aria-label={`Remove ${h.name ?? h.email} as HOD of ${d.code}`}
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => call(`/api/departments/${d.id}/heads`, 'POST', { email })).then((ok) => ok && setEmail(''))
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hod@college.edu.in"
            aria-label={`Add an HOD to ${d.code}`}
            className="border-input bg-card focus-visible:border-ring h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none"
          />
          <Button size="sm" type="submit" variant="outline" disabled={busy || !email.trim()} className="h-9">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
            Add HOD
          </Button>
        </form>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>

      <ConfirmDialog
        open={deleting}
        title={`Delete ${d.code}?`}
        busy={busy}
        error={error}
        confirmLabel="Delete department"
        onCancel={() => setDeleting(false)}
        onConfirm={() => void run(() => call(`/api/departments/${d.id}`, 'DELETE')).then((ok) => ok && setDeleting(false))}
        body={
          <ul className="list-disc space-y-1 pl-4">
            <li>{d.students} student{d.students === 1 ? '' : 's'} become Unassigned (only College Admins see them).</li>
            <li>Its {d.assessments} tests and {d.batches} batches become college-wide.</li>
            <li>Its HODs lose access to this department.</li>
            <li>No results or exams are deleted.</li>
          </ul>
        }
      />
    </article>
  )
}
