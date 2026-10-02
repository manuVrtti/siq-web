import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope } from '@/lib/auth/scope'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { getOrgBySlug } from '@/services/organizations'
import { createAnnouncement, listAnnouncements } from '@/services/notifications/announcements'

/**
 * Workspace announcements: GET/POST /api/notifications/announcements?org=<slug>
 * Managers only; HODs are limited to their own departments by Scope.
 */

export const dynamic = 'force-dynamic'

async function scopeFor(req: NextRequest) {
  const user = await withRole(MANAGER_ROLES)
  const slug = req.nextUrl.searchParams.get('org')
  if (!slug) throw new ValidationError('org is required')
  const org = await getOrgBySlug(slug)
  if (!org) throw new NotFoundError('Workspace not found')
  return { user, scope: await getScope(user, org.id) }
}

export async function GET(req: NextRequest) {
  try {
    const { scope } = await scopeFor(req)
    return successResponse({ announcements: await listAnnouncements(scope) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, scope } = await scopeFor(req)
    const created = await createAnnouncement(scope, user.id, await req.json().catch(() => null))
    return successResponse({ announcement: created }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
