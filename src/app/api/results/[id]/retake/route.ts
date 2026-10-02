import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { getScope } from '@/lib/auth/scope'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { audit } from '@/services/audit'
import { grantRetake } from '@/services/retake'

/**
 * Plan 016b — give the student of this result a fresh attempt.
 * College Admin / Super Admin: any student of the college; HOD: own departments.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const)
    const { id } = await params
    const r = await prisma.result.findUnique({ where: { id }, select: { assessment: { select: { orgId: true } } } })
    if (!r) throw new NotFoundError('Result not found')
    const scope = await getScope(user, r.assessment.orgId)
    const body = await request.json().catch(() => null)
    const res = await grantRetake(scope, id, String(body?.reason ?? ''), user.id)
    await audit({
      userId: user.id,
      action: 'result.retake',
      entityType: 'Result',
      entityId: id,
      metadata: { orgId: scope.orgId, student: res.userId, assessmentId: res.assessmentId, reason: String(body?.reason ?? '').slice(0, 300) },
    })
    return successResponse(res)
  } catch (error) {
    return errorResponse(error)
  }
}
