import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { authorizeAssessment } from '@/lib/auth/assessment-access'
import { ValidationError } from '@/lib/errors'
import { addQuestions, removeQuestion } from '@/services/assessments'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; sectionId: string }> },
) {
  try {
    const { id, sectionId } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    const body = await request.json().catch(() => null)
    const questionIds: unknown = body?.questionIds
    if (!Array.isArray(questionIds) || questionIds.some((q) => typeof q !== 'string')) {
      throw new ValidationError('questionIds must be an array of ids')
    }
    await addQuestions(orgId, sectionId, questionIds as string[])
    return successResponse({ added: questionIds.length })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; sectionId: string }> },
) {
  try {
    const { id, sectionId } = await ctx.params
    const { orgId } = await authorizeAssessment(id)
    const questionId = request.nextUrl.searchParams.get('questionId')
    if (!questionId) throw new ValidationError('questionId is required')
    await removeQuestion(orgId, sectionId, questionId)
    return successResponse({ removed: true })
  } catch (error) {
    return errorResponse(error)
  }
}
