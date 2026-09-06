import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileQuestion } from 'lucide-react'

import QuestionCard from '@/components/questions/question-card'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { listQuestions } from '@/services/questions'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Question Bank — SelectIQ' }

export default async function QuestionsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const org = await getOrgBySlug(slug) // access already enforced by [org]/layout
  if (!org) notFound()

  const { items, total } = await listQuestions(org.id, { take: 50 })

  return (
    <>
      <PageHeader title="Question Bank" description={`${total} question${total === 1 ? '' : 's'} in ${org.name}`}>
        <Button render={<Link href={`/${slug}/questions/new`} />}>Create question</Button>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No questions yet"
          description="Create your first question to start building assessments."
          action={<Button render={<Link href={`/${slug}/questions/new`} />}>Create question</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((q) => (
            <QuestionCard key={q.id} orgSlug={slug} question={q} />
          ))}
        </div>
      )}
    </>
  )
}
