import 'server-only'

import { notFound } from 'next/navigation'

import type { Permission } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { hasPermission } from '@/lib/auth/permissions'
import type { CurrentUser } from '@/types/auth'

/**
 * Page-level permission gate for server components.
 *
 * [org]/layout only proves org MEMBERSHIP — a student is a member too. Pages
 * that read org data straight from services (not via the role-checked API)
 * must call this first, or a student can open e.g. the question editor and
 * read the answer key before their exam.
 *
 * 404 rather than 403, matching the tenant boundary: we don't confirm the
 * page exists to someone who may not see it.
 */
export async function requirePagePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, permission)) notFound()
  return user
}
