import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
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
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER)
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)

    const [overview, trend, recent, upcoming, pendingReview, assessments] = await Promise.all([
      getOrgOverview(orgId),
      getOrgScoreTrend(orgId),
      getRecentSubmissions(orgId),
      getUpcomingAssessments(orgId),
      getPendingReviewQueue(orgId),
      listAssessmentPerformance(orgId),
    ])
    return successResponse({ overview, trend, recent, upcoming, pendingReview, assessments })
  } catch (error) {
    return errorResponse(error)
  }
}
