'use client'

import type { ReactNode } from 'react'
import type { UserRole } from '@prisma/client'

import type { Permission } from '@/constants/permissions'
import { hasPermission } from '@/lib/auth/permissions'
import { useCurrentUser } from '@/lib/auth/user-context'

/**
 * Plan 007 — conditional rendering by role or permission.
 *
 * ⚠️  THIS IS NOT SECURITY. It decides what to draw, nothing more. The check
 *     runs in the browser, on data the browser already has, and anyone can
 *     edit it in devtools or simply call the API directly.
 *
 *     Its job is to stop showing people buttons that would fail. Every action
 *     it hides MUST also be enforced server-side with `withRole()`,
 *     `withPermission()` or `requireOrgAccess()`. If an action is gated only
 *     here, it is not gated.
 *
 *     Concretely, and measured rather than assumed: for a STUDENT, gated
 *     content is absent from the rendered DOM but PRESENT in the RSC payload,
 *     because `children` is serialised by the server before this component
 *     decides anything. So never wrap real data in a RoleGate and assume it
 *     was withheld — it was sent, just not painted. Fetch privileged data
 *     behind a server-side check instead, so it is never serialised at all.
 */

type RoleGateProps = {
  children: ReactNode
  /** Rendered when the check fails. Defaults to nothing. */
  fallback?: ReactNode
} & (
  | { allowedRoles: readonly UserRole[]; permission?: never }
  | { permission: Permission; allowedRoles?: never }
)

export default function RoleGate({
  children,
  fallback = null,
  allowedRoles,
  permission,
}: RoleGateProps) {
  const user = useCurrentUser()

  if (!user) return <>{fallback}</>

  const allowed = permission
    ? hasPermission(user, permission)
    : (allowedRoles?.includes(user.role) ?? false)

  return <>{allowed ? children : fallback}</>
}
