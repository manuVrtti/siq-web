import 'server-only'

import { notFound } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getScope } from '@/lib/auth/scope'
import { getOrgBySlug } from '@/services/organizations'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN']

/** Plan 023 — gate for staff mock-drive pages: college staff only, 404 otherwise. */
export async function requireDrivePage(slug: string) {
  const user = await getCurrentUser()
  if (!user || !STAFF.includes(user.role)) notFound()
  const org = await getOrgBySlug(slug)
  if (!org || org.type !== 'COLLEGE') notFound()
  const scope = await getScope(user, org.id).catch(() => notFound())
  return { user, org, scope }
}
