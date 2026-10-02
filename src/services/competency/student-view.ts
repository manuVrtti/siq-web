import 'server-only'

import type { CompetencyTier, CompetencyTrend } from '@prisma/client'

import { CUMULATIVE_REF, UNRANKED } from '@/constants/competency-thresholds'
import { prisma } from '@/lib/prisma'
import { getCompetencyVsCohort } from '@/services/competency/read'
import { getRecommendations } from '@/services/competency/recommendations'

/**
 * Plan 027 — everything the student's strengths & weaknesses screens need,
 * in one plain-JSON shape. Always the caller's OWN data: pass the signed-in
 * student's id, never a request parameter.
 */

export type Dim = {
  id: string
  name: string
  score: number
  questions: number
  tier: CompetencyTier
  trend: CompetencyTrend
  priority: number
  vs: { belowP25: boolean; aboveP75: boolean; cohort: string } | null
}
export type TopicView = Dim & { code: string; skills: Dim[] }

export async function getStudentCompetencyView(userId: string, orgId: string, opts: { compare?: boolean } = {}) {
  const [sections, skills, insights, recs, cohort] = await Promise.all([
    prisma.sectionCompetency.findMany({
      where: { userId, orgId, scope: 'CUMULATIVE', scopeRefId: CUMULATIVE_REF },
      select: { sectionId: true, weightedScore: true, questionsAttempted: true, section: { select: { name: true, code: true } } },
    }),
    prisma.skillCompetency.findMany({
      where: { userId, orgId, scope: 'CUMULATIVE', scopeRefId: CUMULATIVE_REF },
      select: { skillId: true, weightedScore: true, questionsAttempted: true, skill: { select: { name: true, sectionId: true } } },
    }),
    prisma.competencyInsight.findMany({ where: { userId, orgId }, select: { dimensionType: true, dimensionId: true, tier: true, trend: true, priority: true } }),
    getRecommendations(userId, orgId),
    opts.compare ? getCompetencyVsCohort(userId, orgId) : Promise.resolve(null),
  ])
  const ins = new Map(insights.map((i) => [`${i.dimensionType}:${i.dimensionId}`, i]))
  const vsSection = new Map(cohort?.sections.map((s) => [s.sectionId, s.vs]) ?? [])
  const vsSkill = new Map(cohort?.sections.flatMap((s) => s.skills.map((k) => [k.skillId, k.vs] as const)) ?? [])

  const dim = (type: 'SECTION' | 'SKILL', id: string, name: string, score: number, questions: number): Dim => {
    const i = ins.get(`${type}:${id}`)
    const vs = (type === 'SECTION' ? vsSection.get(id) : vsSkill.get(id)) ?? null
    return {
      id,
      name,
      score: Math.round(score),
      questions,
      tier: i?.tier ?? 'ON_TRACK',
      trend: i?.trend ?? 'INSUFFICIENT_DATA',
      priority: i?.priority ?? UNRANKED,
      vs: vs ? { belowP25: vs.belowP25, aboveP75: vs.aboveP75, cohort: vs.cohort } : null,
    }
  }

  const topics: TopicView[] = sections
    .map((s) => ({
      ...dim('SECTION', s.sectionId, s.section.name, s.weightedScore, s.questionsAttempted),
      code: s.section.code,
      skills: skills
        .filter((k) => k.skill.sectionId === s.sectionId)
        .map((k) => dim('SKILL', k.skillId, k.skill.name, k.weightedScore, k.questionsAttempted))
        .sort((a, b) => b.score - a.score),
    }))
    .sort((a, b) => b.score - a.score)

  const allSkills = topics.flatMap((t) => t.skills.map((k) => ({ ...k, topic: t.name, topicId: t.id })))
  return {
    topics,
    strengths: [...topics.map((t) => ({ ...t, topic: null as string | null })), ...allSkills.map((k) => ({ ...k, topic: k.topic }))]
      .filter((d) => (d.tier === 'STRONG' || d.tier === 'ON_TRACK') && d.questions >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4),
    focus: recs.map((r) => ({
      skillId: r.skillId,
      skillName: r.skillName,
      reason: r.reason,
      questionCount: r.questionCount,
      topicId: r.skill.sectionId,
      score: allSkills.find((k) => k.id === r.skillId)?.score ?? null,
      tier: allSkills.find((k) => k.id === r.skillId)?.tier ?? 'NEEDS_WORK',
    })),
    hasProfile: topics.length > 0,
  }
}

/** One topic's score in each counted test, oldest first, for the trend chart. */
export async function getTopicHistory(userId: string, orgId: string, sectionId: string) {
  const snaps = await prisma.sectionCompetency.findMany({
    where: { userId, orgId, sectionId, scope: 'ASSESSMENT' },
    select: { scopeRefId: true, weightedScore: true },
  })
  if (snaps.length === 0) return []
  const results = await prisma.result.findMany({
    where: { userId, status: 'GRADED', assessmentId: { in: snaps.map((s) => s.scopeRefId) } },
    orderBy: { createdAt: 'desc' },
    select: { assessmentId: true, createdAt: true, assessment: { select: { title: true } } },
  })
  const at = new Map<string, { t: number; title: string }>()
  for (const r of results) if (!at.has(r.assessmentId)) at.set(r.assessmentId, { t: r.createdAt.getTime(), title: r.assessment.title })
  return snaps
    .filter((s) => at.has(s.scopeRefId))
    .map((s) => ({ title: at.get(s.scopeRefId)!.title, t: at.get(s.scopeRefId)!.t, value: Math.round(s.weightedScore) }))
    .sort((a, b) => a.t - b.t)
    .map(({ title, value }) => ({ title, value }))
}
