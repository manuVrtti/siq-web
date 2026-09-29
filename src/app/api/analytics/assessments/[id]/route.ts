import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { getAssessmentAnalytics } from '@/services/analytics/assessment-analytics'

/**
 * Plan 019 — full analytics for one assessment. The org is derived from the
 * assessment itself (authorizeAssessment), never from the client.
 */

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    return successResponse(await getAssessmentAnalytics(orgId, id))
  } catch (error) {
    return errorResponse(error)
  }
}
