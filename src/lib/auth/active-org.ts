import 'server-only'

import { getUserOrgs } from '@/lib/auth/org-access'
import type { CurrentUser } from '@/types/auth'

/**
 * Plan 011 — resolve the org whose data a manager is currently working in.
 *
 * INTERIM: returns the user's first organization membership. A proper
 * org-switcher (or subdomain-derived tenant) is a later, separate concern
 * tangled with the deferred subdomain decision — until then, single-org
 * membership is assumed. Returns null when the user belongs to no org, which
 * the pages render as a clear empty state rather than crashing.
 */
export async function getActiveOrg(user: CurrentUser) {
  const orgs = await getUserOrgs(user.id)
  return orgs[0] ?? null
}
