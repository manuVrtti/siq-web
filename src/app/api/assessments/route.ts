import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { createAssessment, listAssessments } from '@/services/assessments'
import { assessmentInputSchema } from '@/lib/validators/assessment'

export const dynamic = 'force-dynamic'
const MANAGER_ROLES = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)
    const status = request.nextUrl.searchParams.get('status') ?? undefined
    return successResponse({ assessments: await listAssessments(orgId, status) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.orgId !== 'string') throw new ValidationError('orgId is required')
    await requireOrgAccess(user, body.orgId)
    const parsed = assessmentInputSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
    const assessment = await createAssessment(body.orgId, user.id, parsed.data)
    return successResponse({ assessment }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
