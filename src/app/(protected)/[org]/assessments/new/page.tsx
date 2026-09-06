import type { Metadata } from 'next'

import PageHeader from '@/components/ui/page-header'
import NewAssessmentForm from './new-assessment-form'

export const metadata: Metadata = { title: 'New Assessment — SelectIQ' }

export default function NewAssessmentPage() {
  return (
    <>
      <PageHeader title="New assessment" description="Start a draft, then add sections and questions." />
      <NewAssessmentForm />
    </>
  )
}
