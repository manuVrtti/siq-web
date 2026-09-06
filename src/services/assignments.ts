import 'server-only'

import { Prisma } from '@prisma/client'

import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

/**
 * Plan 013 — assignments.
 *
 * One `AssessmentAssignment` per (assessment × candidate), each with a unique
 * `token`. The token forms the candidate's personal exam link — Plan 015 (exam
 * runtime) resolves it and gates entry.
 */

const assignmentInclude = {
  user: { select: { id: true, email: true, phone: true, name: true, firebaseUid: true } },
} satisfies Prisma.AssessmentAssignmentInclude

export async function listAssignments(orgId: string, assessmentId: string) {
  // Scope check: the assessment must belong to this org.
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, orgId },
    select: { id: true },
  })
  if (!a) throw new NotFoundError('Assessment not found')

  return prisma.assessmentAssignment.findMany({
    where: { assessmentId },
    include: assignmentInclude,
    orderBy: { invitedAt: 'desc' },
  })
}

/**
 * Assign an assessment to specific users. Idempotent: a user already assigned
 * is silently skipped rather than duplicated.
 *
 * Returns the number of NEW assignments created (not the total in the set).
 */
export async function assignToCandidates(
  orgId: string,
  assessmentId: string,
  userIds: string[],
): Promise<number> {
  // Assessment must live in this org.
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, orgId },
    select: { id: true },
  })
  if (!a) throw new NotFoundError('Assessment not found')

  // Every candidate must be a member of this org — no cross-tenant assignments.
  if (userIds.length === 0) return 0
  const memberCount = await prisma.user.count({
    where: { id: { in: userIds }, memberships: { some: { orgId } } },
  })
  if (memberCount !== userIds.length) {
    throw new ValidationError('One or more users are not members of this organization')
  }

  const res = await prisma.assessmentAssignment.createMany({
    data: userIds.map((userId) => ({ assessmentId, userId })),
    skipDuplicates: true, // (assessmentId, userId) is unique — quiet no-op
  })
  return res.count
}

/**
 * Assign an assessment to every member of a batch.
 * Returns the number of NEW assignments created.
 */
export async function assignToBatch(
  orgId: string,
  assessmentId: string,
  batchId: string,
): Promise<number> {
  const batch = await prisma.batch.findFirst({ where: { id: batchId, orgId }, select: { id: true } })
  if (!batch) throw new NotFoundError('Batch not found')

  const members = await prisma.batchMember.findMany({
    where: { batchId },
    select: { userId: true },
  })
  return assignToCandidates(orgId, assessmentId, members.map((m) => m.userId))
}

export async function revokeAssignment(orgId: string, id: string): Promise<void> {
  const a = await prisma.assessmentAssignment.findUnique({
    where: { id },
    select: { assessment: { select: { orgId: true } } },
  })
  if (!a || a.assessment.orgId !== orgId) throw new NotFoundError('Assignment not found')
  await prisma.assessmentAssignment.delete({ where: { id } })
}

/**
 * Resolve an assessment by its per-candidate token — the exam entry point.
 *
 * NOT org-scoped: this is used by the candidate's browser, before any session,
 * to look up an invite from a link they were emailed. The consumer (Plan 015)
 * still verifies the caller matches the assignment's user before letting the
 * exam start.
 */
export async function getAssignmentByToken(token: string) {
  return prisma.assessmentAssignment.findUnique({
    where: { token },
    include: {
      assessment: { select: { id: true, title: true, status: true, orgId: true, durationMinutes: true } },
      user: { select: { id: true, email: true, phone: true } },
    },
  })
}
