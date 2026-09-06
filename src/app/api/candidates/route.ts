import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { listCandidates } from '@/services/candidates'

export const dynamic = 'force-dynamic'
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER)
    const p = request.nextUrl.searchParams
    const orgId = p.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)

    return successResponse(
      await listCandidates(orgId, {
        search: p.get('search') || undefined,
        batchId: p.get('batchId') || undefined,
        skip: p.get('skip') ? Number(p.get('skip')) : undefined,
        take: p.get('take') ? Number(p.get('take')) : undefined,
      }),
    )
  } catch (error) {
    return errorResponse(error)
  }
}
