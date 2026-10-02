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

/** Smallest cohort a comparison is shown against — below this, stats mislead. */
export const MIN_COHORT = 5

export type CohortKind = 'DEPARTMENT_BATCH' | 'DEPARTMENT' | 'BATCH' | 'COLLEGE'
export type BaselineRef = { cohort: CohortKind; sampleSize: number; avg: number; median: number; p25: number; p75: number }

/**
 * The baseline a student is compared with, per dimension ("SECTION:<id>" /
 * "SKILL:<id>"): the narrowest cohort with at least MIN_COHORT students —
 * department × batch, then department, then batch, then the whole college.
 */
export async function baselineLookup(userId: string, orgId: string): Promise<Map<string, BaselineRef>> {
  const member = await prisma.organizationMember.findFirst({
    where: { userId, orgId },
    select: { departmentId: true, user: { select: { candidateProfile: { select: { graduationYear: true } } } } },
  })
  const dept = member?.departmentId ?? null
  const year = member?.user.candidateProfile?.graduationYear ?? null
  const rows = await prisma.cohortBaseline.findMany({
    where: {
      orgId,
      sampleSize: { gte: MIN_COHORT },
      OR: [
        { departmentId: null, batchYear: null },
        ...(dept ? [{ departmentId: dept, batchYear: null }] : []),
        ...(year ? [{ departmentId: null, batchYear: year }] : []),
        ...(dept && year ? [{ departmentId: dept, batchYear: year }] : []),
      ],
    },
  })
  const rank = (b: { departmentId: string | null; batchYear: number | null }) => (b.departmentId ? 2 : 0) + (b.batchYear ? 1 : 0)
  const best = new Map<string, (typeof rows)[number]>()
  for (const b of rows) {
    const k = `${b.dimensionType}:${b.dimensionId}`
    const cur = best.get(k)
    if (!cur || rank(b) > rank(cur)) best.set(k, b)
  }
  const out = new Map<string, BaselineRef>()
  for (const [k, b] of best) {
    out.set(k, {
      cohort: b.departmentId && b.batchYear ? 'DEPARTMENT_BATCH' : b.departmentId ? 'DEPARTMENT' : b.batchYear ? 'BATCH' : 'COLLEGE',
      sampleSize: b.sampleSize,
      avg: b.avgAccuracy,
      median: b.medianAccuracy,
      p25: b.p25Accuracy,
      p75: b.p75Accuracy,
    })
  }
  return out
}
