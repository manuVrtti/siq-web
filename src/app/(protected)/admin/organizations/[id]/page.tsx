import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Building2, ExternalLink, GraduationCap, Settings, Users } from 'lucide-react'

import { EditOrgForm } from '@/components/admin/admin-actions'
import { Panel } from '@/components/analytics/panel'
import { StatCard } from '@/components/analytics/stat-card'
import { StaffManager } from '@/components/people/staff-manager'
import { DepartmentsManager } from '@/components/settings/departments-manager'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { NotFoundError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { getOrganizationDetail } from '@/services/admin'
import { getCollegeOverview } from '@/services/college-admin'
import { listDepartments } from '@/services/departments'
import { listCollegeStaff } from '@/services/people'

export const metadata: Metadata = { title: 'Organization — Platform console — SelectIQ' }

const TABS = [
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
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? (isCollege ? 'people' : 'settings')
  const [o, staff, depts] = await Promise.all([
    getCollegeOverview(org.id),
    tab === 'people' ? listCollegeStaff(org.id) : Promise.resolve([]),
    tab === 'departments' || tab === 'people' ? listDepartments(org.id) : Promise.resolve(null),
  ])

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
          </p>
        </div>
        <Button variant="outline" render={<Link href={`/${org.slug}/${isCollege ? 'manage' : 'dashboard'}`} />}>
          Open {isCollege ? 'college admin' : 'workspace'}
          <ExternalLink className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Students" value={o.students} hint={`${o.studentsPending} yet to sign in`} />
        <StatCard label="College Admins" value={o.admins} hint={o.admins === 0 ? 'none — add one' : `${o.hods} HODs`} tone={o.admins === 0 ? 'attention' : 'default'} />
        <StatCard label="Departments" value={o.departments} hint={`${o.unassigned} students unassigned`} />
        <StatCard label="Assessments" value={org._count.assessments} hint={`${org._count.questions} questions`} />
      </div>

      <nav aria-label="Organization" className="bg-muted/70 flex w-full gap-1 overflow-x-auto rounded-2xl p-1 sm:w-fit">
        {TABS.filter((t) => isCollege || t.key === 'settings' || t.key === 'people').map((t) => (
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
        <Panel eyebrow="Platform-only" title="Name & email domain">
          <p className="text-muted-foreground mb-4 text-sm">
            Only Super Admins can change these: the email domain decides which students join this college automatically.
          </p>
          <EditOrgForm id={org.id} name={org.name} domain={org.domain} />
        </Panel>
      ) : null}
    </div>
  )
}
