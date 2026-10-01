import 'server-only'

import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'

import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/validators/contact'

/**
 * Departments + HOD assignment — College Admin (MANAGE_OWN_ORG) only.
 *
 * An HOD is a User with role COLLEGE_HOD who heads one or more departments
 * (DepartmentHead rows). The College Admin decides how many. Removing an
 * HOD's last department leaves the role in place but the scope empty — they
 * see nothing until reassigned (default deny).
 */

export async function listDepartments(orgId: string) {
  const [departments, unassigned, org] = await Promise.all([
    prisma.department.findMany({
      where: { orgId },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        heads: {
          orderBy: { assignedAt: 'asc' },
          select: { user: { select: { id: true, name: true, email: true, firebaseUid: true } } },
        },
        _count: { select: { members: { where: { user: { role: 'STUDENT' } } }, assessments: true, batches: true } },
      },
    }),
    prisma.organizationMember.count({ where: { orgId, departmentId: null, user: { role: 'STUDENT' } } }),
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { studentsPickDepartment: true } }),
  ])
  return { departments, unassigned, studentsPickDepartment: org.studentsPickDepartment }
}

function clean(input: { name?: unknown; code?: unknown }) {
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : ''
  const code = typeof input.code === 'string' ? input.code.trim().toUpperCase().replace(/\s+/g, '') : ''
  if (name.length < 2 || name.length > 100) throw new ValidationError('Name must be 2–100 characters')
  if (!/^[A-Z0-9&.-]{2,12}$/.test(code)) throw new ValidationError('Code must be 2–12 letters/numbers, e.g. CSE or ECE')
  return { name, code }
}

function uniqueGuard(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new ValidationError('A department with that name or code already exists')
  }
  throw e
}

export async function createDepartment(orgId: string, input: { name?: unknown; code?: unknown }) {
  const data = clean(input)
  return prisma.department.create({ data: { orgId, ...data } }).catch(uniqueGuard)
}

async function assertDept(orgId: string, id: string) {
  const d = await prisma.department.findFirst({ where: { id, orgId }, select: { id: true } })
  if (!d) throw new NotFoundError('Department not found')
}

export async function updateDepartment(orgId: string, id: string, input: { name?: unknown; code?: unknown }) {
  await assertDept(orgId, id)
  return prisma.department.update({ where: { id }, data: clean(input) }).catch(uniqueGuard)
}

/** Students become Unassigned; its tests and batches become college-wide. */
export async function deleteDepartment(orgId: string, id: string) {
  await assertDept(orgId, id)
  await prisma.department.delete({ where: { id } })
}

export async function setStudentsPickDepartment(orgId: string, value: boolean) {
  await prisma.organization.update({ where: { id: orgId }, data: { studentsPickDepartment: value } })
}

/**
 * Make `email` an HOD of this department. Existing account: a student (e.g.
 * faculty who self-signed-up) is promoted; an HOD gains another department;
 * other staff roles are refused rather than silently changed. New address:
 * a pending HOD account the person claims on first sign-in.
 */
export async function assignHead(orgId: string, departmentId: string, rawEmail: string) {
  await assertDept(orgId, departmentId)
  const email = normalizeEmail(rawEmail)
  if (!email) throw new ValidationError('Enter a valid email address')

  let user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
  if (user && user.role !== 'STUDENT' && user.role !== 'COLLEGE_HOD') {
    throw new ForbiddenError('That account already has a staff role — it can’t also be made an HOD here')
  }
  if (!user) {
    user = await prisma.user.create({
      data: { email, firebaseUid: `pending:${randomUUID()}`, role: 'COLLEGE_HOD' },
      select: { id: true, role: true },
    })
  } else if (user.role === 'STUDENT') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'COLLEGE_HOD' } })
  }
  // HODs need college membership; as staff they don't sit in a student department.
  await prisma.organizationMember.upsert({
    where: { userId_orgId: { userId: user.id, orgId } },
    create: { orgId, userId: user.id, role: 'MEMBER' },
    update: { departmentId: null },
  })
  await prisma.departmentHead.upsert({
    where: { departmentId_userId: { departmentId, userId: user.id } },
    create: { departmentId, userId: user.id },
    update: {},
  })
  return { userId: user.id }
}

export async function removeHead(orgId: string, departmentId: string, userId: string) {
  await assertDept(orgId, departmentId)
  await prisma.departmentHead.deleteMany({ where: { departmentId, userId } })
}

/** Departments a student may pick at registration (empty when the college assigns them). */
export async function pickableDepartments(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { studentsPickDepartment: true } })
  if (!org?.studentsPickDepartment) return []
  return prisma.department.findMany({ where: { orgId }, orderBy: { code: 'asc' }, select: { id: true, name: true, code: true } })
}
