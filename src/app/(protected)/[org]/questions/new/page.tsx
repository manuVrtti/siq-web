import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import QuestionForm from '@/components/questions/question-form'
import PageHeader from '@/components/ui/page-header'
import { prisma } from '@/lib/prisma'
import { getOrgBySlug } from '@/services/organizations'
import { listTaxonomy } from '@/services/taxonomy'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'New Question — SelectIQ' }

export default async function NewQuestionPage({ params }: { params: Promise<{ org: string }> }) {
  // Managers only — [org]/layout proves membership, and students are members.
  await requirePagePermission(PERMISSIONS.CREATE_ASSESSMENT)

  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const [tags, topics] = await Promise.all([
    prisma.tag.findMany({ where: { orgId: org.id }, orderBy: { name: 'asc' } }),
    listTaxonomy(org.id),
  ])

  return (
    <>
      <PageHeader title="New question" description={org.name} />
      <QuestionForm orgId={org.id} orgTags={tags.map((t) => ({ id: t.id, name: t.name }))} topics={topics} />
    </>
  )
}
