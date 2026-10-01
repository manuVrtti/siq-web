import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { setUserRole } from '@/services/admin'
import { audit } from '@/services/audit'

/** Change a user's global role — SUPER_ADMIN only, audited. */

export const dynamic = 'force-dynamic'
const schema = z.object({ role: z.enum(['STUDENT', 'COLLEGE_HOD', 'COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN']) })

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError('Choose a valid role')
    const change = await setUserRole(actor.id, id, parsed.data.role)
    if (change.from !== change.to) {
      await audit({ userId: actor.id, action: 'user.role.change', entityType: 'User', entityId: id, metadata: change })
    }
    return successResponse(change)
  } catch (error) {
    return errorResponse(error)
  }
}
