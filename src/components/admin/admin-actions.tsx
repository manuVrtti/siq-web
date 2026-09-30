'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'

import { Field, SelectInput, TextInput } from '@/components/profile/fields'
import { Button } from '@/components/ui/button'

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

export function CreateOrgForm() {
  const router = useRouter()
  const [v, setV] = useState({ name: '', slug: '', type: 'COLLEGE', domain: '' })
  const { busy, error, run } = useAction()
  const set = (k: keyof typeof v) => (x: string) =>
    setV((p) => ({
      ...p,
      [k]: x,
      // Suggest a slug from the name until the admin edits the slug.
      ...(k === 'name' && (!p.slug || p.slug === slugify(p.name)) ? { slug: slugify(x) } : {}),
    }))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(
          () => call('/api/orgs', 'POST', { ...v, domain: v.domain || undefined }),
          (d) => router.push(`/admin/organizations/${(d as { org: { id: string } }).org.id}`),
        )
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Name" required>
        <TextInput value={v.name} onChange={set('name')} placeholder="ABES Engineering College" maxLength={200} />
      </Field>
      <Field label="URL slug" hint={`selectiq…/${v.slug || 'slug'}`} required>
        <TextInput value={v.slug} onChange={set('slug')} placeholder="abes" maxLength={40} />
      </Field>
      <Field label="Type">
        <SelectInput value={v.type} onChange={set('type')} options={[{ value: 'COLLEGE', label: 'College' }, { value: 'COMPANY', label: 'Company' }]} />
      </Field>
      <Field label="Student email domain" hint="self sign-up matching">
        <TextInput value={v.domain} onChange={set('domain')} placeholder="abes.ac.in" maxLength={120} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy || !v.name.trim() || !v.slug.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Create organization
        </Button>
        <p className="text-muted-foreground text-xs">You become its first admin. The slug can&apos;t be changed later.</p>
      </div>
      {error ? <p role="alert" className="text-destructive text-sm sm:col-span-2">{error}</p> : null}
    </form>
  )
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function EditOrgForm({ id, name, domain }: { id: string; name: string; domain: string | null }) {
  const [v, setV] = useState({ name, domain: domain ?? '' })
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAction()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSaved(false)
        void run(() => call(`/api/admin/organizations/${id}`, 'PATCH', { name: v.name, domain: v.domain || null }), () => setSaved(true))
      }}
      className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <Field label="Name">
        <TextInput value={v.name} onChange={(x) => setV((p) => ({ ...p, name: x }))} maxLength={200} />
      </Field>
      <Field label="Student email domain" hint="blank = no self sign-up">
        <TextInput value={v.domain} onChange={(x) => setV((p) => ({ ...p, domain: x }))} placeholder="abes.ac.in" maxLength={120} />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Save
      </Button>
      {error ? <p role="alert" className="text-destructive text-sm sm:col-span-3">{error}</p> : null}
      {saved && !error ? <p role="status" className="text-success text-sm sm:col-span-3">Saved</p> : null}
    </form>
  )
}

export function AddMemberForm({ orgId }: { orgId: string }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const { busy, error, run } = useAction()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => call(`/api/admin/organizations/${orgId}/members`, 'POST', { email, role }), () => setEmail(''))
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput value={email} onChange={setEmail} placeholder="person@college.edu" type="email" aria-label="Email" />
        <div className="sm:w-44">
          <SelectInput value={role} onChange={setRole} options={[{ value: 'MEMBER', label: 'Member' }, { value: 'ADMIN', label: 'Org admin' }]} />
        </div>
        <Button type="submit" disabled={busy || !email.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Add
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        They must have signed in once. To let them manage the college, also set their role to College admin on the Users page.
      </p>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
    </form>
  )
}

export function RemoveMemberButton({ orgId, userId, label }: { orgId: string; userId: string; label: string }) {
  const { busy, error, run } = useAction()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!window.confirm(`Remove ${label} from this organization?`)) return
          void run(() => call(`/api/admin/organizations/${orgId}/members?userId=${encodeURIComponent(userId)}`, 'DELETE'))
        }}
        disabled={busy}
        aria-label={`Remove ${label}`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
      </button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </>
  )
}

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'COLLEGE_ADMIN', label: 'College admin' },
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
