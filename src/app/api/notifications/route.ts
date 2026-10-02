import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { requireAuth } from '@/lib/auth/require-auth'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { getOrgBySlug } from '@/services/organizations'
import { BELL_LIMIT, getFeed } from '@/services/notifications/feed'

/**
 * Notification feed for one workspace: GET /api/notifications?org=<slug>[&all=1]
 * The slug is only a lookup key — access is checked against the session user.
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const slug = req.nextUrl.searchParams.get('org')
    if (!slug) throw new ValidationError('org is required')

    const org = await getOrgBySlug(slug)
    if (!org) throw new NotFoundError('Workspace not found')
    await requireOrgAccess(user, org.id)

    const limit = req.nextUrl.searchParams.get('all') === '1' ? 50 : BELL_LIMIT
    return successResponse(await getFeed(user, { id: org.id, slug: org.slug }, limit))
  } catch (error) {
    return errorResponse(error)
  }
}
