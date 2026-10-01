import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope } from '@/lib/auth/scope'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { listCandidates, removeCandidates, setCandidatesDepartment } from '@/services/candidates'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const p = request.nextUrl.searchParams
    const orgId = p.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    const scope = await getScope(user, orgId)

    return successResponse(
      await listCandidates(scope, {
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
    const user = await withRole(MANAGER_ROLES)
    const body = await request.json().catch(() => null)
    const orgId: unknown = body?.orgId
    const userIds: unknown = body?.userIds
    if (typeof orgId !== 'string' || !orgId) throw new ValidationError('orgId is required')
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.some((x) => typeof x !== 'string')) {
      throw new ValidationError('userIds must be a non-empty array of ids')
    }
    const scope = await getScope(user, orgId)

    const result = await removeCandidates(scope, userIds as string[])
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

/**
 * Move candidates to a department. Body: { orgId, userIds, departmentId }
 * (departmentId null = unassigned, College Admins only).
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const body = await request.json().catch(() => null)
    const orgId: unknown = body?.orgId
    const userIds: unknown = body?.userIds
    const departmentId: unknown = body?.departmentId
    if (typeof orgId !== 'string' || !orgId) throw new ValidationError('orgId is required')
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.some((x) => typeof x !== 'string')) {
      throw new ValidationError('userIds must be a non-empty array of ids')
    }
    if (departmentId !== null && typeof departmentId !== 'string') throw new ValidationError('departmentId must be an id or null')
    const scope = await getScope(user, orgId)
    const moved = await setCandidatesDepartment(scope, userIds as string[], departmentId as string | null)
    await audit({
      userId: user.id,
      action: 'candidate.department',
      entityType: 'User',
      entityId: null,
      metadata: { orgId, departmentId: departmentId as string | null, moved },
    })
    return successResponse({ moved })
  } catch (error) {
    return errorResponse(error)
  }
}
