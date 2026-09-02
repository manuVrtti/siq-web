import 'server-only'

import type { Organization } from '@prisma/client'

import { ForbiddenError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { CurrentUser } from '@/types/auth'

/**
 * Plan 007 — organization-scoped access control.
 *
 * Role checks answer "may this kind of user do this?". These answer "is this
 * user allowed near THIS org's data?". Both are needed: a COLLEGE_ADMIN is
 * legitimately an admin, but only of their own college. Without this layer,
 * one college could read another's candidates and results.
 *
 * ⚠️  Never trust an `orgId` from the client without passing it through here.
 */

/** Pure membership check — no role shortcuts. */
export async function belongsToOrg(userId: string, orgId: string): Promise<boolean> {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
    select: { id: true },
  })

  return membership !== null
}

/**
 * Asserts the user may act on this organization.
 *
 * Takes the whole `CurrentUser`, not just an id, because SUPER_ADMIN holds
 * MANAGE_ALL_ORGS and is deliberately not a member of every org — a
 * membership-only check would lock platform staff out of their own product.
 * Plan 007 sketches this as `requireOrgAccess(userId, orgId)`; widening the
 * signature is what makes the super-admin case expressible.
 *
 * @throws {ForbiddenError} 403
 */
export async function requireOrgAccess(user: CurrentUser, orgId: string): Promise<void> {
  if (user.role === 'SUPER_ADMIN') return

  if (!(await belongsToOrg(user.id, orgId))) {
    // Deliberately vague: confirming an org exists but is off-limits leaks
    // which organizations are on the platform.
    throw new ForbiddenError('You do not have access to this organization')
  }
}

/** Every organization the user belongs to. */
export async function getUserOrgs(userId: string): Promise<Organization[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: { org: true },
    orderBy: { joinedAt: 'asc' },
  })

  return memberships.map((m) => m.org)
}
