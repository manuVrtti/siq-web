import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { gradeSubjective } from '@/services/grading'

/**
 * Plan 016 — manual grading of subjective / coding QuestionResults.
 *
 * Body: an array of { questionResultId, scoreAwarded, feedback? }
 * Each item is verified to belong to the same Result and to an assessment in
 * this admin's org. All grades apply, then the Result is recomputed once.
 */

export const dynamic = 'force-dynamic'
const MANAGER_ROLES = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

const gradesSchema = z.object({
  grades: z
    .array(
      z.object({
        questionResultId: z.string(),
        scoreAwarded: z.number(),
        feedback: z.string().max(5000).nullish(),
      }),
    )
    .min(1)
    .max(500),
})

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: resultId } = await ctx.params
    const user = await withRole(MANAGER_ROLES)

    const parsed = gradesSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
    }

    // Verify the target Result's org, once.
    const result = await prisma.result.findUnique({
      where: { id: resultId },
      select: { assessment: { select: { orgId: true } } },
    })
    if (!result) throw new NotFoundError('Result not found')
    await requireOrgAccess(user, result.assessment.orgId)

    // Every grade must reference a QuestionResult ON THIS Result — no
    // cross-result forgery.
    const ids = parsed.data.grades.map((g) => g.questionResultId)
    const owned = await prisma.questionResult.count({
      where: { id: { in: ids }, resultId },
    })
    if (owned !== ids.length) {
      throw new ValidationError('One or more grades reference a different result')
    }

    let updated
    for (const g of parsed.data.grades) {
      updated = await gradeSubjective({
        orgId: result.assessment.orgId,
        questionResultId: g.questionResultId,
        scoreAwarded: g.scoreAwarded,
        feedback: g.feedback ?? null,
        reviewerId: user.id,
      })
    }

    return successResponse({ result: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
