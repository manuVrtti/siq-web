import type { Metadata } from 'next'
import { ClipboardCheck } from 'lucide-react'

import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Assessments — SelectIQ' }

export default function AssessmentsPage() {
  return (
    <>
      <PageHeader title="Assessments" description="Create and manage assessments." />
      <EmptyState icon={ClipboardCheck} title="Nothing here yet" description="Assessment creation arrives in Sprint 2 (Plan 012)." />
    </>
  )
}
