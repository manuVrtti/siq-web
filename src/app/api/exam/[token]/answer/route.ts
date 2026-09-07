import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { saveAnswer } from '@/services/exam-session'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    const user = await requireAuth()
    const body = await request.json().catch(() => null)

    const questionId = body?.questionId
    if (typeof questionId !== 'string') throw new ValidationError('questionId is required')

    const selectedOptionIds: unknown = body?.selectedOptionIds
    if (
      selectedOptionIds !== undefined &&
      (!Array.isArray(selectedOptionIds) || selectedOptionIds.some((x) => typeof x !== 'string'))
    ) {
      throw new ValidationError('selectedOptionIds must be an array of ids')
    }

    const textAnswer: unknown = body?.textAnswer
    if (textAnswer !== undefined && textAnswer !== null && typeof textAnswer !== 'string') {
      throw new ValidationError('textAnswer must be a string')
    }

    await saveAnswer(token, user.id, {
      questionId,
      selectedOptionIds: (selectedOptionIds as string[]) ?? undefined,
      textAnswer: (textAnswer as string | null | undefined) ?? undefined,
    })
    return successResponse({ saved: true })
  } catch (error) {
    return errorResponse(error)
  }
}
