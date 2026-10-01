import 'server-only'

import { prisma } from '@/lib/prisma'

/**
 * Super Admin console overview — platform KPIs with week-over-week deltas,
 * 14-day series for sparklines, and a "needs attention" list across every
 * college. SUPER_ADMIN only (the console layout + APIs enforce it).
 */

const DAY = 86_400_000

function dayKey(d: Date) {
  return new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10) // IST day
}

function series(dates: Date[], days: number): number[] {
  const out = new Map<string, number>()
  const now = Date.now()
  for (let i = days - 1; i >= 0; i--) out.set(dayKey(new Date(now - i * DAY)), 0)
  for (const d of dates) {
    const k = dayKey(d)
    if (out.has(k)) out.set(k, out.get(k)! + 1)
  }
  return [...out.values()]
}

export async function getPlatformDashboard() {
  const now = Date.now()
  const weekAgo = new Date(now - 7 * DAY)
  const twoWeeks = new Date(now - 14 * DAY)

  const [
    colleges,
    companies,
    byRole,
    suspended,
    signups14,
    submissions14,
    collegesNoAdmin,
    hodsNoDept,
    pendingStaff,
    recentAudit,
  ] = await Promise.all([
    prisma.organization.count({ where: { type: 'COLLEGE' } }),
    prisma.organization.count({ where: { type: 'COMPANY' } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.findMany({
      where: { suspendedAt: { not: null } },
      orderBy: { suspendedAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, suspendedAt: true },
    }),
    prisma.user.findMany({ where: { createdAt: { gte: twoWeeks } }, select: { createdAt: true } }),
    prisma.assessmentAssignment.findMany({ where: { submittedAt: { gte: twoWeeks } }, select: { submittedAt: true } }),
    prisma.organization.findMany({
      where: { type: 'COLLEGE', members: { none: { user: { role: 'COLLEGE_ADMIN', suspendedAt: null } } } },
      select: { id: true, name: true },
      take: 10,
    }),
    prisma.user.count({ where: { role: 'COLLEGE_HOD', headOf: { none: {} } } }),
    prisma.user.count({ where: { role: { in: ['COLLEGE_ADMIN', 'COLLEGE_HOD'] }, firebaseUid: { startsWith: 'pending:' } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, action: true, createdAt: true, entityType: true, user: { select: { name: true, email: true } } },
    }),
  ])

  const roles = Object.fromEntries(byRole.map((r) => [r.role, r._count._all])) as Record<string, number>
  const signupDates = signups14.map((s) => s.createdAt)
  const submitDates = submissions14.map((s) => s.submittedAt!).filter(Boolean)
  const inWeek = (ds: Date[], from: Date, to?: Date) => ds.filter((d) => d >= from && (!to || d < to)).length

  return {
    colleges,
    companies,
    roles,
    users: Object.values(roles).reduce((a, b) => a + b, 0),
    signups: { thisWeek: inWeek(signupDates, weekAgo), lastWeek: inWeek(signupDates, twoWeeks, weekAgo), series: series(signupDates, 14) },
    submissions: { thisWeek: inWeek(submitDates, weekAgo), lastWeek: inWeek(submitDates, twoWeeks, weekAgo), series: series(submitDates, 14) },
    attention: { collegesNoAdmin, hodsNoDept, pendingStaff, suspended },
    recentAudit,
  }
}
