import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, canEditAssessment, getScope } from '@/lib/auth/scope'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { revokeAssignment } from '@/services/assignments'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await withRole(MANAGER_ROLES)
    // Derive org from the assignment itself — no client orgId to spoof.
    const record = await prisma.assessmentAssignment.findUnique({
      where: { id },
      select: { assessment: { select: { orgId: true, departmentId: true } } },
    })
    if (!record) throw new NotFoundError('Assignment not found')
    const scope = await getScope(user, record.assessment.orgId)
    if (!canEditAssessment(scope, record.assessment)) throw new ForbiddenError('Only this test’s department can change who takes it')
    await revokeAssignment(scope, id)
    return successResponse({ revoked: true })
  } catch (error) {
    return errorResponse(error)
  }
}
