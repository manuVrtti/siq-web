import type { Metadata } from 'next'

import { AnnouncementsManager } from '@/components/notifications/announcements-manager'
import PageHeader from '@/components/ui/page-header'
import { PERMISSIONS } from '@/constants/permissions'
import { requirePageScope } from '@/lib/auth/page-guard'
import { listScopeDepartments } from '@/lib/auth/scope'
import { listAnnouncements } from '@/services/notifications/announcements'

export const metadata: Metadata = { title: 'Announcements — SelectIQ' }

/**
 * Managers push announcements into their workspace's bells. HODs only reach
 * their own departments (Scope); College Admins can go college-wide.
 */
export default async function AnnouncementsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const { org, scope } = await requirePageScope(PERMISSIONS.VIEW_ORG_RESULTS, slug)
  const [rows, departments] = await Promise.all([listAnnouncements(scope), listScopeDepartments(scope)])
  const q = `org=${encodeURIComponent(org.slug)}`

  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <PageHeader
        title="Announcements"
        description={
          scope.all
            ? 'Send a notice to everyone in the college, one department, students or staff. It appears in their notification bell.'
            : 'Send a notice to the departments you head. It appears in their notification bell.'
        }
      />
      <AnnouncementsManager
        rows={rows}
        createUrl={`/api/notifications/announcements?${q}`}
        itemUrl={`/api/notifications/announcements/{id}?${q}`}
        departments={departments}
        allowCollegeWide={scope.all}
      />
    </div>
  )
}
