import 'server-only'

import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, assessmentWhere, canEditAssessment, getScope, type Scope } from '@/lib/auth/scope'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { CurrentUser } from '@/types/auth'

/**
 * Authorize a manager for an assessment. Derives the org from the
 * assessment itself (no client orgId to spoof), then applies department
 * scope:
 *   'view' — HODs may open a test their department owns, or one assigned to
 *            at least one of their students (data is still filtered to
 *            their students downstream via `scope`).
 *   'edit' — build, publish, assign, delete: only the owning department's
 *            HODs, or college-wide managers.
 */
export async function authorizeAssessment(
  id: string,
  mode: 'view' | 'edit' = 'edit',
): Promise<{ user: CurrentUser; orgId: string; scope: Scope }> {
  const user = await withRole(MANAGER_ROLES)
  const a = await prisma.assessment.findUnique({ where: { id }, select: { orgId: true, departmentId: true } })
  if (!a) throw new NotFoundError('Assessment not found')
  const scope = await getScope(user, a.orgId)

  if (!scope.all) {
    const visible = await prisma.assessment.count({ where: { id, ...assessmentWhere(scope) } })
    if (!visible) throw new NotFoundError('Assessment not found')
    if (mode === 'edit' && !canEditAssessment(scope, a)) {
      throw new ForbiddenError('Only this test’s department or a College Admin can change it')
    }
  }
  return { user, orgId: a.orgId, scope }
}
