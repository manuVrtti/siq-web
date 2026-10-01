import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { updateCandidate } from '@/services/candidates'

/**
 * Edit a candidate's name / email / phone. Allowed only for rows that have
 * never signed in and sit on this college's roster alone — enforced in
 * updateCandidate, not here.
 */

export const dynamic = 'force-dynamic'
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

const optStr = (v: unknown, field: string): string | null | undefined => {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== 'string') throw new ValidationError(`${field} must be text`)
  return v
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await withRole(MANAGER)
    const body = await request.json().catch(() => null)
    const orgId: unknown = body?.orgId
    if (typeof orgId !== 'string' || !orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)

    const updated = await updateCandidate(orgId, id, {
      name: optStr(body.name, 'name'),
      email: optStr(body.email, 'email'),
      phone: optStr(body.phone, 'phone'),
    })
    await audit({
      userId: user.id,
      action: 'candidate.update',
      entityType: 'User',
      entityId: id,
      // Which fields changed, not their values.
      metadata: { orgId, fields: ['name', 'email', 'phone'].filter((f) => body[f] !== undefined) },
    })
    return successResponse({ candidate: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
