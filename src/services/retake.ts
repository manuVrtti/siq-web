import 'server-only'

import { userInScope, type Scope } from '@/lib/auth/scope'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { recomputeForStudent } from '@/services/competency/rollup'
import { notifyRetakeGranted, safely } from '@/services/notifications/events'

/**
 * Plan 016b — staff give one student a fresh attempt at one test.
 *
 * Nothing is deleted. The earlier attempt keeps its answers, score, identity
 * check and activity log; its result becomes SUPERSEDED (out of every
 * average, list and export) and the attempt is detached from the assignment
 * (archivedAssignmentId), which goes back to INVITED so the normal start
 * flow creates a new attempt. A proctored test asks for the identity check
 * again.
 */
export async function grantRetake(scope: Scope, resultId: string, rawReason: string, actorId: string) {
  const reason = rawReason.trim()
  if (reason.length < 3) throw new ValidationError('Give a reason for the retake')

  const result = await prisma.result.findFirst({
    where: { id: resultId, assessment: { orgId: scope.orgId }, ...userInScope(scope) },
    select: {
      id: true,
      status: true,
      userId: true,
      assessmentId: true,
      attemptId: true,
      attempt: { select: { id: true, assignmentId: true } },
      assessment: { select: { title: true, status: true, endAt: true } },
    },
  })
  if (!result) throw new NotFoundError('Result not found')
  if (result.status === 'SUPERSEDED' || !result.attempt.assignmentId) {
    throw new ValidationError('This attempt was already replaced by a retake')
  }
  if (result.assessment.status !== 'PUBLISHED') throw new ValidationError('The test isn’t published any more')
  if (result.assessment.endAt && result.assessment.endAt < new Date()) {
    throw new ValidationError('The test window has closed — extend the end time first, then allow the retake')
  }
  const assignmentId = result.attempt.assignmentId

  // Mock-drive rounds: only while the round is still open.
  const roundResults = await prisma.mockRoundResult.findMany({
    where: { assignmentId },
    select: { id: true, registrationId: true, round: { select: { order: true, evaluatedAt: true, name: true } } },
  })
  const closed = roundResults.find((r) => r.round.evaluatedAt)
  if (closed) throw new ForbiddenError(`${closed.round.name} is already closed — use Reinstate in the live monitor instead`)

  await prisma.$transaction([
    prisma.result.update({ where: { id: result.id }, data: { status: 'SUPERSEDED', supersededAt: new Date(), passed: null } }),
    // Keep the identity check with the attempt it belonged to.
    prisma.identityCheck.updateMany({ where: { assignmentId, attemptId: null }, data: { attemptId: result.attemptId } }),
    prisma.identityCheck.updateMany({ where: { assignmentId }, data: { assignmentId: null } }),
    prisma.examAttempt.update({ where: { id: result.attemptId }, data: { assignmentId: null, archivedAssignmentId: assignmentId } }),
    prisma.assessmentAssignment.update({ where: { id: assignmentId }, data: { status: 'INVITED', startedAt: null, submittedAt: null } }),
    prisma.attemptRetake.create({
      data: {
        assignmentId,
        userId: result.userId,
        assessmentId: result.assessmentId,
        previousAttemptId: result.attemptId,
        previousResultId: result.id,
        grantedById: actorId,
        reason: reason.slice(0, 300),
      },
    }),
    // The round waits for the new attempt.
    ...roundResults.flatMap((r) => [
      prisma.mockRoundResult.update({ where: { id: r.id }, data: { outcome: 'PENDING', score: null, decidedAt: null, decidedById: null, overrideReason: null } }),
      prisma.mockDriveRegistration.update({ where: { id: r.registrationId }, data: { eliminated: false, currentRound: r.round.order - 1 } }),
    ]),
  ])

  await safely(() => recomputeForStudent(result.userId, result.assessmentId))
  await safely(() => notifyRetakeGranted({ userId: result.userId, assessmentId: result.assessmentId, title: result.assessment.title, key: result.id }))
  return { userId: result.userId, assessmentId: result.assessmentId, assignmentId }
}

/** Retakes of one assignment, newest first (grade page history). */
export async function listRetakes(assignmentId: string) {
  return prisma.attemptRetake.findMany({
    where: { assignmentId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, reason: true, createdAt: true, previousResultId: true, grantedBy: { select: { name: true, email: true } } },
  })
}
