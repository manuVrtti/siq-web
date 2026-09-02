import 'server-only'

import type { UserRole } from '@prisma/client'

import { requireAuth } from '@/lib/auth/require-auth'
import type { Permission } from '@/constants/permissions'
import { requirePermission } from '@/lib/auth/permissions'
import { ForbiddenError } from '@/lib/errors'
import type { CurrentUser } from '@/types/auth'

/**
 * Plan 007 — role enforcement for API routes.
 *
 * `withRole` / `withPermission` are the ones to reach for: they authenticate
 * and authorize in a single call, so a handler cannot accidentally check the
 * role of a user it never verified.
 */

/**
 * Asserts the user holds one of the given roles.
 *
 * @throws {ForbiddenError} 403
 */
export function requireRole(user: CurrentUser, roles: readonly UserRole[]): void {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError('Insufficient role')
  }
}

/**
 * Authenticate, then require one of the given roles.
 *
 * ```ts
 * export async function GET() {
 *   try {
 *     const user = await withRole(['COLLEGE_ADMIN', 'SUPER_ADMIN'])
 *     ...
 *   } catch (error) {
 *     return handleApiError(error)
 *   }
 * }
 * ```
 *
 * @throws {AuthError} 401 when not signed in.
 * @throws {ForbiddenError} 403 when the role is wrong.
 */
export async function withRole(roles: readonly UserRole[]): Promise<CurrentUser> {
  const user = await requireAuth()
  requireRole(user, roles)
  return user
}

/**
 * Authenticate, then require a permission.
 *
 * Prefer this over `withRole` where a capability is what matters — it survives
 * a role being added or renamed, whereas a hardcoded role list does not.
 */
export async function withPermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireAuth()
  requirePermission(user, permission)
  return user
}
