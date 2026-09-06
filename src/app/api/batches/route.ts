import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { createBatch, listBatches } from '@/services/candidates'

export const dynamic = 'force-dynamic'
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER)
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)
    return successResponse({ batches: await listBatches(orgId) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(MANAGER)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.orgId !== 'string' || typeof body.name !== 'string') {
      throw new ValidationError('orgId and name are required')
    }
    await requireOrgAccess(user, body.orgId)
    return successResponse(
      { batch: await createBatch(body.orgId, body.name, body.description) },
      201,
    )
  } catch (error) {
    return errorResponse(error)
  }
}
