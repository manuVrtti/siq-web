import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { listResultsForAssessment, summariseResults } from '@/services/grading'

/**
 * Plan 016 — list every candidate's result for one assessment (admin view).
 * Tenant-scoped via `authorizeAssessment` (derives the org from the id).
 */

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    const results = await listResultsForAssessment(orgId, id)
    return successResponse({ results, summary: summariseResults(results) })
  } catch (error) {
    return errorResponse(error)
  }
}
