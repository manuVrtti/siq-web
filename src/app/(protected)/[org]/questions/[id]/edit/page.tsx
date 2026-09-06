import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import QuestionForm from '@/components/questions/question-form'
import PageHeader from '@/components/ui/page-header'
import { prisma } from '@/lib/prisma'
import { getQuestion } from '@/services/questions'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Edit Question — SelectIQ' }

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>
}) {
  const { org: slug, id } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const question = await getQuestion(org.id, id).catch(() => null)
  if (!question) notFound()

  const tags = await prisma.tag.findMany({ where: { orgId: org.id }, orderBy: { name: 'asc' } })

  return (
    <>
      <PageHeader title="Edit question" description={org.name} />
      <QuestionForm
        orgId={org.id}
        orgTags={tags.map((t) => ({ id: t.id, name: t.name }))}
        initial={{
          id: question.id,
          type: question.type,
          title: question.title,
          body: question.body,
          difficulty: question.difficulty,
          marks: question.marks,
          negativeMarks: question.negativeMarks,
          explanation: question.explanation ?? '',
          options: question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          tagIds: question.tags.map((t) => t.tag.id),
        }}
      />
    </>
  )
}
