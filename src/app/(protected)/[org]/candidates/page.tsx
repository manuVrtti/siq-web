import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Users } from 'lucide-react'

import CandidateImport from '@/components/candidates/candidate-import'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { getOrgBySlug } from '@/services/organizations'
import { listCandidates, listBatches } from '@/services/candidates'

export const metadata: Metadata = { title: 'Candidates — SelectIQ' }

export default async function CandidatesPage({
  params,
}: {
  params: Promise<{ org: string }>
}) {
  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const [{ items: candidates, total }, batches] = await Promise.all([
    listCandidates(org.id, { take: 100 }),
    listBatches(org.id),
  ])

  return (
    <>
      <PageHeader
        title="Candidates"
        description={`${total} candidate${total === 1 ? '' : 's'} · ${batches.length} batch${
          batches.length === 1 ? '' : 'es'
        }`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <CandidateImport />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batches</CardTitle>
          </CardHeader>
          <CardContent>
            {batches.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No batches yet. Create one to group candidates for bulk assignment.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {batches.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <span>{b.name}</span>
                    <span className="text-muted-foreground text-xs">{b._count.members} members</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">All candidates</h2>
        {candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No candidates yet"
            description="Import a roster from your college above to add them."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-current/10 rounded-lg border">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="flex-1 truncate">{c.name ?? c.email ?? c.phone}</span>
                <span className="text-muted-foreground truncate text-xs">{c.email ?? c.phone}</span>
                <Badge variant={c.claimed ? 'secondary' : 'outline'} className="text-[10px]">
                  {c.claimed ? 'active' : 'pending'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
