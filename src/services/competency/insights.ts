import 'server-only'

import { CUMULATIVE_REF, MIN_EVIDENCE, UNRANKED } from '@/constants/competency-thresholds'
import { prisma } from '@/lib/prisma'
import { baselineLookup } from '@/services/competency/cohort-baseline'
import { classifyTier, detectTrend, evaluateDimension, priorityScore } from '@/services/competency/classification'
import { generateRecommendations } from '@/services/competency/recommendations'

/**
 * Plan 026 — the analyzer: cumulative scores (plan 025) + cohort baselines →
 * one classified insight per topic and skill, ranked by what to fix first.
 *
 * Called after every cumulative recompute (grading hook) and by the nightly
 * job after baselines are rebuilt. Rows are replaced wholesale per student
 * and college, then recommendations are regenerated from them.
 */

/** When each counted test was taken (latest graded attempt), for trend order. */
async function testDates(userId: string, orgId: string) {
  const results = await prisma.result.findMany({
    where: { userId, status: 'GRADED', assessment: { orgId, countsForAnalytics: true } },
    orderBy: { createdAt: 'desc' },
    select: { assessmentId: true, createdAt: true },
  })
  const at = new Map<string, number>()
  for (const r of results) if (!at.has(r.assessmentId)) at.set(r.assessmentId, r.createdAt.getTime())
  return at
}

export async function generateInsights(userId: string, orgId: string) {
  const [sections, skills, snapSections, snapSkills, dates, lookup] = await Promise.all([
    prisma.sectionCompetency.findMany({
      where: { userId, orgId, scope: 'CUMULATIVE', scopeRefId: CUMULATIVE_REF },
      select: { sectionId: true, weightedScore: true, questionsAttempted: true, section: { select: { name: true, code: true } } },
    }),
    prisma.skillCompetency.findMany({
      where: { userId, orgId, scope: 'CUMULATIVE', scopeRefId: CUMULATIVE_REF },
      select: { skillId: true, weightedScore: true, questionsAttempted: true, skill: { select: { name: true, sectionId: true, section: { select: { code: true } } } } },
    }),
    prisma.sectionCompetency.findMany({ where: { userId, orgId, scope: 'ASSESSMENT' }, select: { sectionId: true, scopeRefId: true, weightedScore: true } }),
    prisma.skillCompetency.findMany({ where: { userId, orgId, scope: 'ASSESSMENT' }, select: { skillId: true, scopeRefId: true, weightedScore: true } }),
    testDates(userId, orgId),
    baselineLookup(userId, orgId),
  ])

  const history = (rows: { id: string; ref: string; score: number }[]) => {
    const by = new Map<string, { t: number; score: number }[]>()
    for (const r of rows) {
      const t = dates.get(r.ref)
      if (t === undefined) continue
      ;(by.get(r.id) ?? by.set(r.id, []).get(r.id)!).push({ t, score: r.score })
    }
    return (id: string) => (by.get(id) ?? []).sort((a, b) => a.t - b.t).map((x) => x.score)
  }
  const sectionHistory = history(snapSections.map((r) => ({ id: r.sectionId, ref: r.scopeRefId, score: r.weightedScore })))
  const skillHistory = history(snapSkills.map((r) => ({ id: r.skillId, ref: r.scopeRefId, score: r.weightedScore })))

  type Draft = {
    dimensionType: 'SECTION' | 'SKILL'
    dimensionId: string
    dimensionName: string
    sectionId: string
    topicCode: string | null
    score: number
    evidence: number
    trendScores: number[]
  }
  const drafts: Draft[] = [
    ...sections.map((s) => ({
      dimensionType: 'SECTION' as const,
      dimensionId: s.sectionId,
      dimensionName: s.section.name,
      sectionId: s.sectionId,
      topicCode: s.section.code,
      score: s.weightedScore,
      evidence: s.questionsAttempted,
      trendScores: sectionHistory(s.sectionId),
    })),
    ...skills.map((k) => ({
      dimensionType: 'SKILL' as const,
      dimensionId: k.skillId,
      dimensionName: k.skill.name,
      sectionId: k.skill.sectionId,
      topicCode: k.skill.section.code,
      score: k.weightedScore,
      evidence: k.questionsAttempted,
      trendScores: skillHistory(k.skillId),
    })),
  ]

  const classified = drafts.map((d) => {
    const tier = classifyTier(d.score)
    const flags = evaluateDimension(d.score, lookup.get(`${d.dimensionType}:${d.dimensionId}`) ?? null)
    const trend = detectTrend(d.trendScores)
    const urgency = d.evidence >= MIN_EVIDENCE ? priorityScore({ score: d.score, tier, belowCohort: flags.belowCohort, trend, topicCode: d.topicCode }) : 0
    return { ...d, tier, trend, ...flags, urgency }
  })
  const ranked = classified.filter((c) => c.urgency > 0).sort((a, b) => b.urgency - a.urgency)
  const rankOf = new Map(ranked.map((c, i) => [`${c.dimensionType}:${c.dimensionId}`, i]))

  const computedAt = new Date()
  await prisma.$transaction([
    prisma.competencyInsight.deleteMany({ where: { userId, orgId } }),
    prisma.competencyInsight.createMany({
      data: classified.map((c) => ({
        userId,
        orgId,
        dimensionType: c.dimensionType,
        dimensionId: c.dimensionId,
        dimensionName: c.dimensionName,
        sectionId: c.sectionId,
        score: c.score,
        tier: c.tier,
        belowAbsolute: c.belowAbsolute,
        belowCohort: c.belowCohort,
        trend: c.trend,
        priority: rankOf.get(`${c.dimensionType}:${c.dimensionId}`) ?? UNRANKED,
        computedAt,
      })),
    }),
  ])
  await generateRecommendations(userId, orgId)
  return { insights: classified.length, priorities: ranked.length }
}

const insightSelect = {
  dimensionType: true,
  dimensionId: true,
  dimensionName: true,
  sectionId: true,
  score: true,
  tier: true,
  belowAbsolute: true,
  belowCohort: true,
  trend: true,
  priority: true,
  computedAt: true,
} as const

export async function getInsights(userId: string, orgId: string) {
  return prisma.competencyInsight.findMany({ where: { userId, orgId }, select: insightSelect, orderBy: [{ priority: 'asc' }, { score: 'desc' }] })
}

/** Strong / on-track dimensions, best first. */
export async function getStrengths(userId: string, orgId: string) {
  return prisma.competencyInsight.findMany({
    where: { userId, orgId, tier: { in: ['STRONG', 'ON_TRACK'] }, belowCohort: false },
    select: insightSelect,
    orderBy: { score: 'desc' },
  })
}

/** Everything that needs attention, most urgent first. */
export async function getWeaknesses(userId: string, orgId: string) {
  return prisma.competencyInsight.findMany({
    where: { userId, orgId, OR: [{ tier: { in: ['CRITICAL_GAP', 'NEEDS_WORK'] } }, { belowCohort: true }] },
    select: insightSelect,
    orderBy: [{ priority: 'asc' }, { score: 'asc' }],
  })
}

/** The n things to fix first. */
export async function getTopPriorities(userId: string, orgId: string, n = 3) {
  return prisma.competencyInsight.findMany({
    where: { userId, orgId, priority: { lt: UNRANKED } },
    select: insightSelect,
    orderBy: { priority: 'asc' },
    take: n,
  })
}
