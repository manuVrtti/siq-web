import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { ValidationError } from '@/lib/errors'
import { profileBasicsSchema } from '@/lib/validators/profile'
import { computeCompleteness, getProfile, updateBasics } from '@/services/profile'

/** The signed-in user's own profile. */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth()
    const full = await getProfile(user.id)
    return successResponse({ ...full, completeness: computeCompleteness(full) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    const parsed = profileBasicsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue ? `${String(issue.path[0] ?? '')}: ${issue.message}` : 'Invalid profile')
    }
    await updateBasics(user.id, parsed.data)
    const full = await getProfile(user.id)
    return successResponse({ completeness: computeCompleteness(full) })
  } catch (error) {
    return errorResponse(error)
  }
}
