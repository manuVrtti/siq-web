import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { audit } from '@/services/audit'
import { refreshOrgInsights } from '@/services/competency/refresh'
import { recomputeOrg } from '@/services/competency/rollup'
import { assertCollegeAdminOf } from '@/services/people'

/**
 * Plan 025 — rebuild every student's competency profile in a college from
 * the graded results, then the cohort baselines. College Admin / Super Admin.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(['COLLEGE_ADMIN', 'SUPER_ADMIN'] as const)
    const body = await request.json().catch(() => null)
    if (typeof body?.orgId !== 'string') throw new ValidationError('orgId is required')
    await requireOrgAccess(user, body.orgId)
    await assertCollegeAdminOf(user, body.orgId)
    const res = await recomputeOrg(body.orgId)
    const refreshed = await refreshOrgInsights(body.orgId)
    await audit({ userId: user.id, action: 'competency.recompute', entityType: 'Organization', entityId: body.orgId, metadata: { orgId: body.orgId, ...res } })
    return successResponse({ ...res, baselines: refreshed.baselines })
  } catch (error) {
    return errorResponse(error)
  }
}
