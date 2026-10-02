import 'server-only'

import { stats } from '@/lib/competency/weighting'
import { prisma } from '@/lib/prisma'

/**
 * Plan 025 — cohort baselines: avg / median / p25 / p75 of students'
 * CUMULATIVE weighted scores, per topic and per skill, for four cohorts:
 *
 *   whole college · each department · each batch (graduation year) · department × batch
 *
 * Rebuilt per college in one transaction. There is no scheduler yet, so
 * baselines are rebuilt lazily: `ensureFreshBaselines` recomputes when any
 * student's profile changed after the last build.
 */

type Key = { departmentId: string | null; batchYear: number | null; dimensionType: 'SECTION' | 'SKILL'; dimensionId: string }

export async function computeBaselines(orgId: string) {
  const [sections, skills, members] = await Promise.all([
    prisma.sectionCompetency.findMany({ where: { orgId, scope: 'CUMULATIVE' }, select: { userId: true, sectionId: true, weightedScore: true } }),
    prisma.skillCompetency.findMany({ where: { orgId, scope: 'CUMULATIVE' }, select: { userId: true, skillId: true, weightedScore: true } }),
    prisma.organizationMember.findMany({
      where: { orgId, user: { role: 'STUDENT' } },
      select: { userId: true, departmentId: true, user: { select: { candidateProfile: { select: { graduationYear: true } } } } },
    }),
  ])
  const who = new Map(members.map((m) => [m.userId, { dept: m.departmentId, year: m.user.candidateProfile?.graduationYear ?? null }]))

  const buckets = new Map<string, { key: Key; values: number[] }>()
  const put = (key: Key, v: number) => {
    const k = JSON.stringify(key)
    ;(buckets.get(k) ?? buckets.set(k, { key, values: [] }).get(k)!).values.push(v)
  }
  const add = (userId: string, dimensionType: Key['dimensionType'], dimensionId: string, v: number) => {
    const w = who.get(userId)
    if (!w) return // no longer a student of this college
    put({ departmentId: null, batchYear: null, dimensionType, dimensionId }, v)
    if (w.dept) put({ departmentId: w.dept, batchYear: null, dimensionType, dimensionId }, v)
    if (w.year) put({ departmentId: null, batchYear: w.year, dimensionType, dimensionId }, v)
    if (w.dept && w.year) put({ departmentId: w.dept, batchYear: w.year, dimensionType, dimensionId }, v)
  }
  for (const r of sections) add(r.userId, 'SECTION', r.sectionId, r.weightedScore)
  for (const r of skills) add(r.userId, 'SKILL', r.skillId, r.weightedScore)

  const computedAt = new Date()
  const data = [...buckets.values()].map(({ key, values }) => ({ orgId, computedAt, ...key, ...stats(values) }))
  await prisma.$transaction([
    prisma.cohortBaseline.deleteMany({ where: { orgId } }),
    prisma.cohortBaseline.createMany({ data }),
  ])
  return { rows: data.length, computedAt }
}

/** Rebuild if any profile in this college changed since the last build. */
export async function ensureFreshBaselines(orgId: string) {
  const [last, newestSection, newestSkill] = await Promise.all([
    prisma.cohortBaseline.findFirst({ where: { orgId }, orderBy: { computedAt: 'desc' }, select: { computedAt: true } }),
    prisma.sectionCompetency.findFirst({ where: { orgId, scope: 'CUMULATIVE' }, orderBy: { computedAt: 'desc' }, select: { computedAt: true } }),
    prisma.skillCompetency.findFirst({ where: { orgId, scope: 'CUMULATIVE' }, orderBy: { computedAt: 'desc' }, select: { computedAt: true } }),
  ])
  const newest = Math.max(newestSection?.computedAt.getTime() ?? 0, newestSkill?.computedAt.getTime() ?? 0)
  if (!last ? newest > 0 : newest > last.computedAt.getTime()) await computeBaselines(orgId)
}
