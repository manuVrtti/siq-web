import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { getSessionForAdmin } from '@/services/proctoring'

/**
 * Plan 018 — admin view of one proctoring session with all its flags and
 * short-lived signed URLs for the reference photo + each snapshot.
 *
 * Manager-only. The service resolves the org from the assessment attached
 * to the session, and we verify the caller has access to that org.
 */

export const dynamic = 'force-dynamic'
const MANAGER_ROLES = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await withRole(MANAGER_ROLES)

    // Derive the org from the session's attempt → assessment. ExamAttempt has
    // no relation object, only assessmentId, so this needs two hops.
    const row = await prisma.proctoringSession.findUnique({
      where: { id },
      select: { attempt: { select: { assessmentId: true } } },
    })
    if (!row) throw new NotFoundError('Proctoring session not found')
    const assessment = await prisma.assessment.findUnique({
      where: { id: row.attempt.assessmentId },
      select: { orgId: true },
    })
    if (!assessment) throw new NotFoundError('Proctoring session not found')
    await requireOrgAccess(user, assessment.orgId)

    return successResponse(await getSessionForAdmin(assessment.orgId, id))
  } catch (error) {
    return errorResponse(error)
  }
}
