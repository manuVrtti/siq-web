import type { Metadata } from 'next'

import PageHeader from '@/components/ui/page-header'
import NewAssessmentForm from './new-assessment-form'
import { requirePageScope } from '@/lib/auth/page-guard'
import { listScopeDepartments } from '@/lib/auth/scope'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'New Assessment — SelectIQ' }

export default async function NewAssessmentPage({ params }: { params: Promise<{ org: string }> }) {
  // Managers only — [org]/layout proves membership, and students are members.
  const { org: slug } = await params
  const { scope } = await requirePageScope(PERMISSIONS.CREATE_ASSESSMENT, slug)
  const departments = await listScopeDepartments(scope)

  return (
    <>
      <PageHeader title="New assessment" description="Start a draft, then add sections and questions." />
      <NewAssessmentForm departments={departments} required={!scope.all} />
    </>
  )
}
