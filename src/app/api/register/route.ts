import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/require-auth'
import { getSessionCookie, verifySessionCookie } from '@/lib/auth/session'
import { ValidationError } from '@/lib/errors'
import { registrationSchema } from '@/lib/validators/profile'
import { register } from '@/services/profile'

/**
 * Registration step (first sign-in). Saves the minimum profile, marks it
 * complete, and — for a self sign-up with no college yet — joins the
 * college whose domain matches the VERIFIED email. `email_verified` is read
 * from the Firebase-verified session cookie, never from the client.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const parsed = registrationSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid details')

    let emailVerified = false
    const cookie = await getSessionCookie()
    if (cookie) {
      const decoded = await verifySessionCookie(cookie).catch(() => null)
      emailVerified = Boolean(decoded?.email_verified)
    }

    const { joined } = await register(user, parsed.data, { emailVerified })
    return successResponse({ joined })
  } catch (error) {
    return errorResponse(error)
  }
}
