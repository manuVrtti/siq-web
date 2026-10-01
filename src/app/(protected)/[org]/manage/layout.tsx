import { notFound } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

import { ManageTabs } from '@/components/people/manage-tabs'
import { PageIntro } from '@/components/student/page-intro'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getOrgBySlug } from '@/services/organizations'

/**
 * College Admin panel — everything a College Admin manages for their
 * college: people (College Admins + HODs), departments and settings.
 * [org]/layout already proved membership (or Super Admin); this narrows to
 * College Admin / Super Admin. HODs and students get 404.
 */
export default async function ManageLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const user = (await getCurrentUser())!
  if (user.role !== 'COLLEGE_ADMIN' && user.role !== 'SUPER_ADMIN') notFound()
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageIntro
        icon={ShieldCheck}
        title="College admin"
        subtitle={`Run ${org.name}: your team, departments and settings.`}
        aside={
          user.role === 'SUPER_ADMIN' ? (
            <span className="bg-highlight-tint text-highlight-foreground rounded-full px-3 py-1 text-xs font-semibold">Viewing as Super Admin</span>
          ) : null
        }
      />
      <ManageTabs slug={slug} />
      {children}
    </div>
  )
}
