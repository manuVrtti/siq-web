import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { getStudentDriveJourney } from '@/services/mock-drive-student'

/** Plan 024 — the signed-in student's journey through one drive. */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(['STUDENT'] as const)
    const { id } = await params
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)
    return successResponse(await getStudentDriveJourney(user.id, orgId, id))
  } catch (error) {
    return errorResponse(error)
  }
}
