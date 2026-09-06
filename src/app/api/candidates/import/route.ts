import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { importCandidates } from '@/services/candidates'

export const dynamic = 'force-dynamic'
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(MANAGER)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.orgId !== 'string' || typeof body.raw !== 'string') {
      throw new ValidationError('orgId and raw list are required')
    }
    await requireOrgAccess(user, body.orgId)
    return successResponse(await importCandidates(body.orgId, body.raw))
  } catch (error) {
    return errorResponse(error)
  }
}
