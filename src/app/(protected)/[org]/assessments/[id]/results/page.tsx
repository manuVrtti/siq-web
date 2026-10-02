import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, Download, FileCheck2, FileText, Hourglass, Target, Trophy } from 'lucide-react'

import { IntegrityBadge } from '@/components/proctoring/integrity-badge'
import { integrityByAssignment } from '@/services/proctoring'
import { prisma } from '@/lib/prisma'
import { StatCard } from '@/components/analytics/stat-card'
import { Initials, StatusPill } from '@/components/dashboard/bits'
import {
  DataTable,
  Pagination,
  SortHeader,
  TD,
  TH,
  THead,
  TRow,
  TableEmpty,
} from '@/components/data/data-table'
import { FilterBar } from '@/components/data/filter-bar'
import { ListHeader } from '@/components/data/list-header'
import { parseTableParams, type SearchParams } from '@/components/data/table-params'
import { formatScore } from '@/components/results/score-badge'
import { Button } from '@/components/ui/button'
import { PERMISSIONS } from '@/constants/permissions'
import { requireAssessmentPage } from '@/lib/auth/page-guard'
import { timeAgo } from '@/lib/format'
import { getAssessment } from '@/services/assessments'
import { RESULT_SORTS, queryResultsForAssessment } from '@/services/grading'

export const metadata: Metadata = { title: 'Results — SelectIQ' }

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)

/**
 * Plan 016, redesigned in plan 019 Phase 3 — every candidate's result for one
 * assessment. Filter by outcome, search by name/email, sort by score; the
 * summary tiles always describe the whole assessment, not the current filter.
 */
export default async function AssessmentResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; id: string }>
  searchParams: Promise<SearchParams>
}) {
  const { org: slug, id } = await params
  const { org, scope } = await requireAssessmentPage(PERMISSIONS.VIEW_ORG_RESULTS, slug, id, 'view')

  const assessment = await getAssessment(org.id, id).catch(() => null)
  if (!assessment) notFound()

  const p = parseTableParams(await searchParams, {
    sortable: RESULT_SORTS,
    defaultSort: 'percentage',
  })
  const outcomeRaw = p.get('outcome')
  const outcome =
    outcomeRaw === 'passed' || outcomeRaw === 'failed' || outcomeRaw === 'pending'
      ? outcomeRaw
      : undefined

  const { items, total, summary } = await queryResultsForAssessment(scope, id, {
    search: p.q || undefined,
    outcome,
    sort: p.sort,
    dir: p.dir,
    skip: p.skip,
    take: p.pageSize,
  })

  // Plan 018b — integrity marker per submission (staff only).
  const attempts = await prisma.examAttempt.findMany({ where: { id: { in: items.map((r) => r.attemptId) } }, select: { id: true, assignmentId: true } })
  const assignmentOf = new Map(attempts.map((a) => [a.id, a.assignmentId]))
  const integrity = await integrityByAssignment(attempts.map((a) => a.assignmentId))

  const base = `/${slug}/assessments/${id}`
  const pathname = `${base}/results`
  const nothingYet = summary.graded + summary.pending === 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow="Results"
        title={assessment.title}
        description={`${summary.graded + summary.pending} submission${summary.graded + summary.pending === 1 ? '' : 's'}`}
        actions={
          <>
            <Button variant="outline" render={<Link href={`${base}/build`} />}>
              Edit assessment
            </Button>
            {!nothingYet ? (
              <Button variant="outline" render={<a href={`/api/export/assessments/${id}/results`} download />}>
                <Download className="size-4" aria-hidden />
                Export Excel
              </Button>
            ) : null}
            <Button render={<Link href={`${base}/analytics`} />}>
              <BarChart3 className="size-4" aria-hidden />
              Analytics
            </Button>
          </>
        }
      />

      {nothingYet ? (
        <TableEmpty
          filtered={false}
          clearHref={pathname}
          icon={<FileText className="size-5" aria-hidden />}
          title="No submissions yet"
          body="Results appear here the moment a candidate submits. Objective questions are graded instantly."
          action={
            <Button size="sm" variant="outline" render={<Link href={`${base}/assign`} />}>
              Assign candidates
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Graded" value={summary.graded} icon={FileCheck2} />
            <StatCard
              label="Awaiting review"
              value={summary.pending}
              icon={Hourglass}
              tone={summary.pending > 0 ? 'attention' : 'default'}
              hint={summary.pending > 0 ? 'Subjective answers to mark' : 'Nothing to mark'}
            />
            <StatCard
              label="Average score"
              value={round1(summary.avgPercentage)}
              suffix={summary.avgPercentage === null ? undefined : '%'}
              icon={Target}
              hint={
                summary.highestPercentage === null
                  ? undefined
                  : `Top score ${round1(summary.highestPercentage)}%`
              }
            />
            <StatCard
              label="Pass rate"
              value={round1(summary.passRate)}
              suffix={summary.passRate === null ? undefined : '%'}
              icon={Trophy}
              hint={summary.passRate === null ? 'No pass mark set' : undefined}
            />
          </div>

          <FilterBar
            searchPlaceholder="Search candidate name or email…"
            filters={[
              {
                key: 'outcome',
                label: 'Outcome',
                options: [
                  { value: 'passed', label: 'Passed' },
                  { value: 'failed', label: 'Not passed' },
                  { value: 'pending', label: 'Awaiting review' },
                ],
              },
            ]}
          />

          {items.length === 0 ? (
            <TableEmpty
              filtered
              clearHref={pathname}
              icon={<FileText className="size-5" aria-hidden />}
              title=""
            />
          ) : (
            <DataTable
              minWidth={820}
              footer={<Pagination pathname={pathname} params={p} total={total} />}
            >
              <THead>
                <th className={`${TH} w-12`}>#</th>
                <SortHeader label="Candidate" field="name" pathname={pathname} params={p} />
                <SortHeader label="Score" field="percentage" pathname={pathname} params={p} align="right" />
                <th className={TH}>Outcome</th>
                <th className={TH}>Integrity</th>
                <SortHeader label="Submitted" field="createdAt" pathname={pathname} params={p} align="right" />
                <th className={`${TH} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </THead>
              <tbody>
                {items.map((r, i) => (
                  <TRow key={r.id} href={`${pathname}/${r.id}/grade`}>
                    <td className={`${TD} text-muted-foreground siq-numeric`}>{p.skip + i + 1}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <Initials name={r.user.name} email={r.user.email} />
                        <div className="min-w-0">
                          <Link
                            href={`${pathname}/${r.id}/grade`}
                            className="hover:text-primary block truncate font-medium transition-colors"
                          >
                            {r.user.name ?? r.user.email}
                          </Link>
                          <p className="text-muted-foreground truncate text-xs">{r.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${TD} text-right`}>
                      <p className="siq-numeric font-medium">
                        {formatScore(r.totalScore)}
                        <span className="text-muted-foreground"> / {formatScore(r.maxScore)}</span>
                      </p>
                      {r.status === 'GRADED' ? (
                        <p className="text-muted-foreground siq-numeric text-xs">
                          {r.percentage.toFixed(1)}%
                        </p>
                      ) : null}
                    </td>
                    <td className={TD}>
                      <StatusPill status={r.status} percentage={null} passed={r.passed} />
                    </td>
                    <td className={TD}>
                      {(() => {
                        const g = integrity.get(assignmentOf.get(r.attemptId) ?? '')
                        return g ? <IntegrityBadge risk={g.risk} flags={g.flags} /> : <span className="text-muted-foreground text-xs">—</span>
                      })()}
                    </td>
                    <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>
                      {timeAgo(r.createdAt)}
                    </td>
                    <td className={`${TD} text-right`}>
                      <Link
                        href={`${pathname}/${r.id}/grade`}
                        className="text-primary text-xs font-medium hover:underline"
                      >
                        {r.status === 'PENDING_REVIEW' ? 'Grade' : 'Review'}
                      </Link>
                    </td>
                  </TRow>
                ))}
              </tbody>
            </DataTable>
          )}
        </>
      )}
    </div>
  )
}
