import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { getPracticeQuestions } from '@/services/competency/recommendations'

/**
 * Plan 026/027 — a student's practice set for one skill. Only questions staff
 * opened for practice (they include the answer). Students only, own college.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(['STUDENT'] as const)
    const p = request.nextUrl.searchParams
    const orgId = p.get('orgId')
    const skillId = p.get('skillId')
    if (!orgId || !skillId) throw new ValidationError('orgId and skillId are required')
    await requireOrgAccess(user, orgId)
    return successResponse({ questions: await getPracticeQuestions(user.id, orgId, skillId) })
  } catch (error) {
    return errorResponse(error)
  }
}
