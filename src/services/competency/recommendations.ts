import 'server-only'

import { MAX_RECOMMENDATIONS, UNRANKED } from '@/constants/competency-thresholds'
import { prisma } from '@/lib/prisma'

/**
 * Plan 026 — rule-based practice recommendations. For each weak skill (in
 * priority order) the student gets: why it matters, and how many practice
 * questions are waiting.
 *
 * Practice questions are only ever those staff marked `practiceEnabled` —
 * never the exam bank at large, because practice shows the answer.
 */

function reasonFor(i: { dimensionName: string; tier: string; score: number; belowCohort: boolean; trend: string }) {
  const pct = `${Math.round(i.score)}%`
  const head =
    i.tier === 'CRITICAL_GAP'
      ? `Critical gap in ${i.dimensionName} (${pct})`
      : i.tier === 'NEEDS_WORK'
        ? `${i.dimensionName} needs work (${pct})`
        : `${i.dimensionName} is behind most of your batch (${pct})`
  const tail = [i.belowCohort && i.tier !== 'ON_TRACK' && i.tier !== 'STRONG' ? 'below most of your batch' : null, i.trend === 'DECLINING' ? 'slipping lately' : null]
    .filter(Boolean)
    .join(', ')
  return tail ? `${head} — ${tail}` : head
}

/** Questions on a skill the student may practise, not yet seen in a graded test first. */
async function practicePool(userId: string, orgId: string, skillId: string) {
  const pool = await prisma.question.findMany({
    where: { orgId, practiceEnabled: true, type: { not: 'CODING' }, skills: { some: { skillId } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  const ids = pool.map((q) => q.id)
  if (ids.length === 0) return { all: [], unseen: [] }
  const seen = await prisma.questionResult.findMany({
    where: { questionId: { in: ids }, result: { userId } },
    select: { questionId: true },
  })
  const seenIds = new Set(seen.map((s) => s.questionId))
  return { all: ids, unseen: ids.filter((id) => !seenIds.has(id)) }
}

export async function generateRecommendations(userId: string, orgId: string) {
  const weak = await prisma.competencyInsight.findMany({
    where: { userId, orgId, dimensionType: 'SKILL', priority: { lt: UNRANKED } },
    orderBy: { priority: 'asc' },
    take: MAX_RECOMMENDATIONS,
  })
  const rows = []
  for (const [i, w] of weak.entries()) {
    const pool = await practicePool(userId, orgId, w.dimensionId)
    rows.push({ userId, orgId, skillId: w.dimensionId, skillName: w.dimensionName, reason: reasonFor(w), priority: i, questionCount: pool.unseen.length || pool.all.length })
  }
  await prisma.$transaction([
    prisma.practiceRecommendation.deleteMany({ where: { userId, orgId } }),
    prisma.practiceRecommendation.createMany({ data: rows }),
  ])
  return rows.length
}

export async function getRecommendations(userId: string, orgId: string) {
  return prisma.practiceRecommendation.findMany({
    where: { userId, orgId },
    orderBy: { priority: 'asc' },
    select: { skillId: true, skillName: true, reason: true, priority: true, questionCount: true, skill: { select: { sectionId: true } } },
  })
}

/**
 * The practice set for one skill: up to `limit` practice-enabled questions,
 * unseen first, WITH answers (that is the point of practice).
 */
export async function getPracticeQuestions(userId: string, orgId: string, skillId: string, limit = 10) {
  const pool = await practicePool(userId, orgId, skillId)
  const order = [...pool.unseen, ...pool.all.filter((id) => !pool.unseen.includes(id))].slice(0, limit)
  if (order.length === 0) return []
  const questions = await prisma.question.findMany({
    where: { id: { in: order }, orgId, practiceEnabled: true },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      difficulty: true,
      explanation: true,
      options: { orderBy: { order: 'asc' }, select: { id: true, text: true, isCorrect: true } },
    },
  })
  const byId = new Map(questions.map((q) => [q.id, q]))
  return order.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q))
}
