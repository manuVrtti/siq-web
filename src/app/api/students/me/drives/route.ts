import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { listStudentDrives } from '@/services/mock-drive-student'

/** Plan 024 — the signed-in student's drives + open drives they could join. */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(['STUDENT'] as const)
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)
    return successResponse(await listStudentDrives(user.id, orgId))
  } catch (error) {
    return errorResponse(error)
  }
}
