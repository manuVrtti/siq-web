import type { Metadata } from 'next'
import { Users } from 'lucide-react'

import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Candidates — SelectIQ' }

export default function CandidatesPage() {
  return (
    <>
      <PageHeader title="Candidates" description="Students and applicants in your organisation." />
      <EmptyState icon={Users} title="Nothing here yet" description="Candidate import arrives in Sprint 2 (Plan 013)." />
    </>
  )
}
