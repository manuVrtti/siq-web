import 'server-only'

import { Prisma } from '@prisma/client'

import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { memberWhere, type Scope } from '@/lib/auth/scope'
import { deleteFile, getSignedUrl, uploadFile } from '@/lib/storage'
import { normalizePhone } from '@/lib/validators/contact'
import type {
  ProfileBasicsInput,
  ProfileSection,
  RegistrationInput,
} from '@/lib/validators/profile'
import type { CurrentUser } from '@/types/auth'

/**
 * Candidate profile — the student's own record, ABtalks-style.
 *
 * Owned by the candidate; readable by managers of any college the candidate
 * belongs to (and SUPER_ADMIN). Never readable by other students.
 */

export const RESUME_BUCKET = 'resumes'
export const RESUME_MAX_BYTES = 5 * 1024 * 1024

const sectionsInclude = {
  education: { orderBy: { order: 'asc' } },
  experience: { orderBy: { order: 'asc' } },
  projects: { orderBy: { order: 'asc' } },
  achievements: { orderBy: { order: 'asc' } },
} satisfies Prisma.CandidateProfileInclude

export async function getProfile(userId: string) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: true },
    }),
    prisma.candidateProfile.findUnique({ where: { userId }, include: sectionsInclude }),
  ])
  if (!user) throw new NotFoundError('User not found')
  return { user, profile }
}

export type FullProfile = Awaited<ReturnType<typeof getProfile>>

/** Registration gate: a student must finish the registration step once. */
export async function isRegistered(userId: string): Promise<boolean> {
  const p = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { completedAt: true },
  })
  return Boolean(p?.completedAt)
}

async function setPhone(userId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone)
  if (!phone) throw new ValidationError('Enter a valid 10-digit mobile number')
  try {
    await prisma.user.update({ where: { id: userId }, data: { phone } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ValidationError('That phone number is already linked to another account')
    }
    throw e
  }
}

/**
 * Self sign-up: attach the student to the college whose `domain` matches
 * their VERIFIED email. Only an exact, unambiguous match joins — two
 * colleges sharing a domain, or an unverified email, joins nothing.
 * Returns the org joined, if any.
 */
/** The single college whose domain matches this email, if exactly one does. */
export async function collegeForEmail(email: string | null) {
  const domain = email?.split('@')[1]?.toLowerCase()
  if (!domain) return null
  const colleges = await prisma.organization.findMany({
    where: { type: 'COLLEGE', domain: { equals: domain, mode: 'insensitive' } },
    select: { id: true, name: true, slug: true },
    take: 2,
  })
  return colleges.length === 1 ? colleges[0]! : null
}

async function joinCollegeByEmailDomain(user: CurrentUser, emailVerified: boolean) {
  if (!emailVerified || !user.email) return null
  const org = await collegeForEmail(user.email)
  if (!org) return null
  await prisma.organizationMember.createMany({
    data: [{ userId: user.id, orgId: org.id }],
    skipDuplicates: true,
  })
  return org
}

export async function register(
  user: CurrentUser,
  input: RegistrationInput,
  opts: { emailVerified: boolean },
) {
  await setPhone(user.id, input.phone)
  await prisma.user.update({ where: { id: user.id }, data: { name: input.name } })
  const data = {
    degree: input.degree,
    branch: input.branch,
    graduationYear: input.graduationYear,
    rollNumber: input.rollNumber ?? null,
  }
  await prisma.candidateProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data, completedAt: new Date() },
    update: { ...data, completedAt: new Date() },
  })

  const memberships = await prisma.organizationMember.count({ where: { userId: user.id } })
  const joined = memberships === 0 ? await joinCollegeByEmailDomain(user, opts.emailVerified) : null

  // Department choice: only into a department of a college the student is
  // in, only where that college lets students choose, and only if the
  // college hasn't already placed them.
  if (input.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { orgId: true, org: { select: { studentsPickDepartment: true } } },
    })
    if (dept?.org.studentsPickDepartment) {
      await prisma.organizationMember.updateMany({
        where: { userId: user.id, orgId: dept.orgId, departmentId: null },
        data: { departmentId: input.departmentId },
      })
    }
  }
  return { joined }
}

export async function updateBasics(userId: string, input: ProfileBasicsInput) {
  const { name, ...rest } = input
  if (name) await prisma.user.update({ where: { id: userId }, data: { name } })
  // `undefined` = field not sent (leave it); `null` = cleared.
  const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
  return prisma.candidateProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
}

/** Replace a repeating section wholesale, in the order given. */
export async function replaceSection(userId: string, section: ProfileSection, items: unknown[]) {
  const profile = await prisma.candidateProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  })
  const rows = items.map((item, order) => ({ ...(item as object), profileId: profile.id, order }))

  await prisma.$transaction(async (tx) => {
    switch (section) {
      case 'education':
        await tx.candidateEducation.deleteMany({ where: { profileId: profile.id } })
        await tx.candidateEducation.createMany({ data: rows as Prisma.CandidateEducationCreateManyInput[] })
        break
      case 'experience':
        await tx.candidateExperience.deleteMany({ where: { profileId: profile.id } })
        await tx.candidateExperience.createMany({ data: rows as Prisma.CandidateExperienceCreateManyInput[] })
        break
      case 'projects':
        await tx.candidateProject.deleteMany({ where: { profileId: profile.id } })
        await tx.candidateProject.createMany({ data: rows as Prisma.CandidateProjectCreateManyInput[] })
        break
      case 'achievements':
        await tx.candidateAchievement.deleteMany({ where: { profileId: profile.id } })
        await tx.candidateAchievement.createMany({ data: rows as Prisma.CandidateAchievementCreateManyInput[] })
        break
    }
  })
}

/* ---- résumé ------------------------------------------------------------ */

export async function saveResume(userId: string, file: { bytes: ArrayBuffer; name: string; type: string }) {
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    throw new ValidationError('Upload your résumé as a PDF')
  }
  if (file.bytes.byteLength > RESUME_MAX_BYTES) throw new ValidationError('Résumé must be 5 MB or smaller')
  // Real PDF magic bytes — a renamed .exe doesn't pass.
  const head = new Uint8Array(file.bytes.slice(0, 5))
  if (String.fromCharCode(...head) !== '%PDF-') throw new ValidationError('That file is not a valid PDF')

  const path = `users/${userId}/resume.pdf`
  await uploadFile(RESUME_BUCKET, path, Buffer.from(file.bytes), 'application/pdf')
  return prisma.candidateProfile.upsert({
    where: { userId },
    create: { userId, resumePath: path, resumeFileName: file.name.slice(0, 200), resumeUploadedAt: new Date() },
    update: { resumePath: path, resumeFileName: file.name.slice(0, 200), resumeUploadedAt: new Date() },
  })
}

export async function removeResume(userId: string) {
  const p = await prisma.candidateProfile.findUnique({ where: { userId }, select: { resumePath: true } })
  if (p?.resumePath) {
    await deleteFile(RESUME_BUCKET, p.resumePath).catch(() => undefined)
    await prisma.candidateProfile.update({
      where: { userId },
      data: { resumePath: null, resumeFileName: null, resumeUploadedAt: null },
    })
  }
}

export async function resumeDownloadUrl(userId: string): Promise<string> {
  const p = await prisma.candidateProfile.findUnique({ where: { userId }, select: { resumePath: true } })
  if (!p?.resumePath) throw new NotFoundError('No résumé uploaded')
  return getSignedUrl(RESUME_BUCKET, p.resumePath, 120)
}

/* ---- access ------------------------------------------------------------ */

/**
 * May `viewer` see `candidateId`'s profile? Themselves, SUPER_ADMIN, a
 * College Admin / Recruiter who shares a college with the candidate, or an
 * HOD who heads the candidate's department in that college.
 */
export async function canViewProfile(viewer: CurrentUser, candidateId: string): Promise<boolean> {
  if (viewer.id === candidateId) return true
  if (viewer.role === 'SUPER_ADMIN') return true
  if (viewer.role === 'COLLEGE_HOD') {
    const inDept = await prisma.organizationMember.count({
      where: { userId: candidateId, org: { status: 'ACTIVE' }, department: { heads: { some: { userId: viewer.id } } } },
    })
    return inDept > 0
  }
  if (viewer.role !== 'COLLEGE_ADMIN' && viewer.role !== 'RECRUITER') return false
  const shared = await prisma.organizationMember.count({
    where: {
      userId: candidateId,
      org: { status: 'ACTIVE', members: { some: { userId: viewer.id } } },
    },
  })
  return shared > 0
}

/**
 * A candidate as a manager of the scope's org sees them: profile + this
 * org's exam history + batches. NotFound unless the user is a STUDENT
 * member in scope (never reveal whether an id exists elsewhere).
 */
export async function getCandidateForManager(scope: Scope, userId: string) {
  const orgId = scope.orgId
  const member = await prisma.organizationMember.findFirst({
    where: { userId, ...memberWhere(scope) },
    select: { user: { select: { role: true } }, department: { select: { id: true, code: true, name: true } } },
  })
  if (!member || member.user.role !== 'STUDENT') throw new NotFoundError('Candidate not found')

  const [full, results, assignments, batches] = await Promise.all([
    getProfile(userId),
    prisma.result.findMany({
      where: { status: { not: 'SUPERSEDED' as const }, userId, assessment: { orgId } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        percentage: true,
        totalScore: true,
        maxScore: true,
        passed: true,
        createdAt: true,
        assessment: { select: { id: true, title: true } },
      },
    }),
    prisma.assessmentAssignment.findMany({
      where: { userId, assessment: { orgId }, status: { in: ['INVITED', 'STARTED'] } },
      select: { id: true, status: true, assessment: { select: { id: true, title: true } } },
    }),
    prisma.batchMember.findMany({
      where: { userId, batch: { orgId } },
      select: { batch: { select: { id: true, name: true } } },
    }),
  ])
  return { ...full, department: member.department, results, pending: assignments, batches: batches.map((b) => b.batch) }
}

/* ---- completeness ------------------------------------------------------ */

export type CompletenessItem = { key: string; label: string; done: boolean; weight: number; section: string }

/**
 * Weighted checklist → a 0–100 score plus the next things to fill in. The
 * weights favour what placement cells filter on (academics, résumé) over
 * nice-to-haves.
 */
export function computeCompleteness(p: FullProfile): { percent: number; items: CompletenessItem[] } {
  const pr = p.profile
  const items: CompletenessItem[] = [
    { key: 'name', label: 'Add your full name', done: Boolean(p.user.name), weight: 5, section: 'basics' },
    { key: 'phone', label: 'Add your phone number', done: Boolean(p.user.phone), weight: 5, section: 'basics' },
    { key: 'headline', label: 'Write a headline', done: Boolean(pr?.headline), weight: 5, section: 'basics' },
    { key: 'about', label: 'Write a short intro', done: Boolean(pr?.about), weight: 5, section: 'basics' },
    { key: 'academics', label: 'Add your degree and branch', done: Boolean(pr?.degree && pr.branch && pr.graduationYear), weight: 10, section: 'academics' },
    { key: 'cgpa', label: 'Add your CGPA', done: pr?.cgpa != null, weight: 10, section: 'academics' },
    { key: 'school', label: 'Add 10th & 12th scores', done: pr?.tenthPercent != null && pr.twelfthPercent != null, weight: 5, section: 'academics' },
    { key: 'education', label: 'Add your education', done: (pr?.education.length ?? 0) > 0, weight: 5, section: 'education' },
    { key: 'skills', label: 'Add 5 skills', done: (pr?.skills.length ?? 0) >= 5, weight: 10, section: 'skills' },
    { key: 'projects', label: 'Add a project', done: (pr?.projects.length ?? 0) > 0, weight: 10, section: 'projects' },
    { key: 'experience', label: 'Add an internship', done: (pr?.experience.length ?? 0) > 0, weight: 5, section: 'experience' },
    { key: 'links', label: 'Link LinkedIn or GitHub', done: Boolean(pr?.linkedinUrl || pr?.githubUrl), weight: 5, section: 'links' },
    { key: 'resume', label: 'Upload your résumé', done: Boolean(pr?.resumePath), weight: 15, section: 'links' },
    { key: 'preferences', label: 'Pick roles you want', done: (pr?.preferredRoles.length ?? 0) > 0, weight: 5, section: 'preferences' },
  ]
  const total = items.reduce((n, i) => n + i.weight, 0)
  const got = items.reduce((n, i) => n + (i.done ? i.weight : 0), 0)
  return { percent: Math.round((got / total) * 100), items }
}
