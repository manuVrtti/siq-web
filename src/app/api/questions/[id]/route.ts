import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { deleteQuestion, getQuestion, updateQuestion } from '@/services/questions'
import { questionUpdateSchema } from '@/lib/validators/question'

/**
 * Plan 011 — single question get / update / delete.
 *
 * The org is derived from the question itself, then authorised — so there is
 * no client-supplied orgId to spoof. A question belonging to another org
 * fails `requireOrgAccess` (or is never found), never leaking across tenants.
 */

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'SUPER_ADMIN'] as const

/** Loads the question's org and authorises the caller for it. */
async function authorizeForQuestion(id: string) {
  const user = await withRole(MANAGER_ROLES)
  const record = await prisma.question.findUnique({
    where: { id },
    select: { orgId: true },
  })
  if (!record) throw new NotFoundError('Question not found')
  await requireOrgAccess(user, record.orgId)
  return { user, orgId: record.orgId }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeForQuestion(id)
    return successResponse({ question: await getQuestion(orgId, id) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeForQuestion(id)

    const body = await request.json().catch(() => null)
    const parsed = questionUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid question')
    }
    // Plan 021 — every question written from the form carries a topic + skill,
    // so strengths/weaknesses can be computed from it.
    if (!parsed.data.topicId) throw new ValidationError('Choose a topic and at least one skill')

    if (parsed.data.tagIds.length > 0) {
      const owned = await prisma.tag.count({
        where: { orgId, id: { in: parsed.data.tagIds } },
      })
      if (owned !== parsed.data.tagIds.length) {
        throw new ValidationError('One or more tags do not belong to this organization')
      }
    }

    const question = await updateQuestion(orgId, id, parsed.data)
    return successResponse({ question })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { orgId } = await authorizeForQuestion(id)
    await deleteQuestion(orgId, id)
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
