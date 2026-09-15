import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FileText } from 'lucide-react'

import { ResultsTable } from '@/components/results/results-table'
import { formatScore } from '@/components/results/score-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { PERMISSIONS } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { hasPermission } from '@/lib/auth/permissions'
import { getAssessment } from '@/services/assessments'
import { getOrgBySlug } from '@/services/organizations'
import { listResultsForAssessment, summariseResults } from '@/services/grading'

export const metadata: Metadata = { title: 'Results — SelectIQ' }

/**
 * Plan 016 — admin view of every candidate's Result for one assessment.
 *
 * Rendered by the org shell, so RBAC is already enforced. Each row deep-links
 * into the per-candidate grading page.
 */
export default async function AssessmentResultsPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>
}) {
  const { org: slug, id } = await params
  const user = (await getCurrentUser())!
  if (!hasPermission(user, PERMISSIONS.VIEW_ORG_RESULTS)) notFound()

  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const assessment = await getAssessment(org.id, id).catch(() => null)
  if (!assessment) notFound()

  const results = await listResultsForAssessment(org.id, id)
  const summary = summariseResults(results)

  return (
    <>
      <PageHeader
        title={`Results: ${assessment.title}`}
        description={`${org.name} · ${summary.total} submission${summary.total === 1 ? '' : 's'}`}
      />

      {results.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No submissions yet"
          description="Results appear here once candidates finish this assessment."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Graded" value={String(summary.graded)} />
            <SummaryCard label="Pending" value={String(summary.pending)} />
            <SummaryCard
              label="Avg score"
              value={summary.graded > 0 ? formatScore(summary.avgScore) : '—'}
            />
            <SummaryCard
              label="Pass rate"
              value={summary.graded > 0 ? `${summary.passRate.toFixed(0)}%` : '—'}
            />
          </div>

          <ResultsTable
            rows={results.map((r) => ({
              id: r.id,
              status: r.status,
              totalScore: r.totalScore,
              maxScore: r.maxScore,
              percentage: r.percentage,
              passed: r.passed,
              user: r.user,
            }))}
            gradeHref={(rid) => `/${slug}/assessments/${id}/results/${rid}/grade`}
          />
        </div>
      )}
    </>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="gap-1 pb-2">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
        <CardTitle className="text-xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent />
    </Card>
  )
}
