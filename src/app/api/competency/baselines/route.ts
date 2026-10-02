import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { getScope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import { ensureFreshBaselines } from '@/services/competency/cohort-baseline'

/**
 * Plan 025 — cohort baselines of a college (aggregates only, no individual
 * scores). HODs see college-wide and their own departments' rows.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(['COLLEGE_HOD', 'COLLEGE_ADMIN', 'SUPER_ADMIN'] as const)
    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    const scope = await getScope(user, orgId)
    await ensureFreshBaselines(orgId)
    const baselines = await prisma.cohortBaseline.findMany({
      where: { orgId, ...(scope.all ? {} : { OR: [{ departmentId: null }, { departmentId: { in: scope.departmentIds } }] }) },
      orderBy: [{ dimensionType: 'asc' }, { dimensionId: 'asc' }],
    })
    return successResponse({ baselines })
  } catch (error) {
    return errorResponse(error)
  }
}
