import 'server-only'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { AuthError, handleApiError } from '@/lib/errors'
import type { CurrentUser } from '@/types/auth'

/**
 * Plan 006 — auth enforcement for API routes.
 *
 * The proxy rejects requests with no session cookie, but that check is
 * shallow: it never verifies the cookie's signature or expiry. This is the
 * real gate, and every authenticated route handler must call it. Relying on
 * the proxy alone would let a forged cookie value through.
 *
 * Error classes moved to `@/lib/errors` in Plan 007 so 403/400/404 could join
 * them; re-exported here so existing imports keep working.
 */

export { AuthError }

/** Alias kept for Plan 004/006 call sites. Prefer `handleApiError`. */
export const handleAuthError = handleApiError

/**
 * Returns the authenticated caller, or throws.
 *
 * @throws {AuthError} 401 when there is no valid session.
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError()

  return user
}
