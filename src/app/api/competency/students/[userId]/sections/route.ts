import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { assertCanReadCompetency, getSectionBreakdown } from '@/services/competency/read'

/** Plan 025 — cumulative topic scores, strongest first. Readable by the student, their HOD, College Admins, Super Admins. */

export const dynamic = 'force-dynamic'

const READERS = ['STUDENT', 'COLLEGE_HOD', 'COLLEGE_ADMIN', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const viewer = await withRole(READERS)
    const { userId } = await params
    const p = request.nextUrl.searchParams
    const orgId = p.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await assertCanReadCompetency(viewer, orgId, userId)
    return successResponse({ sections: await getSectionBreakdown(userId, orgId) })
  } catch (error) {
    return errorResponse(error)
  }
}
