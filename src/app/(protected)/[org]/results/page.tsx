import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3 } from 'lucide-react'

import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { PERMISSIONS } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { hasPermission } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Results — SelectIQ' }

/**
 * Plan 016 — org-wide results landing.
 *
 * Lists every assessment in the org along with a count of graded / pending
 * submissions, so an admin can drill into the per-assessment results table.
 */
export default async function ResultsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const user = (await getCurrentUser())!
  if (!hasPermission(user, PERMISSIONS.VIEW_ORG_RESULTS)) notFound()

  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  // One aggregate query per assessment would N+1; group by instead.
  const [assessments, groups] = await Promise.all([
    prisma.assessment.findMany({
      where: { orgId: org.id },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.result.groupBy({
      by: ['assessmentId', 'status'],
      where: { assessment: { orgId: org.id } },
      _count: { _all: true },
    }),
  ])

  const countsById = new Map<string, { graded: number; pending: number }>()
  for (const g of groups) {
    const row = countsById.get(g.assessmentId) ?? { graded: 0, pending: 0 }
    if (g.status === 'GRADED') row.graded += g._count._all
    else row.pending += g._count._all
    countsById.set(g.assessmentId, row)
  }

  const withResults = assessments.filter(
    (a) => (countsById.get(a.id)?.graded ?? 0) + (countsById.get(a.id)?.pending ?? 0) > 0,
  )

  return (
    <>
      <PageHeader title="Results" description={`${org.name} · ${withResults.length} with submissions`} />

      {withResults.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No submissions yet"
          description="Results appear once candidates finish an assessment."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {withResults.map((a) => {
            const c = countsById.get(a.id)!
            return (
              <Link key={a.id} href={`/${slug}/assessments/${a.id}/results`} className="block">
                <Card className="transition-colors hover:border-current/30">
                  <CardHeader className="gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-muted-foreground uppercase tracking-wide">
                        {a.status.toLowerCase()}
                      </span>
                      <span className="ml-auto tabular-nums">
                        {c.graded} graded · {c.pending} pending
                      </span>
                    </div>
                    <CardTitle className="text-base font-medium">{a.title}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
