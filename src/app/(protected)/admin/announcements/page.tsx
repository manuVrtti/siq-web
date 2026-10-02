import type { Metadata } from 'next'

import { AnnouncementsManager } from '@/components/notifications/announcements-manager'
import PageHeader from '@/components/ui/page-header'
import { listPlatformAnnouncements } from '@/services/notifications/announcements'

export const metadata: Metadata = { title: 'Announcements — SelectIQ console' }
export const dynamic = 'force-dynamic'

/** Platform-wide notices (every college). admin/layout gates SUPER_ADMIN. */
export default async function PlatformAnnouncementsPage() {
  const rows = await listPlatformAnnouncements()
  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <PageHeader
        title="Announcements"
        description="Platform-wide notices — they appear in the bell in every college. For one college, use its own Announcements page."
      />
      <AnnouncementsManager
        rows={rows}
        createUrl="/api/admin/notifications/announcements"
        itemUrl="/api/admin/notifications/announcements/{id}"
        departments={null}
        platform
      />
    </div>
  )
}
