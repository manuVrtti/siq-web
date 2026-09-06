import 'server-only'

import { requireOrgAccess } from '@/lib/auth/org-access'
import { withRole } from '@/lib/auth/require-role'
import type { CurrentUser } from '@/types/auth'
import { getAssessmentOrgId } from '@/services/assessments'

const MANAGER_ROLES = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

/**
 * Plan 012 — authorize a manager for the org that owns an assessment.
 * Derives the org from the assessment itself (no client orgId to spoof).
 */
export async function authorizeAssessment(id: string): Promise<{ user: CurrentUser; orgId: string }> {
  const user = await withRole(MANAGER_ROLES)
  const orgId = await getAssessmentOrgId(id)
  await requireOrgAccess(user, orgId)
  return { user, orgId }
}
