import { notFound } from 'next/navigation'

import AppShell from '@/components/layout/app-shell'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { belongsToOrg } from '@/lib/auth/org-access'
import { OrgProvider } from '@/lib/org-context'
import { getOrgBySlug } from '@/services/organizations'

/**
 * Plan T02 — the tenant boundary.
 *
 * Resolves the org from the URL slug and enforces access before ANYTHING
 * renders. A non-member (or a bad slug) gets 404 — deliberately not 403, so we
 * never confirm that an org exists to someone who shouldn't see it.
 * SUPER_ADMIN passes without membership.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ org: string }>
}) {
  const { org: slug } = await params

  const user = (await getCurrentUser())! // (protected)/layout already guarded
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const allowed = user.role === 'SUPER_ADMIN' || (await belongsToOrg(user.id, org.id))
  if (!allowed) notFound()

  return (
    <OrgProvider org={{ id: org.id, slug: org.slug, name: org.name }}>
      <AppShell>{children}</AppShell>
    </OrgProvider>
  )
}
