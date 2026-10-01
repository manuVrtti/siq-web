import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus, UserPlus } from 'lucide-react'

import { DashboardHero } from '@/components/dashboard/bits'
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard'
import { getScope, listScopeDepartments } from '@/lib/auth/scope'
import { PlatformStrip } from '@/components/dashboard/platform-strip'
import { StudentDashboard } from '@/components/dashboard/student-dashboard'
import { Button } from '@/components/ui/button'
import { PERMISSIONS } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { hasPermission } from '@/lib/auth/permissions'
import { firstName, greeting, longDate } from '@/lib/format'
import { getOrgBySlug } from '@/services/organizations'

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

  if (!isManager) {
    // Students: the dashboard view carries its own greeting + next-exam hero.
    return (
      <StudentDashboard orgId={org.id} orgName={org.name} userId={user.id} userName={user.name} slug={slug} />
    )
  }
  const scope = await getScope(user, org.id)
  const depts = scope.all ? [] : await listScopeDepartments(scope)
  const subtitle = scope.all
    ? `Here's what's happening at ${org.name}.`
    : depts.length
      ? `Here's what's happening in ${depts.map((d) => d.code).join(', ')} at ${org.name}.`
      : `You don't head a department yet — ask your College Admin to assign one.`

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <DashboardHero
        eyebrow={longDate()}
        title={title}
        subtitle={subtitle}
        actions={
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
        }
      />

      {user.role === 'SUPER_ADMIN' ? <PlatformStrip /> : null}

      <ManagerDashboard scope={scope} slug={slug} />
    </div>
  )
}
