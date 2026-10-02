import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope } from '@/lib/auth/scope'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { getOrgBySlug } from '@/services/organizations'
import { setAnnouncementActive } from '@/services/notifications/announcements'

/** PATCH { isActive } ?org=<slug> — deactivate or restore (never delete). */

export const dynamic = 'force-dynamic'

const body = z.object({ isActive: z.boolean() })

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const { id } = await ctx.params
    const slug = req.nextUrl.searchParams.get('org')
    if (!slug) throw new ValidationError('org is required')
    const org = await getOrgBySlug(slug)
    if (!org) throw new NotFoundError('Workspace not found')
    const parsed = body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new ValidationError('Invalid request')

    await setAnnouncementActive(await getScope(user, org.id), user.id, id, parsed.data.isActive)
    return successResponse(null)
  } catch (error) {
    return errorResponse(error)
  }
}
