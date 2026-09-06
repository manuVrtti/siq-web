import type { Metadata } from 'next'
import { BarChart3 } from 'lucide-react'

import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Results — SelectIQ' }

export default function ResultsPage() {
  return (
    <>
      <PageHeader title="Results" description="Assessment results and analytics." />
      <EmptyState icon={BarChart3} title="Nothing here yet" description="Results appear once assessments have been taken (Plan 016)." />
    </>
  )
}
