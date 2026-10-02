import 'server-only'

import type { MockRoundOutcome } from '@prisma/client'

import type { Scope } from '@/lib/auth/scope'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { assignToCandidates } from '@/services/assignments'
import { getDrive, getDriveForManage } from '@/services/mock-drives'
import { notifyDriveOutcome, safely } from '@/services/notifications/events'

/**
 * Plan 024 — running a drive.
 *
 *   activateRound  — the round's test is assigned to everyone still in.
 *   grading hook   — a graded result decides the student's round outcome
 *                    straight away (score ≥ cutoff → shortlisted; no cutoff →
 *                    everyone who finishes advances).
 *   evaluateRound  — closes the round: no-shows are eliminated. Refused while
 *                    any answer still awaits review.
 *   overrideOutcome — a person changes an outcome, with a reason (audited).
 *   completeDrive  — after the last round: the final shortlist.
 */

/** Apply one outcome to the registration (advance or eliminate). */
async function applyOutcome(registrationId: string, roundOrder: number, outcome: MockRoundOutcome) {
  if (outcome === 'SHORTLISTED') {
    await prisma.mockDriveRegistration.update({ where: { id: registrationId }, data: { eliminated: false, currentRound: roundOrder } })
  } else if (outcome === 'ELIMINATED') {
    await prisma.mockDriveRegistration.update({ where: { id: registrationId }, data: { eliminated: true, currentRound: roundOrder - 1 } })
  }
}

const decide = (score: number, cutoff: number | null): MockRoundOutcome => (cutoff === null || score >= cutoff ? 'SHORTLISTED' : 'ELIMINATED')

/** Record a graded result against its round, if the student is in a live drive round for that test. */
async function recordResult(userId: string, assessmentId: string) {
  const result = await prisma.result.findFirst({
    where: { userId, assessmentId, status: 'GRADED' },
    orderBy: [{ gradedAt: 'desc' }, { createdAt: 'desc' }],
    select: { percentage: true },
  })
  if (!result) return 0
  const pending = await prisma.mockRoundResult.findMany({
    where: {
      outcome: 'PENDING',
      registration: { userId, eliminated: false },
      round: { assessmentId, activatedAt: { not: null }, evaluatedAt: null, drive: { status: 'IN_PROGRESS' } },
    },
    include: { round: { select: { order: true, cutoffScore: true, name: true, drive: { select: { id: true, title: true, orgId: true } } } } },
  })
  for (const rr of pending) {
    const score = Math.round(result.percentage * 100) / 100
    const outcome = decide(score, rr.round.cutoffScore)
    await prisma.mockRoundResult.update({ where: { id: rr.id }, data: { score, outcome, decidedAt: new Date() } })
    await applyOutcome(rr.registrationId, rr.round.order, outcome)
    await safely(() => notifyDriveOutcome({ userId, driveId: rr.round.drive.id, orgId: rr.round.drive.orgId, driveTitle: rr.round.drive.title, roundName: rr.round.name, outcome, key: rr.id }))
  }
  return pending.length
}

/** Grading hook (services/grading.ts): never throws. */
export async function onResultGraded(userId: string, assessmentId: string) {
  await recordResult(userId, assessmentId)
}

export async function activateRound(scope: Scope, driveId: string, order: number) {
  const drive = await getDriveForManage(scope, driveId)
  if (drive.status !== 'IN_PROGRESS') throw new ValidationError('Start the drive before opening rounds')
  const round = drive.rounds.find((r) => r.order === order)
  if (!round) throw new NotFoundError('Round not found')
  if (round.activatedAt) throw new ValidationError('This round is already open')
  const prev = drive.rounds.find((r) => r.order === order - 1)
  if (prev && !prev.evaluatedAt) throw new ValidationError(`Close ${prev.name} first`)
  if (round.assessment.status !== 'PUBLISHED') throw new ValidationError('Publish this round’s test first')

  const inRound = await prisma.mockDriveRegistration.findMany({
    where: { driveId, eliminated: false, currentRound: order - 1 },
    select: { id: true, userId: true },
  })
  // Authorised to run the drive → assign college-wide (a registrant may have
  // changed department since registering).
  await assignToCandidates({ orgId: scope.orgId, all: true }, round.assessmentId, inRound.map((r) => r.userId))
  const assignments = await prisma.assessmentAssignment.findMany({
    where: { assessmentId: round.assessmentId, userId: { in: inRound.map((r) => r.userId) } },
    select: { id: true, userId: true },
  })
  const assignmentOf = new Map(assignments.map((a) => [a.userId, a.id]))
  await prisma.$transaction([
    prisma.mockRoundResult.createMany({
      data: inRound.map((r) => ({ registrationId: r.id, roundId: round.id, assignmentId: assignmentOf.get(r.userId) ?? null })),
      skipDuplicates: true,
    }),
    prisma.mockDriveRound.update({ where: { id: round.id }, data: { activatedAt: new Date() } }),
  ])
  // Someone may have taken this test before the round opened.
  for (const r of inRound) await recordResult(r.userId, round.assessmentId)
  return { assigned: inRound.length }
}

export async function evaluateRound(scope: Scope, driveId: string, order: number) {
  const drive = await getDriveForManage(scope, driveId)
  const round = drive.rounds.find((r) => r.order === order)
  if (!round) throw new NotFoundError('Round not found')
  if (!round.activatedAt) throw new ValidationError('This round hasn’t been opened')
  if (round.evaluatedAt) throw new ValidationError('This round is already closed')

  const pending = await prisma.mockRoundResult.findMany({
    where: { roundId: round.id, outcome: 'PENDING' },
    include: { registration: { select: { userId: true } } },
  })
  const awaitingReview = await prisma.result.count({
    where: { assessmentId: round.assessmentId, status: 'PENDING_REVIEW', userId: { in: pending.map((p) => p.registration.userId) } },
  })
  if (awaitingReview > 0) throw new ValidationError(`${awaitingReview} answer sheet${awaitingReview === 1 ? ' still needs' : 's still need'} grading before this round can close`)

  let noShows = 0
  for (const p of pending) {
    // Graded but somehow unrecorded → record now; otherwise a no-show.
    if (await recordResult(p.registration.userId, round.assessmentId)) continue
    await prisma.mockRoundResult.update({ where: { id: p.id }, data: { outcome: 'ELIMINATED', decidedAt: new Date(), overrideReason: 'Did not take the round' } })
    await applyOutcome(p.registrationId, order, 'ELIMINATED')
    noShows++
  }
  await prisma.mockDriveRound.update({ where: { id: round.id }, data: { evaluatedAt: new Date() } })
  const tally = await prisma.mockRoundResult.groupBy({ by: ['outcome'], where: { roundId: round.id }, _count: { _all: true } })
  const count = (o: MockRoundOutcome) => tally.find((t) => t.outcome === o)?._count._all ?? 0
  return { shortlisted: count('SHORTLISTED'), eliminated: count('ELIMINATED'), noShows }
}

export async function overrideOutcome(scope: Scope, roundResultId: string, outcome: 'SHORTLISTED' | 'ELIMINATED', reason: string, actorId: string) {
  const rr = await prisma.mockRoundResult.findUnique({
    where: { id: roundResultId },
    include: { round: { select: { order: true, driveId: true, name: true } }, registration: { select: { userId: true } } },
  })
  if (!rr) throw new NotFoundError('Round result not found')
  const drive = await getDriveForManage(scope, rr.round.driveId)
  if (drive.status !== 'IN_PROGRESS') throw new ValidationError('Outcomes can only change while the drive is running')
  const next = drive.rounds.find((r) => r.order === rr.round.order + 1)
  if (next?.activatedAt) throw new ValidationError(`${next.name} has already opened — outcomes of earlier rounds are final`)
  const why = reason.trim()
  if (why.length < 3) throw new ValidationError('Give a reason for the change')
  await prisma.mockRoundResult.update({ where: { id: rr.id }, data: { outcome, decidedAt: new Date(), decidedById: actorId, overrideReason: why.slice(0, 300) } })
  await applyOutcome(rr.registrationId, rr.round.order, outcome)
  await safely(() => notifyDriveOutcome({ userId: rr.registration.userId, driveId: drive.id, orgId: drive.orgId, driveTitle: drive.title, roundName: rr.round.name, outcome, key: `${rr.id}:${outcome}` }))
  return { driveId: drive.id, userId: rr.registration.userId }
}

/** Funnel + table for the live monitor. */
export async function getDriveStandings(scope: Scope, driveId: string) {
  const drive = await getDrive(scope, driveId)
  const [registrations, results] = await Promise.all([
    prisma.mockDriveRegistration.count({ where: { driveId } }),
    prisma.mockRoundResult.groupBy({ by: ['roundId', 'outcome'], where: { round: { driveId } }, _count: { _all: true } }),
  ])
  const rounds = drive.rounds.map((r) => {
    const c = (o: MockRoundOutcome) => results.find((x) => x.roundId === r.id && x.outcome === o)?._count._all ?? 0
    return {
      id: r.id,
      order: r.order,
      name: r.name,
      cutoff: r.cutoffScore,
      activated: Boolean(r.activatedAt),
      evaluated: Boolean(r.evaluatedAt),
      taking: c('PENDING') + c('SHORTLISTED') + c('ELIMINATED'),
      pending: c('PENDING'),
      shortlisted: c('SHORTLISTED'),
      eliminated: c('ELIMINATED'),
    }
  })
  const finalists = drive.rounds.length
    ? await prisma.mockDriveRegistration.count({ where: { driveId, eliminated: false, currentRound: drive.rounds.length } })
    : 0
  return { registrations, rounds, finalists }
}

export async function completeDrive(scope: Scope, driveId: string) {
  const drive = await getDriveForManage(scope, driveId)
  if (drive.status !== 'IN_PROGRESS') throw new ValidationError('Only a running drive can be completed')
  const open = drive.rounds.filter((r) => !r.evaluatedAt)
  if (open.length) throw new ValidationError(`Close every round first (${open.map((r) => r.name).join(', ')})`)
  const finalists = await prisma.mockDriveRegistration.findMany({
    where: { driveId, eliminated: false, currentRound: drive.rounds.length },
    select: { userId: true },
  })
  await prisma.mockDrive.update({ where: { id: driveId }, data: { status: 'COMPLETED', completedAt: new Date() } })
  for (const f of finalists) {
    await safely(() => notifyDriveOutcome({ userId: f.userId, driveId, orgId: drive.orgId, driveTitle: drive.title, roundName: null, outcome: 'SHORTLISTED', key: `${driveId}:final` }))
  }
  return { finalists: finalists.length }
}
