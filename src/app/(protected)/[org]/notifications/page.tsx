import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { NotificationsCenter } from '@/components/notifications/notifications-center'
import PageHeader from '@/components/ui/page-header'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getOrgBySlug } from '@/services/organizations'
import { getFeed } from '@/services/notifications/feed'

export const metadata: Metadata = { title: 'Notifications — SelectIQ' }

/** Every role: the full notification feed for this workspace. */
export default async function NotificationsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  // [org]/layout has already enforced membership for this slug.
  const user = await getCurrentUser()
  const org = await getOrgBySlug(slug)
  if (!user || !org) notFound()

  const feed = await getFeed(user, { id: org.id, slug: org.slug }, 50)

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader title="Notifications" description="Announcements, tests and results for this workspace." />
      <NotificationsCenter initialItems={feed.items} />
    </div>
  )
}
