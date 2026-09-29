import type { Metadata } from 'next'

import PageHeader from '@/components/ui/page-header'
import NewAssessmentForm from './new-assessment-form'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'New Assessment — SelectIQ' }

export default async function NewAssessmentPage() {
  // Managers only — [org]/layout proves membership, and students are members.
  await requirePagePermission(PERMISSIONS.CREATE_ASSESSMENT)

  return (
    <>
      <PageHeader title="New assessment" description="Start a draft, then add sections and questions." />
      <NewAssessmentForm />
    </>
  )
}
