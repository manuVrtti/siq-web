import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { ValidationError } from '@/lib/errors'
import { assignToBatch, assignToCandidates, listAssignments } from '@/services/assignments'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    return successResponse({ assignments: await listAssignments(orgId, id) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    const body = await request.json().catch(() => null)

    if (body?.batchId) {
      const created = await assignToBatch(orgId, id, body.batchId)
      return successResponse({ created })
    }

    const userIds: unknown = body?.userIds
    if (!Array.isArray(userIds) || userIds.some((x) => typeof x !== 'string')) {
      throw new ValidationError('userIds must be an array, or provide batchId')
    }
    const created = await assignToCandidates(orgId, id, userIds as string[])
    return successResponse({ created })
  } catch (error) {
    return errorResponse(error)
  }
}
