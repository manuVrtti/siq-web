import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  FileCheck2,
  GraduationCap,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'

import { Sparkline } from '@/components/admin/sparkline'
import { CountUp } from '@/components/motion/animated'
import { AUDIT_ACTION_LABEL, ROLE_LABEL } from '@/constants/labels'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { firstName, greeting, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getOrgDirectoryRows } from '@/services/console'
import { getPlatformDashboard } from '@/services/platform'

export const metadata: Metadata = { title: 'Platform console — SelectIQ' }


/** Super Admin overview — ABtalks-style console: KPIs, trends, attention, activity. */
export default async function AdminOverviewPage() {
  const user = (await getCurrentUser())!
  const [d, orgs] = await Promise.all([getPlatformDashboard(), getOrgDirectoryRows()])
  const mostActive = [...orgs].filter((o) => o.submissions7d > 0).sort((a, b) => b.submissions7d - a.submissions7d).slice(0, 5)
  const recent = [...orgs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5)
  const health = { noAdmin: orgs.filter((o) => o.health === 'no-admin').length, noDepts: orgs.filter((o) => o.health === 'no-departments').length, inactive: orgs.filter((o) => o.health === 'inactive').length }
  const name = firstName(user.name)
  const staff = (d.roles.COLLEGE_ADMIN ?? 0) + (d.roles.COLLEGE_HOD ?? 0)

  const attention = [
    health.noAdmin > 0 && {
      text: `${health.noAdmin} college${health.noAdmin === 1 ? ' has' : 's have'} no active College Admin`,
      href: '/admin/organizations?health=no-admin',
      cta: 'Review',
    },
    health.noDepts > 0 && {
      text: `${health.noDepts} college${health.noDepts === 1 ? ' has' : 's have'} no departments`,
      href: '/admin/organizations?health=no-departments',
      cta: 'Review',
    },
    health.inactive > 0 && {
      text: `${health.inactive} organization${health.inactive === 1 ? '' : 's'} inactive for 30 days`,
      href: '/admin/organizations?health=inactive',
      cta: 'Review',
    },
    d.attention.hodsNoDept > 0 && { text: `${d.attention.hodsNoDept} HOD${d.attention.hodsNoDept === 1 ? '' : 's'} with no department`, href: '/admin/users?role=COLLEGE_HOD', cta: 'Review' },
    d.attention.pendingStaff > 0 && { text: `${d.attention.pendingStaff} staff invite${d.attention.pendingStaff === 1 ? '' : 's'} not accepted yet`, href: '/admin/users?status=invited', cta: 'Review' },
    ...d.attention.suspended.map((u) => ({ text: `${u.name ?? u.email} is suspended`, href: `/admin/users/${u.id}`, cta: 'Open' })),
  ].filter(Boolean) as { text: string; href: string; cta: string }[]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="siq-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{greeting()}{name ? `, ${name}` : ''}</p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">Platform console</h1>
          <p className="text-muted-foreground mt-1 text-sm">Every college, every person on SelectIQ — and what needs you.</p>
        </div>
        <Link
          href="/admin/organizations/new"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-primary)]"
        >
          <Building2 className="size-4" aria-hidden /> Onboard a college
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Colleges" value={d.colleges} hint={`${d.companies} compan${d.companies === 1 ? 'y' : 'ies'}`} icon={Building2} href="/admin/organizations" />
        <Kpi label="Students" value={d.roles.STUDENT ?? 0} hint={`${d.users} accounts in all`} icon={GraduationCap} href="/admin/users?role=STUDENT" />
        <Kpi
          label="New sign-ups"
          value={d.signups.thisWeek}
          delta={d.signups.thisWeek - d.signups.lastWeek}
          hint="this week"
          series={d.signups.series}
          icon={UserPlus}
          href="/admin/users"
        />
        <Kpi
          label="Submissions"
          value={d.submissions.thisWeek}
          delta={d.submissions.thisWeek - d.submissions.lastWeek}
          hint="this week"
          series={d.submissions.series}
          icon={FileCheck2}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="siq-card siq-rise overflow-hidden">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <AlertTriangle className={cn('size-4', attention.length ? 'text-warning' : 'text-success')} aria-hidden />
            <h2 className="text-[15px] font-semibold">Needs attention</h2>
            <span className="text-muted-foreground ml-auto text-xs">{attention.length || 'All clear'}</span>
          </div>
          {attention.length === 0 ? (
            <p className="text-muted-foreground px-5 py-8 text-center text-sm">Every college has an admin, every HOD has a department, nobody is suspended.</p>
          ) : (
            <ul className="divide-y">
              {attention.slice(0, 8).map((a) => (
                <li key={a.text} className="siq-row flex items-center gap-3 px-5 py-3">
                  <p className="min-w-0 flex-1 truncate text-sm">{a.text}</p>
                  <Link href={a.href} className="text-primary group inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline">
                    {a.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t px-5 py-4">
            <p className="text-muted-foreground mb-3 text-xs font-medium">People by role</p>
            <div className="grid grid-cols-5 gap-2">
              {(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'STUDENT'] as const).map((r) => (
                <Link key={r} href={`/admin/users?role=${r}`} className="hover:bg-muted rounded-xl p-2 text-center transition-colors">
                  <p className="font-display text-xl font-semibold">{(d.roles[r] ?? 0).toLocaleString('en-IN')}</p>
                  <p className="text-muted-foreground text-[11px] leading-tight">{ROLE_LABEL[r]}</p>
                </Link>
              ))}
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              <ShieldCheck className="mr-1 inline size-3.5" aria-hidden />
              {staff} college staff across {d.colleges} college{d.colleges === 1 ? '' : 's'}
            </p>
          </div>
        </section>

        <section className="siq-card siq-rise overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-[15px] font-semibold">Recent activity</h2>
            <Link href="/admin/audit" className="text-primary text-xs font-semibold hover:underline">
              Audit log
            </Link>
          </div>
          {d.recentAudit.length === 0 ? (
            <p className="text-muted-foreground px-5 py-8 text-center text-sm">Nothing recorded yet.</p>
          ) : (
            <ol className="px-5 py-4">
              {d.recentAudit.map((a, i) => (
                <li key={a.id} className="siq-in-up relative flex gap-3 pb-4 last:pb-0" style={{ '--d': `${i * 50}ms` } as React.CSSProperties}>
                  {i < d.recentAudit.length - 1 ? <span className="bg-border absolute top-4 bottom-0 left-[5px] w-px" aria-hidden /> : null}
                  <span className="bg-primary relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-[var(--card)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{a.user.name ?? a.user.email}</span>{' '}
                      <span className="text-muted-foreground">{AUDIT_ACTION_LABEL[a.action] ?? a.action}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">{timeAgo(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <OrgList title="Most active this week" empty="No submissions this week." rows={mostActive.map((o) => ({ id: o.id, name: o.name, meta: `${o.submissions7d} submissions · ${o.students} students` }))} />
        <OrgList title="Recently onboarded" empty="No organizations yet." rows={recent.map((o) => ({ id: o.id, name: o.name, meta: `${timeAgo(o.createdAt)} · ${o.admins} admin${o.admins === 1 ? '' : 's'} · ${o.departments} departments` }))} />
      </div>
    </div>
  )
}

function OrgList({ title, empty, rows }: { title: string; empty: string; rows: { id: string; name: string; meta: string }[] }) {
  return (
    <section className="siq-card siq-rise overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <Link href="/admin/organizations" className="text-primary text-xs font-semibold hover:underline">
          Directory
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-5 py-6 text-sm">{empty}</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/organizations/${r.id}`} className="siq-row flex items-center gap-3 px-5 py-3">
                <Building2 className="text-muted-foreground size-4" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="text-muted-foreground block text-xs">{r.meta}</span>
                </span>
                <ArrowRight className="text-muted-foreground size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  series,
  href,
}: {
  label: string
  value: number
  hint: string
  icon: typeof Users
  delta?: number
  series?: number[]
  href?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[13px] font-medium">{label}</p>
        <span className="bg-accent text-primary grid size-8 place-items-center rounded-lg">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="font-display text-[30px] leading-none font-semibold">
          <CountUp value={value} />
        </p>
        {series ? <Sparkline values={series} className="h-9 w-28" /> : null}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
              delta > 0 ? 'bg-success/10 text-success' : delta < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
            )}
          >
            {delta > 0 ? <ArrowUpRight className="size-3" aria-hidden /> : delta < 0 ? <ArrowDownRight className="size-3" aria-hidden /> : null}
            {delta > 0 ? '+' : ''}
            {delta} vs last week
          </span>
        ) : null}
        <span className="text-muted-foreground">{hint}</span>
      </div>
    </>
  )
  return href ? (
    <Link href={href} className="siq-card siq-lift siq-rise block p-5">
      {body}
    </Link>
  ) : (
    <div className="siq-card siq-rise p-5">{body}</div>
  )
}
