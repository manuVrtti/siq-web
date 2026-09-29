import Link from 'next/link'
import { Award, BookOpenCheck, ClipboardList, FileClock, GraduationCap, Target } from 'lucide-react'

import { Panel } from '@/components/analytics/panel'
import { StatCard } from '@/components/analytics/stat-card'
import { TrendLine } from '@/components/analytics/trend-line'
import { PanelEmpty, Pill, StatusPill } from '@/components/dashboard/bits'
import { Button } from '@/components/ui/button'
import { shortDateTime, timeAgo } from '@/lib/format'
import { getStudentOverview } from '@/services/analytics/candidate-analytics'

/**
 * Plan 019 — the student's dashboard. The first job is "what do I need to
 * take", so open exams lead, each with a single Start/Resume action. Scores
 * come second. Copy is direct and calm — this is often opened minutes before
 * an exam.
 */
export async function StudentDashboard({ orgId, userId }: { orgId: string; userId: string }) {
  const s = await getStudentOverview(orgId, userId)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Exams to take"
          value={s.open.length}
          hint={s.open.length === 0 ? 'Nothing assigned right now' : 'Assigned by your college'}
          icon={ClipboardList}
          tone={s.open.length > 0 ? 'attention' : 'default'}
        />
        <StatCard
          label="Completed"
          value={s.completed}
          hint={s.pendingReview > 0 ? `${s.pendingReview} awaiting grading` : undefined}
          icon={BookOpenCheck}
        />
        <StatCard
          label="Average score"
          value={s.avgPercentage}
          suffix={s.avgPercentage === null ? undefined : '%'}
          hint={s.decided > 0 ? `Passed ${s.passed} of ${s.decided}` : undefined}
          icon={Target}
        />
        <StatCard
          label="Best score"
          value={s.bestPercentage}
          suffix={s.bestPercentage === null ? undefined : '%'}
          icon={Award}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel eyebrow="Up next" title="Your exams" bodyClassName="px-3 pb-3">
          {s.open.length === 0 ? (
            <PanelEmpty
              icon={GraduationCap}
              title="No exams assigned"
              body="When your placement cell assigns an exam, it will appear here with a Start button."
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {s.open.map((a) => (
                <li
                  key={a.id}
                  className="hover:bg-muted/50 flex flex-col gap-3 rounded-xl px-3 py-3 transition-colors sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{a.assessment.title}</p>
                      {a.status === 'STARTED' ? <Pill tone="warning">In progress</Pill> : null}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {a.assessment.durationMinutes} min
                      {a.assessment.startAt ? ` · opens ${shortDateTime(a.assessment.startAt)}` : ''}
                      {a.assessment.endAt ? ` · closes ${shortDateTime(a.assessment.endAt)}` : ''}
                    </p>
                  </div>
                  <Button size="sm" render={<Link href={`/exam/${a.token}`} />}>
                    {a.status === 'STARTED' ? 'Resume' : 'Start'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          eyebrow="History"
          title="Recent results"
          action={
            <Link href="/my-results" className="text-primary text-xs font-medium hover:underline">
              View all
            </Link>
          }
          bodyClassName="px-3 pb-3"
        >
          {s.recent.length === 0 ? (
            <PanelEmpty icon={FileClock} title="No results yet" body="Finished exams appear here." />
          ) : (
            <ul className="flex flex-col">
              {s.recent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/my-results/${r.id}`}
                    className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.assessment.title}</p>
                      <p className="text-muted-foreground text-xs">{timeAgo(r.createdAt)}</p>
                    </div>
                    <StatusPill status={r.status} percentage={r.percentage} passed={r.passed} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel eyebrow="Progress" title="Your scores over time">
        <TrendLine
          points={s.trend.map((t) => ({ title: t.title, value: t.percentage }))}
          emptyText="Your progress chart starts after your first graded exam."
          valueLabel="score"
        />
      </Panel>
    </>
  )
}
