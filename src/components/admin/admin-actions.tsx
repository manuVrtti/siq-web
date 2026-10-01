'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Field, TextInput } from '@/components/profile/fields'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/**
 * Admin console actions. Each calls a SUPER_ADMIN-only, audited API and
 * refreshes the server page. Errors render inline.
 */

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Request failed')
  return json.data
}

function useAction() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(fn: () => Promise<unknown>, after?: (data: unknown) => void) {
    setBusy(true)
    setError(null)
    try {
      const data = await fn()
      after?.(data)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export function EditOrgForm({
  id,
  name,
  domain,
  city,
  state,
}: {
  id: string
  name: string
  domain: string | null
  city: string | null
  state: string | null
}) {
  const [v, setV] = useState({ name, domain: domain ?? '', city: city ?? '', state: state ?? '' })
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAction()
  const set = (k: keyof typeof v) => (x: string) => setV((p) => ({ ...p, [k]: x }))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSaved(false)
        void run(
          () => call(`/api/admin/organizations/${id}`, 'PATCH', { name: v.name, domain: v.domain || null, city: v.city || null, state: v.state || null }),
          () => setSaved(true),
        )
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Name">
        <TextInput value={v.name} onChange={set('name')} maxLength={200} />
      </Field>
      <Field label="Student email domain" hint="blank = students join only by import">
        <TextInput value={v.domain} onChange={set('domain')} placeholder="abes.ac.in" maxLength={120} />
      </Field>
      <Field label="City">
        <TextInput value={v.city} onChange={set('city')} maxLength={80} />
      </Field>
      <Field label="State">
        <TextInput value={v.state} onChange={set('state')} maxLength={80} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save
        </Button>
        {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
        {saved && !error ? <p role="status" className="text-success text-sm">Saved</p> : null}
      </div>
    </form>
  )
}

/** Suspend (pause every member's access) / reactivate an organization. */
export function OrgStatusControl({ id, name, suspended }: { id: string; name: string; suspended: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const { busy, error, run } = useAction()
  if (suspended) {
    return (
      <Button variant="outline" disabled={busy} onClick={() => void run(() => call(`/api/admin/organizations/${id}/status`, 'DELETE'))}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Reactivate
      </Button>
    )
  }
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Suspend
      </Button>
      <ConfirmDialog
        open={open}
        title={`Suspend ${name}?`}
        busy={busy}
        error={error}
        confirmLabel="Suspend organization"
        onCancel={() => setOpen(false)}
        onConfirm={() => void run(() => call(`/api/admin/organizations/${id}/status`, 'POST', { reason }), () => setOpen(false))}
        body={
          <div className="flex flex-col gap-3">
            <ul className="list-disc space-y-1 pl-4">
              <li>Every member — admins, HODs, students — loses access straight away, including starting exams.</li>
              <li>Nothing is deleted. Reactivate any time and everything is back.</li>
            </ul>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="Reason (kept in the record), e.g. contract ended"
              className="border-input bg-card text-foreground h-10 rounded-lg border px-3 text-sm outline-none"
            />
          </div>
        }
      />
    </>
  )
}

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'COLLEGE_ADMIN', label: 'College admin' },
  { value: 'COLLEGE_HOD', label: 'College HOD' },
  { value: 'RECRUITER', label: 'Recruiter' },
  { value: 'SUPER_ADMIN', label: 'Super admin' },
]

export function RoleSelect({ userId, role, self }: { userId: string; role: string; self: boolean }) {
  const [value, setValue] = useState(role)
  const { busy, error, run } = useAction()
  if (self) return <span className="text-muted-foreground text-xs">{ROLE_OPTIONS.find((r) => r.value === role)?.label} (you)</span>
  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={value}
        disabled={busy}
        aria-label="Role"
        onChange={(e) => {
          const next = e.target.value
          const label = ROLE_OPTIONS.find((r) => r.value === next)?.label
          if (!window.confirm(`Change this user's role to ${label}?`)) return
          const prev = value
          setValue(next)
          void run(
            () => call(`/api/admin/users/${userId}`, 'PATCH', { role: next }).catch((err) => {
              setValue(prev)
              throw err
            }),
          )
        }}
        className="border-input bg-card h-8 rounded-lg border px-2 text-xs outline-none"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-destructive max-w-48 text-right text-[11px]">{error}</span> : null}
    </div>
  )
}
