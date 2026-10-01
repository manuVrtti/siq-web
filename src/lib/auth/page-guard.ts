import 'server-only'

import { notFound } from 'next/navigation'

import type { Permission } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { hasPermission } from '@/lib/auth/permissions'
import { assessmentWhere, canEditAssessment, getScope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import { getOrgBySlug } from '@/services/organizations'
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

/**
 * Page-level gate for manager pages under /[org]: permission + org by slug
 * + department scope in one call. Every manager page uses this so an HOD
 * can never land on unscoped data.
 */
export async function requirePageScope(permission: Permission, slug: string) {
  const user = await requirePagePermission(permission)
  const org = await getOrgBySlug(slug)
  if (!org) notFound()
  const scope = await getScope(user, org.id).catch(() => notFound())
  return { user, org, scope }
}

/**
 * Per-assessment manager page: requirePageScope plus the same view/edit
 * rule as the API (lib/auth/assessment-access.ts). 404 when out of scope.
 */
export async function requireAssessmentPage(permission: Permission, slug: string, id: string, mode: 'view' | 'edit') {
  const ctx = await requirePageScope(permission, slug)
  const a = await prisma.assessment.findFirst({
    where: { id, ...assessmentWhere(ctx.scope) },
    select: { departmentId: true },
  })
  if (!a || (mode === 'edit' && !canEditAssessment(ctx.scope, a))) notFound()
  return { ...ctx, canEdit: canEditAssessment(ctx.scope, a) }
}
