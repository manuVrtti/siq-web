import { type NextRequest } from 'next/server'

import { PERMISSIONS } from '@/constants/permissions'
import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withPermission } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { setStudentsPickDepartment } from '@/services/departments'

/** PATCH { orgId, studentsPickDepartment } — who decides a student's department. */

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const user = await withPermission(PERMISSIONS.MANAGE_OWN_ORG)
    const body = await request.json().catch(() => null)
    if (typeof body?.orgId !== 'string') throw new ValidationError('orgId is required')
    if (typeof body.studentsPickDepartment !== 'boolean') throw new ValidationError('studentsPickDepartment must be true or false')
    await requireOrgAccess(user, body.orgId)
    await setStudentsPickDepartment(body.orgId, body.studentsPickDepartment)
    await audit({ userId: user.id, action: 'org.update', entityType: 'Organization', entityId: body.orgId, metadata: { studentsPickDepartment: body.studentsPickDepartment } })
    return successResponse({ studentsPickDepartment: body.studentsPickDepartment })
  } catch (error) {
    return errorResponse(error)
  }
}
