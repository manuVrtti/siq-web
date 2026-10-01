import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, Building2, FileCheck2, GraduationCap, ScrollText, UserPlus, Users } from 'lucide-react'

import { Panel } from '@/components/analytics/panel'
import { StatCard } from '@/components/analytics/stat-card'
import { Initials, PanelEmpty, Pill } from '@/components/dashboard/bits'
import { DashboardHero } from '@/components/dashboard/bits'
import { firstName, greeting, longDate, timeAgo } from '@/lib/format'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getConsoleOverview } from '@/services/admin'
import { getPlatformOverview } from '@/services/analytics/org-analytics'
import { listAudit } from '@/services/audit'

export const metadata: Metadata = { title: 'Admin — SelectIQ' }

const ACTION_LABEL: Record<string, string> = {
  'org.create': 'created an organization',
  'org.update': 'updated an organization',
  'org.member.add': 'added an org member',
  'org.member.remove': 'removed an org member',
  'user.role.change': 'changed a user role',
  'assessment.publish': 'published an assessment',
  'result.grade': 'graded a result',
  'import.candidates': 'imported candidates',
  'import.questions': 'imported questions',
  'batch.delete': 'deleted a batch',
  'candidate.update': 'edited a candidate',
  'candidate.remove': 'removed candidates',
}

/** Console overview — platform KPIs, activity, and who just joined. */
export default async function AdminOverviewPage() {
  const user = (await getCurrentUser())!
  const [platform, overview, audit] = await Promise.all([
    getPlatformOverview(),
    getConsoleOverview(),
    listAudit({ take: 8 }),
  ])
  const name = firstName(user.name)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <DashboardHero
        eyebrow={longDate()}
        title={name ? `${greeting()}, ${name}` : greeting()}
        subtitle="Everything across every college and company on SelectIQ."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Organizations" value={platform.orgs} icon={Building2} />
        <StatCard
          label="Users"
          value={platform.totalUsers.toLocaleString('en-IN')}
          hint={`${overview.newUsers7d} new this week`}
          icon={Users}
        />
        <StatCard
          label="Active this week"
          value={overview.activeUsers7d.toLocaleString('en-IN')}
          hint="Signed in in the last 7 days"
          icon={Activity}
        />
        <StatCard
          label="Submissions (7d)"
          value={platform.submittedThisWeek}
          hint={`${platform.graded.toLocaleString('en-IN')} graded all-time`}
          icon={FileCheck2}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          eyebrow="Governance"
          title="Recent admin actions"
          action={
            <Link href="/admin/audit" className="text-primary text-xs font-medium hover:underline">
              Audit log
            </Link>
          }
          bodyClassName="px-3 pb-3"
        >
          {audit.items.length === 0 ? (
            <PanelEmpty icon={ScrollText} title="Nothing recorded yet" body="Role changes, org edits, imports, publishing and grading appear here." />
          ) : (
            <ul className="flex flex-col">
              {audit.items.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                  <Initials name={a.user.name} email={a.user.email} />
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{a.user.name ?? a.user.email}</span>{' '}
                    <span className="text-muted-foreground">{ACTION_LABEL[a.action] ?? a.action}</span>
                  </p>
                  <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel eyebrow="Busiest" title="Most active organizations" bodyClassName="px-3 pb-3">
          {overview.activeOrgs.length === 0 ? (
            <PanelEmpty icon={Building2} title="No submissions this week" />
          ) : (
            <ul className="flex flex-col">
              {overview.activeOrgs.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/organizations/${o.id}`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span>
                    <Pill tone="info">{o.submissions} submissions</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          eyebrow="Growth"
          title="Newest users"
          action={
            <Link href="/admin/users" className="text-primary text-xs font-medium hover:underline">
              All users
            </Link>
          }
          bodyClassName="px-3 pb-3"
        >
          {overview.recentUsers.length === 0 ? (
            <PanelEmpty icon={UserPlus} title="No users yet" />
          ) : (
            <ul className="flex flex-col">
              {overview.recentUsers.map((u) => (
                <li key={u.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                  <Initials name={u.name} email={u.email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.name ?? u.email}</p>
                    <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                  </div>
                  <Pill tone="muted">{u.role.replace('_', ' ').toLowerCase()}</Pill>
                  <span className="text-muted-foreground w-16 text-right text-xs">{timeAgo(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel eyebrow="Mix" title="Users by role">
          <ul className="flex flex-col gap-3">
            {(['STUDENT', 'COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const).map((r) => {
              const n = platform.users[r] ?? 0
              const pct = platform.totalUsers ? (n / platform.totalUsers) * 100 : 0
              return (
                <li key={r} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <Link href={`/admin/users?role=${r}`} className="hover:text-primary inline-flex items-center gap-1.5">
                      {r === 'STUDENT' ? <GraduationCap className="size-3.5" aria-hidden /> : null}
                      {r.replace('_', ' ').toLowerCase()}
                    </Link>
                    <span className="siq-numeric">{n.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
