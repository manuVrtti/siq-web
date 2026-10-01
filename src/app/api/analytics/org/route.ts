import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope } from '@/lib/auth/scope'
import { ValidationError } from '@/lib/errors'
import { listAssessmentPerformance } from '@/services/analytics/assessment-analytics'
import {
  getOrgOverview,
  getOrgScoreTrend,
  getPendingReviewQueue,
  getRecentSubmissions,
  getUpcomingAssessments,
} from '@/services/analytics/org-analytics'

/** Plan 019 — org overview metrics. Manager roles, org-scoped. */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    const scope = await getScope(user, orgId)

    const [overview, trend, recent, upcoming, pendingReview, assessments] = await Promise.all([
      getOrgOverview(scope),
      getOrgScoreTrend(scope),
      getRecentSubmissions(scope),
      getUpcomingAssessments(scope),
      getPendingReviewQueue(scope),
      listAssessmentPerformance(scope),
    ])
    return successResponse({ overview, trend, recent, upcoming, pendingReview, assessments })
  } catch (error) {
    return errorResponse(error)
  }
}
