import 'server-only'

import type { MockDriveStatus, Prisma } from '@prisma/client'

import { assessmentWhere, type Scope } from '@/lib/auth/scope'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { DriveInput } from '@/lib/validators/mock-drive'

/**
 * Plan 023 — mock drive set-up.
 *
 * A drive is orchestration over ordinary assessments: rounds link existing
 * tests, cutoffs make a funnel. Who may do what:
 *   College Admin / Super Admin — any drive in the college.
 *   HOD — sees drives that include their departments (or the whole college);
 *         creates and manages only drives aimed at their own departments.
 */

export const driveInclude = {
  rounds: {
    orderBy: { order: 'asc' },
    include: { assessment: { select: { id: true, title: true, status: true, countsForAnalytics: true, durationMinutes: true, proctoringEnabled: true } } },
  },
  targets: { include: { department: { select: { id: true, code: true, name: true } } } },
  sampleCompany: { select: { id: true, name: true, logoUrl: true } },
  _count: { select: { registrations: true } },
} satisfies Prisma.MockDriveInclude

/** Drives this scope may see. */
export function driveWhere(scope: Scope): Prisma.MockDriveWhereInput {
  if (scope.all) return { orgId: scope.orgId }
  return {
    orgId: scope.orgId,
    OR: [{ targets: { none: {} } }, { targets: { some: { departmentId: { in: scope.departmentIds } } } }],
  }
}

/** May this scope change the drive? HODs only when every target is theirs. */
export function canManageDrive(scope: Scope, drive: { targets: { departmentId: string }[] }) {
  if (scope.all) return true
  return drive.targets.length > 0 && drive.targets.every((t) => scope.departmentIds.includes(t.departmentId))
}

export async function getDrive(scope: Scope, id: string) {
  const drive = await prisma.mockDrive.findFirst({ where: { id, ...driveWhere(scope) }, include: driveInclude })
  if (!drive) throw new NotFoundError('Mock drive not found')
  return drive
}

/** Load for a change: visible AND manageable, else 403. */
export async function getDriveForManage(scope: Scope, id: string) {
  const drive = await getDrive(scope, id)
  if (!canManageDrive(scope, drive)) throw new ForbiddenError('Only a College Admin can change a drive that includes other departments')
  return drive
}

export async function listDrives(scope: Scope, status?: MockDriveStatus) {
  return prisma.mockDrive.findMany({
    where: { ...driveWhere(scope), ...(status ? { status } : {}) },
    orderBy: [{ updatedAt: 'desc' }],
    include: driveInclude,
  })
}

async function resolveTargets(scope: Scope, departmentIds: string[]) {
  const ids = [...new Set(departmentIds)]
  if (!scope.all) {
    if (ids.length === 0) throw new ForbiddenError('Choose your department(s) — only a College Admin can run a college-wide drive')
    if (ids.some((d) => !scope.departmentIds.includes(d))) throw new ForbiddenError('You can only target departments you head')
  }
  if (ids.length) {
    const n = await prisma.department.count({ where: { id: { in: ids }, orgId: scope.orgId } })
    if (n !== ids.length) throw new NotFoundError('Department not found')
  }
  return ids
}

async function resolveEmployer(input: DriveInput) {
  if (input.mode !== 'SAMPLE_COMPANY') return { employerName: input.employerName!, sampleCompanyOrgId: null, employerLogo: input.employerLogo ?? null }
  const company = await prisma.organization.findFirst({
    where: { id: input.sampleCompanyOrgId!, type: 'COMPANY', status: 'ACTIVE' },
    select: { id: true, name: true, logoUrl: true },
  })
  if (!company) throw new ValidationError('That sample company isn’t available')
  return { employerName: input.employerName || company.name, sampleCompanyOrgId: company.id, employerLogo: input.employerLogo || company.logoUrl || null }
}

export async function createDrive(scope: Scope, userId: string, input: DriveInput) {
  const departmentIds = await resolveTargets(scope, input.departmentIds)
  const employer = await resolveEmployer(input)
  return prisma.mockDrive.create({
    data: {
      orgId: scope.orgId,
      createdById: userId,
      mode: input.mode,
      title: input.title,
      description: input.description ?? null,
      ...employer,
      roleTitle: input.roleTitle,
      roleCtc: input.roleCtc ?? null,
      batchYears: [...new Set(input.batchYears)].sort(),
      minCgpa: input.minCgpa ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      registrationDeadline: input.registrationDeadline,
      targets: { create: departmentIds.map((departmentId) => ({ departmentId })) },
    },
    include: driveInclude,
  })
}

const LOCKED: MockDriveStatus[] = ['COMPLETED', 'ARCHIVED']
const STARTED: MockDriveStatus[] = ['IN_PROGRESS', 'COMPLETED', 'ARCHIVED']

export async function updateDrive(scope: Scope, id: string, input: DriveInput) {
  const drive = await getDriveForManage(scope, id)
  if (LOCKED.includes(drive.status)) throw new ValidationError('A finished drive can’t be edited')
  const departmentIds = await resolveTargets(scope, input.departmentIds)
  const sameTargets =
    departmentIds.length === drive.targets.length && departmentIds.every((d) => drive.targets.some((t) => t.departmentId === d))
  const sameEligibility =
    sameTargets &&
    (input.minCgpa ?? null) === drive.minCgpa &&
    JSON.stringify([...new Set(input.batchYears)].sort()) === JSON.stringify([...drive.batchYears].sort())
  if (STARTED.includes(drive.status) && !sameEligibility) {
    throw new ValidationError('Eligibility can’t change once the drive has started')
  }
  const employer = await resolveEmployer(input)
  return prisma.$transaction(async (tx) => {
    if (!sameTargets) {
      await tx.mockDriveTarget.deleteMany({ where: { driveId: id } })
      await tx.mockDriveTarget.createMany({ data: departmentIds.map((departmentId) => ({ driveId: id, departmentId })) })
    }
    return tx.mockDrive.update({
      where: { id },
      data: {
        mode: input.mode,
        title: input.title,
        description: input.description ?? null,
        ...employer,
        roleTitle: input.roleTitle,
        roleCtc: input.roleCtc ?? null,
        batchYears: [...new Set(input.batchYears)].sort(),
        minCgpa: input.minCgpa ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        registrationDeadline: input.registrationDeadline,
      },
      include: driveInclude,
    })
  })
}

export async function deleteDrive(scope: Scope, id: string) {
  const drive = await getDriveForManage(scope, id)
  if (drive.status !== 'DRAFT') throw new ValidationError('Only a draft drive can be deleted — archive it instead')
  await prisma.mockDrive.delete({ where: { id } })
}

/* ---- rounds ------------------------------------------------------------ */

export async function addRound(
  scope: Scope,
  driveId: string,
  input: { assessmentId: string; name?: string; cutoffScore?: number | null; scheduledAt?: Date | null },
) {
  const drive = await getDriveForManage(scope, driveId)
  if (STARTED.includes(drive.status)) throw new ValidationError('Rounds can’t be added once the drive has started')
  const assessment = await prisma.assessment.findFirst({ where: { id: input.assessmentId, ...assessmentWhere(scope) }, select: { id: true, title: true } })
  if (!assessment) throw new NotFoundError('Test not found')
  if (drive.rounds.some((r) => r.assessmentId === assessment.id)) throw new ValidationError('That test is already a round of this drive')
  if (drive.rounds.length >= 10) throw new ValidationError('A drive can have at most 10 rounds')
  const order = (drive.rounds.at(-1)?.order ?? 0) + 1
  return prisma.mockDriveRound.create({
    data: {
      driveId,
      order,
      assessmentId: assessment.id,
      name: input.name || `Round ${order}: ${assessment.title}`,
      cutoffScore: input.cutoffScore ?? null,
      scheduledAt: input.scheduledAt ?? null,
    },
  })
}

async function getRoundForManage(scope: Scope, roundId: string) {
  const round = await prisma.mockDriveRound.findUnique({ where: { id: roundId }, select: { id: true, driveId: true, order: true, activatedAt: true, evaluatedAt: true } })
  if (!round) throw new NotFoundError('Round not found')
  const drive = await getDriveForManage(scope, round.driveId)
  return { round, drive }
}

export async function updateRound(scope: Scope, roundId: string, input: { name?: string; cutoffScore?: number | null; scheduledAt?: Date | null }) {
  const { round } = await getRoundForManage(scope, roundId)
  if (round.evaluatedAt && input.cutoffScore !== undefined) throw new ValidationError('This round has been evaluated — its cutoff is final')
  return prisma.mockDriveRound.update({
    where: { id: roundId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.cutoffScore !== undefined && { cutoffScore: input.cutoffScore }),
      ...(input.scheduledAt !== undefined && { scheduledAt: input.scheduledAt }),
    },
  })
}

export async function removeRound(scope: Scope, roundId: string) {
  const { round, drive } = await getRoundForManage(scope, roundId)
  if (STARTED.includes(drive.status) || round.activatedAt) throw new ValidationError('Rounds can’t be removed once the drive has started')
  await prisma.$transaction(async (tx) => {
    await tx.mockDriveRound.delete({ where: { id: roundId } })
    // Close the gap; ascending so the (driveId, order) key never collides.
    const later = await tx.mockDriveRound.findMany({ where: { driveId: drive.id, order: { gt: round.order } }, orderBy: { order: 'asc' } })
    for (const r of later) await tx.mockDriveRound.update({ where: { id: r.id }, data: { order: r.order - 1 } })
  })
}

export async function moveRound(scope: Scope, roundId: string, direction: 'up' | 'down') {
  const { round, drive } = await getRoundForManage(scope, roundId)
  if (STARTED.includes(drive.status)) throw new ValidationError('Rounds can’t be reordered once the drive has started')
  const other = drive.rounds.find((r) => r.order === round.order + (direction === 'up' ? -1 : 1))
  if (!other) return
  await prisma.$transaction([
    prisma.mockDriveRound.update({ where: { id: round.id }, data: { order: -1 } }),
    prisma.mockDriveRound.update({ where: { id: other.id }, data: { order: round.order } }),
    prisma.mockDriveRound.update({ where: { id: round.id }, data: { order: other.order } }),
  ])
}

/* ---- lifecycle --------------------------------------------------------- */

/** What stops this drive from going live, as a checklist. */
export function driveBlockers(drive: Awaited<ReturnType<typeof getDrive>>): string[] {
  const out: string[] = []
  if (drive.rounds.length === 0) out.push('Add at least one round')
  const unpublished = drive.rounds.filter((r) => r.assessment.status !== 'PUBLISHED')
  if (unpublished.length) out.push(`Publish the test${unpublished.length === 1 ? '' : 's'} for ${unpublished.map((r) => `round ${r.order}`).join(', ')}`)
  // Plan 018b — every round is identity-checked and camera-proctored.
  const unproctored = drive.rounds.filter((r) => !r.assessment.proctoringEnabled)
  if (unproctored.length) out.push(`Turn on proctoring for ${unproctored.map((r) => `round ${r.order}`).join(', ')} (identity check + camera)`)
  if (drive.mode === 'SAMPLE_COMPANY' && !drive.sampleCompanyOrgId) out.push('The sample company is no longer available')
  return out
}

const NEXT: Record<MockDriveStatus, MockDriveStatus[]> = {
  DRAFT: ['SCHEDULED', 'REGISTRATION_OPEN'],
  SCHEDULED: ['REGISTRATION_OPEN', 'DRAFT'],
  REGISTRATION_OPEN: ['IN_PROGRESS', 'SCHEDULED'],
  IN_PROGRESS: [], // → COMPLETED only through completeDrive
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
}

export async function updateStatus(scope: Scope, id: string, next: MockDriveStatus) {
  const drive = await getDriveForManage(scope, id)
  if (!NEXT[drive.status].includes(next)) {
    throw new ValidationError(
      drive.status === 'IN_PROGRESS' ? 'Finish the drive with “Complete drive”' : `A ${drive.status.toLowerCase().replace('_', ' ')} drive can’t move to ${next.toLowerCase().replace('_', ' ')}`,
    )
  }
  if (next !== 'DRAFT') {
    const blockers = driveBlockers(drive)
    if (blockers.length) throw new ValidationError(`Not ready: ${blockers.join('; ')}`)
  }
  if (next === 'IN_PROGRESS' && drive._count.registrations === 0) throw new ValidationError('Register at least one student before starting')
  return prisma.mockDrive.update({ where: { id }, data: { status: next }, include: driveInclude })
}
