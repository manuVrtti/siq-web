import type { Metadata } from 'next'
import { Settings } from 'lucide-react'

import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'Settings — SelectIQ' }

export default async function SettingsPage() {
  // Managers only — [org]/layout proves membership, and students are members.
  await requirePagePermission(PERMISSIONS.MANAGE_OWN_ORG)

  return (
    <>
      <PageHeader title="Settings" description="Organisation and account settings." />
      <EmptyState icon={Settings} title="Nothing here yet" description="Organisation settings arrive in Plan 046." />
    </>
  )
}
