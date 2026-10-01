import 'server-only'

import { randomUUID } from 'node:crypto'

import type { UserRole } from '@prisma/client'

import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/validators/contact'
import type { CurrentUser } from '@/types/auth'

/**
 * WHO MAY MANAGE WHOM — the single source of truth for people management.
 * (docs/roles-and-permissions.md mirrors this; keep them in sync.)
 *
 *   SUPER_ADMIN    everyone, in every organization: College Admins, HODs,
 *                  students, recruiters and other Super Admins. Only role
 *                  that can suspend accounts or grant Super Admin.
 *   COLLEGE_ADMIN  everyone inside the college(s) they belong to: other
 *                  College Admins, HODs and students. Never a Super Admin or
 *                  recruiter, and never an account that also belongs to a
 *                  different organization (a role is global — changing it
 *                  from one college would change it at the other).
 *   COLLEGE_HOD    students in the department(s) they head — enforced by
 *                  lib/auth/scope.ts on the candidate APIs, not here.
 *   RECRUITER, STUDENT   nobody.
 *
 * Guards that apply to everyone, Super Admins included:
 *   - nobody changes their own role or removes themselves (no self-lockout);
 *   - a college always keeps at least one College Admin;
 *   - the platform always keeps at least one Super Admin.
 * Every write here is audited by the calling route.
 */

export type CollegeStaffRole = 'COLLEGE_ADMIN' | 'COLLEGE_HOD'
const STAFF: readonly UserRole[] = ['COLLEGE_ADMIN', 'COLLEGE_HOD']

/** Super Admin, or a College Admin who is a member of this college. */
export async function assertCollegeAdminOf(actor: CurrentUser, orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { type: true } })
  if (!org) throw new NotFoundError('Organization not found')
  if (actor.role === 'SUPER_ADMIN') return
  if (actor.role !== 'COLLEGE_ADMIN') throw new ForbiddenError('Only College Admins can manage people here')
  const member = await prisma.organizationMember.count({ where: { orgId, userId: actor.id } })
  if (!member) throw new ForbiddenError('You do not have access to this organization')
}

/** College Admins may not touch accounts that also live in another org. */
export async function assertSoleOrg(actor: CurrentUser, orgId: string, userId: string) {
  if (actor.role === 'SUPER_ADMIN') return
  const elsewhere = await prisma.organizationMember.count({ where: { userId, NOT: { orgId } } })
  if (elsewhere) {
    throw new ForbiddenError('This account also belongs to another organization — ask a Super Admin to change it')
  }
}

async function assertNotLastAdmin(orgId: string, userId: string) {
  const admins = await prisma.organizationMember.count({
    where: { orgId, user: { role: 'COLLEGE_ADMIN', suspendedAt: null } },
  })
  const isAdmin = await prisma.organizationMember.count({ where: { orgId, userId, user: { role: 'COLLEGE_ADMIN' } } })
  if (isAdmin && admins <= 1) throw new ValidationError('A college must keep at least one College Admin — add another first')
}

async function assertDepartmentsInOrg(orgId: string, departmentIds: string[]) {
  const ids = [...new Set(departmentIds)]
  if (!ids.length) return ids
  const n = await prisma.department.count({ where: { orgId, id: { in: ids } } })
  if (n !== ids.length) throw new ValidationError('One or more departments are not in this college')
  return ids
}

/* ---- reads ------------------------------------------------------------- */

/** College Admins + HODs of a college, with the departments each HOD heads. */
export async function listCollegeStaff(orgId: string) {
  const members = await prisma.organizationMember.findMany({
    where: { orgId, user: { role: { in: [...STAFF] } } },
    orderBy: { joinedAt: 'asc' },
    select: {
      joinedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          firebaseUid: true,
          lastLoginAt: true,
          suspendedAt: true,
          headOf: { where: { department: { orgId } }, select: { department: { select: { id: true, code: true, name: true } } } },
          _count: { select: { memberships: true } },
        },
      },
    },
  })
  return members.map(({ joinedAt, user: u }) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as CollegeStaffRole,
    pending: u.firebaseUid.startsWith('pending:'),
    lastLoginAt: u.lastLoginAt,
    suspended: Boolean(u.suspendedAt),
    otherOrgs: u._count.memberships - 1,
    departments: u.headOf.map((h) => h.department),
    joinedAt,
  }))
}

/* ---- college staff writes ---------------------------------------------- */

/**
 * Add (or invite) a College Admin or HOD by email. Existing student
 * accounts are promoted; brand-new addresses get a pending account the
 * person claims on first sign-in. Super Admins and recruiters are refused.
 */
export async function addCollegeStaff(
  actor: CurrentUser,
  orgId: string,
  input: { email: string; role: CollegeStaffRole; departmentIds?: string[] },
) {
  await assertCollegeAdminOf(actor, orgId)
  const email = normalizeEmail(input.email)
  if (!email) throw new ValidationError('Enter a valid email address')
  if (!STAFF.includes(input.role)) throw new ValidationError('Role must be College Admin or HOD')
  const departmentIds = await assertDepartmentsInOrg(orgId, input.role === 'COLLEGE_HOD' ? (input.departmentIds ?? []) : [])

  let user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
  const invited = !user
  if (user) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'RECRUITER') {
      throw new ForbiddenError('That account is a Super Admin or recruiter and can’t be added as college staff')
    }
    if (user.id === actor.id) throw new ValidationError('You can’t change your own role')
    await assertSoleOrg(actor, orgId, user.id)
    if (user.role === 'COLLEGE_ADMIN' && input.role !== 'COLLEGE_ADMIN') await assertNotLastAdmin(orgId, user.id)
    await prisma.user.update({ where: { id: user.id }, data: { role: input.role } })
  } else {
    user = await prisma.user.create({
      data: { email, firebaseUid: `pending:${randomUUID()}`, role: input.role },
      select: { id: true, role: true },
    })
  }

  await prisma.$transaction([
    prisma.organizationMember.upsert({
      where: { userId_orgId: { userId: user.id, orgId } },
      // Staff don't sit in a student department.
      create: { orgId, userId: user.id, role: input.role === 'COLLEGE_ADMIN' ? 'ADMIN' : 'MEMBER' },
      update: { role: input.role === 'COLLEGE_ADMIN' ? 'ADMIN' : 'MEMBER', departmentId: null },
    }),
    // Headships in this college are replaced, never merged silently.
    prisma.departmentHead.deleteMany({ where: { userId: user.id, department: { orgId } } }),
    ...departmentIds.map((departmentId) => prisma.departmentHead.create({ data: { departmentId, userId: user!.id } })),
  ])
  return { userId: user.id, role: input.role, invited }
}

/** Switch a staff member between College Admin and HOD, and/or set an HOD's departments. */
export async function updateCollegeStaff(
  actor: CurrentUser,
  orgId: string,
  userId: string,
  input: { role?: CollegeStaffRole; departmentIds?: string[] },
) {
  await assertCollegeAdminOf(actor, orgId)
  const target = await prisma.organizationMember.findFirst({
    where: { orgId, userId, user: { role: { in: [...STAFF] } } },
    select: { user: { select: { role: true } } },
  })
  if (!target) throw new NotFoundError('Staff member not found in this college')
  const role = input.role ?? (target.user.role as CollegeStaffRole)
  if (input.role && input.role !== target.user.role) {
    if (userId === actor.id) throw new ValidationError('You can’t change your own role')
    if (!STAFF.includes(input.role)) throw new ValidationError('Role must be College Admin or HOD')
    await assertSoleOrg(actor, orgId, userId)
    if (target.user.role === 'COLLEGE_ADMIN') await assertNotLastAdmin(orgId, userId)
  }
  const departmentIds = role === 'COLLEGE_HOD' ? await assertDepartmentsInOrg(orgId, input.departmentIds ?? []) : []
  const replaceHeads = role === 'COLLEGE_ADMIN' || input.departmentIds !== undefined

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { role } }),
    prisma.organizationMember.update({
      where: { userId_orgId: { userId, orgId } },
      data: { role: role === 'COLLEGE_ADMIN' ? 'ADMIN' : 'MEMBER' },
    }),
    ...(replaceHeads
      ? [
          prisma.departmentHead.deleteMany({ where: { userId, department: { orgId } } }),
          ...departmentIds.map((departmentId) => prisma.departmentHead.create({ data: { departmentId, userId } })),
        ]
      : []),
  ])
  return { role, departmentIds }
}

/** Take a staff member out of this college (their account and other colleges are untouched). */
export async function removeCollegeStaff(actor: CurrentUser, orgId: string, userId: string) {
  await assertCollegeAdminOf(actor, orgId)
  if (userId === actor.id) throw new ValidationError('You can’t remove yourself — ask another College Admin')
  const target = await prisma.organizationMember.findFirst({
    where: { orgId, userId, user: { role: { in: [...STAFF] } } },
    select: { id: true },
  })
  if (!target) throw new NotFoundError('Staff member not found in this college')
  await assertNotLastAdmin(orgId, userId)
  await prisma.$transaction([
    prisma.departmentHead.deleteMany({ where: { userId, department: { orgId } } }),
    prisma.organizationMember.delete({ where: { id: target.id } }),
  ])
}

/* ---- Super Admin only -------------------------------------------------- */

function assertSuper(actor: CurrentUser) {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError('Only a Super Admin can do this')
}

/**
 * Global role change (People table). Keeps the side tables consistent:
 * leaving HOD drops headships; becoming College Admin marks memberships
 * ADMIN; never the last Super Admin, never yourself.
 */
export async function setRoleAsSuperAdmin(actor: CurrentUser, userId: string, role: UserRole) {
  assertSuper(actor)
  if (actor.id === userId) throw new ValidationError('You can’t change your own role')
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, memberships: { select: { orgId: true } } },
  })
  if (!target) throw new NotFoundError('User not found')
  if (target.role === role) return { from: role, to: role }
  if (target.role === 'SUPER_ADMIN') {
    const supers = await prisma.user.count({ where: { role: 'SUPER_ADMIN', suspendedAt: null } })
    if (supers <= 1) throw new ValidationError('The platform needs at least one Super Admin')
  }
  if (target.role === 'COLLEGE_ADMIN') {
    for (const m of target.memberships) await assertNotLastAdmin(m.orgId, userId)
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { role } }),
    ...(role !== 'COLLEGE_HOD' ? [prisma.departmentHead.deleteMany({ where: { userId } })] : []),
    prisma.organizationMember.updateMany({ where: { userId }, data: { role: role === 'COLLEGE_ADMIN' ? 'ADMIN' : 'MEMBER' } }),
  ])
  return { from: target.role, to: role }
}

/** Grant Super Admin by email — the account must exist (signed in at least once or imported). */
export async function grantSuperAdmin(actor: CurrentUser, rawEmail: string) {
  assertSuper(actor)
  const email = normalizeEmail(rawEmail)
  if (!email) throw new ValidationError('Enter a valid email address')
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, suspendedAt: true } })
  if (!user) throw new NotFoundError('No account with that email — ask them to sign in to SelectIQ once first')
  if (user.suspendedAt) throw new ValidationError('That account is suspended — reactivate it first')
  if (user.role === 'COLLEGE_ADMIN') {
    for (const m of await prisma.organizationMember.findMany({ where: { userId: user.id }, select: { orgId: true } })) {
      await assertNotLastAdmin(m.orgId, user.id)
    }
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } }),
    prisma.departmentHead.deleteMany({ where: { userId: user.id } }),
  ])
  return { userId: user.id, from: user.role }
}

async function firebaseUidOf(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { firebaseUid: true, role: true } })
  if (!u) throw new NotFoundError('User not found')
  return u
}

/**
 * Suspend: blocks sign-in and kills every live session now — the DB flag
 * (checked on every request), plus Firebase disable + token revocation so
 * the identity itself is frozen. Reversible; no data is deleted.
 */
export async function suspendUser(actor: CurrentUser, userId: string, reason: string | null) {
  assertSuper(actor)
  if (actor.id === userId) throw new ValidationError('You can’t suspend yourself')
  const u = await firebaseUidOf(userId)
  if (u.role === 'SUPER_ADMIN') {
    const supers = await prisma.user.count({ where: { role: 'SUPER_ADMIN', suspendedAt: null } })
    if (supers <= 1) throw new ValidationError('The platform needs at least one active Super Admin')
  }
  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: new Date(), suspendedReason: reason?.trim().slice(0, 300) || null },
  })
  if (!u.firebaseUid.startsWith('pending:')) {
    const auth = getAdminAuth()
    await auth.updateUser(u.firebaseUid, { disabled: true }).catch(() => null)
    await auth.revokeRefreshTokens(u.firebaseUid).catch(() => null)
  }
}

export async function reactivateUser(actor: CurrentUser, userId: string) {
  assertSuper(actor)
  const u = await firebaseUidOf(userId)
  await prisma.user.update({ where: { id: userId }, data: { suspendedAt: null, suspendedReason: null } })
  if (!u.firebaseUid.startsWith('pending:')) {
    await getAdminAuth().updateUser(u.firebaseUid, { disabled: false }).catch(() => null)
  }
}

/** Full picture of one person, for the Super Admin user page. */
export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      firebaseUid: true,
      createdAt: true,
      lastLoginAt: true,
      onboardedAt: true,
      suspendedAt: true,
      suspendedReason: true,
      memberships: {
        orderBy: { joinedAt: 'asc' },
        select: {
          joinedAt: true,
          role: true,
          org: { select: { id: true, name: true, slug: true, type: true } },
          department: { select: { code: true, name: true } },
        },
      },
      headOf: { select: { department: { select: { code: true, name: true, org: { select: { name: true, slug: true } } } } } },
      _count: { select: { results: true, assignments: true, createdAssessments: true, authoredQuestions: true } },
    },
  })
  if (!user) throw new NotFoundError('User not found')
  const [about, by] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityId: userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, action: true, createdAt: true, metadata: true, user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, action: true, createdAt: true, entityType: true },
    }),
  ])
  const { firebaseUid, ...rest } = user
  return { ...rest, pending: firebaseUid.startsWith('pending:'), auditAbout: about, auditBy: by }
}
