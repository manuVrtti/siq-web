import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus, UserPlus } from 'lucide-react'

import { DashboardHero } from '@/components/dashboard/bits'
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard'
import { PlatformStrip } from '@/components/dashboard/platform-strip'
import { StudentDashboard } from '@/components/dashboard/student-dashboard'
import { Button } from '@/components/ui/button'
import { PERMISSIONS } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { hasPermission } from '@/lib/auth/permissions'
import { firstName, greeting, longDate } from '@/lib/format'
import { getOrgBySlug } from '@/services/organizations'
import { getStudentOverview } from '@/services/analytics/candidate-analytics'

export const metadata: Metadata = { title: 'Dashboard — SelectIQ' }

/**
 * Plan 019 — role-aware dashboard.
 *
 * Managers (VIEW_ORG_RESULTS) get the org view; everyone else gets their own
 * exams and scores. SUPER_ADMIN additionally sees platform totals. Branching
 * is by permission, not role name, so a future role inherits the right view
 * from its permission set.
 */
export default async function DashboardPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const user = (await getCurrentUser())! // (protected)/layout guards signed-out
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const isManager = hasPermission(user, PERMISSIONS.VIEW_ORG_RESULTS)
  const name = firstName(user.name)
  const title = name ? `${greeting()}, ${name}` : greeting()

  let subtitle = `Here's what's happening at ${org.name}.`
  if (!isManager) {
    const s = await getStudentOverview(org.id, user.id)
    subtitle =
      s.open.length === 0
        ? `No exams waiting for you at ${org.name}.`
        : `You have ${s.open.length} exam${s.open.length === 1 ? '' : 's'} waiting at ${org.name}.`
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <DashboardHero
        eyebrow={longDate()}
        title={title}
        subtitle={subtitle}
        actions={
          isManager ? (
            <>
              <Button variant="outline" render={<Link href={`/${slug}/candidates`} />}>
                <UserPlus className="size-4" aria-hidden />
                Add candidates
              </Button>
              <Button render={<Link href={`/${slug}/assessments/new`} />}>
                <Plus className="size-4" aria-hidden />
                New assessment
              </Button>
            </>
          ) : null
        }
      />

      {user.role === 'SUPER_ADMIN' ? <PlatformStrip /> : null}

      {isManager ? (
        <ManagerDashboard orgId={org.id} slug={slug} />
      ) : (
        <StudentDashboard orgId={org.id} userId={user.id} slug={slug} />
      )}
    </div>
  )
}
