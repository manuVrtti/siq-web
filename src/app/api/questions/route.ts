import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { createQuestion, listQuestions, type QuestionFilters } from '@/services/questions'
import { questionInputSchema } from '@/lib/validators/question'
import type { QuestionType, Difficulty } from '@prisma/client'

/**
 * Plan 011 — question bank list + create.
 *
 * Every request carries an orgId. `withRole` gates the global role;
 * `requireOrgAccess` confirms the caller belongs to that specific org — the
 * two layers from Plan 007. A question is never created or listed without an
 * authorised org in scope.
 */

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'SUPER_ADMIN'] as const

export async function GET(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)

    const p = request.nextUrl.searchParams
    const orgId = p.get('orgId')
    if (!orgId) throw new ValidationError('orgId is required')
    await requireOrgAccess(user, orgId)

    const filters: QuestionFilters = {
      type: (p.get('type') as QuestionType) || undefined,
      difficulty: (p.get('difficulty') as Difficulty) || undefined,
      tagId: p.get('tagId') || undefined,
      topicId: p.get('topicId') || undefined,
      skillId: p.get('skillId') || undefined,
      search: p.get('search') || undefined,
      skip: p.get('skip') ? Number(p.get('skip')) : undefined,
      take: p.get('take') ? Number(p.get('take')) : undefined,
    }

    const result = await listQuestions(orgId, filters)
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)

    const body = await request.json().catch(() => null)
    if (!body || typeof body.orgId !== 'string') {
      throw new ValidationError('orgId is required')
    }
    const orgId = body.orgId
    await requireOrgAccess(user, orgId)

    const parsed = questionInputSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid question')
    }
    // Plan 021 — every question written from the form carries a topic + skill,
    // so strengths/weaknesses can be computed from it.
    if (!parsed.data.topicId) throw new ValidationError('Choose a topic and at least one skill')

    // Tags must belong to the same org — otherwise a caller could attach
    // another organisation's tags by id.
    if (parsed.data.tagIds.length > 0) {
      const owned = await prisma.tag.count({
        where: { orgId, id: { in: parsed.data.tagIds } },
      })
      if (owned !== parsed.data.tagIds.length) {
        throw new ValidationError('One or more tags do not belong to this organization')
      }
    }

    const question = await createQuestion(orgId, user.id, parsed.data)
    return successResponse({ question }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
