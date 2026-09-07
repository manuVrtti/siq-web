import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { validateToken } from '@/services/exam-session'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    const user = await requireAuth()
    return successResponse(await validateToken(token, user.id))
  } catch (error) {
    return errorResponse(error)
  }
}
