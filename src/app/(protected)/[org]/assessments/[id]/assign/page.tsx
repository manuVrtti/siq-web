import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import AssignmentManager from '@/components/assessments/assignment-manager'
import PageHeader from '@/components/ui/page-header'
import { getAssessment } from '@/services/assessments'
import { getOrgBySlug } from '@/services/organizations'
import { listCandidates, listBatches } from '@/services/candidates'
import { listAssignments } from '@/services/assignments'

export const metadata: Metadata = { title: 'Assign Assessment — SelectIQ' }

export default async function AssignPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>
}) {
  const { org: slug, id } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const assessment = await getAssessment(org.id, id).catch(() => null)
  if (!assessment) notFound()

  const [{ items: candidates }, batches, assignments] = await Promise.all([
    listCandidates(org.id, { take: 500 }),
    listBatches(org.id),
    listAssignments(org.id, id),
  ])

  // Build the canonical origin: use NEXT_PUBLIC_APP_URL if set (production
  // scope on Vercel), else the current request host — so the copied invite
  // link works even on preview / localhost.
  const hs = await headers()
  const proto = hs.get('x-forwarded-proto') ?? 'http'
  const host = hs.get('x-forwarded-host') ?? hs.get('host') ?? 'localhost:3000'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

  return (
    <>
      <PageHeader title={`Assign: ${assessment.title}`} description={`${org.name} · ${assessment.status.toLowerCase()}`} />
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
    </>
  )
}
