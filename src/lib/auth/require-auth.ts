import 'server-only'

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import type { CurrentUser } from '@/types/auth'

/**
 * Plan 006 — auth enforcement for API routes.
 *
 * The proxy already rejects requests with no session cookie, but that check is
 * shallow: it never verifies the cookie's signature or expiry. `requireAuth()`
 * is the real gate, and every authenticated route handler must call it. Relying
 * on the proxy alone would let a forged cookie value through.
 */

export class AuthError extends Error {
  readonly status = 401

  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Returns the authenticated caller, or throws `AuthError`.
 *
 * @throws {AuthError} when there is no valid session.
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError()

  return user
}

/**
 * Maps a thrown `AuthError` to a 401 JSON response, and anything else to 500.
 *
 * Use in a route handler's catch block so an auth failure never leaks an
 * internal error message to the client:
 *
 * ```ts
 * try {
 *   const user = await requireAuth()
 *   // ...
 * } catch (error) {
 *   return handleAuthError(error)
 * }
 * ```
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error('[api] unhandled error:', error)

  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}
