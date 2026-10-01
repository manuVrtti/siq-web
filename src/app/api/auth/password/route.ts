import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { getSessionCookie, verifySessionCookie } from '@/lib/auth/session'
import { AuthError, ForbiddenError, ValidationError } from '@/lib/errors'
import { completePasswordChange } from '@/services/credentials'

/**
 * Replace a temporary password (first sign-in after a college issued one).
 * Only callable by a session carrying the `mustChangePassword` claim; the
 * session is revoked afterwards and the client signs in with the new one.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const cookie = await getSessionCookie()
    if (!cookie) throw new AuthError('Not signed in')
    const decoded = await verifySessionCookie(cookie).catch(() => {
      throw new AuthError('Session expired — sign in again')
    })
    if (decoded.mustChangePassword !== true) throw new ForbiddenError('No password change is pending')

    const body = await request.json().catch(() => null)
    const newPassword: unknown = body?.newPassword
    if (typeof newPassword !== 'string') throw new ValidationError('newPassword is required')

    await completePasswordChange(decoded.uid, newPassword)
    return successResponse({ changed: true, email: decoded.email ?? null })
  } catch (error) {
    return errorResponse(error)
  }
}
