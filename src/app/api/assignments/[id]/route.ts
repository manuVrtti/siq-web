import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { revokeAssignment } from '@/services/assignments'

export const dynamic = 'force-dynamic'
const MANAGER = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await withRole(MANAGER)
    // Derive org from the assignment itself — no client orgId to spoof.
    const record = await prisma.assessmentAssignment.findUnique({
      where: { id },
      select: { assessment: { select: { orgId: true } } },
    })
    if (!record) throw new NotFoundError('Assignment not found')
    await requireOrgAccess(user, record.assessment.orgId)
    await revokeAssignment(record.assessment.orgId, id)
    return successResponse({ revoked: true })
  } catch (error) {
    return errorResponse(error)
  }
}
