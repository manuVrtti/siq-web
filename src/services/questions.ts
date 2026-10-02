import 'server-only'

import type { Prisma, QuestionType, Difficulty } from '@prisma/client'

import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { QuestionInput } from '@/lib/validators/question'
import { setQuestionTagging, untaggedWhere, validateTagging } from '@/services/taxonomy'
import { recomputeForQuestions } from '@/services/competency/rollup'
import { safely } from '@/services/notifications/events'

/**
 * Plan 011 — question business logic.
 *
 * Every function is org-scoped: callers pass the orgId that `requireOrgAccess`
 * has already authorised, and queries filter by it. A question is never fetched
 * or mutated without its org in the WHERE clause, so one org can never reach
 * another's questions even with a guessed id.
 */

const questionInclude = {
  options: { orderBy: { order: 'asc' } },
  tags: { include: { tag: true } },
  topic: { include: { section: { select: { id: true, name: true, code: true } } } },
  skills: { include: { skill: { select: { id: true, name: true } } } },
} satisfies Prisma.QuestionInclude

export const QUESTION_SORTS = ['createdAt', 'updatedAt', 'title', 'marks', 'difficulty'] as const
export type QuestionSort = (typeof QUESTION_SORTS)[number]

export type QuestionFilters = {
  type?: QuestionType
  difficulty?: Difficulty
  tagId?: string
  /** Plan 021 — a topic id, or 'untagged' for the backfill queue. */
  topicId?: string
  skillId?: string
  search?: string
  skip?: number
  take?: number
  sort?: QuestionSort
  dir?: 'asc' | 'desc'
}

export async function listQuestions(orgId: string, filters: QuestionFilters = {}) {
  const where: Prisma.QuestionWhereInput = {
    orgId,
    ...(filters.type && { type: filters.type }),
    ...(filters.difficulty && { difficulty: filters.difficulty }),
    ...(filters.tagId && { tags: { some: { tagId: filters.tagId } } }),
    ...(filters.topicId === 'untagged'
      ? { AND: [untaggedWhere] }
      : filters.topicId && { topic: { is: { sectionId: filters.topicId } } }),
    ...(filters.skillId && { skills: { some: { skillId: filters.skillId } } }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { body: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        ...questionInclude,
        // How many assessments place this question — shown as "Used in" so an
        // admin can see which questions are safe to edit.
        _count: { select: { assessmentQuestions: true } },
      },
      // Secondary sort on id keeps paging stable when the primary key ties.
      orderBy: [{ [filters.sort ?? 'createdAt']: filters.dir ?? 'desc' }, { id: 'asc' }],
      skip: filters.skip ?? 0,
      take: Math.min(filters.take ?? 20, 100),
    }),
    prisma.question.count({ where }),
  ])

  return { items, total }
}

/** Fetch one question, scoped to the org. Throws if it belongs to another org. */
export async function getQuestion(orgId: string, id: string) {
  const question = await prisma.question.findFirst({
    where: { id, orgId },
    include: questionInclude,
  })
  if (!question) throw new NotFoundError('Question not found')
  return question
}

export async function createQuestion(orgId: string, userId: string, data: QuestionInput) {
  const skillIds = data.topicId ? await validateTagging(orgId, data.topicId, data.skillIds) : []
  return prisma.$transaction(async (tx) => {
    const q = await tx.question.create({
    data: {
      orgId,
      createdById: userId,
      type: data.type,
      title: data.title,
      body: data.body,
      difficulty: data.difficulty,
      marks: data.marks,
      negativeMarks: data.negativeMarks,
      explanation: data.explanation ?? null,
      practiceEnabled: data.practiceEnabled,
      options: { create: data.options },
      tags: { create: data.tagIds.map((tagId) => ({ tagId })) },
    },
    })
    if (data.topicId) await setQuestionTagging(tx, q.id, data.topicId, skillIds)
    return tx.question.findUniqueOrThrow({ where: { id: q.id }, include: questionInclude })
  })
}

/**
 * Replace a question's contents. Options and tags are fully replaced rather
 * than diffed — simpler and correct, since the form always submits the full
 * set. Wrapped in a transaction so a question is never left with the old
 * options and new fields (or vice versa).
 */
export async function updateQuestion(
  orgId: string,
  id: string,
  data: QuestionInput,
) {
  // Ensures the question belongs to this org before mutating.
  await getQuestion(orgId, id)
  const skillIds = data.topicId ? await validateTagging(orgId, data.topicId, data.skillIds) : []

  const question = await prisma.$transaction(async (tx) => {
    await tx.questionOption.deleteMany({ where: { questionId: id } })
    await tx.questionTag.deleteMany({ where: { questionId: id } })

    await setQuestionTagging(tx, id, data.topicId ?? null, skillIds)

    const saved = await tx.question.update({
      where: { id },
      data: {
        type: data.type,
        title: data.title,
        body: data.body,
        difficulty: data.difficulty,
        marks: data.marks,
        negativeMarks: data.negativeMarks,
        explanation: data.explanation ?? null,
        practiceEnabled: data.practiceEnabled,
        options: { create: data.options },
        tags: { create: data.tagIds.map((tagId) => ({ tagId })) },
      },
      include: questionInclude,
    })
    return saved
  })
  // Plan 025 — difficulty or topic may have changed for already-graded answers.
  await safely(async () => {
    await recomputeForQuestions([id])
  })
  return question
}

export async function deleteQuestion(orgId: string, id: string) {
  // Scope check first — deleteMany with orgId means a cross-org id deletes
  // nothing rather than erroring, but we want a clear 404.
  await getQuestion(orgId, id)
  await prisma.question.delete({ where: { id } })
}
