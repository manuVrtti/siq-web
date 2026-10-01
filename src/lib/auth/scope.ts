import 'server-only'

import type { Prisma, UserRole } from '@prisma/client'

import { requireOrgAccess } from '@/lib/auth/org-access'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { CurrentUser } from '@/types/auth'

/**
 * Department scoping (5-role model).
 *
 *   SUPER_ADMIN, COLLEGE_ADMIN, RECRUITER  → the whole org
 *   COLLEGE_HOD                            → only the department(s) they head
 *
 * Every manager page, API route and export resolves a Scope once and passes
 * it down; queries use the filter builders below instead of a bare orgId.
 * An HOD heading no department gets an empty scope and sees nothing —
 * default deny, never "the whole college".
 */

/** Roles that manage a college's data. HOD is included; scoping limits it. */
export const MANAGER_ROLES = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'SUPER_ADMIN'] as const satisfies readonly UserRole[]

export type Scope =
  | { orgId: string; all: true }
  | { orgId: string; all: false; departmentIds: string[] }

export async function getScope(user: CurrentUser, orgId: string): Promise<Scope> {
  await requireOrgAccess(user, orgId)
  if (user.role === 'COLLEGE_HOD') {
    const heads = await prisma.departmentHead.findMany({
      where: { userId: user.id, department: { orgId } },
      select: { departmentId: true },
    })
    return { orgId, all: false, departmentIds: heads.map((h) => h.departmentId) }
  }
  if (user.role === 'STUDENT') throw new ForbiddenError('Insufficient role')
  return { orgId, all: true }
}

/** Membership filter: this org, and (for HODs) one of their departments. */
export function memberWhere(scope: Scope): Prisma.OrganizationMemberWhereInput {
  return scope.all ? { orgId: scope.orgId } : { orgId: scope.orgId, departmentId: { in: scope.departmentIds } }
}

/** Students this scope may see. */
export function studentWhere(scope: Scope): Prisma.UserWhereInput {
  return { role: 'STUDENT', memberships: { some: memberWhere(scope) } }
}

/**
 * Assessments this scope may see: HODs see their departments' own tests,
 * plus any test (e.g. college-wide) assigned to at least one of their
 * students — results of other departments stay filtered out separately.
 */
export function assessmentWhere(scope: Scope): Prisma.AssessmentWhereInput {
  if (scope.all) return { orgId: scope.orgId }
  return {
    orgId: scope.orgId,
    OR: [
      { departmentId: { in: scope.departmentIds } },
      { assignments: { some: { user: { memberships: { some: memberWhere(scope) } } } } },
    ],
  }
}

/** May this scope change the assessment (build, publish, assign, delete)? */
export function canEditAssessment(scope: Scope, a: { departmentId: string | null }): boolean {
  return scope.all || (a.departmentId !== null && scope.departmentIds.includes(a.departmentId))
}

/** Results this scope may see (always the student's side of the filter). */
export function resultWhere(scope: Scope): Prisma.ResultWhereInput {
  return { assessment: { orgId: scope.orgId }, user: { memberships: { some: memberWhere(scope) } } }
}

export function batchWhere(scope: Scope): Prisma.BatchWhereInput {
  return scope.all ? { orgId: scope.orgId } : { orgId: scope.orgId, departmentId: { in: scope.departmentIds } }
}

/** Throws unless every id is a student this scope may act on. */
export async function assertStudentsInScope(scope: Scope, rawIds: string[]): Promise<void> {
  const ids = [...new Set(rawIds)]
  if (ids.length === 0) return
  const n = await prisma.user.count({ where: { id: { in: ids }, ...studentWhere(scope) } })
  if (n !== ids.length) {
    throw new ForbiddenError(
      scope.all ? 'One or more candidates are not on this college’s roster' : 'One or more candidates are outside your department',
    )
  }
}

/**
 * The department a NEW record created by this scope belongs to. HODs must
 * use one of theirs (defaulting to their only one); admins may pick any
 * department of the org, or none for college-wide.
 */
export async function resolveOwningDepartment(scope: Scope, requested?: string | null): Promise<string | null> {
  if (scope.all) {
    if (!requested) return null
    const d = await prisma.department.findFirst({ where: { id: requested, orgId: scope.orgId }, select: { id: true } })
    if (!d) throw new NotFoundError('Department not found')
    return d.id
  }
  if (requested) {
    if (!scope.departmentIds.includes(requested)) throw new ForbiddenError('That department isn’t yours')
    return requested
  }
  if (scope.departmentIds.length === 0) throw new ForbiddenError('You don’t head a department yet — ask your College Admin')
  return scope.departmentIds[0]!
}

/** Departments visible to this scope, for pickers and filters. */
export function listScopeDepartments(scope: Scope) {
  return prisma.department.findMany({
    where: scope.all ? { orgId: scope.orgId } : { orgId: scope.orgId, id: { in: scope.departmentIds } },
    orderBy: { code: 'asc' },
    select: { id: true, name: true, code: true },
  })
}

/**
 * For queries over people-linked rows (results, assignments, attempts):
 * `{}` for college-wide scopes, otherwise a `user` filter to spread in.
 * Use inside `AND: [...]` when the query already filters on `user`.
 */
export function userInScope(scope: Scope): { user?: Prisma.UserWhereInput } {
  return scope.all ? {} : { user: { memberships: { some: memberWhere(scope) } } }
}
