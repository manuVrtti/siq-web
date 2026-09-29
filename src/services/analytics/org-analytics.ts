import 'server-only'

import { cache } from 'react'

import { prisma } from '@/lib/prisma'
import { round } from '@/services/analytics/stats'

/**
 * Plan 019 — org-level and platform-level overview metrics.
 *
 * Everything here is scoped by `orgId` through the assessment relation, so a
 * manager only ever sees their own tenant. Queries run in parallel and use
 * Prisma aggregates rather than loading rows, so the dashboard stays cheap as
 * result volume grows. No snapshot cache yet — the plan marks it optional, and
 * these are all indexed aggregates; revisit if the dashboard p95 creeps up.
 *
 * Wrapped in React `cache()` so a page and its child components share one
 * computation per request.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export const getOrgOverview = cache(async (orgId: string) => {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS)
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS)
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS)
  const inOrg = { assessment: { orgId } }

  const [
    assessmentsByStatus,
    candidateCount,
    assignmentsByStatus,
    gradedAgg,
    passedCount,
    decidedCount,
    pendingReviewCount,
    submittedThisWeek,
    submittedLastWeek,
    highFlags30d,
  ] = await Promise.all([
    prisma.assessment.groupBy({ by: ['status'], where: { orgId }, _count: { _all: true } }),
    prisma.user.count({ where: { role: 'STUDENT', memberships: { some: { orgId } } } }),
    prisma.assessmentAssignment.groupBy({
      by: ['status'],
      where: inOrg,
      _count: { _all: true },
    }),
    prisma.result.aggregate({
      where: { ...inOrg, status: 'GRADED' },
      _avg: { percentage: true },
      _count: { _all: true },
    }),
    prisma.result.count({ where: { ...inOrg, status: 'GRADED', passed: true } }),
    prisma.result.count({ where: { ...inOrg, status: 'GRADED', passed: { not: null } } }),
    prisma.result.count({ where: { ...inOrg, status: 'PENDING_REVIEW' } }),
    prisma.assessmentAssignment.count({
      where: { ...inOrg, status: 'SUBMITTED', submittedAt: { gte: weekAgo } },
    }),
    prisma.assessmentAssignment.count({
      where: { ...inOrg, status: 'SUBMITTED', submittedAt: { gte: twoWeeksAgo, lt: weekAgo } },
    }),
    prisma.proctoringFlag.count({
      where: {
        severity: 'HIGH',
        occurredAt: { gte: monthAgo },
        session: { attempt: { assignment: { assessment: { orgId } } } },
      },
    }),
  ])

  const assessments = { total: 0, published: 0, draft: 0, archived: 0 }
  for (const g of assessmentsByStatus) {
    assessments.total += g._count._all
    if (g.status === 'PUBLISHED') assessments.published = g._count._all
    if (g.status === 'DRAFT') assessments.draft = g._count._all
    if (g.status === 'ARCHIVED') assessments.archived = g._count._all
  }

  const assignments = { total: 0, invited: 0, started: 0, submitted: 0, expired: 0 }
  for (const g of assignmentsByStatus) {
    assignments.total += g._count._all
    if (g.status === 'INVITED') assignments.invited = g._count._all
    if (g.status === 'STARTED') assignments.started = g._count._all
    if (g.status === 'SUBMITTED') assignments.submitted = g._count._all
    if (g.status === 'EXPIRED') assignments.expired = g._count._all
  }

  return {
    assessments,
    candidates: candidateCount,
    assignments,
    graded: gradedAgg._count._all,
    avgPercentage: round(gradedAgg._avg.percentage),
    // Pass rate only over results whose assessment defines a passing score —
    // otherwise `passed` is null and would drag the rate toward zero.
    passRate: decidedCount > 0 ? round((passedCount / decidedCount) * 100) : null,
    pendingReview: pendingReviewCount,
    submissions: { thisWeek: submittedThisWeek, lastWeek: submittedLastWeek },
    highFlags30d,
  }
})

/** Average score per assessment, oldest → newest, for the trend chart. */
export const getOrgScoreTrend = cache(async (orgId: string, limit = 8) => {
  const groups = await prisma.result.groupBy({
    by: ['assessmentId'],
    where: { status: 'GRADED', assessment: { orgId } },
    _avg: { percentage: true },
    _count: { _all: true },
    _max: { createdAt: true },
  })
  const latest = groups
    .sort((a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0))
    .slice(0, limit)
  if (latest.length === 0) return []

  const titles = await prisma.assessment.findMany({
    where: { id: { in: latest.map((g) => g.assessmentId) } },
    select: { id: true, title: true },
  })
  const titleById = new Map(titles.map((t) => [t.id, t.title]))

  return latest.reverse().map((g) => ({
    assessmentId: g.assessmentId,
    title: titleById.get(g.assessmentId) ?? 'Untitled',
    avgPercentage: round(g._avg.percentage) ?? 0,
    submissions: g._count._all,
  }))
})

/** Latest submissions across the org, newest first. */
export const getRecentSubmissions = cache(async (orgId: string, limit = 8) => {
  const rows = await prisma.assessmentAssignment.findMany({
    where: { status: 'SUBMITTED', assessment: { orgId } },
    orderBy: { submittedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      submittedAt: true,
      assessment: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
      attempt: {
        select: { result: { select: { id: true, status: true, percentage: true, passed: true } } },
      },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    submittedAt: r.submittedAt,
    assessment: r.assessment,
    user: r.user,
    result: r.attempt?.result ?? null,
  }))
})

/** Published assessments that are still open or not yet started. */
export const getUpcomingAssessments = cache(async (orgId: string, limit = 5) => {
  const now = new Date()
  return prisma.assessment.findMany({
    where: {
      orgId,
      status: 'PUBLISHED',
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
    orderBy: [{ startAt: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      durationMinutes: true,
      _count: { select: { assignments: true } },
    },
  })
})

/** Results waiting on a human grader, oldest first — the queue order. */
export const getPendingReviewQueue = cache(async (orgId: string, limit = 5) => {
  return prisma.result.findMany({
    where: { status: 'PENDING_REVIEW', assessment: { orgId } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      assessment: { select: { id: true, title: true } },
      user: { select: { name: true, email: true } },
    },
  })
})

/** SUPER_ADMIN only — callers must enforce the role before calling. */
export const getPlatformOverview = cache(async () => {
  const weekAgo = new Date(Date.now() - 7 * DAY_MS)
  const [orgs, usersByRole, assessments, submittedThisWeek, graded] = await Promise.all([
    prisma.organization.count(),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.assessment.count(),
    prisma.assessmentAssignment.count({
      where: { status: 'SUBMITTED', submittedAt: { gte: weekAgo } },
    }),
    prisma.result.count({ where: { status: 'GRADED' } }),
  ])
  const users = Object.fromEntries(usersByRole.map((g) => [g.role, g._count._all])) as Record<
    string,
    number
  >
  return {
    orgs,
    users,
    totalUsers: usersByRole.reduce((n, g) => n + g._count._all, 0),
    assessments,
    submittedThisWeek,
    graded,
  }
})
