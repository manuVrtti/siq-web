import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import AssessmentBuilder from '@/components/assessments/assessment-builder'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/ui/page-header'
import { getAssessment } from '@/services/assessments'
import { getOrgBySlug } from '@/services/organizations'
import { listQuestions } from '@/services/questions'
import { prisma } from '@/lib/prisma'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'Build Assessment — SelectIQ' }

export default async function BuildPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>
}) {
  // Managers only — [org]/layout proves membership, and students are members.
  await requirePagePermission(PERMISSIONS.EDIT_ASSESSMENT)

  const { org: slug, id } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const assessment = await getAssessment(org.id, id).catch(() => null)
  if (!assessment) notFound()

  // The bank to pick from, plus tags for auto-assemble criteria.
  const [{ items: questions }, tags] = await Promise.all([
    listQuestions(org.id, { take: 500 }),
    prisma.tag.findMany({ where: { orgId: org.id }, orderBy: { name: 'asc' } }),
  ])

  return (
    <>
      <PageHeader title={assessment.title} description={`${org.name} · ${assessment.status.toLowerCase()}`}>
        <Button
          variant="outline"
          render={<Link href={`/${slug}/assessments/${id}/assign`} />}
        >
          Assign
        </Button>
        <Button
          variant="outline"
          render={<Link href={`/${slug}/assessments/${id}/results`} />}
        >
          Results
        </Button>
        <Button
          variant="outline"
          render={<Link href={`/${slug}/assessments/${id}/analytics`} />}
        >
          Analytics
        </Button>
      </PageHeader>
      <AssessmentBuilder
        assessment={JSON.parse(JSON.stringify(assessment))}
        bank={questions.map((q) => ({
          id: q.id,
          title: q.title,
          type: q.type,
          difficulty: q.difficulty,
          marks: q.marks,
        }))}
        tags={tags.map((t) => ({ id: t.id, name: t.name }))}
      />
    </>
  )
}
