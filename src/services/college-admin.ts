import 'server-only'

import { prisma } from '@/lib/prisma'

/** College Admin panel overview — the health of one college at a glance. */
export async function getCollegeOverview(orgId: string) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  const student = { role: 'STUDENT' as const }
  const [admins, hods, hodsNoDept, departments, students, unassigned, studentsPending, staffPending, published, submitted7d, depts] =
    await Promise.all([
      prisma.organizationMember.count({ where: { orgId, user: { role: 'COLLEGE_ADMIN' } } }),
      prisma.organizationMember.count({ where: { orgId, user: { role: 'COLLEGE_HOD' } } }),
      prisma.organizationMember.count({ where: { orgId, user: { role: 'COLLEGE_HOD', headOf: { none: { department: { orgId } } } } } }),
      prisma.department.count({ where: { orgId } }),
      prisma.organizationMember.count({ where: { orgId, user: student } }),
      prisma.organizationMember.count({ where: { orgId, departmentId: null, user: student } }),
      prisma.organizationMember.count({ where: { orgId, user: { ...student, firebaseUid: { startsWith: 'pending:' } } } }),
      prisma.organizationMember.count({
        where: { orgId, user: { role: { in: ['COLLEGE_ADMIN', 'COLLEGE_HOD'] }, firebaseUid: { startsWith: 'pending:' } } },
      }),
      prisma.assessment.count({ where: { orgId, status: 'PUBLISHED' } }),
      prisma.assessmentAssignment.count({ where: { assessment: { orgId }, status: 'SUBMITTED', submittedAt: { gte: weekAgo } } }),
      prisma.department.findMany({
        where: { orgId },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          heads: { select: { user: { select: { name: true, email: true } } } },
          _count: { select: { members: { where: { user: student } } } },
        },
      }),
    ])
  return { admins, hods, hodsNoDept, departments, students, unassigned, studentsPending, staffPending, published, submitted7d, depts }
}
