import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGER_ROLES, getScope } from '@/lib/auth/scope'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { getResultForAdmin, getResultForCandidate } from '@/services/grading'

/**
 * Plan 016 — result detail.
 *
 * Access model:
 *   - the candidate whose result it is (userId match), OR
 *   - a MANAGER role in the assessment's org
 * Anyone else → 404 (deliberately not 403 — don't confirm the id exists).
 */

export const dynamic = 'force-dynamic'


export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await requireAuth()

    // Candidate viewing their own result — always allowed.
    try {
      return successResponse({ result: await getResultForCandidate(user.id, id) })
    } catch (e) {
      if (!(e instanceof NotFoundError)) throw e
    }

    // Not the candidate — try the manager path.
    if (!(MANAGER_ROLES as readonly string[]).includes(user.role)) {
      throw new NotFoundError('Result not found')
    }
    const record = await prisma.result.findUnique({
      where: { id },
      select: { assessment: { select: { orgId: true } } },
    })
    if (!record) throw new NotFoundError('Result not found')
    const scope = await getScope(user, record.assessment.orgId).catch(() => {
      throw new NotFoundError('Result not found')
    })
    // getResultForAdmin applies the department filter too (HOD → own students).
    return successResponse({ result: await getResultForAdmin(scope, id) })
  } catch (error) {
    // Hide ForbiddenError as 404 for safety on this endpoint.
    if (error instanceof ForbiddenError) return errorResponse(new NotFoundError('Result not found'))
    return errorResponse(error)
  }
}
