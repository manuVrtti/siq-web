import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheck, Plus } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
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
import { Button } from '@/components/ui/button'
import { ASSESSMENT_STATUS_LABEL, labelOf } from '@/constants/labels'
import { shortDateTime } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import { listAssessments } from '@/services/assessments'
import { requirePageScope } from '@/lib/auth/page-guard'
import { assessmentWhere, studentWhere } from '@/lib/auth/scope'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'Assessments — SelectIQ' }

const SORTS = ['updatedAt', 'title', 'durationMinutes', 'submitted'] as const
const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
const STATUS_TONE: Record<string, 'muted' | 'success' | 'info'> = {
  DRAFT: 'muted',
  PUBLISHED: 'success',
  ARCHIVED: 'info',
}

/**
 * Plan 012, redesigned in plan 019 Phase 3. An org has tens of assessments,
 * not thousands, so this filters and sorts in memory after one query — the
 * URL still carries the state so views stay shareable.
 */
export default async function AssessmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<SearchParams>
}) {
  // Managers only — [org]/layout proves membership, and students are members.
  const { org: slug } = await params
  const { org, scope } = await requirePageScope(PERMISSIONS.EDIT_ASSESSMENT, slug)

  const p = parseTableParams(await searchParams, { sortable: SORTS, defaultSort: 'updatedAt' })
  const status = STATUSES.find((s) => s === p.get('status'))

  const [all, assignmentGroups] = await Promise.all([
    listAssessments(scope),
    prisma.assessmentAssignment.groupBy({
      by: ['assessmentId', 'status'],
      where: { assessment: assessmentWhere(scope), ...(scope.all ? {} : { user: studentWhere(scope) }) },
      _count: { _all: true },
    }),
  ])

  const invited = new Map<string, number>()
  const submitted = new Map<string, number>()
  for (const g of assignmentGroups) {
    invited.set(g.assessmentId, (invited.get(g.assessmentId) ?? 0) + g._count._all)
    if (g.status === 'SUBMITTED') submitted.set(g.assessmentId, g._count._all)
  }

  const q = p.q.toLowerCase()
  const rows = all
    .filter((a) => (!status || a.status === status) && (!q || a.title.toLowerCase().includes(q)))
    .map((a) => ({
      ...a,
      questions: a.sections.reduce((n, s) => n + s.questions.length, 0),
      invited: invited.get(a.id) ?? 0,
      submitted: submitted.get(a.id) ?? 0,
    }))
    .sort((x, y) => {
      const dir = p.dir === 'asc' ? 1 : -1
      if (p.sort === 'title') return x.title.localeCompare(y.title) * dir
      if (p.sort === 'durationMinutes') return (x.durationMinutes - y.durationMinutes) * dir
      if (p.sort === 'submitted') return (x.submitted - y.submitted) * dir
      return (x.updatedAt.getTime() - y.updatedAt.getTime()) * dir
    })
  const page = rows.slice(p.skip, p.skip + p.pageSize)

  const counts = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 } as Record<string, number>
  for (const a of all) counts[a.status] = (counts[a.status] ?? 0) + 1

  const pathname = `/${slug}/assessments`
  const newHref = `${pathname}/new`

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow={org.name}
        title="Assessments"
        description={`${counts.PUBLISHED} published · ${counts.DRAFT} draft${counts.DRAFT === 1 ? '' : 's'} · ${counts.ARCHIVED} archived`}
        actions={
          <Button render={<Link href={newHref} />}>
            <Plus className="size-4" aria-hidden />
            New assessment
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Search assessments…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: STATUSES.map((s) => ({
              value: s,
              label: `${labelOf(ASSESSMENT_STATUS_LABEL, s)} (${counts[s] ?? 0})`,
            })),
          },
        ]}
      />

      {page.length === 0 ? (
        <TableEmpty
          filtered={Boolean(p.q || status)}
          clearHref={pathname}
          icon={<ClipboardCheck className="size-5" aria-hidden />}
          title="No assessments yet"
          body="Create one, add sections and questions from the bank, then publish and assign it."
          action={
            <Button size="sm" render={<Link href={newHref} />}>
              Create the first assessment
            </Button>
          }
        />
      ) : (
        <DataTable
          minWidth={820}
          footer={<Pagination pathname={pathname} params={p} total={rows.length} />}
        >
          <THead>
            <SortHeader label="Assessment" field="title" pathname={pathname} params={p} />
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Questions</th>
            <SortHeader label="Duration" field="durationMinutes" pathname={pathname} params={p} align="right" />
            <SortHeader label="Submitted" field="submitted" pathname={pathname} params={p} align="right" />
            <SortHeader label="Updated" field="updatedAt" pathname={pathname} params={p} align="right" />
            <th className={`${TH} text-right`}>
              <span className="sr-only">Actions</span>
            </th>
          </THead>
          <tbody>
            {page.map((a) => (
              <TRow key={a.id} href={`${pathname}/${a.id}/build`}>
                <td className={`${TD} max-w-[320px]`}>
                  <Link
                    href={`${pathname}/${a.id}/build`}
                    className="hover:text-primary block truncate font-medium transition-colors"
                  >
                    {a.title}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {a.sections.length} section{a.sections.length === 1 ? '' : 's'}
                    {a.proctoringEnabled ? ' · proctored' : ''}
                  </p>
                </td>
                <td className={TD}>
                  <Pill tone={STATUS_TONE[a.status] ?? 'muted'}>
                    {labelOf(ASSESSMENT_STATUS_LABEL, a.status)}
                  </Pill>
                </td>
                <td className={`${TD} siq-numeric text-right`}>{a.questions}</td>
                <td className={`${TD} siq-numeric text-right`}>{a.durationMinutes} min</td>
                <td className={`${TD} siq-numeric text-right`}>
                  {a.invited === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <>
                      {a.submitted}
                      <span className="text-muted-foreground"> / {a.invited}</span>
                    </>
                  )}
                </td>
                <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>
                  {shortDateTime(a.updatedAt)}
                </td>
                <td className={`${TD} text-right whitespace-nowrap`}>
                  <div className="flex justify-end gap-3 text-xs font-medium">
                    {a.status !== 'DRAFT' ? (
                      <Link href={`${pathname}/${a.id}/assign`} className="text-primary hover:underline">
                        Assign
                      </Link>
                    ) : null}
                    {a.submitted > 0 ? (
                      <Link href={`${pathname}/${a.id}/analytics`} className="text-primary hover:underline">
                        Analytics
                      </Link>
                    ) : null}
                  </div>
                </td>
              </TRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}
