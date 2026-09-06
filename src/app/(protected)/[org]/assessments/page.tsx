import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'

import AssessmentCard from '@/components/assessments/assessment-card'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { listAssessments } from '@/services/assessments'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Assessments — SelectIQ' }

export default async function AssessmentsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const assessments = await listAssessments(org.id)

  return (
    <>
      <PageHeader title="Assessments" description={`${assessments.length} in ${org.name}`}>
        <Button render={<Link href={`/${slug}/assessments/new`} />}>Create assessment</Button>
      </PageHeader>

      {assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No assessments yet"
          description="Create one, add sections and questions from the bank, then publish."
          action={<Button render={<Link href={`/${slug}/assessments/new`} />}>Create assessment</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {assessments.map((a) => (
            <AssessmentCard key={a.id} orgSlug={slug} assessment={a} />
          ))}
        </div>
      )}
    </>
  )
}
