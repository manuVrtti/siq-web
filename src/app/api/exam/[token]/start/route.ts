import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { startAttempt } from '@/services/exam-session'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    const user = await requireAuth()
    const attempt = await startAttempt(token, user.id)
    return successResponse({ attemptId: attempt.id, deadlineAt: attempt.deadlineAt })
  } catch (error) {
    return errorResponse(error)
  }
}
