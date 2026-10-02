import 'server-only'

import { studentWhere, type Scope } from '@/lib/auth/scope'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { getDrive, getDriveForManage } from '@/services/mock-drives'

/**
 * Plan 023 — who may enter a drive, and getting them in.
 *
 * Eligible = a student of the drive's college, in a target department (none
 * = every department), in one of its batches (none = any), with CGPA at or
 * above the minimum. A missing batch or CGPA on the profile fails a rule
 * that needs it — the student is told to complete their profile.
 */

type DriveRules = {
  orgId: string
  batchYears: number[]
  minCgpa: number | null
  targets: { departmentId: string }[]
}

export async function eligibilityOf(drive: DriveRules, userId: string): Promise<string[]> {
  const member = await prisma.organizationMember.findFirst({
    where: { orgId: drive.orgId, userId, user: { role: 'STUDENT' } },
    select: { departmentId: true, user: { select: { candidateProfile: { select: { graduationYear: true, cgpa: true } } } } },
  })
  if (!member) return ['Not a student of this college']
  const reasons: string[] = []
  if (drive.targets.length && !drive.targets.some((t) => t.departmentId === member.departmentId)) {
    reasons.push(member.departmentId ? 'Your department isn’t part of this drive' : 'You haven’t been placed in a department yet')
  }
  const year = member.user.candidateProfile?.graduationYear ?? null
  if (drive.batchYears.length && (year === null || !drive.batchYears.includes(year))) {
    reasons.push(year === null ? 'Add your graduation year to your profile' : `Open to the ${drive.batchYears.join(', ')} batch${drive.batchYears.length === 1 ? '' : 'es'}`)
  }
  const cgpa = member.user.candidateProfile?.cgpa ?? null
  if (drive.minCgpa !== null && (cgpa === null || cgpa < drive.minCgpa)) {
    reasons.push(cgpa === null ? 'Add your CGPA to your profile' : `Needs a CGPA of ${drive.minCgpa} or more`)
  }
  return reasons
}

/** A student enters an open drive themselves. Idempotent. */
export async function registerStudent(driveId: string, userId: string) {
  const drive = await prisma.mockDrive.findUnique({ where: { id: driveId }, include: { targets: true } })
  if (!drive) throw new NotFoundError('Mock drive not found')
  if (drive.status !== 'REGISTRATION_OPEN') throw new ValidationError('Registration for this drive isn’t open')
  if (drive.registrationDeadline && drive.registrationDeadline < new Date()) throw new ValidationError('Registration for this drive has closed')
  const reasons = await eligibilityOf(drive, userId)
  if (reasons.length) throw new ValidationError(reasons.join(' · '))
  return prisma.mockDriveRegistration.upsert({
    where: { driveId_userId: { driveId, userId } },
    create: { driveId, userId, source: 'SELF' },
    update: {},
  })
}

/** Withdraw before the drive starts. */
export async function withdrawStudent(driveId: string, userId: string) {
  const drive = await prisma.mockDrive.findUnique({ where: { id: driveId }, select: { status: true } })
  if (!drive) throw new NotFoundError('Mock drive not found')
  if (drive.status !== 'REGISTRATION_OPEN' && drive.status !== 'SCHEDULED') throw new ValidationError('The drive has started — you can’t withdraw now')
  await prisma.mockDriveRegistration.deleteMany({ where: { driveId, userId } })
}

/** Students in scope who pass the drive's rules (and aren't registered yet). */
export async function getEligibleStudents(scope: Scope, driveId: string) {
  const drive = await getDrive(scope, driveId)
  const students = await prisma.user.findMany({
    where: {
      ...studentWhere(scope),
      memberships: {
        some: {
          orgId: scope.orgId,
          ...(drive.targets.length ? { departmentId: { in: drive.targets.map((t) => t.departmentId) } } : {}),
          ...(scope.all ? {} : { departmentId: { in: scope.departmentIds } }),
        },
      },
      ...(drive.batchYears.length || drive.minCgpa !== null
        ? {
            candidateProfile: {
              ...(drive.batchYears.length ? { graduationYear: { in: drive.batchYears } } : {}),
              ...(drive.minCgpa !== null ? { cgpa: { gte: drive.minCgpa } } : {}),
            },
          }
        : {}),
      mockRegistrations: { none: { driveId } },
    },
    select: { id: true },
  })
  return students.map((s) => s.id)
}

/** The placement cell enrols students (or everyone eligible). Ineligible ids are skipped, not forced. */
export async function bulkRegister(scope: Scope, driveId: string, userIds: string[] | 'ALL_ELIGIBLE') {
  const drive = await getDriveForManage(scope, driveId)
  if (!['DRAFT', 'SCHEDULED', 'REGISTRATION_OPEN'].includes(drive.status)) throw new ValidationError('Students can only be enrolled before the drive starts')
  const eligible = new Set(await getEligibleStudents(scope, driveId))
  const wanted = userIds === 'ALL_ELIGIBLE' ? [...eligible] : [...new Set(userIds)]
  const ok = wanted.filter((id) => eligible.has(id))
  const res = await prisma.mockDriveRegistration.createMany({
    data: ok.map((userId) => ({ driveId, userId, source: 'BULK' })),
    skipDuplicates: true,
  })
  return { registered: res.count, skipped: wanted.length - ok.length }
}

export async function listRegistrations(scope: Scope, driveId: string) {
  await getDrive(scope, driveId)
  return prisma.mockDriveRegistration.findMany({
    where: { driveId },
    orderBy: [{ eliminated: 'asc' }, { currentRound: 'desc' }, { registeredAt: 'asc' }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          memberships: { where: { orgId: scope.orgId }, select: { department: { select: { code: true } } } },
        },
      },
      roundResults: { select: { id: true, roundId: true, score: true, outcome: true, decidedById: true, overrideReason: true } },
    },
  })
}
