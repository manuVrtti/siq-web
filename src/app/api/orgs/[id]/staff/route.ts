import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { addCollegeStaff, assertCollegeAdminOf, listCollegeStaff } from '@/services/people'

/**
 * College staff (College Admins + HODs). Super Admin anywhere; College
 * Admins only in their own college — enforced in services/people.ts.
 */

export const dynamic = 'force-dynamic'

const addSchema = z.object({
  email: z.string().trim().min(3).max(200),
  role: z.enum(['COLLEGE_ADMIN', 'COLLEGE_HOD']),
  departmentIds: z.array(z.string().max(40)).max(50).optional(),
})

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const actor = await requireAuth()
    await assertCollegeAdminOf(actor, id)
    return successResponse({ staff: await listCollegeStaff(id) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const actor = await requireAuth()
    const parsed = addSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid details')
    const res = await addCollegeStaff(actor, id, parsed.data)
    await audit({
      userId: actor.id,
      action: 'staff.add',
      entityType: 'User',
      entityId: res.userId,
      metadata: { orgId: id, role: res.role, departments: parsed.data.departmentIds?.length ?? 0, invited: res.invited },
    })
    return successResponse(res, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
