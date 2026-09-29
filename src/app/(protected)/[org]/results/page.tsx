import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3 } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
import { DataTable, TD, TH, THead, TRow, TableEmpty } from '@/components/data/data-table'
import { ListHeader } from '@/components/data/list-header'
import { ASSESSMENT_STATUS_LABEL, labelOf } from '@/constants/labels'
import { PERMISSIONS } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { hasPermission } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Results — SelectIQ' }

/**
 * Plan 016, redesigned in plan 019 Phase 3 — every assessment that has
 * submissions, with its grading progress. Ordered so the ones needing a
 * grader come first: that's why an admin opens this page.
 */
export default async function ResultsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const user = (await getCurrentUser())!
  if (!hasPermission(user, PERMISSIONS.VIEW_ORG_RESULTS)) notFound()

  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  // One groupBy for all assessments rather than a query per row.
  const [assessments, groups, avgs] = await Promise.all([
    prisma.assessment.findMany({
      where: { orgId: org.id },
      select: { id: true, title: true, status: true },
    }),
    prisma.result.groupBy({
      by: ['assessmentId', 'status'],
      where: { assessment: { orgId: org.id } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.result.groupBy({
      by: ['assessmentId'],
      where: { status: 'GRADED', assessment: { orgId: org.id } },
      _avg: { percentage: true },
    }),
  ])

  const stats = new Map<string, { graded: number; pending: number; latest: number }>()
  for (const g of groups) {
    const row = stats.get(g.assessmentId) ?? { graded: 0, pending: 0, latest: 0 }
    if (g.status === 'GRADED') row.graded += g._count._all
    else row.pending += g._count._all
    row.latest = Math.max(row.latest, g._max.createdAt?.getTime() ?? 0)
    stats.set(g.assessmentId, row)
  }
  const avgById = new Map(avgs.map((a) => [a.assessmentId, a._avg.percentage]))

  const rows = assessments
    .filter((a) => stats.has(a.id))
    .map((a) => ({ ...a, ...stats.get(a.id)!, avg: avgById.get(a.id) ?? null }))
    .sort((x, y) => y.pending - x.pending || y.latest - x.latest)

  const pendingTotal = rows.reduce((n, r) => n + r.pending, 0)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow={org.name}
        title="Results"
        description={
          rows.length === 0
            ? 'Nothing submitted yet.'
            : `${rows.length} assessment${rows.length === 1 ? '' : 's'} with submissions${pendingTotal > 0 ? ` · ${pendingTotal} awaiting review` : ''}`
        }
      />

      {rows.length === 0 ? (
        <TableEmpty
          filtered={false}
          clearHref={`/${slug}/results`}
          icon={<BarChart3 className="size-5" aria-hidden />}
          title="No submissions yet"
          body="Results appear here as soon as candidates finish an assessment."
        />
      ) : (
        <DataTable minWidth={680}>
          <THead>
            <th className={TH}>Assessment</th>
            <th className={`${TH} text-right`}>Graded</th>
            <th className={TH}>Awaiting review</th>
            <th className={`${TH} text-right`}>Average</th>
            <th className={`${TH} text-right`}>
              <span className="sr-only">Open</span>
            </th>
          </THead>
          <tbody>
            {rows.map((r) => {
              const href = `/${slug}/assessments/${r.id}/results`
              return (
                <TRow key={r.id} href={href}>
                  <td className={`${TD} max-w-[340px]`}>
                    <Link href={href} className="hover:text-primary block truncate font-medium transition-colors">
                      {r.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {labelOf(ASSESSMENT_STATUS_LABEL, r.status)}
                    </p>
                  </td>
                  <td className={`${TD} siq-numeric text-right`}>{r.graded}</td>
                  <td className={TD}>
                    {r.pending > 0 ? (
                      <Pill tone="warning">{r.pending} to grade</Pill>
                    ) : (
                      <span className="text-muted-foreground text-xs">All graded</span>
                    )}
                  </td>
                  <td className={`${TD} siq-numeric text-right`}>
                    {r.avg === null ? '—' : `${Math.round(r.avg * 10) / 10}%`}
                  </td>
                  <td className={`${TD} text-right`}>
                    <Link href={href} className="text-primary text-xs font-medium hover:underline">
                      Open
                    </Link>
                  </td>
                </TRow>
              )
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}
