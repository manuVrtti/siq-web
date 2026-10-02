import 'server-only'

import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { eligibilityOf } from '@/services/mock-drive-registration'

/**
 * Plan 024 — the student's side of mock drives. Always the caller's own
 * data: pass the signed-in student's id, never a request parameter.
 */

export type RoundState = 'CLEARED' | 'NOT_SHORTLISTED' | 'TAKE_NOW' | 'AWAITING_RESULT' | 'UPCOMING' | 'LOCKED'

const VISIBLE = ['SCHEDULED', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED'] as const

/** Drives the student is in, plus open drives they could join (with why not, if not). */
export async function listStudentDrives(userId: string, orgId: string) {
  const drives = await prisma.mockDrive.findMany({
    // Archived drives stay in the history of those who took part.
    where: { orgId, OR: [{ status: { in: [...VISIBLE] } }, { status: 'ARCHIVED', registrations: { some: { userId } } }] },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      targets: true,
      rounds: { orderBy: { order: 'asc' }, select: { id: true, order: true, activatedAt: true, evaluatedAt: true } },
      registrations: { where: { userId }, include: { roundResults: true } },
    },
  })
  const mine = []
  const open = []
  for (const d of drives) {
    const reg = d.registrations[0]
    const base = {
      id: d.id,
      title: d.title,
      employerName: d.employerName,
      employerLogo: d.employerLogo,
      roleTitle: d.roleTitle,
      roleCtc: d.roleCtc,
      status: d.status,
      startDate: d.startDate,
      registrationDeadline: d.registrationDeadline,
      rounds: d.rounds.length,
    }
    if (reg) {
      const finalist = (d.status === 'COMPLETED' || d.status === 'ARCHIVED') && !reg.eliminated && reg.currentRound === d.rounds.length
      mine.push({ ...base, cleared: reg.currentRound, eliminated: reg.eliminated, finalist, actionNeeded: await hasPendingRound(userId, d.id) })
    } else if (d.status === 'REGISTRATION_OPEN' && !(d.registrationDeadline && d.registrationDeadline < new Date())) {
      open.push({ ...base, reasons: await eligibilityOf(d, userId) })
    }
  }
  return { mine, open }
}

async function hasPendingRound(userId: string, driveId: string) {
  const n = await prisma.mockRoundResult.count({
    where: { outcome: 'PENDING', registration: { userId, driveId }, round: { evaluatedAt: null } },
  })
  return n > 0
}

/** One drive, round by round. */
export async function getStudentDriveJourney(userId: string, orgId: string, driveId: string) {
  const drive = await prisma.mockDrive.findFirst({
    where: { id: driveId, orgId, OR: [{ status: { in: [...VISIBLE] } }, { status: 'ARCHIVED', registrations: { some: { userId } } }] },
    include: {
      targets: { include: { department: { select: { code: true } } } },
      rounds: { orderBy: { order: 'asc' }, include: { assessment: { select: { title: true, durationMinutes: true } } } },
      registrations: { where: { userId }, include: { roundResults: true } },
    },
  })
  if (!drive) throw new NotFoundError('Mock drive not found')
  const reg = drive.registrations[0] ?? null
  const assignments = reg
    ? await prisma.assessmentAssignment.findMany({
        where: { userId, assessmentId: { in: drive.rounds.map((r) => r.assessmentId) } },
        select: { assessmentId: true, token: true, status: true },
      })
    : []
  const asg = new Map(assignments.map((a) => [a.assessmentId, a]))

  const rounds = drive.rounds.map((r) => {
    const rr = reg?.roundResults.find((x) => x.roundId === r.id) ?? null
    const a = asg.get(r.assessmentId)
    let state: RoundState
    if (rr?.outcome === 'SHORTLISTED') state = 'CLEARED'
    else if (rr?.outcome === 'ELIMINATED') state = 'NOT_SHORTLISTED'
    else if (rr && a && (a.status === 'INVITED' || a.status === 'STARTED')) state = 'TAKE_NOW'
    else if (rr) state = 'AWAITING_RESULT'
    else if (reg && !reg.eliminated && reg.currentRound === r.order - 1) state = 'UPCOMING'
    else state = 'LOCKED'
    return {
      id: r.id,
      order: r.order,
      name: r.name,
      test: r.assessment.title,
      durationMinutes: r.assessment.durationMinutes,
      cutoff: r.cutoffScore,
      scheduledAt: r.scheduledAt,
      state,
      score: rr?.score ?? null,
      note: rr?.overrideReason ?? null,
      token: state === 'TAKE_NOW' ? a?.token ?? null : null,
    }
  })

  return {
    drive: {
      id: drive.id,
      title: drive.title,
      description: drive.description,
      mode: drive.mode,
      employerName: drive.employerName,
      employerLogo: drive.employerLogo,
      roleTitle: drive.roleTitle,
      roleCtc: drive.roleCtc,
      status: drive.status,
      startDate: drive.startDate,
      endDate: drive.endDate,
      registrationDeadline: drive.registrationDeadline,
      departments: drive.targets.map((t) => t.department.code),
      batchYears: drive.batchYears,
      minCgpa: drive.minCgpa,
    },
    registered: Boolean(reg),
    eliminated: reg?.eliminated ?? false,
    finalist: Boolean(reg && (drive.status === 'COMPLETED' || drive.status === 'ARCHIVED') && !reg.eliminated && reg.currentRound === drive.rounds.length),
    canRegister: !reg && drive.status === 'REGISTRATION_OPEN' && !(drive.registrationDeadline && drive.registrationDeadline < new Date()),
    canWithdraw: Boolean(reg) && (drive.status === 'REGISTRATION_OPEN' || drive.status === 'SCHEDULED'),
    reasons: reg ? [] : await eligibilityOf(drive, userId),
    rounds,
  }
}

/** Rounds waiting for the student right now (dashboard nudges). */
export async function getPendingDriveActions(userId: string, orgId: string) {
  const rows = await prisma.mockRoundResult.findMany({
    where: { outcome: 'PENDING', registration: { userId, drive: { orgId, status: 'IN_PROGRESS' } }, round: { evaluatedAt: null } },
    select: { round: { select: { name: true, assessmentId: true, drive: { select: { id: true, title: true } } } } },
  })
  if (rows.length === 0) return []
  const open = await prisma.assessmentAssignment.findMany({
    where: { userId, assessmentId: { in: rows.map((r) => r.round.assessmentId) }, status: { in: ['INVITED', 'STARTED'] } },
    select: { assessmentId: true, token: true },
  })
  const tok = new Map(open.map((o) => [o.assessmentId, o.token]))
  return rows
    .filter((r) => tok.has(r.round.assessmentId))
    .map((r) => ({ driveId: r.round.drive.id, driveTitle: r.round.drive.title, roundName: r.round.name, token: tok.get(r.round.assessmentId)! }))
}
