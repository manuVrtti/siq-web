import { errorResponse, successResponse } from '@/lib/api-response'
import { getUserOrgs } from '@/lib/auth/org-access'
import { requireAuth } from '@/lib/auth/require-auth'

/**
 * Plan T01 — organizations.
 *
 *   GET  list the orgs the caller belongs to (any authenticated user)
 *
 * Creating organizations goes through POST /api/admin/organizations (the
 * Super Admin onboarding flow), the single creation path.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth()
    const orgs = await getUserOrgs(user.id)
    return successResponse({ orgs })
  } catch (error) {
    return errorResponse(error)
  }
}
