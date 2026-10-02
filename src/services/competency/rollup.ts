import 'server-only'

import type { CompetencyScope } from '@prisma/client'

import { CUMULATIVE_REF } from '@/constants/competency-thresholds'
import { rollup, type Difficulty, type GradedItem } from '@/lib/competency/weighting'
import { prisma } from '@/lib/prisma'
import { generateInsights } from '@/services/competency/insights'

/**
 * Plan 025 — the competency rollup engine.
 *
 * Joins every graded QuestionResult to its question's topic + skills (plan
 * 021) and rolls it up per student, per college:
 *
 *   ASSESSMENT snapshot — one test (scopeRefId = assessmentId)
 *   CUMULATIVE profile  — every counted test in that college (scopeRefId = "ALL")
 *
 * What counts: GRADED results of tests with `countsForAnalytics`, the latest
 * graded attempt per test (a retake replaces, never double-counts). Questions
 * without a topic are skipped. Rows are replaced wholesale in a transaction,
 * so a recompute is idempotent and a full rebuild equals the incremental one.
 */

export { CUMULATIVE_REF }

type Item = GradedItem & { sectionId: string | null; skillIds: string[] }

/** Latest graded, counted result per assessment for this student in this org. */
async function countedResults(userId: string, orgId: string, assessmentId?: string) {
  const results = await prisma.result.findMany({
    where: {
      userId,
      status: 'GRADED',
      assessment: { orgId, countsForAnalytics: true, ...(assessmentId && { id: assessmentId }) },
    },
    orderBy: [{ gradedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, assessmentId: true, questionResults: { select: { questionId: true, scoreAwarded: true, maxMarks: true } } },
  })
  const latest = new Map<string, (typeof results)[number]>()
  for (const r of results) if (!latest.has(r.assessmentId)) latest.set(r.assessmentId, r)
  return [...latest.values()]
}

/** Attach difficulty + topic + skills to each graded answer. */
async function itemsFor(results: Awaited<ReturnType<typeof countedResults>>): Promise<Item[]> {
  const qIds = [...new Set(results.flatMap((r) => r.questionResults.map((q) => q.questionId)))]
  if (qIds.length === 0) return []
  const questions = await prisma.question.findMany({
    where: { id: { in: qIds } },
    select: { id: true, difficulty: true, topic: { select: { sectionId: true } }, skills: { select: { skillId: true } } },
  })
  const byId = new Map(questions.map((q) => [q.id, q]))
  const items: Item[] = []
  for (const r of results) {
    for (const qr of r.questionResults) {
      const q = byId.get(qr.questionId)
      if (!q?.topic) continue // untagged (or deleted) question: no dimension to attribute to
      items.push({
        difficulty: q.difficulty as Difficulty,
        scoreAwarded: qr.scoreAwarded,
        maxMarks: qr.maxMarks,
        sectionId: q.topic.sectionId,
        skillIds: q.skills.map((s) => s.skillId),
      })
    }
  }
  return items
}

function group(items: Item[]) {
  const sections = new Map<string, Item[]>()
  const skills = new Map<string, Item[]>()
  for (const it of items) {
    if (it.sectionId) (sections.get(it.sectionId) ?? sections.set(it.sectionId, []).get(it.sectionId)!).push(it)
    for (const s of it.skillIds) (skills.get(s) ?? skills.set(s, []).get(s)!).push(it)
  }
  return { sections, skills }
}

/** Replace one (student, org, scope, ref) slice with freshly computed rows. */
async function writeSlice(userId: string, orgId: string, scope: CompetencyScope, scopeRefId: string, items: Item[]) {
  const { sections, skills } = group(items)
  const computedAt = new Date()
  await prisma.$transaction([
    prisma.sectionCompetency.deleteMany({ where: { userId, orgId, scope, scopeRefId } }),
    prisma.skillCompetency.deleteMany({ where: { userId, orgId, scope, scopeRefId } }),
    prisma.sectionCompetency.createMany({
      data: [...sections].map(([sectionId, its]) => ({ userId, orgId, sectionId, scope, scopeRefId, computedAt, ...rollup(its) })),
    }),
    prisma.skillCompetency.createMany({
      data: [...skills].map(([skillId, its]) => ({ userId, orgId, skillId, scope, scopeRefId, computedAt, ...rollup(its) })),
    }),
  ])
  return { sections: sections.size, skills: skills.size }
}

/** One test's snapshot. A test that no longer counts (or has no graded result) clears it. */
export async function computeAssessmentCompetency(userId: string, assessmentId: string) {
  const a = await prisma.assessment.findUnique({ where: { id: assessmentId }, select: { orgId: true } })
  if (!a) return null
  const results = await countedResults(userId, a.orgId, assessmentId)
  return writeSlice(userId, a.orgId, 'ASSESSMENT', assessmentId, await itemsFor(results))
}

/** The student's rolling profile in one college. */
export async function recomputeCumulative(userId: string, orgId: string) {
  const results = await countedResults(userId, orgId)
  const written = await writeSlice(userId, orgId, 'CUMULATIVE', CUMULATIVE_REF, await itemsFor(results))
  // Plan 026 — classify the fresh profile (tiers, trends, priorities, practice).
  await generateInsights(userId, orgId)
  return written
}

/** Grading hook: refresh this test's snapshot, then the cumulative profile. */
export async function recomputeForStudent(userId: string, assessmentId: string) {
  const a = await prisma.assessment.findUnique({ where: { id: assessmentId }, select: { orgId: true } })
  if (!a) return
  await computeAssessmentCompetency(userId, assessmentId)
  await recomputeCumulative(userId, a.orgId)
}

/** Every student with a graded result in this test (e.g. its analytics flag changed). */
export async function recomputeAssessment(assessmentId: string) {
  const users = await prisma.result.findMany({ where: { assessmentId, status: 'GRADED' }, select: { userId: true }, distinct: ['userId'] })
  for (const { userId } of users) await recomputeForStudent(userId, assessmentId)
  return users.length
}

/** Questions were retagged: refresh every graded student who answered them. */
export async function recomputeForQuestions(questionIds: string[]) {
  if (questionIds.length === 0) return 0
  const pairs = await prisma.result.findMany({
    where: { status: 'GRADED', questionResults: { some: { questionId: { in: questionIds } } } },
    select: { userId: true, assessmentId: true },
    distinct: ['userId', 'assessmentId'],
  })
  for (const p of pairs) await recomputeForStudent(p.userId, p.assessmentId)
  return pairs.length
}

/**
 * Full rebuild for a college: clears every competency row and recomputes
 * from the graded results. Used by the College Admin "Recompute" action and
 * to verify incremental == full.
 */
export async function recomputeOrg(orgId: string) {
  const pairs = await prisma.result.findMany({
    where: { status: 'GRADED', assessment: { orgId } },
    select: { userId: true, assessmentId: true },
    distinct: ['userId', 'assessmentId'],
  })
  await prisma.$transaction([
    prisma.sectionCompetency.deleteMany({ where: { orgId } }),
    prisma.skillCompetency.deleteMany({ where: { orgId } }),
  ])
  const students = new Set<string>()
  for (const p of pairs) {
    await computeAssessmentCompetency(p.userId, p.assessmentId)
    students.add(p.userId)
  }
  for (const userId of students) await recomputeCumulative(userId, orgId)
  return { students: students.size, tests: new Set(pairs.map((p) => p.assessmentId)).size }
}
