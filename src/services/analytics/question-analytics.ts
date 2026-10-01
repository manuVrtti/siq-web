import 'server-only'

import { userInScope, type Scope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import { mean, pointBiserial, round } from '@/services/analytics/stats'

/**
 * Plan 019 — question-quality metrics for one assessment.
 *
 * Definitions (also documented for CLAUDE.md):
 *   difficulty index (p-value)
 *       Mean of (scoreAwarded / maxMarks), clamped to [0, 1] per candidate.
 *       For objective questions that is exactly "% who answered correctly".
 *       Higher = easier. Negative marks count as 0 so a penalty doesn't make a
 *       question look harder than "everyone got it wrong".
 *   discrimination
 *       Point-biserial correlation between the item ratio and the candidate's
 *       total percentage. > 0.3 good, 0.1–0.3 fair, < 0.1 poor, negative
 *       usually means a wrong answer key.
 *
 * Only GRADED results count — a PENDING_REVIEW result has a provisional total
 * that would skew discrimination, and unreviewed items have no score yet.
 * The caller must already have verified the assessment belongs to the org.
 */

export type QuestionStat = {
  questionId: string
  title: string
  type: string
  sectionId: string | null
  responses: number
  difficulty: number | null // 0–1
  discrimination: number | null // -1–1
  avgScore: number | null
  maxMarks: number
}

/** `scope` limits the responses to an HOD's students; omit or college-wide = everyone. */
export async function getQuestionStats(assessmentId: string, scope?: Scope): Promise<QuestionStat[]> {
  const [placements, questionResults] = await Promise.all([
    prisma.assessmentQuestion.findMany({
      where: { section: { assessmentId } },
      orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }],
      select: {
        sectionId: true,
        marksOverride: true,
        question: { select: { id: true, title: true, type: true, marks: true } },
      },
    }),
    prisma.questionResult.findMany({
      where: { result: { assessmentId, status: 'GRADED', ...(scope ? userInScope(scope) : {}) }, needsReview: false },
      select: {
        questionId: true,
        scoreAwarded: true,
        maxMarks: true,
        result: { select: { percentage: true } },
      },
    }),
  ])

  const byQuestion = new Map<string, { ratio: number; score: number; total: number }[]>()
  for (const qr of questionResults) {
    const ratio = qr.maxMarks > 0 ? Math.min(1, Math.max(0, qr.scoreAwarded / qr.maxMarks)) : 0
    const list = byQuestion.get(qr.questionId) ?? []
    list.push({ ratio, score: qr.scoreAwarded, total: qr.result.percentage })
    byQuestion.set(qr.questionId, list)
  }

  return placements.map((p) => {
    const rows = byQuestion.get(p.question.id) ?? []
    return {
      questionId: p.question.id,
      title: p.question.title,
      type: p.question.type,
      sectionId: p.sectionId,
      responses: rows.length,
      difficulty: round(mean(rows.map((r) => r.ratio)), 3),
      discrimination: round(
        pointBiserial(rows.map((r) => ({ item: r.ratio, total: r.total }))),
        3,
      ),
      avgScore: round(mean(rows.map((r) => r.score)), 2),
      maxMarks: p.marksOverride ?? p.question.marks,
    }
  })
}

/** The n questions with the lowest difficulty index that have any responses. */
export function mostMissed(stats: QuestionStat[], n = 5): QuestionStat[] {
  return stats
    .filter((s) => s.responses > 0 && s.difficulty !== null)
    .sort((a, b) => (a.difficulty ?? 0) - (b.difficulty ?? 0))
    .slice(0, n)
}

export type OptionDistribution = {
  questionId: string
  responses: number
  options: { id: string; text: string; isCorrect: boolean; count: number }[]
}

/**
 * Which options candidates picked, for every MCQ / true-false question in the
 * assessment. Only submitted attempts count, so an in-progress candidate's
 * half-made choices don't show up as "distractor" data.
 */
export async function getOptionDistributions(
  assessmentId: string,
  scope?: Scope,
): Promise<Map<string, OptionDistribution>> {
  const [questions, answers] = await Promise.all([
    prisma.question.findMany({
      where: {
        type: { in: ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE'] },
        assessmentQuestions: { some: { section: { assessmentId } } },
      },
      select: {
        id: true,
        options: {
          orderBy: { order: 'asc' },
          select: { id: true, text: true, isCorrect: true },
        },
      },
    }),
    prisma.examAnswer.findMany({
      where: { attempt: { assessmentId, submittedAt: { not: null }, ...(scope ? userInScope(scope) : {}) } },
      select: { questionId: true, selectedOptionIds: true },
    }),
  ])

  const out = new Map<string, OptionDistribution>()
  for (const q of questions) {
    out.set(q.id, {
      questionId: q.id,
      responses: 0,
      options: q.options.map((o) => ({ ...o, count: 0 })),
    })
  }
  for (const a of answers) {
    const dist = out.get(a.questionId)
    if (!dist || a.selectedOptionIds.length === 0) continue
    dist.responses += 1
    for (const optId of a.selectedOptionIds) {
      const opt = dist.options.find((o) => o.id === optId)
      if (opt) opt.count += 1
    }
  }
  return out
}
