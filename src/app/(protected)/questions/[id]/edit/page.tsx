import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import QuestionForm from '@/components/questions/question-form'
import PageHeader from '@/components/ui/page-header'
import { getActiveOrg } from '@/lib/auth/active-org'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { getQuestion } from '@/services/questions'

export const metadata: Metadata = { title: 'Edit Question — SelectIQ' }

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = (await getCurrentUser())!
  const org = await getActiveOrg(user)
  if (!org) redirect('/questions')

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
