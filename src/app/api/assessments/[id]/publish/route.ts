import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { publishAssessment } from '@/services/assessments'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    return successResponse({ assessment: await publishAssessment(orgId, id) })
  } catch (error) {
    return errorResponse(error)
  }
}
