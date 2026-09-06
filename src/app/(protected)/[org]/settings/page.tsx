import type { Metadata } from 'next'
import { Settings } from 'lucide-react'

import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Settings — SelectIQ' }

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Organisation and account settings." />
      <EmptyState icon={Settings} title="Nothing here yet" description="Organisation settings arrive in Plan 046." />
    </>
  )
}
