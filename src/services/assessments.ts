import 'server-only'

import type { Prisma } from '@prisma/client'

import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import {
  publishBlockers,
  type AssessmentInput,
  type AutoAssembleCriteria,
} from '@/lib/validators/assessment'

/**
 * Plan 012 — assessment assembly.
 *
 * Org-scoped throughout: every read and write filters by orgId, so one org can
 * never see or touch another's assessments, sections, or questions — even with
 * a guessed id.
 */

const fullInclude = {
  sections: {
    orderBy: { order: 'asc' },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { question: { include: { options: true } } },
      },
    },
  },
} satisfies Prisma.AssessmentInclude

export async function listAssessments(orgId: string, status?: string) {
  return prisma.assessment.findMany({
    where: { orgId, ...(status ? { status: status as never } : {}) },
    orderBy: { updatedAt: 'desc' },
    include: { sections: { include: { questions: true } } },
  })
}

/** Fetch one assessment scoped to the org, with sections + questions. */
export async function getAssessment(orgId: string, id: string) {
  const a = await prisma.assessment.findFirst({ where: { id, orgId }, include: fullInclude })
  if (!a) throw new NotFoundError('Assessment not found')
  return a
}

/** Loads and returns the assessment's org, throwing if it doesn't exist. */
export async function getAssessmentOrgId(id: string): Promise<string> {
  const a = await prisma.assessment.findUnique({ where: { id }, select: { orgId: true } })
  if (!a) throw new NotFoundError('Assessment not found')
  return a.orgId
}

export async function createAssessment(orgId: string, userId: string, data: AssessmentInput) {
  return prisma.assessment.create({
    data: {
      orgId,
      createdById: userId,
      title: data.title,
      description: data.description ?? null,
      durationMinutes: data.durationMinutes,
      scoringPolicy: data.scoringPolicy,
      maxAttempts: data.maxAttempts,
      shuffleQuestions: data.shuffleQuestions,
      shuffleOptions: data.shuffleOptions,
      passingScore: data.passingScore ?? null,
      startAt: data.startAt ? new Date(data.startAt) : null,
      endAt: data.endAt ? new Date(data.endAt) : null,
      // Plan 018 — pass through when the client set them; otherwise DB defaults.
      ...(data.proctoringEnabled !== undefined
        ? { proctoringEnabled: data.proctoringEnabled }
        : {}),
      ...(data.snapshotIntervalSec !== undefined
        ? { snapshotIntervalSec: data.snapshotIntervalSec }
        : {}),
      ...(data.storeSnapshots !== undefined ? { storeSnapshots: data.storeSnapshots } : {}),
      ...(data.faceMatchThreshold !== undefined
        ? { faceMatchThreshold: data.faceMatchThreshold }
        : {}),
    },
    include: fullInclude,
  })
}

export async function updateAssessment(orgId: string, id: string, data: AssessmentInput) {
  await getAssessment(orgId, id) // scope check
  return prisma.assessment.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description ?? null,
      durationMinutes: data.durationMinutes,
      scoringPolicy: data.scoringPolicy,
      maxAttempts: data.maxAttempts,
      shuffleQuestions: data.shuffleQuestions,
      shuffleOptions: data.shuffleOptions,
      passingScore: data.passingScore ?? null,
      startAt: data.startAt ? new Date(data.startAt) : null,
      endAt: data.endAt ? new Date(data.endAt) : null,
      // Plan 018 — only overwrite when the client sent the field; otherwise
      // the existing value stays, so a partial PATCH cannot accidentally
      // reset proctoring config.
      ...(data.proctoringEnabled !== undefined
        ? { proctoringEnabled: data.proctoringEnabled }
        : {}),
      ...(data.snapshotIntervalSec !== undefined
        ? { snapshotIntervalSec: data.snapshotIntervalSec }
        : {}),
      ...(data.storeSnapshots !== undefined ? { storeSnapshots: data.storeSnapshots } : {}),
      ...(data.faceMatchThreshold !== undefined
        ? { faceMatchThreshold: data.faceMatchThreshold }
        : {}),
    },
    include: fullInclude,
  })
}

export async function deleteAssessment(orgId: string, id: string) {
  await getAssessment(orgId, id)
  await prisma.assessment.delete({ where: { id } })
}

/* ---- sections ---------------------------------------------------------- */

export async function addSection(
  orgId: string,
  assessmentId: string,
  data: { title: string; description?: string; durationMinutes?: number },
) {
  await getAssessment(orgId, assessmentId) // scope check
  const count = await prisma.assessmentSection.count({ where: { assessmentId } })
  return prisma.assessmentSection.create({
    data: {
      assessmentId,
      title: data.title,
      description: data.description ?? null,
      durationMinutes: data.durationMinutes ?? null,
      order: count,
    },
  })
}

/** Confirms a section belongs to an assessment in this org. */
async function assertSectionInOrg(orgId: string, sectionId: string) {
  const section = await prisma.assessmentSection.findUnique({
    where: { id: sectionId },
    select: { assessment: { select: { orgId: true } } },
  })
  if (!section || section.assessment.orgId !== orgId) throw new NotFoundError('Section not found')
}

export async function deleteSection(orgId: string, sectionId: string) {
  await assertSectionInOrg(orgId, sectionId)
  await prisma.assessmentSection.delete({ where: { id: sectionId } })
}

/* ---- questions in a section -------------------------------------------- */

export async function addQuestions(orgId: string, sectionId: string, questionIds: string[]) {
  await assertSectionInOrg(orgId, sectionId)

  // Every question must belong to this org — no borrowing across tenants.
  const owned = await prisma.question.count({ where: { orgId, id: { in: questionIds } } })
  if (owned !== questionIds.length) {
    throw new ValidationError('One or more questions do not belong to this organization')
  }

  const existing = await prisma.assessmentQuestion.count({ where: { sectionId } })
  // createMany + skipDuplicates: re-adding a question already in the section is
  // a no-op rather than an error.
  await prisma.assessmentQuestion.createMany({
    data: questionIds.map((questionId, i) => ({ sectionId, questionId, order: existing + i })),
    skipDuplicates: true,
  })
}

export async function removeQuestion(orgId: string, sectionId: string, questionId: string) {
  await assertSectionInOrg(orgId, sectionId)
  await prisma.assessmentQuestion.deleteMany({ where: { sectionId, questionId } })
}

/**
 * Auto-assemble: randomly pick `count` questions matching the criteria that
 * aren't already in the section, and add them.
 */
export async function autoAssemble(
  orgId: string,
  sectionId: string,
  criteria: AutoAssembleCriteria,
): Promise<number> {
  await assertSectionInOrg(orgId, sectionId)

  const already = await prisma.assessmentQuestion.findMany({
    where: { sectionId },
    select: { questionId: true },
  })
  const excludeIds = already.map((q) => q.questionId)

  const pool = await prisma.question.findMany({
    where: {
      orgId,
      id: { notIn: excludeIds },
      ...(criteria.type && { type: criteria.type }),
      ...(criteria.difficulty && { difficulty: criteria.difficulty }),
      ...(criteria.tagId && { tags: { some: { tagId: criteria.tagId } } }),
    },
    select: { id: true },
  })

  // Shuffle and take `count`. Random selection is the point of auto-assembly.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const chosen = pool.slice(0, criteria.count).map((q) => q.id)
  if (chosen.length === 0) return 0

  await addQuestions(orgId, sectionId, chosen)
  return chosen.length
}

/* ---- marks + publish --------------------------------------------------- */

/** Total marks = sum of per-assessment override, else the question's default. */
export async function computeTotalMarks(orgId: string, assessmentId: string): Promise<number> {
  const a = await getAssessment(orgId, assessmentId)
  return a.sections.reduce(
    (sum, s) =>
      sum + s.questions.reduce((n, q) => n + (q.marksOverride ?? q.question.marks), 0),
    0,
  )
}

export async function publishAssessment(orgId: string, id: string) {
  const a = await getAssessment(orgId, id)

  const blockers = publishBlockers(a)
  if (blockers.length > 0) {
    throw new ValidationError(`Cannot publish: ${blockers.join('; ')}`)
  }

  return prisma.assessment.update({
    where: { id },
    data: { status: 'PUBLISHED' },
    include: fullInclude,
  })
}
