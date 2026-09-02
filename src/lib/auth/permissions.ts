import type { Permission } from '@/constants/permissions'
import { ROLE_PERMISSIONS } from '@/lib/auth/role-permissions'
import { ForbiddenError } from '@/lib/errors'
import type { CurrentUser } from '@/types/auth'

/**
 * Plan 007 — permission checks.
 *
 * Pure functions with no I/O, so they are safe in server components, route
 * handlers and client components alike. The role they read has already been
 * proven by `getCurrentUser()`; nothing here re-verifies identity.
 */

/** Does this user's role grant the permission? */
export function hasPermission(user: CurrentUser, permission: Permission): boolean {
  const granted: readonly Permission[] = ROLE_PERMISSIONS[user.role]
  return granted.includes(permission)
}

/** True only if EVERY permission is granted. */
export function hasAllPermissions(
  user: CurrentUser,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((p) => hasPermission(user, p))
}

/** True if ANY permission is granted. */
export function hasAnyPermission(
  user: CurrentUser,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((p) => hasPermission(user, p))
}

/**
 * Asserts the permission, or throws.
 *
 * @throws {ForbiddenError} 403 — signed in but not allowed.
 */
export function requirePermission(user: CurrentUser, permission: Permission): void {
  if (!hasPermission(user, permission)) {
    // The message names the permission, not the user's role: it tells the
    // caller what was needed without disclosing how roles are structured.
    throw new ForbiddenError(`Missing required permission: ${permission}`)
  }
}
