import 'server-only'

import type { CompetencyScope } from '@prisma/client'

import { requireOrgAccess } from '@/lib/auth/org-access'
import { assertStudentsInScope, getScope } from '@/lib/auth/scope'
import { ForbiddenError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { baselineLookup, ensureFreshBaselines } from '@/services/competency/cohort-baseline'
import { CUMULATIVE_REF } from '@/constants/competency-thresholds'
import type { CurrentUser } from '@/types/auth'

/**
 * Plan 025 — reading competency profiles.
 *
 * A competency profile is sensitive. Who may read a student's profile in a
 * college:
 *   the student themselves (and only within a college they belong to),
 *   a College Admin of that college, a Super Admin, or an HOD of the
 *   student's department. Recruiters: not yet — a later plan decides what
 *   companies may see, with the student's consent.
 */
export async function assertCanReadCompetency(viewer: CurrentUser, orgId: string, userId: string) {
  if (viewer.id === userId) {
    await requireOrgAccess(viewer, orgId)
    return
  }
  if (viewer.role === 'STUDENT' || viewer.role === 'RECRUITER') throw new ForbiddenError('You can’t view this student’s analytics')
  const scope = await getScope(viewer, orgId) // org membership (and department scope for HODs)
  await assertStudentsInScope(scope, [userId])
}

const scoreFields = {
  questionsAttempted: true,
  questionsCorrect: true,
  rawAccuracy: true,
  weightedScore: true,
  marksEarned: true,
  marksPossible: true,
  computedAt: true,
} as const

/** Topics (with their skills nested) for one student, one college, one scope. */
export async function getStudentCompetencyProfile(
  userId: string,
  orgId: string,
  scope: CompetencyScope = 'CUMULATIVE',
  scopeRefId: string = CUMULATIVE_REF,
) {
  const [sections, skills] = await Promise.all([
    prisma.sectionCompetency.findMany({
      where: { userId, orgId, scope, scopeRefId },
      select: { ...scoreFields, section: { select: { id: true, name: true, code: true } } },
      orderBy: { weightedScore: 'desc' },
    }),
    prisma.skillCompetency.findMany({
      where: { userId, orgId, scope, scopeRefId },
      select: { ...scoreFields, skill: { select: { id: true, name: true, sectionId: true } } },
      orderBy: { weightedScore: 'desc' },
    }),
  ])
  return {
    sections: sections.map(({ section, ...s }) => ({
      sectionId: section.id,
      name: section.name,
      code: section.code,
      ...s,
      skills: skills
        .filter((k) => k.skill.sectionId === section.id)
        .map(({ skill, ...k }) => ({ skillId: skill.id, name: skill.name, ...k })),
    })),
    computedAt: sections[0]?.computedAt ?? null,
  }
}

/** Cumulative topic scores, strongest first. */
export async function getSectionBreakdown(userId: string, orgId: string) {
  const { sections } = await getStudentCompetencyProfile(userId, orgId)
  return sections.map((s) => ({
    sectionId: s.sectionId,
    name: s.name,
    code: s.code,
    questionsAttempted: s.questionsAttempted,
    questionsCorrect: s.questionsCorrect,
    rawAccuracy: s.rawAccuracy,
    weightedScore: s.weightedScore,
    marksEarned: s.marksEarned,
    marksPossible: s.marksPossible,
    computedAt: s.computedAt,
  }))
}

/** Cumulative skill scores, optionally within one topic, strongest first. */
export async function getSkillBreakdown(userId: string, orgId: string, sectionId?: string) {
  const rows = await prisma.skillCompetency.findMany({
    where: { userId, orgId, scope: 'CUMULATIVE', scopeRefId: CUMULATIVE_REF, ...(sectionId && { skill: { sectionId } }) },
    select: { ...scoreFields, skill: { select: { id: true, name: true, sectionId: true } } },
    orderBy: { weightedScore: 'desc' },
  })
  return rows.map(({ skill, ...k }) => ({ skillId: skill.id, name: skill.name, sectionId: skill.sectionId, ...k }))
}

/**
 * The student's score against their cohort for every topic and skill (see
 * `baselineLookup` for which cohort is used).
 */
export async function getCompetencyVsCohort(userId: string, orgId: string) {
  await ensureFreshBaselines(orgId)
  const [profile, lookup] = await Promise.all([getStudentCompetencyProfile(userId, orgId), baselineLookup(userId, orgId)])
  const compare = (type: 'SECTION' | 'SKILL', id: string, score: number) => {
    const b = lookup.get(`${type}:${id}`)
    return b ? { ...b, belowP25: score < b.p25, aboveP75: score > b.p75 } : null
  }
  return {
    sections: profile.sections.map((s) => ({
      sectionId: s.sectionId,
      name: s.name,
      score: s.weightedScore,
      vs: compare('SECTION', s.sectionId, s.weightedScore),
      skills: s.skills.map((k) => ({ skillId: k.skillId, name: k.name, score: k.weightedScore, vs: compare('SKILL', k.skillId, k.weightedScore) })),
    })),
  }
}
