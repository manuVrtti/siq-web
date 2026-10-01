import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { removeCollegeStaff, updateCollegeStaff } from '@/services/people'

/** Change a staff member's role / HOD departments, or remove them from the college. */

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  role: z.enum(['COLLEGE_ADMIN', 'COLLEGE_HOD']).optional(),
  departmentIds: z.array(z.string().max(40)).max(50).optional(),
})

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id, userId } = await ctx.params
    const actor = await requireAuth()
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid details')
    const res = await updateCollegeStaff(actor, id, userId, parsed.data)
    await audit({
      userId: actor.id,
      action: 'staff.update',
      entityType: 'User',
      entityId: userId,
      metadata: { orgId: id, role: res.role, departments: res.departmentIds.length },
    })
    return successResponse(res)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id, userId } = await ctx.params
    const actor = await requireAuth()
    await removeCollegeStaff(actor, id, userId)
    await audit({ userId: actor.id, action: 'staff.remove', entityType: 'User', entityId: userId, metadata: { orgId: id } })
    return successResponse({ removed: true })
  } catch (error) {
    return errorResponse(error)
  }
}
