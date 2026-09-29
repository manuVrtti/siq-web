import Link from 'next/link'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Inbox,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'

import { Panel } from '@/components/analytics/panel'
import { StatCard } from '@/components/analytics/stat-card'
import { TrendLine } from '@/components/analytics/trend-line'
import { Initials, PanelEmpty, Pill, StatusPill } from '@/components/dashboard/bits'
import { Button } from '@/components/ui/button'
import { shortDateTime, timeAgo } from '@/lib/format'
import {
  getOrgOverview,
  getOrgScoreTrend,
  getPendingReviewQueue,
  getRecentSubmissions,
  getUpcomingAssessments,
} from '@/services/analytics/org-analytics'

/**
 * Plan 019 — dashboard for placement cells, college admins and recruiters.
 * Four KPIs, then "how are scores moving" beside "what needs me", then
 * "what just happened" beside "what's live". Every panel links to the page
 * where the admin acts on it.
 */
export async function ManagerDashboard({ orgId, slug }: { orgId: string; slug: string }) {
  const [overview, trend, recent, upcoming, queue] = await Promise.all([
    getOrgOverview(orgId),
    getOrgScoreTrend(orgId),
    getRecentSubmissions(orgId),
    getUpcomingAssessments(orgId),
    getPendingReviewQueue(orgId),
  ])

  const weekDelta = overview.submissions.thisWeek - overview.submissions.lastWeek
  const attention = overview.pendingReview + overview.highFlags30d

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Candidates"
          value={overview.candidates.toLocaleString('en-IN')}
          hint={`${overview.assignments.total.toLocaleString('en-IN')} invitations sent`}
          icon={Users}
        />
        <StatCard
          label="Live assessments"
          value={overview.assessments.published}
          hint={
            overview.assessments.draft > 0
              ? `${overview.assessments.draft} in draft`
              : 'No drafts pending'
          }
          icon={ClipboardCheck}
        />
        <StatCard
          label="Submissions this week"
          value={overview.submissions.thisWeek}
          delta={{ value: weekDelta, label: 'vs last week' }}
          icon={FileCheck2}
        />
        <StatCard
          label="Average score"
          value={overview.avgPercentage}
          suffix={overview.avgPercentage === null ? undefined : '%'}
          hint={
            overview.passRate === null
              ? `${overview.graded} graded`
              : `Pass rate ${overview.passRate}% · ${overview.graded} graded`
          }
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          eyebrow="Performance"
          title="Average score by exam"
          action={
            <Link
              href={`/${slug}/analytics`}
              className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              Analytics <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          <TrendLine
            points={trend.map((t) => ({
              title: t.title,
              value: t.avgPercentage,
              meta: `${t.submissions} graded`,
            }))}
            emptyText="Scores will appear here once your first exam is graded."
          />
        </Panel>

        <Panel
          eyebrow="Needs attention"
          title={attention > 0 ? `${attention} item${attention === 1 ? '' : 's'}` : 'All caught up'}
          className={attention > 0 ? 'border-warning/40' : undefined}
        >
          {attention === 0 ? (
            <PanelEmpty
              icon={CheckCircle2}
              title="Nothing waiting on you"
              body="Every submission is graded and no serious proctoring flags came in this month."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {overview.highFlags30d > 0 ? (
                <div className="bg-destructive/5 border-destructive/20 flex items-start gap-3 rounded-xl border p-3">
                  <ShieldAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="text-sm">
                    <p className="font-medium">
                      {overview.highFlags30d} high-severity proctoring flag
                      {overview.highFlags30d === 1 ? '' : 's'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Last 30 days · review them on each candidate&apos;s grade page
                    </p>
                  </div>
                </div>
              ) : null}

              {overview.pendingReview > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    {overview.pendingReview} awaiting manual grading
                  </p>
                  {queue.map((q) => (
                    <Link
                      key={q.id}
                      href={`/${slug}/assessments/${q.assessment.id}/results/${q.id}/grade`}
                      className="hover:bg-muted/60 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
                    >
                      <Initials name={q.user.name} email={q.user.email} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {q.user.name ?? q.user.email}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {q.assessment.title} · {timeAgo(q.createdAt)}
                        </p>
                      </div>
                      <span className="text-primary text-xs font-medium">Grade</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel eyebrow="Activity" title="Recent submissions" bodyClassName="px-3 pb-3">
          {recent.length === 0 ? (
            <PanelEmpty
              icon={Inbox}
              title="No submissions yet"
              body="When candidates finish an exam, it shows up here in real order."
            />
          ) : (
            <ul className="flex flex-col">
              {recent.map((r) => {
                const href = r.result
                  ? `/${slug}/assessments/${r.assessment.id}/results/${r.result.id}/grade`
                  : `/${slug}/assessments/${r.assessment.id}/results`
                return (
                  <li key={r.id}>
                    <Link
                      href={href}
                      className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
                    >
                      <Initials name={r.user.name} email={r.user.email} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {r.user.name ?? r.user.email}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {r.assessment.title}
                        </p>
                      </div>
                      <StatusPill
                        status={r.result?.status ?? null}
                        percentage={r.result?.percentage}
                        passed={r.result?.passed}
                      />
                      <span className="text-muted-foreground hidden w-16 text-right text-xs sm:block">
                        {r.submittedAt ? timeAgo(r.submittedAt) : ''}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel
          eyebrow="Live"
          title="Open assessments"
          action={
            <Button size="sm" render={<Link href={`/${slug}/assessments/new`} />}>
              New
            </Button>
          }
          bodyClassName="px-3 pb-3"
        >
          {upcoming.length === 0 ? (
            <PanelEmpty
              icon={CalendarClock}
              title="Nothing live right now"
              body="Publish an assessment and assign it to candidates to open it."
            />
          ) : (
            <ul className="flex flex-col">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/${slug}/assessments/${a.id}/analytics`}
                    className="hover:bg-muted/60 flex flex-col gap-1 rounded-lg px-2 py-2.5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <Pill tone="info">{a._count.assignments} invited</Pill>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {a.durationMinutes} min
                      {a.startAt ? ` · opens ${shortDateTime(a.startAt)}` : ''}
                      {a.endAt ? ` · closes ${shortDateTime(a.endAt)}` : ' · no close date'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
