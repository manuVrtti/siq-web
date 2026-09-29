import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FolderKanban } from 'lucide-react'

import { Panel } from '@/components/analytics/panel'
import { CreateBatchForm, DeleteBatchButton } from '@/components/candidates/batch-actions'
import { DataTable, TD, TH, THead, TRow, TableEmpty } from '@/components/data/data-table'
import { ListHeader } from '@/components/data/list-header'
import { shortDateTime } from '@/lib/format'
import { listBatchPerformance } from '@/services/analytics/candidate-analytics'
import { listBatches } from '@/services/candidates'
import { getOrgBySlug } from '@/services/organizations'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'Batches — SelectIQ' }

/**
 * Batches: named groups of candidates (e.g. "CSE 2026 — Section A") used to
 * assign an exam to many people at once and to compare cohorts in
 * Analytics. Members are added from the Candidates table (select rows →
 * Add to batch). [org]/layout already enforces org membership; the batch
 * API enforces manager roles on every write.
 */
export default async function BatchesPage({ params }: { params: Promise<{ org: string }> }) {
  // Managers only — [org]/layout proves membership, and students are members.
  await requirePagePermission(PERMISSIONS.MANAGE_ORG_USERS)

  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const [batches, performance] = await Promise.all([
    listBatches(org.id),
    listBatchPerformance(org.id),
  ])
  const perfById = new Map(performance.map((b) => [b.id, b]))
  const base = `/${slug}/candidates`

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow={
          <Link href={base} className="hover:text-foreground">
            Candidates
          </Link>
        }
        title="Batches"
        description="Group candidates to assign exams in bulk and compare cohorts. Add people from the Candidates table."
      />

      <Panel eyebrow="New" title="Create a batch">
        <CreateBatchForm />
      </Panel>

      {batches.length === 0 ? (
        <TableEmpty
          filtered={false}
          clearHref={`${base}/batches`}
          icon={<FolderKanban className="size-5" aria-hidden />}
          title="No batches yet"
          body="Create one above, then select candidates on the Candidates page and add them to it."
        />
      ) : (
        <DataTable minWidth={680}>
          <THead>
            <th className={TH}>Batch</th>
            <th className={`${TH} text-right`}>Members</th>
            <th className={`${TH} text-right`}>Average score</th>
            <th className={`${TH} text-right`}>Pass rate</th>
            <th className={`${TH} text-right`}>Created</th>
            <th className={`${TH} text-right`}>
              <span className="sr-only">Actions</span>
            </th>
          </THead>
          <tbody>
            {batches.map((b) => {
              const perf = perfById.get(b.id)
              return (
                <TRow key={b.id} href={`${base}/batches/${b.id}`}>
                  <td className={`${TD} max-w-[320px]`}>
                    <Link
                      href={`${base}/batches/${b.id}`}
                      className="hover:text-primary block truncate font-medium transition-colors"
                    >
                      {b.name}
                    </Link>
                    {b.description ? (
                      <p className="text-muted-foreground truncate text-xs">{b.description}</p>
                    ) : null}
                  </td>
                  <td className={`${TD} siq-numeric text-right`}>{b._count.members}</td>
                  <td className={`${TD} siq-numeric text-right`}>
                    {perf?.avgPercentage == null ? '—' : `${perf.avgPercentage}%`}
                  </td>
                  <td className={`${TD} siq-numeric text-right`}>
                    {perf?.passRate == null ? '—' : `${perf.passRate}%`}
                  </td>
                  <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>
                    {shortDateTime(b.createdAt)}
                  </td>
                  <td className={`${TD} text-right`}>
                    <DeleteBatchButton batchId={b.id} name={b.name} />
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
