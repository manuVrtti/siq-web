import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { ValidationError } from '@/lib/errors'
import {
  getOptionDistributions,
  getQuestionStats,
} from '@/services/analytics/question-analytics'

/**
 * Plan 019 — one question's metrics *within one assessment*. A question can
 * sit in many assessments and its difficulty only means something relative
 * to a cohort, so `assessmentId` is required. Authorization runs on the
 * assessment; the question must be placed in it or we 404.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await ctx.params
    const assessmentId = request.nextUrl.searchParams.get('assessmentId')
    if (!assessmentId) throw new ValidationError('assessmentId is required')
    const { scope } = await authorizeAssessment(assessmentId, 'view')

    const [stats, distributions] = await Promise.all([
      getQuestionStats(assessmentId, scope),
      getOptionDistributions(assessmentId, scope),
    ])
    const stat = stats.find((s) => s.questionId === questionId)
    if (!stat) throw new ValidationError('Question is not part of this assessment')

    return successResponse({ ...stat, optionDistribution: distributions.get(questionId) ?? null })
  } catch (error) {
    return errorResponse(error)
  }
}
