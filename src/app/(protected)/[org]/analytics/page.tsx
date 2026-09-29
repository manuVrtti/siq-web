import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, Layers, Users } from 'lucide-react'

import { Panel } from '@/components/analytics/panel'
import { StatCard } from '@/components/analytics/stat-card'
import { TrendLine } from '@/components/analytics/trend-line'
import { PanelEmpty, Pill } from '@/components/dashboard/bits'
import { PERMISSIONS } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { hasPermission } from '@/lib/auth/permissions'
import { listAssessmentPerformance } from '@/services/analytics/assessment-analytics'
import { listBatchPerformance } from '@/services/analytics/candidate-analytics'
import { getOrgOverview, getOrgScoreTrend } from '@/services/analytics/org-analytics'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Analytics — SelectIQ' }

/**
 * Plan 019 — org analytics: every assessment and every batch compared side by
 * side, with a drill-down into each assessment. The dashboard is the "at a
 * glance" view; this page is where a placement head compares.
 */
export default async function AnalyticsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const user = (await getCurrentUser())!
  if (!hasPermission(user, PERMISSIONS.VIEW_ORG_RESULTS)) notFound()

  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const [overview, trend, assessments, batches] = await Promise.all([
    getOrgOverview(org.id),
    getOrgScoreTrend(org.id, 12),
    listAssessmentPerformance(org.id),
    listBatchPerformance(org.id),
  ])

  const completion =
    overview.assignments.total > 0
      ? Math.round((overview.assignments.submitted / overview.assignments.total) * 100)
      : null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div>
        <p className="siq-eyebrow mb-2">{org.name}</p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          How every assessment and batch is performing. Open an assessment for question-level
          detail.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Average score"
          value={overview.avgPercentage}
          suffix={overview.avgPercentage === null ? undefined : '%'}
          hint={`${overview.graded} graded results`}
          icon={BarChart3}
        />
        <StatCard
          label="Pass rate"
          value={overview.passRate}
          suffix={overview.passRate === null ? undefined : '%'}
          hint="Across exams with a pass mark"
        />
        <StatCard
          label="Completion"
          value={completion}
          suffix={completion === null ? undefined : '%'}
          hint={`${overview.assignments.submitted} of ${overview.assignments.total} invitations`}
          icon={Users}
        />
        <StatCard
          label="Assessments run"
          value={assessments.filter((a) => a.submitted > 0).length}
          hint={`${overview.assessments.published} currently live`}
          icon={Layers}
        />
      </div>

      <Panel eyebrow="Trend" title="Average score across recent exams">
        <TrendLine
          points={trend.map((t) => ({
            title: t.title,
            value: t.avgPercentage,
            meta: `${t.submissions} graded`,
          }))}
        />
      </Panel>

      <Panel eyebrow="Assessments" title="Performance by assessment" bodyClassName="px-0 pb-2">
        {assessments.length === 0 ? (
          <PanelEmpty
            icon={Layers}
            title="No published assessments"
            body="Publish an assessment to start collecting analytics."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-5 py-2 font-medium">Assessment</th>
                  <th className="py-2 text-right font-medium">Invited</th>
                  <th className="py-2 text-right font-medium">Submitted</th>
                  <th className="py-2 pl-6 font-medium">Average</th>
                  <th className="py-2 text-right font-medium">Pass rate</th>
                  <th className="px-5 py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="max-w-[280px] px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{a.title}</span>
                        {a.status === 'ARCHIVED' ? <Pill tone="muted">archived</Pill> : null}
                        {a.proctoringEnabled ? <Pill tone="info">proctored</Pill> : null}
                      </div>
                    </td>
                    <td className="siq-numeric py-3 text-right">{a.invited}</td>
                    <td className="siq-numeric py-3 text-right">{a.submitted}</td>
                    <td className="w-48 py-3 pl-6">
                      {a.avgPercentage === null ? (
                        <span className="text-muted-foreground text-xs">No graded results</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{ width: `${a.avgPercentage}%` }}
                            />
                          </div>
                          <span className="siq-numeric w-12 text-right text-xs">
                            {a.avgPercentage}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="siq-numeric py-3 text-right">
                      {a.passRate === null ? '—' : `${a.passRate}%`}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/${slug}/assessments/${a.id}/analytics`}
                        className="text-primary text-xs font-medium hover:underline"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel eyebrow="Batches" title="Performance by batch" bodyClassName="px-0 pb-2">
        {batches.length === 0 ? (
          <PanelEmpty
            icon={Users}
            title="No batches yet"
            body="Group candidates into batches on the Candidates page to compare cohorts."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-5 py-2 font-medium">Batch</th>
                  <th className="py-2 text-right font-medium">Members</th>
                  <th className="py-2 text-right font-medium">Graded exams</th>
                  <th className="py-2 text-right font-medium">Average</th>
                  <th className="px-5 py-2 text-right font-medium">Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="px-5 py-3 font-medium">{b.name}</td>
                    <td className="siq-numeric py-3 text-right">{b.members}</td>
                    <td className="siq-numeric py-3 text-right">{b.graded}</td>
                    <td className="siq-numeric py-3 text-right">
                      {b.avgPercentage === null ? '—' : `${b.avgPercentage}%`}
                    </td>
                    <td className="siq-numeric px-5 py-3 text-right">
                      {b.passRate === null ? '—' : `${b.passRate}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
