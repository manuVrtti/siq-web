import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { getScope } from '@/lib/auth/scope'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { getStudentsNeedingAttention } from '@/services/competency/aggregate-insights'

export const dynamic = 'force-dynamic'

const MANAGERS = ['COLLEGE_HOD', 'COLLEGE_ADMIN', 'SUPER_ADMIN'] as const

/** Plan 026 — students with the most serious gaps in a department (HOD triage). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(MANAGERS)
    const { id } = await params
    const dept = await prisma.department.findUnique({ where: { id }, select: { orgId: true } })
    if (!dept) throw new NotFoundError('Department not found')
    const scope = await getScope(user, dept.orgId)
    if (!scope.all && !scope.departmentIds.includes(id)) throw new ForbiddenError('That department isn’t yours')
    const batch = request.nextUrl.searchParams.get('batch')
    return successResponse({ students: await getStudentsNeedingAttention(scope, { departmentId: id, batchYear: batch ? Number(batch) : null }) })
  } catch (error) {
    return errorResponse(error)
  }
}
