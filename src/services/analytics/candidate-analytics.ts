import 'server-only'

import { cache } from 'react'

import { NotFoundError } from '@/lib/errors'
import { batchWhere, studentWhere, type Scope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import { mean, round } from '@/services/analytics/stats'

/**
 * Plan 019 — candidate + batch analytics.
 *
 * The student dashboard is org-scoped like everything else under /[org]: a
 * student in two colleges sees each college's exams in that college's
 * workspace. Their cross-org history lives at /my-results.
 */

/** Everything the student dashboard needs, in one parallel batch. */
export const getStudentOverview = cache(async (orgId: string, userId: string) => {
  const now = new Date()
  const [assignments, results] = await Promise.all([
    prisma.assessmentAssignment.findMany({
      where: { userId, assessment: { orgId, status: 'PUBLISHED' } },
      orderBy: { invitedAt: 'desc' },
      select: {
        id: true,
        token: true,
        status: true,
        invitedAt: true,
        submittedAt: true,
        assessment: {
          select: {
            id: true,
            title: true,
            durationMinutes: true,
            startAt: true,
            endAt: true,
            sections: { select: { _count: { select: { questions: true } } } },
          },
        },
      },
    }),
    prisma.result.findMany({
      where: { status: { not: 'SUPERSEDED' as const }, userId, assessment: { orgId } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        percentage: true,
        passed: true,
        createdAt: true,
        assessment: { select: { title: true } },
      },
    }),
  ])

  // An exam is "open" if the candidate can still act on it: not submitted,
  // and its window hasn't closed.
  const open = assignments
    .filter(
      (a) =>
        (a.status === 'INVITED' || a.status === 'STARTED') &&
        (!a.assessment.endAt || a.assessment.endAt > now),
    )
    // In-progress first, then whatever opens or closes soonest.
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'STARTED' ? -1 : 1
      const key = (x: typeof a) =>
        (x.assessment.startAt ?? x.assessment.endAt ?? new Date(8.64e15)).getTime()
      return key(a) - key(b)
    })
  const graded = results.filter((r) => r.status === 'GRADED')
  const decided = graded.filter((r) => r.passed !== null)

  return {
    open,
    completed: assignments.filter((a) => a.status === 'SUBMITTED').length,
    pendingReview: results.filter((r) => r.status === 'PENDING_REVIEW').length,
    avgPercentage: round(mean(graded.map((r) => r.percentage))),
    bestPercentage: graded.length ? round(Math.max(...graded.map((r) => r.percentage))) : null,
    passed: decided.filter((r) => r.passed).length,
    decided: decided.length,
    trend: graded.map((r) => ({
      id: r.id,
      title: r.assessment.title,
      percentage: round(r.percentage) ?? 0,
      at: r.createdAt,
    })),
    recent: [...results].reverse().slice(0, 5),
  }
})

/**
 * Student insights for the dashboard (plan 027 territory, ABtalks-inspired):
 *
 *   standing — for the 5 most recent graded exams, the share of the cohort
 *              that scored below the student. Cohort = everyone graded on
 *              that assessment; hidden below 5 graded candidates, where a
 *              percentile says more about the sample than the student.
 *   topics   — mean marks ratio per question tag across all graded answers.
 *              Needs ≥3 answered questions per tag before it's shown, so
 *              one lucky guess isn't reported as a strength.
 */
const MIN_COHORT = 5
const MIN_PER_TAG = 3

export const getStudentInsights = cache(async (orgId: string, userId: string) => {
  const recent = await prisma.result.findMany({
    where: { userId, status: 'GRADED', assessment: { orgId } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, percentage: true, assessmentId: true, assessment: { select: { title: true } } },
  })

  const standing = (
    await Promise.all(
      recent.map(async (r) => {
        const [below, total] = await Promise.all([
          prisma.result.count({
            where: { assessmentId: r.assessmentId, status: 'GRADED', percentage: { lt: r.percentage } },
          }),
          prisma.result.count({ where: { assessmentId: r.assessmentId, status: 'GRADED' } }),
        ])
        if (total < MIN_COHORT) return null
        return {
          resultId: r.id,
          title: r.assessment.title,
          percentage: round(r.percentage) ?? 0,
          betterThan: Math.round((below / (total - 1 || 1)) * 100),
          cohort: total,
        }
      }),
    )
  ).filter((s): s is NonNullable<typeof s> => s !== null)

  // Topic performance from tagged questions.
  const answers = await prisma.questionResult.findMany({
    where: { needsReview: false, result: { userId, status: 'GRADED', assessment: { orgId } } },
    select: { questionId: true, scoreAwarded: true, maxMarks: true },
  })
  const tagRows = answers.length
    ? await prisma.questionTag.findMany({
        where: { questionId: { in: [...new Set(answers.map((a) => a.questionId))] } },
        select: { questionId: true, tag: { select: { name: true } } },
      })
    : []
  const tagsByQuestion = new Map<string, string[]>()
  for (const t of tagRows) {
    const list = tagsByQuestion.get(t.questionId) ?? []
    list.push(t.tag.name)
    tagsByQuestion.set(t.questionId, list)
  }
  const byTag = new Map<string, number[]>()
  for (const a of answers) {
    const ratio = a.maxMarks > 0 ? Math.min(1, Math.max(0, a.scoreAwarded / a.maxMarks)) : 0
    for (const tag of tagsByQuestion.get(a.questionId) ?? []) {
      const list = byTag.get(tag) ?? []
      list.push(ratio)
      byTag.set(tag, list)
    }
  }
  const topics = [...byTag.entries()]
    .filter(([, v]) => v.length >= MIN_PER_TAG)
    .map(([tag, v]) => ({ tag, percentage: Math.round((mean(v) ?? 0) * 100), questions: v.length }))
    .sort((a, b) => b.percentage - a.percentage)

  return {
    standing,
    strengths: topics.slice(0, 3),
    // Weakest three, excluding anything already listed as a strength.
    focus: topics.length > 3 ? topics.slice(-3).reverse().filter((t) => !topics.slice(0, 3).includes(t)) : [],
    topicCount: topics.length,
    /** Every topic with enough answers, best first — the Analytics tab shows them all. */
    topics,
  }
})

/**
 * Every exam assigned to the student in this org, bucketed for the
 * Assessments tab:
 *   inProgress — started, window still open
 *   open       — can start now
 *   upcoming   — window hasn't opened yet
 *   done       — submitted (links to the result when one exists)
 *   missed     — expired, or the window closed before they submitted
 */
export const getStudentAssessments = cache(async (orgId: string, userId: string) => {
  const now = new Date()
  const rows = await prisma.assessmentAssignment.findMany({
    where: { userId, assessment: { orgId, status: { in: ['PUBLISHED', 'ARCHIVED'] } } },
    orderBy: { invitedAt: 'desc' },
    select: {
      id: true,
      token: true,
      status: true,
      invitedAt: true,
      submittedAt: true,
      assessment: {
        select: {
          title: true,
          description: true,
          durationMinutes: true,
          startAt: true,
          endAt: true,
          status: true,
          sections: { select: { _count: { select: { questions: true } } } },
        },
      },
      attempt: { select: { result: { select: { id: true, status: true, percentage: true, passed: true } } } },
    },
  })

  const items = rows.map((r) => {
    const a = r.assessment
    const closed = (a.endAt !== null && a.endAt <= now) || a.status === 'ARCHIVED'
    const bucket: 'inProgress' | 'open' | 'upcoming' | 'done' | 'missed' =
      r.status === 'SUBMITTED'
        ? 'done'
        : r.status === 'EXPIRED' || closed
          ? 'missed'
          : r.status === 'STARTED'
            ? 'inProgress'
            : a.startAt && a.startAt > now
              ? 'upcoming'
              : 'open'
    return {
      id: r.id,
      token: r.token,
      bucket,
      title: a.title,
      description: a.description,
      durationMinutes: a.durationMinutes,
      questions: a.sections.reduce((n, s) => n + s._count.questions, 0),
      startAt: a.startAt,
      endAt: a.endAt,
      invitedAt: r.invitedAt,
      submittedAt: r.submittedAt,
      result: r.attempt?.result ?? null,
    }
  })

  const soonest = (x: (typeof items)[number]) => (x.startAt ?? x.endAt ?? new Date(8.64e15)).getTime()
  const latest = (x: (typeof items)[number]) => -(x.submittedAt ?? x.endAt ?? x.invitedAt).getTime()
  const pick = (b: (typeof items)[number]['bucket'], key: typeof soonest) =>
    items.filter((i) => i.bucket === b).sort((x, y) => key(x) - key(y))

  return {
    inProgress: pick('inProgress', soonest),
    open: pick('open', soonest),
    upcoming: pick('upcoming', soonest),
    done: pick('done', latest),
    missed: pick('missed', latest),
    total: items.length,
  }
})

/** Aggregate graded performance of a batch's members on this org's exams. */
export async function getBatchPerformance(scope: Scope, batchId: string) {
  const orgId = scope.orgId
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, ...batchWhere(scope) },
    select: {
      id: true,
      name: true,
      // An HOD sees only their own students even inside a mixed batch.
      members: {
        where: scope.all ? {} : { user: studentWhere(scope) },
        select: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  })
  if (!batch) throw new NotFoundError('Batch not found')

  const userIds = batch.members.map((m) => m.user.id)
  const results = userIds.length
    ? await prisma.result.findMany({
        where: { userId: { in: userIds }, status: 'GRADED', assessment: { orgId } },
        select: { userId: true, percentage: true, passed: true },
      })
    : []

  const byUser = new Map<string, number[]>()
  for (const r of results) {
    const list = byUser.get(r.userId) ?? []
    list.push(r.percentage)
    byUser.set(r.userId, list)
  }
  const decided = results.filter((r) => r.passed !== null)

  return {
    id: batch.id,
    name: batch.name,
    members: batch.members.length,
    graded: results.length,
    avgPercentage: round(mean(results.map((r) => r.percentage))),
    passRate: decided.length
      ? round((decided.filter((r) => r.passed).length / decided.length) * 100)
      : null,
    perMember: batch.members
      .map((m) => ({
        ...m.user,
        attempts: byUser.get(m.user.id)?.length ?? 0,
        avgPercentage: round(mean(byUser.get(m.user.id) ?? [])),
      }))
      .sort((a, b) => (b.avgPercentage ?? -1) - (a.avgPercentage ?? -1)),
  }
}

/** Summary rows for every batch in the org — the analytics page table. */
export async function listBatchPerformance(scope: Scope) {
  const batches = await prisma.batch.findMany({
    where: batchWhere(scope),
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  return Promise.all(batches.map((b) => getBatchPerformance(scope, b.id)))
}
