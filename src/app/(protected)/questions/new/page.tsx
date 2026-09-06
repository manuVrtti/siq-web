import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import QuestionForm from '@/components/questions/question-form'
import PageHeader from '@/components/ui/page-header'
import { getActiveOrg } from '@/lib/auth/active-org'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'New Question — SelectIQ' }

export default async function NewQuestionPage() {
  const user = (await getCurrentUser())!
  const org = await getActiveOrg(user)
  if (!org) redirect('/questions')

  const tags = await prisma.tag.findMany({ where: { orgId: org.id }, orderBy: { name: 'asc' } })

  return (
    <>
      <PageHeader title="New question" description={org.name} />
      <QuestionForm orgId={org.id} orgTags={tags.map((t) => ({ id: t.id, name: t.name }))} />
    </>
  )
}
