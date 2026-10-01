import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope, resolveOwningDepartment } from '@/lib/auth/scope'
import { ValidationError } from '@/lib/errors'
import { importCandidates } from '@/services/candidates'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.orgId !== 'string' || typeof body.raw !== 'string') {
      throw new ValidationError('orgId and raw list are required')
    }
    const scope = await getScope(user, body.orgId)
    // HOD imports land in their department; admins may pick one or leave unassigned.
    const departmentId = await resolveOwningDepartment(scope, typeof body.departmentId === 'string' ? body.departmentId : null)
    return successResponse(await importCandidates(scope, body.raw, departmentId))
  } catch (error) {
    return errorResponse(error)
  }
}
