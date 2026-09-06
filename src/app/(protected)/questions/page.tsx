import type { Metadata } from 'next'
import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

import QuestionCard from '@/components/questions/question-card'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { getActiveOrg } from '@/lib/auth/active-org'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { listQuestions } from '@/services/questions'

export const metadata: Metadata = { title: 'Question Bank — SelectIQ' }

export default async function QuestionsPage() {
  const user = (await getCurrentUser())!
  const org = await getActiveOrg(user)

  if (!org) {
    return (
      <>
        <PageHeader title="Question Bank" />
        <EmptyState
          icon={FileQuestion}
          title="No organization yet"
          description="Question management is scoped to an organization. You'll see the bank once you're part of a college or company."
        />
      </>
    )
  }

  const { items, total } = await listQuestions(org.id, { take: 50 })

  return (
    <>
      <PageHeader title="Question Bank" description={`${total} question${total === 1 ? '' : 's'} in ${org.name}`}>
        <Button render={<Link href="/questions/new" />}>Create question</Button>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No questions yet"
          description="Create your first question to start building assessments."
          action={<Button render={<Link href="/questions/new" />}>Create question</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </div>
      )}
    </>
  )
}
