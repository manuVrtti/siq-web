import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { markOnboarded } from '@/services/onboarding'

/** POST — the signed-in user finished (or skipped) their welcome journey. */

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const user = await requireAuth()
    await markOnboarded(user.id)
    return successResponse({ onboarded: true })
  } catch (error) {
    return errorResponse(error)
  }
}
