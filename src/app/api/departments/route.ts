import { type NextRequest } from 'next/server'

import { PERMISSIONS } from '@/constants/permissions'
import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withPermission } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { createDepartment, listDepartments } from '@/services/departments'

/** Departments of a college. College Admin / Super Admin only (MANAGE_OWN_ORG). */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await withPermission(PERMISSIONS.MANAGE_OWN_ORG)
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)
    return successResponse(await listDepartments(orgId))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withPermission(PERMISSIONS.MANAGE_OWN_ORG)
    const body = await request.json().catch(() => null)
    if (typeof body?.orgId !== 'string') throw new ValidationError('orgId is required')
    await requireOrgAccess(user, body.orgId)
    const department = await createDepartment(body.orgId, body)
    await audit({ userId: user.id, action: 'department.create', entityType: 'Department', entityId: department.id, metadata: { orgId: body.orgId, code: department.code } })
    return successResponse({ department }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
