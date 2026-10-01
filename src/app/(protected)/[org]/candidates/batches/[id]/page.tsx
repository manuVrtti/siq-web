import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Download, Target, Trophy, Users } from 'lucide-react'

import { StatCard } from '@/components/analytics/stat-card'
import { DeleteBatchButton, RemoveMemberButton } from '@/components/candidates/batch-actions'
import { Initials } from '@/components/dashboard/bits'
import { DataTable, TD, TH, THead, TRow, TableEmpty } from '@/components/data/data-table'
import { ListHeader } from '@/components/data/list-header'
import { Button } from '@/components/ui/button'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { getBatchPerformance } from '@/services/analytics/candidate-analytics'
import { requirePageScope } from '@/lib/auth/page-guard'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'Batch — SelectIQ' }

/**
 * One batch: its members ranked by average score, and the cohort's
 * aggregate performance. Members are removed here; added from the
 * Candidates table.
 */
export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>
}) {
  // Managers only — [org]/layout proves membership, and students are members.
  const { org: slug, id } = await params
  const { scope } = await requirePageScope(PERMISSIONS.MANAGE_ORG_USERS, slug)

  let perf
  try {
    perf = await getBatchPerformance(scope, id) // scoped; NotFound otherwise
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
  const batch = await prisma.batch.findUnique({ where: { id }, select: { description: true } })

  const base = `/${slug}/candidates`

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow={
          <Link href={`${base}/batches`} className="hover:text-foreground">
            Batches
          </Link>
        }
        title={perf.name}
        description={batch?.description ?? undefined}
        actions={
          <>
            <Button variant="outline" render={<Link href={`${base}?batch=${id}`} />}>
              Open in Candidates
            </Button>
            <Button variant="outline" render={<a href={`/api/export/batches/${id}/results`} download />}>
              <Download className="size-4" aria-hidden />
              Export
            </Button>
            <DeleteBatchButton batchId={id} name={perf.name} redirectTo={`${base}/batches`} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Members" value={perf.members} icon={Users} />
        <StatCard label="Graded exams" value={perf.graded} hint="Across this org's assessments" />
        <StatCard
          label="Average score"
          value={perf.avgPercentage}
          suffix={perf.avgPercentage === null ? undefined : '%'}
          icon={Target}
        />
        <StatCard
          label="Pass rate"
          value={perf.passRate}
          suffix={perf.passRate === null ? undefined : '%'}
          icon={Trophy}
        />
      </div>

      {perf.perMember.length === 0 ? (
        <TableEmpty
          filtered={false}
          clearHref={base}
          icon={<Users className="size-5" aria-hidden />}
          title="This batch is empty"
          body="On the Candidates page, tick the people you want and choose Add to batch."
          action={
            <Button size="sm" render={<Link href={base} />}>
              Go to Candidates
            </Button>
          }
        />
      ) : (
        <DataTable minWidth={600}>
          <THead>
            <th className={`${TH} w-12`}>#</th>
            <th className={TH}>Candidate</th>
            <th className={`${TH} text-right`}>Graded exams</th>
            <th className={`${TH} text-right`}>Average score</th>
            <th className={`${TH} text-right`}>
              <span className="sr-only">Remove</span>
            </th>
          </THead>
          <tbody>
            {perf.perMember.map((m, i) => (
              <TRow key={m.id}>
                <td className={`${TD} text-muted-foreground siq-numeric`}>{i + 1}</td>
                <td className={TD}>
                  <div className="flex items-center gap-3">
                    <Initials name={m.name} email={m.email} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name ?? m.email}</p>
                      <p className="text-muted-foreground truncate text-xs">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className={`${TD} siq-numeric text-right`}>{m.attempts}</td>
                <td className={`${TD} siq-numeric text-right`}>
                  {m.avgPercentage === null ? '—' : `${m.avgPercentage}%`}
                </td>
                <td className={`${TD} text-right`}>
                  <RemoveMemberButton batchId={id} userId={m.id} label={m.name ?? m.email ?? 'member'} />
                </td>
              </TRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}
