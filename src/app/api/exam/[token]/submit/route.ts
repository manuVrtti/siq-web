import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { requireSecureBrowser } from '@/lib/seb'
import { submitAttempt } from '@/services/exam-session'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    requireSecureBrowser(request.headers)
    const user = await requireAuth()
    return successResponse(await submitAttempt(token, user.id))
  } catch (error) {
    return errorResponse(error)
  }
}
