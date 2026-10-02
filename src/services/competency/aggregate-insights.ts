import 'server-only'

import type { Prisma } from '@prisma/client'

import { UNRANKED } from '@/constants/competency-thresholds'
import { memberWhere, type Scope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'

/**
 * Plan 026 — cohort-level insight for HODs and College Admins:
 *   weak spots     — which topics/skills most of the cohort is weak in
 *   attention list — the students with the most serious gaps (triage)
 *
 * Always within a Scope (college-wide, or an HOD's departments), optionally
 * narrowed to one department and/or batch.
 */

export type CohortFilter = { departmentId?: string | null; batchYear?: number | null }

function studentsIn(scope: Scope, f: CohortFilter): Prisma.UserWhereInput {
  return {
    role: 'STUDENT',
    memberships: { some: { ...memberWhere(scope), ...(f.departmentId ? { departmentId: f.departmentId } : {}) } },
    ...(f.batchYear ? { candidateProfile: { graduationYear: f.batchYear } } : {}),
  }
}

const WEAK = { OR: [{ tier: { in: ['CRITICAL_GAP', 'NEEDS_WORK'] } }, { belowCohort: true }] } satisfies Prisma.CompetencyInsightWhereInput

/** Topics and skills ranked by how many students in the cohort are weak in them. */
export async function getWeakSpots(scope: Scope, f: CohortFilter = {}, dimensionType: 'SECTION' | 'SKILL' = 'SKILL', take = 10) {
  const user = studentsIn(scope, f)
  const [weak, assessed] = await Promise.all([
    prisma.competencyInsight.groupBy({
      by: ['dimensionId', 'dimensionName'],
      where: { orgId: scope.orgId, dimensionType, user, ...WEAK },
      _count: { _all: true },
      _avg: { score: true },
    }),
    prisma.competencyInsight.groupBy({
      by: ['dimensionId'],
      where: { orgId: scope.orgId, dimensionType, user },
      _count: { _all: true },
      _avg: { score: true },
    }),
  ])
  const total = new Map(assessed.map((a) => [a.dimensionId, { n: a._count._all, avg: a._avg.score ?? 0 }]))
  return weak
    .map((w) => {
      const t = total.get(w.dimensionId) ?? { n: w._count._all, avg: 0 }
      return {
        dimensionId: w.dimensionId,
        name: w.dimensionName,
        weakStudents: w._count._all,
        assessedStudents: t.n,
        weakShare: Math.round((w._count._all / Math.max(1, t.n)) * 100),
        avgScore: Math.round(t.avg * 100) / 100,
      }
    })
    .sort((a, b) => b.weakStudents - a.weakStudents || b.weakShare - a.weakShare || a.avgScore - b.avgScore)
    .slice(0, take)
}

/**
 * Students to look at first: most critical gaps, then most "needs work",
 * then the lowest average. Each with their top three priorities.
 */
export async function getStudentsNeedingAttention(scope: Scope, f: CohortFilter = {}, take = 25) {
  const rows = await prisma.competencyInsight.findMany({
    where: { orgId: scope.orgId, user: studentsIn(scope, f) },
    select: { userId: true, dimensionType: true, dimensionName: true, tier: true, score: true, priority: true, trend: true },
  })
  const by = new Map<string, typeof rows>()
  for (const r of rows) (by.get(r.userId) ?? by.set(r.userId, []).get(r.userId)!).push(r)

  const ranked = [...by.entries()]
    .map(([userId, rs]) => {
      const sections = rs.filter((r) => r.dimensionType === 'SECTION')
      return {
        userId,
        critical: rs.filter((r) => r.tier === 'CRITICAL_GAP').length,
        needsWork: rs.filter((r) => r.tier === 'NEEDS_WORK').length,
        declining: rs.filter((r) => r.trend === 'DECLINING').length,
        avgTopicScore: sections.length ? Math.round((sections.reduce((a, r) => a + r.score, 0) / sections.length) * 100) / 100 : null,
        top: rs
          .filter((r) => r.priority < UNRANKED)
          .sort((a, b) => a.priority - b.priority)
          .slice(0, 3)
          .map((r) => ({ name: r.dimensionName, tier: r.tier, score: r.score })),
      }
    })
    .filter((s) => s.critical + s.needsWork > 0)
    .sort((a, b) => b.critical - a.critical || b.needsWork - a.needsWork || (a.avgTopicScore ?? 100) - (b.avgTopicScore ?? 100))
    .slice(0, take)

  const people = await prisma.user.findMany({
    where: { id: { in: ranked.map((r) => r.userId) } },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: { where: { orgId: scope.orgId }, select: { department: { select: { code: true } } } },
    },
  })
  const who = new Map(people.map((p) => [p.id, p]))
  return ranked.map((r) => ({
    ...r,
    name: who.get(r.userId)?.name ?? who.get(r.userId)?.email ?? 'Student',
    department: who.get(r.userId)?.memberships[0]?.department?.code ?? null,
  }))
}
