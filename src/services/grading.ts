import 'server-only'

import type { Prisma } from '@prisma/client'

import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { userInScope, type Scope } from '@/lib/auth/scope'
import { notifyResultGraded, safely } from '@/services/notifications/events'

/**
 * Plan 016 — grading engine.
 *
 * `gradeAttempt` is called from services/exam-session.ts when a candidate
 * submits. It:
 *   - loads the attempt's answers + assessment structure
 *   - dispatches by question type (auto-grade objective, flag subjective/coding)
 *   - applies the assessment's ScoringPolicy (STANDARD or NEGATIVE_MARKING)
 *   - creates one Result + one QuestionResult per question
 *   - finalises immediately if nothing needs review; else PENDING_REVIEW
 *
 * Deliberate scope:
 *   - CODING questions are flagged `needsReview` for now. When Plan 014 (Judge0)
 *     lands, replace the CODING branch with a lookup of the linked
 *     CodeSubmission score. The Result finalisation logic below is already
 *     ready — it treats coding exactly like subjective.
 *   - MCQ_MULTI is all-or-nothing (full marks only when the selected set equals
 *     the correct set exactly). Partial-credit config can slot in later without
 *     touching callers.
 */

type QuestionForGrading = {
  id: string
  type: string
  marks: number
  negativeMarks: number
  options: { id: string; isCorrect: boolean }[]
}
type AnswerForGrading = {
  questionId: string
  selectedOptionIds: string[]
  textAnswer: string | null
}

type ObjectiveResult = { scoreAwarded: number; isCorrect: boolean }

/**
 * Grade one objective question given the candidate's selected option ids and
 * the assessment scoring policy. Returns 0 if no answer was recorded (no
 * negative for skipped questions — a plain STANDARD assumption).
 */
export function gradeObjective(
  question: QuestionForGrading,
  answer: AnswerForGrading | undefined,
  scoringPolicy: 'STANDARD' | 'NEGATIVE_MARKING',
): ObjectiveResult {
  const correctSet = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id))
  const selectedSet = new Set(answer?.selectedOptionIds ?? [])

  const isEmpty = selectedSet.size === 0

  const isExactMatch =
    selectedSet.size === correctSet.size &&
    [...selectedSet].every((id) => correctSet.has(id))

  if (isExactMatch) {
    return { scoreAwarded: question.marks, isCorrect: true }
  }

  // Skipped → 0 (never negative for a blank answer).
  if (isEmpty) return { scoreAwarded: 0, isCorrect: false }

  // Wrong answer under negative-marking policy → deduct.
  if (scoringPolicy === 'NEGATIVE_MARKING' && question.negativeMarks > 0) {
    return { scoreAwarded: -Math.abs(question.negativeMarks), isCorrect: false }
  }

  return { scoreAwarded: 0, isCorrect: false }
}

/**
 * Grade an attempt after submission. Idempotent: if a Result already exists
 * for this attempt, returns it unchanged (grading is one-shot; manual review
 * updates go through `gradeSubjective`).
 */
export async function gradeAttempt(attemptId: string) {
  const existing = await prisma.result.findUnique({ where: { attemptId } })
  if (existing) return existing

  // ExamAttempt carries only assessmentId (no Prisma relation defined for the
  // reverse side), so load the assessment structure in a second query.
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  })
  if (!attempt) throw new NotFoundError('Attempt not found')

  const assessment = await prisma.assessment.findUnique({
    where: { id: attempt.assessmentId },
    select: {
      id: true,
      scoringPolicy: true,
      passingScore: true,
      sections: {
        include: {
          questions: {
            include: {
              question: { include: { options: true } },
            },
          },
        },
      },
    },
  })
  if (!assessment) throw new NotFoundError('Assessment not found')

  const answersByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]))

  type Item = {
    questionId: string
    scoreAwarded: number
    maxMarks: number
    isCorrect: boolean | null
    needsReview: boolean
  }
  const items: Item[] = []
  let totalScore = 0
  let maxScore = 0
  let anyPending = false

  for (const section of assessment.sections) {
    for (const aq of section.questions) {
      const q = aq.question
      const marks = aq.marksOverride ?? q.marks
      maxScore += marks

      // Objective auto-grading
      if (q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTI' || q.type === 'TRUE_FALSE') {
        const answer = answersByQuestion.get(q.id) as AnswerForGrading | undefined
        const graded = gradeObjective(
          {
            id: q.id,
            type: q.type,
            marks,
            negativeMarks: q.negativeMarks,
            options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
          },
          answer,
          assessment.scoringPolicy,
        )
        items.push({
          questionId: q.id,
          scoreAwarded: graded.scoreAwarded,
          maxMarks: marks,
          isCorrect: graded.isCorrect,
          needsReview: false,
        })
        totalScore += graded.scoreAwarded
        continue
      }

      // SUBJECTIVE — always awaits manual review.
      // CODING — also awaits review for now; replace when Plan 014 lands.
      items.push({
        questionId: q.id,
        scoreAwarded: 0,
        maxMarks: marks,
        isCorrect: null,
        needsReview: true,
      })
      anyPending = true
    }
  }

  const percentage = maxScore > 0 ? Math.max(0, (totalScore / maxScore) * 100) : 0
  const status = anyPending ? 'PENDING_REVIEW' : 'GRADED'
  const passed = passedFor(status, totalScore, assessment.passingScore)

  const created = await prisma.result.create({
    data: {
      attemptId,
      assessmentId: attempt.assessmentId,
      userId: attempt.userId,
      status,
      totalScore,
      maxScore,
      percentage,
      passed,
      gradedAt: anyPending ? null : new Date(),
      questionResults: {
        create: items.map((i) => ({
          questionId: i.questionId,
          scoreAwarded: i.scoreAwarded,
          maxMarks: i.maxMarks,
          isCorrect: i.isCorrect,
          needsReview: i.needsReview,
        })),
      },
    },
    include: { questionResults: true },
  })
  if (created.status === 'GRADED') await safely(() => notifyResultGraded(created.id))
  return created
}

function passedFor(
  status: 'PENDING_REVIEW' | 'GRADED',
  totalScore: number,
  passingScore: number | null,
): boolean | null {
  // Never claim pass/fail while any question is unreviewed.
  if (status !== 'GRADED') return null
  if (passingScore === null) return null
  return totalScore >= passingScore
}

/**
 * Apply a manual grade to one QuestionResult (subjective or coding).
 * Re-aggregates the Result: totals update, and status flips to GRADED once no
 * items remain in `needsReview`.
 */
export async function gradeSubjective(input: {
  scope: Scope
  questionResultId: string
  scoreAwarded: number
  feedback?: string | null
  reviewerId: string
}) {
  const qr = await prisma.questionResult.findUnique({
    where: { id: input.questionResultId },
    include: { result: { include: { assessment: { select: { orgId: true } } } } },
  })
  if (!qr) throw new NotFoundError('Question result not found')

  // Tenant guard: the grader must belong to the org that owns the assessment.
  if (qr.result.assessment.orgId !== input.scope.orgId) {
    throw new ForbiddenError('Result not in this organization')
  }
  // Department guard: an HOD grades only their own students.
  if (!input.scope.all) {
    const ok = await prisma.result.count({ where: { id: qr.resultId, ...userInScope(input.scope) } })
    if (!ok) throw new ForbiddenError('This candidate is outside your department')
  }

  if (input.scoreAwarded < -qr.maxMarks || input.scoreAwarded > qr.maxMarks) {
    throw new NotFoundError(`Score must be between ${-qr.maxMarks} and ${qr.maxMarks}`)
  }

  await prisma.questionResult.update({
    where: { id: qr.id },
    data: {
      scoreAwarded: input.scoreAwarded,
      feedback: input.feedback ?? null,
      reviewedById: input.reviewerId,
      needsReview: false,
      isCorrect: input.scoreAwarded === qr.maxMarks ? true : input.scoreAwarded > 0 ? null : false,
    },
  })

  return recomputeResult(qr.resultId)
}

/**
 * Re-aggregate a Result after any QuestionResult change. Idempotent.
 */
export async function recomputeResult(resultId: string) {
  const result = await prisma.result.findUnique({
    where: { id: resultId },
    include: {
      questionResults: true,
      assessment: { select: { passingScore: true } },
    },
  })
  if (!result) throw new NotFoundError('Result not found')

  const totalScore = result.questionResults.reduce((s, q) => s + q.scoreAwarded, 0)
  const maxScore = result.questionResults.reduce((s, q) => s + q.maxMarks, 0)
  const percentage = maxScore > 0 ? Math.max(0, (totalScore / maxScore) * 100) : 0
  const anyPending = result.questionResults.some((q) => q.needsReview)
  const status: 'PENDING_REVIEW' | 'GRADED' = anyPending ? 'PENDING_REVIEW' : 'GRADED'
  const passed = passedFor(status, totalScore, result.assessment.passingScore)

  const updated = await prisma.result.update({
    where: { id: resultId },
    data: {
      totalScore,
      maxScore,
      percentage,
      status,
      passed,
      gradedAt: anyPending ? null : (result.gradedAt ?? new Date()),
    },
    include: { questionResults: true },
  })
  // Review just finished → tell the student (deduped per result).
  if (result.status === 'PENDING_REVIEW' && status === 'GRADED') {
    await safely(() => notifyResultGraded(resultId))
  }
  return updated
}

/**
 * Fetch a Result with breakdown. Tenant-scoped by the assessment's org.
 */
export async function getResultForAdmin(scope: Scope, resultId: string) {
  const result = await prisma.result.findFirst({
    where: { id: resultId, assessment: { orgId: scope.orgId }, ...userInScope(scope) },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      questionResults: true,
      assessment: { select: { id: true, title: true, orgId: true, passingScore: true } },
    },
  })
  if (!result) throw new NotFoundError('Result not found')
  return result
}

/** A candidate views their OWN result. userId must match. */
export async function getResultForCandidate(userId: string, resultId: string) {
  const result = await prisma.result.findFirst({
    where: { id: resultId, userId },
    include: {
      questionResults: true,
      assessment: { select: { id: true, title: true, passingScore: true } },
    },
  })
  if (!result) throw new NotFoundError('Result not found')
  return result
}

export async function listResultsForAssessment(scope: Scope, assessmentId: string) {
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, orgId: scope.orgId },
    select: { id: true },
  })
  if (!a) throw new NotFoundError('Assessment not found')

  return prisma.result.findMany({
    where: { assessmentId, ...userInScope(scope) },
    orderBy: [{ status: 'asc' }, { totalScore: 'desc' }],
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })
}

export const RESULT_SORTS = ['percentage', 'createdAt', 'name'] as const
export type ResultSort = (typeof RESULT_SORTS)[number]

/**
 * Plan 019 Phase 3 — filtered, sorted, paged results for the admin table.
 * Filtering happens in the database so a 3,000-candidate drive stays fast;
 * the unpaged `listResultsForAssessment` above is kept for the API.
 *
 * `outcome`: graded-and-passed, graded-and-not-passed, or awaiting review.
 */
export async function queryResultsForAssessment(
  scope: Scope,
  assessmentId: string,
  opts: {
    search?: string
    outcome?: 'passed' | 'failed' | 'pending'
    sort?: ResultSort
    dir?: 'asc' | 'desc'
    skip?: number
    take?: number
  },
) {
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, orgId: scope.orgId },
    select: { id: true },
  })
  if (!a) throw new NotFoundError('Assessment not found')

  // Everything below — page, count and summary — is limited to the scope's
  // students, so an HOD's pass rate is their department's pass rate.
  const base: Prisma.ResultWhereInput = { assessmentId, ...userInScope(scope) }
  const where: Prisma.ResultWhereInput = {
    AND: [base],
    ...(opts.outcome === 'pending' && { status: 'PENDING_REVIEW' }),
    ...(opts.outcome === 'passed' && { status: 'GRADED', passed: true }),
    ...(opts.outcome === 'failed' && { status: 'GRADED', passed: false }),
    ...(opts.search && {
      user: {
        OR: [
          { name: { contains: opts.search, mode: 'insensitive' } },
          { email: { contains: opts.search, mode: 'insensitive' } },
        ],
      },
    }),
  }
  const dir = opts.dir ?? 'desc'
  const orderBy: Prisma.ResultOrderByWithRelationInput[] =
    opts.sort === 'name'
      ? [{ user: { name: { sort: dir, nulls: 'last' } } }]
      : opts.sort === 'createdAt'
        ? [{ createdAt: dir }]
        : [{ percentage: dir }]
  orderBy.push({ id: 'asc' })

  const [items, total, agg, passed, decided, pending] = await Promise.all([
    prisma.result.findMany({
      where,
      orderBy,
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 25, 200),
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.result.count({ where }),
    // Summary is over the whole assessment, not the filtered page.
    prisma.result.aggregate({
      where: { ...base, status: 'GRADED' },
      _avg: { percentage: true },
      _max: { percentage: true },
      _count: { _all: true },
    }),
    prisma.result.count({ where: { ...base, status: 'GRADED', passed: true } }),
    prisma.result.count({ where: { ...base, status: 'GRADED', passed: { not: null } } }),
    prisma.result.count({ where: { ...base, status: 'PENDING_REVIEW' } }),
  ])

  return {
    items,
    total,
    summary: {
      graded: agg._count._all,
      pending,
      avgPercentage: agg._avg.percentage,
      highestPercentage: agg._max.percentage,
      passRate: decided > 0 ? (passed / decided) * 100 : null,
    },
  }
}

export async function listResultsForCandidate(userId: string) {
  return prisma.result.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      assessment: { select: { id: true, title: true, orgId: true } },
    },
  })
}

/** Summary stats for an admin dashboard. */
export function summariseResults(results: { totalScore: number; passed: boolean | null; status: string }[]) {
  const graded = results.filter((r) => r.status === 'GRADED')
  const totalScores = graded.map((r) => r.totalScore)
  const avg = totalScores.length > 0 ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length : 0
  const passed = graded.filter((r) => r.passed === true).length
  const passRate = graded.length > 0 ? (passed / graded.length) * 100 : 0

  return {
    total: results.length,
    graded: graded.length,
    pending: results.length - graded.length,
    avgScore: avg,
    highScore: totalScores.length > 0 ? Math.max(...totalScores) : 0,
    lowScore: totalScores.length > 0 ? Math.min(...totalScores) : 0,
    passRate,
  }
}

