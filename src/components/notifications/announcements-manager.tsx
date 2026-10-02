'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
import { DataTable, TD, TH, THead, TRow } from '@/components/data/data-table'
import { Button } from '@/components/ui/button'
import { shortDateTime } from '@/lib/format'
import type { AnnouncementRow } from '@/services/notifications/announcements'

/**
 * Announcement composer + list (ABTalks NotificationComposer +
 * NotificationsTable). Used by managers in a workspace and by the Super Admin
 * for platform-wide notices. Announcements are deactivated, never deleted.
 */

const control =
  'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 w-full rounded-lg border px-3 text-sm outline-none transition-shadow focus-visible:ring-3'

const CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'RESULT', label: 'Results' },
  { value: 'SYSTEM', label: 'System' },
] as const

const AUDIENCES = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'STUDENTS', label: 'Students only' },
  { value: 'STAFF', label: 'Staff only (admins, HODs, recruiters)' },
] as const

const AUDIENCE_LABEL: Record<string, string> = { ALL: 'Everyone', STUDENTS: 'Students', STAFF: 'Staff' }

type Dept = { id: string; name: string; code: string }

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Something went wrong')
  return json.data
}

export function AnnouncementsManager({
  rows,
  createUrl,
  itemUrl,
  departments,
  allowCollegeWide = true,
  platform = false,
}: {
  rows: AnnouncementRow[]
  /** POST endpoint. */
  createUrl: string
  /** PATCH endpoint for one row, with "{id}" in place of the id. */
  itemUrl: string
  /** Null hides the department picker (platform-wide). */
  departments: Dept[] | null
  /** False for HODs: they must pick one of their departments. */
  allowCollegeWide?: boolean
  platform?: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [href, setHref] = useState('')
  const [category, setCategory] = useState<string>('GENERAL')
  const [audience, setAudience] = useState<string>('ALL')
  const [departmentId, setDepartmentId] = useState<string>(allowCollegeWide ? '' : (departments?.[0]?.id ?? ''))
  const [expiresAt, setExpiresAt] = useState('')
  const [pending, setPending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await call(createUrl, 'POST', {
        title,
        body: body.trim() || undefined,
        href: href.trim() || undefined,
        category,
        audience,
        departmentId: departments ? departmentId || null : undefined,
        // datetime-local has no zone: resolve it in the author's browser (IST),
        // the server runs in UTC.
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      })
      setTitle('')
      setBody('')
      setHref('')
      setExpiresAt('')
      setMessage({ ok: true, text: 'Announcement published — it’s in the bell now.' })
      router.refresh()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not publish' })
    } finally {
      setPending(false)
    }
  }

  async function toggle(row: AnnouncementRow) {
    setBusyId(row.id)
    try {
      await call(itemUrl.replace('{id}', encodeURIComponent(row.id)), 'PATCH', { isActive: !row.isActive })
      router.refresh()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not update' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="bg-card flex flex-col gap-4 rounded-xl border p-4 md:p-6">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Title
          <input
            className={`${control} h-10`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Placement drive aptitude test on Friday"
            maxLength={120}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          <span>
            <span>
              Details <span className="text-muted-foreground font-normal">(optional)</span>
            </span>
          </span>
          <textarea
            className={`${control} py-2`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="One or two lines."
            maxLength={500}
            rows={3}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
            <span>
              Link <span className="text-muted-foreground font-normal">(optional)</span>
            </span>
          </span>
            <input
              className={`${control} h-10`}
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/abes/my-assessments or https://…"
              maxLength={300}
            />
            <span className="text-muted-foreground text-xs font-normal">Must start with / or https://</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
            <span>
              Expires <span className="text-muted-foreground font-normal">(optional)</span>
            </span>
          </span>
            <input
              type="datetime-local"
              className={`${control} h-10`}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <span className="text-muted-foreground text-xs font-normal">After this it leaves the bell.</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Audience
            <select className={`${control} h-10`} value={audience} onChange={(e) => setAudience(e.target.value)}>
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          {departments ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Department
              <select
                className={`${control} h-10`}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                {allowCollegeWide && <option value="">Whole college</option>}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Category
              <select className={`${control} h-10`} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={message ? (message.ok ? 'text-success text-sm' : 'text-destructive text-sm') : 'text-sm'} role="status">
            {message?.text ?? (platform ? 'Goes to every college on SelectIQ.' : '')}
          </p>
          <Button type="submit" disabled={pending || !title.trim() || (!allowCollegeWide && !departmentId)}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {pending ? 'Publishing…' : 'Publish announcement'}
          </Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="siq-card text-muted-foreground p-6 text-center text-sm">
          No announcements yet. Publish one above — it reaches every matching bell immediately.
        </p>
      ) : (
      <DataTable>
        <THead>
          <th className={TH}>Announcement</th>
          <th className={TH}>Audience</th>
          <th className={TH}>Published</th>
          <th className={TH}>Status</th>
          <th className={TH} />
        </THead>
        <tbody>
          {rows.map((r) => {
            const expired = r.expired
            return (
              <TRow key={r.id}>
                <td className={TD}>
                  <p className="font-medium">{r.title}</p>
                  {r.body && <p className="text-muted-foreground line-clamp-1 text-xs">{r.body}</p>}
                  {r.author && <p className="text-muted-foreground text-[11px]">by {r.author}</p>}
                </td>
                <td className={TD}>
                  <span className="text-sm">{AUDIENCE_LABEL[r.audience]}</span>
                  <span className="text-muted-foreground block text-xs">
                    {r.departmentCode ?? (r.orgName ? 'Whole college' : 'All colleges')}
                  </span>
                </td>
                <td className={`${TD} text-muted-foreground text-xs whitespace-nowrap`}>
                  {shortDateTime(new Date(r.publishedAt))}
                  {r.expiresAt && <span className="block">until {shortDateTime(new Date(r.expiresAt))}</span>}
                </td>
                <td className={TD}>
                  {!r.isActive ? (
                    <Pill tone="muted">Inactive</Pill>
                  ) : expired ? (
                    <Pill tone="warning">Expired</Pill>
                  ) : (
                    <Pill tone="success">Live</Pill>
                  )}
                </td>
                <td className={`${TD} text-right`}>
                  <Button variant="outline" size="sm" disabled={busyId === r.id} onClick={() => toggle(r)}>
                    {r.isActive ? 'Deactivate' : 'Restore'}
                  </Button>
                </td>
              </TRow>
            )
          })}
        </tbody>
      </DataTable>
      )}
    </div>
  )
}
