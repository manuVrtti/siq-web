import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Ban, Building2, Clock, ExternalLink, FileCheck2, Mail, Phone, UserRound } from 'lucide-react'

import { RoleSelect } from '@/components/admin/admin-actions'
import { SuspendToggle } from '@/components/admin/user-actions'
import { Panel } from '@/components/analytics/panel'
import { AUDIT_ACTION_LABEL, ROLE_LABEL } from '@/constants/labels'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { NotFoundError } from '@/lib/errors'
import { timeAgo } from '@/lib/format'
import { getUserDetail } from '@/services/people'

export const metadata: Metadata = { title: 'Person — Platform console — SelectIQ' }

/** Super Admin → one person: identity, access, status, footprint, audit trail. */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = (await getCurrentUser())!
  let u
  try {
    u = await getUserDetail(id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  const label = u.name ?? u.email ?? 'this person'
  const self = u.id === me.id

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link href="/admin/users" className="text-muted-foreground hover:text-foreground text-xs font-medium">
        ← All people
      </Link>

      <section className="siq-card siq-rise flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <span className="bg-primary text-primary-foreground grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-semibold uppercase">
          {label.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
            <span className="bg-accent text-accent-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold">{ROLE_LABEL[u.role]}</span>
            {u.suspendedAt ? (
              <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                <Ban className="size-3" aria-hidden /> Suspended
              </span>
            ) : u.pending ? (
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold">Invited</span>
            ) : null}
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {u.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-4" aria-hidden /> {u.email}
              </span>
            ) : null}
            {u.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" aria-hidden /> {u.phone}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden /> joined {timeAgo(u.createdAt)} · {u.lastLoginAt ? `active ${timeAgo(u.lastLoginAt)}` : 'never signed in'}
            </span>
          </div>
          {u.suspendedAt ? (
            <p className="text-destructive mt-2 text-sm">
              Suspended {timeAgo(u.suspendedAt)}
              {u.suspendedReason ? ` — “${u.suspendedReason}”` : ''}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RoleSelect userId={u.id} role={u.role} self={self} />
          <SuspendToggle userId={u.id} label={label} suspended={Boolean(u.suspendedAt)} self={self} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="Access" title="Organizations">
          {u.memberships.length === 0 && u.headOf.length === 0 ? (
            <p className="text-muted-foreground text-sm">Not a member of any organization.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {u.memberships.map((m) => (
                <li key={m.org.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                  <Building2 className="text-muted-foreground size-4" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/organizations/${m.org.id}`} className="hover:text-primary block truncate text-sm font-medium">
                      {m.org.name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {m.department ? `${m.department.code} · ` : ''}since {timeAgo(m.joinedAt)}
                    </p>
                  </div>
                  <Link href={`/${m.org.slug}/dashboard`} className="text-muted-foreground hover:text-primary" aria-label={`Open ${m.org.name}`}>
                    <ExternalLink className="size-4" aria-hidden />
                  </Link>
                </li>
              ))}
              {u.headOf.map((h) => (
                <li key={`${h.department.org.slug}-${h.department.code}`} className="bg-highlight-tint/50 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
                  <UserRound className="size-4" aria-hidden /> Heads <b>{h.department.code}</b> at {h.department.org.name}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel eyebrow="Footprint" title="On SelectIQ">
          <dl className="grid grid-cols-2 gap-3">
            {[
              ['Results', u._count.results],
              ['Tests assigned', u._count.assignments],
              ['Tests created', u._count.createdAssessments],
              ['Questions written', u._count.authoredQuestions],
            ].map(([l, v]) => (
              <div key={l as string} className="bg-muted/50 rounded-xl p-3">
                <dd className="font-display text-xl font-semibold">{v}</dd>
                <dt className="text-muted-foreground text-xs">{l}</dt>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="Audit" title="Changes to this person">
          <AuditList items={u.auditAbout.map((a) => ({ id: a.id, text: `${a.user.name ?? a.user.email} · ${AUDIT_ACTION_LABEL[a.action] ?? a.action}`, at: a.createdAt }))} />
        </Panel>
        <Panel eyebrow="Audit" title="What they changed">
          <AuditList items={u.auditBy.map((a) => ({ id: a.id, text: `${AUDIT_ACTION_LABEL[a.action] ?? a.action} · ${a.entityType}`, at: a.createdAt }))} />
        </Panel>
      </div>
    </div>
  )
}

function AuditList({ items }: { items: { id: string; text: string; at: Date }[] }) {
  if (!items.length) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <FileCheck2 className="size-4" aria-hidden /> Nothing recorded.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate">{i.text}</span>
          <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(i.at)}</span>
        </li>
      ))}
    </ul>
  )
}
