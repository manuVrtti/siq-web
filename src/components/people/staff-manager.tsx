'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, MoreHorizontal, ShieldCheck, Trash2, UserCog, UserPlus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export type StaffRow = {
  id: string
  name: string | null
  email: string | null
  role: 'COLLEGE_ADMIN' | 'COLLEGE_HOD'
  pending: boolean
  suspended: boolean
  lastLoginAt: string | null
  otherOrgs: number
  departments: { id: string; code: string; name: string }[]
}
type Dept = { id: string; code: string; name: string }

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
 * College staff — College Admins and HODs of one college. Used by the
 * College Admin panel and the Super Admin college page; the API enforces
 * who may do what (services/people.ts), this only reflects it.
 */
export function StaffManager({
  orgId,
  staff,
  departments,
  actorId,
}: {
  orgId: string
  staff: StaffRow[]
  departments: Dept[]
  actorId: string
}) {
  const router = useRouter()
  const admins = staff.filter((s) => s.role === 'COLLEGE_ADMIN')
  const hods = staff.filter((s) => s.role === 'COLLEGE_HOD')

  return (
    <div className="flex flex-col gap-6">
      <AddStaff orgId={orgId} departments={departments} onDone={() => router.refresh()} />
      <Group
        title="College Admins"
        hint="Manage everything in this college — HODs, departments, students, tests and settings."
        icon={ShieldCheck}
        rows={admins}
        orgId={orgId}
        departments={departments}
        actorId={actorId}
        lastAdmin={admins.length <= 1}
        onChange={() => router.refresh()}
      />
      <Group
        title="HODs"
        hint="Manage the students, tests and results of the departments they head."
        icon={Users}
        rows={hods}
        orgId={orgId}
        departments={departments}
        actorId={actorId}
        lastAdmin={false}
        onChange={() => router.refresh()}
      />
    </div>
  )
}

function AddStaff({ orgId, departments, onDone }: { orgId: string; departments: Dept[]; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'COLLEGE_ADMIN' | 'COLLEGE_HOD'>('COLLEGE_HOD')
  const [depts, setDepts] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await call(`/api/orgs/${orgId}/staff`, 'POST', { email, role, departmentIds: role === 'COLLEGE_HOD' ? depts : [] })
      setMsg({ ok: true, text: res.invited ? `Invited ${email} — they get access when they first sign in.` : `${email} now has access.` })
      setEmail('')
      setDepts([])
      onDone()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not add' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={add} className="siq-card siq-rise flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <UserPlus className="text-primary size-4" aria-hidden />
        <h2 className="text-[15px] font-semibold">Add a College Admin or HOD</h2>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@college.edu.in"
          aria-label="Email"
          required
          className="border-input bg-card focus-visible:border-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none"
        />
        <div role="radiogroup" aria-label="Role" className="bg-muted flex rounded-lg p-1">
          {(
            [
              ['COLLEGE_HOD', 'HOD'],
              ['COLLEGE_ADMIN', 'College Admin'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={role === v}
              onClick={() => setRole(v)}
              className={cn('h-8 rounded-md px-3 text-sm font-medium transition-all', role === v ? 'bg-card shadow-sm' : 'text-muted-foreground')}
            >
              {l}
            </button>
          ))}
        </div>
        <Button type="submit" disabled={busy || !email.trim()} className="h-10">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
          Add
        </Button>
      </div>
      {role === 'COLLEGE_HOD' ? (
        <DeptPicker departments={departments} value={depts} onChange={setDepts} />
      ) : (
        <p className="text-muted-foreground text-xs">College Admins see and manage the whole college. Add more than one so you’re never locked out.</p>
      )}
      {msg ? <p className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')}>{msg.text}</p> : null}
    </form>
  )
}

function DeptPicker({ departments, value, onChange }: { departments: Dept[]; value: string[]; onChange: (v: string[]) => void }) {
  if (departments.length === 0) {
    return <p className="text-muted-foreground text-xs">No departments yet — create them under Departments, then give this HOD one or more.</p>
  }
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs">Departments this HOD heads (pick one or more):</p>
      <div className="flex flex-wrap gap-2">
        {departments.map((d) => {
          const on = value.includes(d.id)
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={on}
              title={d.name}
              onClick={() => onChange(on ? value.filter((x) => x !== d.id) : [...value, d.id])}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                on ? 'bg-primary border-primary text-primary-foreground' : 'hover:border-primary/40',
              )}
            >
              {on ? <Check className="size-3" aria-hidden /> : null}
              {d.code}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Group({
  title,
  hint,
  icon: Icon,
  rows,
  orgId,
  departments,
  actorId,
  lastAdmin,
  onChange,
}: {
  title: string
  hint: string
  icon: typeof Users
  rows: StaffRow[]
  orgId: string
  departments: Dept[]
  actorId: string
  lastAdmin: boolean
  onChange: () => void
}) {
  return (
    <section className="siq-card siq-rise overflow-hidden">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <span className="bg-accent text-primary grid size-8 place-items-center rounded-lg">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">
            {title} <span className="text-muted-foreground font-normal">· {rows.length}</span>
          </h2>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-5 py-6 text-sm">None yet.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <StaffItem key={r.id} row={r} orgId={orgId} departments={departments} isSelf={r.id === actorId} lastAdmin={lastAdmin} onChange={onChange} />
          ))}
        </ul>
      )}
    </section>
  )
}

function StaffItem({
  row: r,
  orgId,
  departments,
  isSelf,
  lastAdmin,
  onChange,
}: {
  row: StaffRow
  orgId: string
  departments: Dept[]
  isSelf: boolean
  lastAdmin: boolean
  onChange: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [depts, setDepts] = useState(r.departments.map((d) => d.id))
  const [removing, setRemoving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = isSelf || r.otherOrgs > 0

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
    <li className="siq-row flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold uppercase',
            r.role === 'COLLEGE_ADMIN' ? 'bg-primary text-primary-foreground' : 'bg-highlight text-highlight-foreground',
          )}
        >
          {(r.name ?? r.email ?? '?').slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{r.name ?? r.email}</span>
            {isSelf ? <span className="bg-muted rounded px-1.5 text-[10px] font-semibold">You</span> : null}
            {r.suspended ? <span className="bg-destructive/10 text-destructive rounded px-1.5 text-[10px] font-semibold">Suspended</span> : null}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {r.email}
            {' · '}
            {r.pending ? 'Invited — hasn’t signed in' : r.lastLoginAt ? `active ${timeAgo(new Date(r.lastLoginAt))}` : 'never signed in'}
            {r.otherOrgs > 0 ? ' · also in another organization' : ''}
          </p>
        </div>
      </div>

      {r.role === 'COLLEGE_HOD' ? (
        editing ? (
          <div className="flex flex-col gap-2 sm:max-w-sm">
            <DeptPicker departments={departments} value={depts} onChange={setDepts} />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void run(() => call(`/api/orgs/${orgId}/staff/${r.id}`, 'PATCH', { departmentIds: depts })).then((ok) => ok && setEditing(false))}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {r.departments.length ? (
              r.departments.map((d) => (
                <span key={d.id} title={d.name} className="bg-accent text-accent-foreground rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
                  {d.code}
                </span>
              ))
            ) : (
              <span className="text-warning text-xs font-medium">No department — sees nothing yet</span>
            )}
          </div>
        )
      ) : null}

      {!isSelf ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name ?? r.email}`} disabled={busy} />}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MoreHorizontal className="size-4" aria-hidden />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {r.role === 'COLLEGE_HOD' ? (
              <>
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Users aria-hidden /> Change departments
                </DropdownMenuItem>
                <DropdownMenuItem disabled={locked} onClick={() => void run(() => call(`/api/orgs/${orgId}/staff/${r.id}`, 'PATCH', { role: 'COLLEGE_ADMIN' }))}>
                  <UserCog aria-hidden /> Make College Admin
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem disabled={locked || lastAdmin} onClick={() => void run(() => call(`/api/orgs/${orgId}/staff/${r.id}`, 'PATCH', { role: 'COLLEGE_HOD' }))}>
                <UserCog aria-hidden /> Make HOD instead
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={r.role === 'COLLEGE_ADMIN' && lastAdmin} onClick={() => setRemoving(true)}>
              <Trash2 aria-hidden /> Remove from college
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="w-8" />
      )}

      {error ? <p className="text-destructive basis-full text-xs">{error}</p> : null}

      <ConfirmDialog
        open={removing}
        title={`Remove ${r.name ?? r.email}?`}
        busy={busy}
        error={error}
        confirmLabel="Remove access"
        onCancel={() => setRemoving(false)}
        onConfirm={() => void run(() => call(`/api/orgs/${orgId}/staff/${r.id}`, 'DELETE')).then((ok) => ok && setRemoving(false))}
        body={
          <ul className="list-disc space-y-1 pl-4">
            <li>They lose access to this college straight away.</li>
            <li>Tests, questions and grades they created stay.</li>
            <li>Their account and any other college they belong to are untouched.</li>
          </ul>
        }
      />
    </li>
  )
}
