import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { setPlatformAnnouncementActive } from '@/services/notifications/announcements'

/** PATCH { isActive } — SUPER_ADMIN only. */

export const dynamic = 'force-dynamic'

const body = z.object({ isActive: z.boolean() })

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    const parsed = body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new ValidationError('Invalid request')
    await setPlatformAnnouncementActive(user.id, id, parsed.data.isActive)
    return successResponse(null)
  } catch (error) {
    return errorResponse(error)
  }
}
