import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Activity, Building2, Check, ExternalLink, GraduationCap, LayoutDashboard, Settings, Users, X } from 'lucide-react'

import { EditOrgForm, OrgStatusControl } from '@/components/admin/admin-actions'
import { Sparkline } from '@/components/admin/sparkline'
import { Panel } from '@/components/analytics/panel'
import { StatCard } from '@/components/analytics/stat-card'
import { StaffManager } from '@/components/people/staff-manager'
import { DepartmentsManager } from '@/components/settings/departments-manager'
import { Button } from '@/components/ui/button'
import { AUDIT_ACTION_LABEL } from '@/constants/labels'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { NotFoundError } from '@/lib/errors'
import { timeAgo } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { getOrganizationDetail } from '@/services/admin'
import { getCollegeOverview } from '@/services/college-admin'
import { orgActivitySeries } from '@/services/console'
import { listDepartments } from '@/services/departments'
import { listCollegeStaff } from '@/services/people'

export const metadata: Metadata = { title: 'Organization — Platform console — SelectIQ' }

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'people', label: 'People', icon: Users },
  { key: 'departments', label: 'Departments', icon: Building2 },
  { key: 'students', label: 'Students', icon: GraduationCap },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const

/**
 * Super Admin → one organization: everything its College Admin can do
 * (same components, same guarded APIs), plus the platform-only settings
 * (name, email domain). Tabs via ?tab=.
 */
export default async function AdminOrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams])
  const me = (await getCurrentUser())!
  let org
  try {
    org = await getOrganizationDetail(id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  const isCollege = org.type === 'COLLEGE'
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? 'overview'
  const [o, staff, depts, series, activity] = await Promise.all([
    getCollegeOverview(org.id),
    tab === 'people' ? listCollegeStaff(org.id) : Promise.resolve([]),
    tab === 'departments' || tab === 'people' ? listDepartments(org.id) : Promise.resolve(null),
    tab === 'overview' ? orgActivitySeries(org.id) : Promise.resolve([] as number[]),
    tab === 'overview'
      ? prisma.auditLog.findMany({
          where: { OR: [{ entityId: org.id }, { metadata: { path: ['orgId'], equals: org.id } }] },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id: true, action: true, createdAt: true, user: { select: { name: true, email: true } } },
        })
      : Promise.resolve([]),
  ])
  const checklist = [
    { ok: o.admins >= 1, t: 'Has a College Admin', d: `${o.admins} active`, tab: 'people', college: true },
    { ok: o.admins >= 2, t: 'A second admin (no lock-out)', d: o.admins >= 2 ? 'Yes' : 'Recommended', tab: 'people', college: true },
    { ok: o.departments > 0, t: 'Departments set up', d: `${o.departments}`, tab: 'departments', college: true },
    {
      ok: o.hods > 0 && o.hodsNoDept === 0,
      t: 'Every HOD has a department',
      d: o.hods ? `${o.hods - o.hodsNoDept}/${o.hods}` : 'No HODs yet',
      tab: 'people',
      college: true,
    },
    { ok: o.students > 0, t: 'Students on the roster', d: o.students.toLocaleString('en-IN'), tab: 'students', college: true },
    {
      ok: o.departments > 0 && o.unassigned === 0,
      t: 'Every student in a department',
      d: o.departments === 0 ? 'Add departments first' : o.unassigned ? `${o.unassigned} unassigned` : 'Yes',
      tab: 'students',
      college: true,
    },
    { ok: o.published > 0, t: 'A live test', d: `${o.published} live`, tab: 'overview', college: false },
  ].filter((x) => isCollege || !x.college)


  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="siq-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/admin/organizations" className="text-muted-foreground hover:text-foreground text-xs font-medium">
            ← Colleges & companies
          </Link>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">{org.name}</h1>
          <p className="text-muted-foreground text-sm">
            /{org.slug} · {isCollege ? 'College' : 'Company'}
            {org.domain ? ` · @${org.domain}` : ''}
            {org.city || org.state ? ` · ${[org.city, org.state].filter(Boolean).join(', ')}` : ''}
          </p>
          {org.status === 'SUSPENDED' ? (
            <p className="bg-destructive/10 text-destructive mt-2 inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold">
              Suspended {org.suspendedAt ? timeAgo(org.suspendedAt) : ''}
              {org.suspendedReason ? ` — ${org.suspendedReason}` : ''} · members have no access
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <OrgStatusControl id={org.id} name={org.name} suspended={org.status === 'SUSPENDED'} />
          <Button variant="outline" render={<Link href={`/${org.slug}/${isCollege ? 'manage' : 'dashboard'}`} />}>
            Open {isCollege ? 'college admin' : 'workspace'}
            <ExternalLink className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Students" value={o.students} hint={`${o.studentsPending} yet to sign in`} />
        <StatCard label="College Admins" value={o.admins} hint={o.admins === 0 ? 'none — add one' : `${o.hods} HODs`} tone={o.admins === 0 ? 'attention' : 'default'} />
        <StatCard label="Departments" value={o.departments} hint={`${o.unassigned} students unassigned`} />
        <StatCard label="Assessments" value={org._count.assessments} hint={`${org._count.questions} questions`} />
      </div>

      <nav aria-label="Organization" className="bg-muted/70 flex w-full gap-1 overflow-x-auto rounded-2xl p-1 sm:w-fit">
        {TABS.filter((t) => isCollege || t.key === 'settings' || t.key === 'overview').map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-all',
              tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'overview' ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Panel eyebrow="Setup" title="Health checklist">
            <ul className="flex flex-col gap-2.5">
              {checklist.map((x) => (
                <li key={x.t}>
                  <Link href={`?tab=${x.tab}`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors">
                    <span
                      className={
                        x.ok
                          ? 'bg-success text-primary-foreground grid size-6 place-items-center rounded-full'
                          : 'bg-muted text-muted-foreground grid size-6 place-items-center rounded-full'
                      }
                    >
                      {x.ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                    </span>
                    <span className="flex-1 text-sm">{x.t}</span>
                    <span className="text-muted-foreground text-xs">{x.d}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-col gap-5">
            <Panel eyebrow="Activity" title={`${o.submitted7d} submissions this week`}>
              <Sparkline values={series} className="h-16 w-full" />
              <p className="text-muted-foreground mt-2 text-xs">Last 14 days · {o.published} live tests</p>
            </Panel>
            <Panel eyebrow="Audit" title="Recent changes here">
              {activity.length === 0 ? (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Activity className="size-4" aria-hidden /> Nothing recorded yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate">
                        <b className="font-medium">{a.user.name ?? a.user.email}</b> <span className="text-muted-foreground">{AUDIT_ACTION_LABEL[a.action] ?? a.action}</span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/admin/audit?org=${org.id}`} className="text-primary mt-3 inline-block text-xs font-semibold hover:underline">
                Full audit log for this organization
              </Link>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === 'people' ? (
        <StaffManager
          orgId={org.id}
          actorId={me.id}
          departments={(depts?.departments ?? []).map((d) => ({ id: d.id, code: d.code, name: d.name }))}
          staff={staff.map((s) => ({ ...s, lastLoginAt: s.lastLoginAt?.toISOString() ?? null }))}
        />
      ) : null}

      {tab === 'departments' && depts ? (
        <DepartmentsManager
          orgId={org.id}
          studentsPickDepartment={depts.studentsPickDepartment}
          departments={depts.departments.map((d) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            students: d._count.members,
            assessments: d._count.assessments,
            batches: d._count.batches,
            heads: d.heads.map((h) => ({ id: h.user.id, name: h.user.name, email: h.user.email, pending: h.user.firebaseUid.startsWith('pending:') })),
          }))}
        />
      ) : null}

      {tab === 'students' ? (
        <Panel eyebrow="Students" title={`${o.students.toLocaleString('en-IN')} students`}>
          <p className="text-muted-foreground mb-4 text-sm">
            Students are managed in the college’s own workspace — import, edit, move between departments, set up password sign-in or remove.
            As Super Admin you have full access there.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href={`/${org.slug}/candidates`} />}>Open candidates</Button>
            <Button variant="outline" render={<Link href={`/admin/users?org=${org.id}&role=STUDENT`} />}>
              View in All people
            </Button>
          </div>
        </Panel>
      ) : null}

      {tab === 'settings' ? (
        <Panel eyebrow="Platform-only" title="Profile">
          <p className="text-muted-foreground mb-4 text-sm">
            Only Super Admins can change these: the email domain decides which students join this college automatically.
          </p>
          <EditOrgForm id={org.id} name={org.name} domain={org.domain} city={org.city} state={org.state} />
        </Panel>
      ) : null}
    </div>
  )
}
