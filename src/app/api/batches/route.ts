import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope, resolveOwningDepartment } from '@/lib/auth/scope'
import { ValidationError } from '@/lib/errors'
import { createBatch, listBatches } from '@/services/candidates'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    const scope = await getScope(user, orgId)
    return successResponse({ batches: await listBatches(scope) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.orgId !== 'string' || typeof body.name !== 'string') {
      throw new ValidationError('orgId and name are required')
    }
    const scope = await getScope(user, body.orgId)
    // An HOD's batch belongs to one of their departments.
    const departmentId = await resolveOwningDepartment(scope, typeof body.departmentId === 'string' ? body.departmentId : null)
    return successResponse({ batch: await createBatch(scope, body.name, body.description, departmentId) }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
