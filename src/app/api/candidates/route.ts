import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { listCandidates, removeCandidates } from '@/services/candidates'

export const dynamic = 'force-dynamic'
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER)
    const p = request.nextUrl.searchParams
    const orgId = p.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)

    return successResponse(
      await listCandidates(orgId, {
        search: p.get('search') || undefined,
        batchId: p.get('batchId') || undefined,
        skip: p.get('skip') ? Number(p.get('skip')) : undefined,
        take: p.get('take') ? Number(p.get('take')) : undefined,
      }),
    )
  } catch (error) {
    return errorResponse(error)
  }
}

/**
 * Remove candidates from this college's roster. Body: { orgId, userIds }.
 * Exam history stays; see removeCandidates for exactly what goes.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await withRole(MANAGER)
    const body = await request.json().catch(() => null)
    const orgId: unknown = body?.orgId
    const userIds: unknown = body?.userIds
    if (typeof orgId !== 'string' || !orgId) throw new ValidationError('orgId is required')
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.some((x) => typeof x !== 'string')) {
      throw new ValidationError('userIds must be a non-empty array of ids')
    }
    await requireOrgAccess(user, orgId)

    const result = await removeCandidates(orgId, userIds as string[])
    await audit({
      userId: user.id,
      action: 'candidate.remove',
      entityType: 'User',
      entityId: userIds.length === 1 ? (userIds[0] as string) : null,
      metadata: { orgId, ...result },
    })
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
