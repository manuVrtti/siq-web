import 'server-only'

import { NotFoundError } from '@/lib/errors'
import { assessmentWhere, userInScope, type Scope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import {
  getOptionDistributions,
  getQuestionStats,
  mostMissed,
} from '@/services/analytics/question-analytics'
import { mean, median, percentageHistogram, round, stdDev } from '@/services/analytics/stats'

/**
 * Plan 019 — everything the per-assessment analytics page shows, in one call
 * so the page issues one parallel batch of queries instead of a waterfall.
 *
 * Tenant check first: the assessment must belong to the scope's org,
 * otherwise NotFound (never confirm that an id exists in another org).
 * Every people-linked number is limited to the scope's students, so an
 * HOD's funnel and pass rate describe their department only.
 */
export async function getAssessmentAnalytics(scope: Scope, assessmentId: string) {
  const u = userInScope(scope)
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, orgId: scope.orgId },
    select: {
      id: true,
      title: true,
      status: true,
      durationMinutes: true,
      passingScore: true,
      proctoringEnabled: true,
      sections: { orderBy: { order: 'asc' }, select: { id: true, title: true } },
    },
  })
  if (!assessment) throw new NotFoundError('Assessment not found')

  const now = new Date()
  const [assignmentsByStatus, attempts, results, questionStats, optionDistributions, flagsByType] =
    await Promise.all([
      prisma.assessmentAssignment.groupBy({
        by: ['status'],
        where: { assessmentId, ...u },
        _count: { _all: true },
      }),
      prisma.examAttempt.findMany({
        where: { assessmentId, ...u },
        select: { startedAt: true, submittedAt: true, deadlineAt: true },
      }),
      prisma.result.findMany({
        where: { assessmentId, ...u },
        select: { status: true, percentage: true, passed: true },
      }),
      getQuestionStats(assessmentId, scope),
      getOptionDistributions(assessmentId, scope),
      prisma.proctoringFlag.groupBy({
        by: ['type'],
        where: { session: { attempt: { assessmentId, ...u } } },
        _count: { _all: true },
      }),
    ])

  // ---- Completion funnel --------------------------------------------------
  let invited = 0
  let submitted = 0
  let expiredStatus = 0
  for (const g of assignmentsByStatus) {
    invited += g._count._all
    if (g.status === 'SUBMITTED') submitted = g._count._all
    if (g.status === 'EXPIRED') expiredStatus = g._count._all
  }
  const started = attempts.length
  // Deadline passed without a submit — the candidate ran out of time or left.
  const timedOut = attempts.filter((a) => !a.submittedAt && a.deadlineAt < now).length
  const inProgress = attempts.filter((a) => !a.submittedAt && a.deadlineAt >= now).length

  // ---- Time analysis (minutes) -------------------------------------------
  const durations = attempts
    .filter((a) => a.submittedAt)
    .map((a) => (a.submittedAt!.getTime() - a.startedAt.getTime()) / 60_000)

  // ---- Scores ------------------------------------------------------------
  const graded = results.filter((r) => r.status === 'GRADED')
  const percentages = graded.map((r) => r.percentage)
  const decided = graded.filter((r) => r.passed !== null)
  const passed = decided.filter((r) => r.passed).length

  // ---- Section performance ------------------------------------------------
  const sectionPerformance = assessment.sections.map((s) => {
    const inSection = questionStats.filter((q) => q.sectionId === s.id && q.difficulty !== null)
    return {
      sectionId: s.id,
      title: s.title,
      questions: questionStats.filter((q) => q.sectionId === s.id).length,
      // Mean of question difficulty indices = average % of marks earned.
      avgPercentage: round(
        inSection.length > 0 ? mean(inSection.map((q) => q.difficulty! * 100)) : null,
      ),
    }
  })

  return {
    assessment,
    funnel: {
      invited,
      started,
      submitted,
      inProgress,
      timedOut,
      expired: expiredStatus,
      notStarted: Math.max(0, invited - started),
    },
    time: {
      samples: durations.length,
      avgMinutes: round(mean(durations)),
      medianMinutes: round(median(durations)),
      limitMinutes: assessment.durationMinutes,
    },
    scores: {
      graded: graded.length,
      pendingReview: results.length - graded.length,
      avgPercentage: round(mean(percentages)),
      medianPercentage: round(median(percentages)),
      stdDev: round(stdDev(percentages)),
      highest: percentages.length ? round(Math.max(...percentages)) : null,
      lowest: percentages.length ? round(Math.min(...percentages)) : null,
      passRate: decided.length > 0 ? round((passed / decided.length) * 100) : null,
      histogram: percentageHistogram(percentages),
    },
    sectionPerformance,
    questions: questionStats,
    mostMissed: mostMissed(questionStats),
    optionDistributions: Object.fromEntries(optionDistributions),
    proctoring: {
      enabled: assessment.proctoringEnabled,
      byType: Object.fromEntries(flagsByType.map((f) => [f.type, f._count._all])) as Record<
        string,
        number
      >,
      total: flagsByType.reduce((n, f) => n + f._count._all, 0),
    },
  }
}

export type AssessmentAnalytics = Awaited<ReturnType<typeof getAssessmentAnalytics>>

/**
 * Compact per-assessment rows for the org analytics table: one aggregate
 * pass over results + assignments instead of N× getAssessmentAnalytics.
 */
export async function listAssessmentPerformance(scope: Scope) {
  const u = userInScope(scope)
  const orgId = scope.orgId
  const [assessments, resultGroups, passedGroups, decidedGroups, assignmentGroups] =
    await Promise.all([
      prisma.assessment.findMany({
        where: { ...assessmentWhere(scope), status: { in: ['PUBLISHED', 'ARCHIVED'] } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, status: true, proctoringEnabled: true },
      }),
      prisma.result.groupBy({
        by: ['assessmentId'],
        where: { status: 'GRADED', assessment: { orgId }, ...u },
        _avg: { percentage: true },
        _count: { _all: true },
      }),
      prisma.result.groupBy({
        by: ['assessmentId'],
        where: { status: 'GRADED', passed: true, assessment: { orgId }, ...u },
        _count: { _all: true },
      }),
      prisma.result.groupBy({
        by: ['assessmentId'],
        where: { status: 'GRADED', passed: { not: null }, assessment: { orgId }, ...u },
        _count: { _all: true },
      }),
      prisma.assessmentAssignment.groupBy({
        by: ['assessmentId', 'status'],
        where: { assessment: { orgId }, ...u },
        _count: { _all: true },
      }),
    ])

  const avgById = new Map(resultGroups.map((g) => [g.assessmentId, g]))
  const passedById = new Map(passedGroups.map((g) => [g.assessmentId, g._count._all]))
  const decidedById = new Map(decidedGroups.map((g) => [g.assessmentId, g._count._all]))
  const invitedById = new Map<string, number>()
  const submittedById = new Map<string, number>()
  for (const g of assignmentGroups) {
    invitedById.set(g.assessmentId, (invitedById.get(g.assessmentId) ?? 0) + g._count._all)
    if (g.status === 'SUBMITTED') submittedById.set(g.assessmentId, g._count._all)
  }

  return assessments.map((a) => {
    const decided = decidedById.get(a.id) ?? 0
    return {
      ...a,
      invited: invitedById.get(a.id) ?? 0,
      submitted: submittedById.get(a.id) ?? 0,
      graded: avgById.get(a.id)?._count._all ?? 0,
      avgPercentage: round(avgById.get(a.id)?._avg.percentage ?? null),
      passRate: decided > 0 ? round(((passedById.get(a.id) ?? 0) / decided) * 100) : null,
    }
  })
}
