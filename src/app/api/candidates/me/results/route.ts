import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { listResultsForCandidate } from '@/services/grading'

/**
 * Plan 016 — the signed-in candidate's own results across every org.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth()
    return successResponse({ results: await listResultsForCandidate(user.id) })
  } catch (error) {
    return errorResponse(error)
  }
}
