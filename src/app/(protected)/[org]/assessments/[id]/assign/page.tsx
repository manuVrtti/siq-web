import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import AssignmentManager from '@/components/assessments/assignment-manager'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/ui/page-header'
import { getAssessment } from '@/services/assessments'
import { listCandidates, listBatches } from '@/services/candidates'
import { listAssignments } from '@/services/assignments'
import { requireAssessmentPage } from '@/lib/auth/page-guard'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'Assign Assessment — SelectIQ' }

export default async function AssignPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>
}) {
  // Managers only — [org]/layout proves membership, and students are members.

  const { org: slug, id } = await params
  const { org, scope } = await requireAssessmentPage(PERMISSIONS.EDIT_ASSESSMENT, slug, id, 'edit')

  const assessment = await getAssessment(org.id, id).catch(() => null)
  if (!assessment) notFound()

  const [{ items: candidates }, batches, assignments] = await Promise.all([
    listCandidates(scope, { take: 500 }),
    listBatches(scope),
    listAssignments(scope, id),
  ])

  // Build the canonical origin: use NEXT_PUBLIC_APP_URL if set (production
  // scope on Vercel), else the current request host — so the copied invite
  // link works even on preview / localhost.
  const hs = await headers()
  const proto = hs.get('x-forwarded-proto') ?? 'http'
  const host = hs.get('x-forwarded-host') ?? hs.get('host') ?? 'localhost:3000'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col">
      <PageHeader
        title={assessment.title}
        description={`Assign students · ${assessment.status === 'PUBLISHED' ? 'Published' : assessment.status === 'DRAFT' ? 'Draft — students see it once you publish' : 'Archived'}`}
      >
        <Button variant="outline" render={<Link href={`/${slug}/assessments/${id}/build`} />}>
          Edit test
        </Button>
        <Button variant="outline" render={<Link href={`/${slug}/assessments/${id}/results`} />}>
          Results
        </Button>
      </PageHeader>
      <AssignmentManager
        assessmentId={assessment.id}
        candidates={candidates.map((c) => ({
          id: c.id,
          email: c.email,
          phone: c.phone,
          name: c.name,
          claimed: c.claimed,
        }))}
        batches={batches.map((b) => ({ id: b.id, name: b.name, membersCount: b._count.members }))}
        assignments={JSON.parse(JSON.stringify(assignments))}
        baseUrl={baseUrl}
      />
    </div>
  )
}
