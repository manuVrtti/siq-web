import 'server-only'

import { Prisma } from '@prisma/client'

import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

/**
 * Plan 015 — exam runtime service.
 *
 * The candidate reaches this via /exam/{token}. Every state transition is
 * server-authoritative:
 *
 *   - The TIMER: `deadlineAt` is set once at attempt start (server clock) and
 *     enforced on every save and submit. A candidate manipulating their own
 *     clock cannot extend the exam.
 *   - The SHUFFLE: resolved once when the attempt is created and stored in
 *     `questionOrder`. A refresh replays the same order.
 *   - The AUTH: every call verifies that the signed-in userId matches the
 *     assignment's userId. A leaked token alone gives nothing.
 */

/* ---- validate ---------------------------------------------------------- */

export type ValidationOk = {
  ok: true
  assignment: {
    id: string
    token: string
    status: string
    assessment: {
      id: string
      title: string
      description: string | null
      durationMinutes: number
      status: string
      startAt: Date | null
      endAt: Date | null
      totalSections: number
      totalQuestions: number
    }
  }
}
export type ValidationFail = {
  ok: false
  reason:
    | 'INVALID_TOKEN'
    | 'WRONG_USER'
    | 'ASSESSMENT_NOT_PUBLISHED'
    | 'NOT_OPEN'
    | 'CLOSED'
    | 'ALREADY_SUBMITTED'
}
export type ValidationResult = ValidationOk | ValidationFail

/**
 * Validates that a candidate may enter the exam. Takes `userId` so a leaked
 * token can't be exercised by a signed-in third party.
 */
export async function validateToken(token: string, userId: string | null): Promise<ValidationResult> {
  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { token },
    include: {
      assessment: {
        include: {
          sections: { include: { _count: { select: { questions: true } } } },
        },
      },
    },
  })
  if (!assignment) return { ok: false, reason: 'INVALID_TOKEN' }

  // Token alone is not sufficient. The caller must be the assigned user.
  if (!userId || userId !== assignment.userId) return { ok: false, reason: 'WRONG_USER' }

  if (assignment.assessment.status !== 'PUBLISHED') {
    return { ok: false, reason: 'ASSESSMENT_NOT_PUBLISHED' }
  }
  if (assignment.status === 'SUBMITTED') return { ok: false, reason: 'ALREADY_SUBMITTED' }

  const now = new Date()
  if (assignment.assessment.startAt && now < assignment.assessment.startAt) {
    return { ok: false, reason: 'NOT_OPEN' }
  }
  if (assignment.assessment.endAt && now > assignment.assessment.endAt) {
    return { ok: false, reason: 'CLOSED' }
  }

  return {
    ok: true,
    assignment: {
      id: assignment.id,
      token: assignment.token,
      status: assignment.status,
      assessment: {
        id: assignment.assessment.id,
        title: assignment.assessment.title,
        description: assignment.assessment.description,
        durationMinutes: assignment.assessment.durationMinutes,
        status: assignment.assessment.status,
        startAt: assignment.assessment.startAt,
        endAt: assignment.assessment.endAt,
        totalSections: assignment.assessment.sections.length,
        totalQuestions: assignment.assessment.sections.reduce(
          (n, s) => n + s._count.questions,
          0,
        ),
      },
    },
  }
}

/* ---- start ------------------------------------------------------------- */

// Fisher-Yates in place, using the ambient Math.random. Determinism is not
// required — the *result* is stored on the attempt.
function shuffleInPlace<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type QuestionOrder = { sections: { sectionId: string; questionIds: string[] }[] }

/**
 * Start an exam attempt. Idempotent: returns the existing attempt if the
 * candidate has already started this assignment.
 */
export async function startAttempt(token: string, userId: string) {
  const v = await validateToken(token, userId)
  if (!v.ok) throw new ForbiddenError(v.reason)

  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { token },
    include: {
      assessment: {
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: { questions: { orderBy: { order: 'asc' }, select: { questionId: true } } },
          },
        },
      },
      attempt: true,
    },
  })
  if (!assignment) throw new NotFoundError('Assignment not found')

  if (assignment.attempt) return assignment.attempt

  const shouldShuffleQuestions = assignment.assessment.shuffleQuestions
  const order: QuestionOrder = {
    sections: assignment.assessment.sections.map((s) => {
      const ids = s.questions.map((q) => q.questionId)
      if (shouldShuffleQuestions) shuffleInPlace(ids)
      return { sectionId: s.id, questionIds: ids }
    }),
  }

  const now = new Date()
  const deadlineAt = new Date(now.getTime() + assignment.assessment.durationMinutes * 60_000)

  // Create the attempt AND flip the assignment status atomically. Two clicks
  // on Start race safely because attemptId is UNIQUE on the assignment.
  try {
    const [attempt] = await prisma.$transaction([
      prisma.examAttempt.create({
        data: {
          assignmentId: assignment.id,
          userId,
          assessmentId: assignment.assessmentId,
          startedAt: now,
          deadlineAt,
          questionOrder: order as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.assessmentAssignment.update({
        where: { id: assignment.id },
        data: { status: 'STARTED', startedAt: now },
      }),
    ])
    return attempt
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // Someone else won the race — return whatever's now there.
      const existing = await prisma.examAttempt.findUnique({ where: { assignmentId: assignment.id } })
      if (existing) return existing
    }
    throw e
  }
}

/* ---- runtime state ----------------------------------------------------- */

/**
 * Full runtime state for the attempt UI. Includes the assessment shell, the
 * resolved shuffle, saved answers, and the SERVER'S notion of time remaining.
 * The client renders from this — the client's clock is only used for the
 * countdown animation.
 */
export async function getAttemptState(token: string, userId: string) {
  const v = await validateToken(token, userId)
  if (!v.ok) throw new ForbiddenError(v.reason)

  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { token },
    include: {
      assessment: {
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  question: {
                    include: { options: { orderBy: { order: 'asc' } } },
                  },
                },
              },
            },
          },
        },
      },
      attempt: { include: { answers: true } },
    },
  })
  if (!assignment) throw new NotFoundError('Assignment not found')
  if (!assignment.attempt) return { assignment, attempt: null }

  const answersByQuestion: Record<
    string,
    { selectedOptionIds: string[]; textAnswer: string | null }
  > = {}
  for (const a of assignment.attempt.answers) {
    answersByQuestion[a.questionId] = {
      selectedOptionIds: a.selectedOptionIds,
      textAnswer: a.textAnswer,
    }
  }

  const now = new Date()
  const remainingMs = Math.max(0, assignment.attempt.deadlineAt.getTime() - now.getTime())

  return {
    assignment,
    attempt: {
      id: assignment.attempt.id,
      startedAt: assignment.attempt.startedAt,
      deadlineAt: assignment.attempt.deadlineAt,
      submittedAt: assignment.attempt.submittedAt,
      questionOrder: assignment.attempt.questionOrder as unknown as QuestionOrder,
      answers: answersByQuestion,
      remainingMs,
    },
    now,
  }
}

/* ---- save + submit ----------------------------------------------------- */

async function loadOpenAttempt(token: string, userId: string) {
  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { token },
    include: { attempt: true },
  })
  if (!assignment) throw new NotFoundError('Assignment not found')
  if (assignment.userId !== userId) throw new ForbiddenError('Not your exam')
  if (!assignment.attempt) throw new ValidationError('Exam has not started')
  if (assignment.attempt.submittedAt) throw new ValidationError('Exam already submitted')

  const now = new Date()
  if (now > assignment.attempt.deadlineAt) throw new ValidationError('Time is up')

  return { attempt: assignment.attempt, questionOrder: assignment.attempt.questionOrder as unknown as QuestionOrder }
}

/** Autosave one answer. Deadline is enforced. */
export async function saveAnswer(
  token: string,
  userId: string,
  input: { questionId: string; selectedOptionIds?: string[]; textAnswer?: string | null },
) {
  const { attempt, questionOrder } = await loadOpenAttempt(token, userId)

  // Question must actually belong to this attempt.
  const validQuestionIds = new Set(questionOrder.sections.flatMap((s) => s.questionIds))
  if (!validQuestionIds.has(input.questionId)) {
    throw new ValidationError('That question is not part of this exam')
  }

  await prisma.examAnswer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: input.questionId } },
    create: {
      attemptId: attempt.id,
      questionId: input.questionId,
      selectedOptionIds: input.selectedOptionIds ?? [],
      textAnswer: input.textAnswer ?? null,
    },
    update: {
      selectedOptionIds: input.selectedOptionIds ?? [],
      textAnswer: input.textAnswer ?? null,
      savedAt: new Date(),
    },
  })
}

/**
 * Final submit. Idempotent: a second submit after the first returns the
 * already-submitted state instead of erroring.
 */
export async function submitAttempt(token: string, userId: string) {
  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { token },
    include: { attempt: true },
  })
  if (!assignment) throw new NotFoundError('Assignment not found')
  if (assignment.userId !== userId) throw new ForbiddenError('Not your exam')
  if (!assignment.attempt) throw new ValidationError('Exam has not started')
  if (assignment.attempt.submittedAt) return { alreadySubmitted: true }

  const now = new Date()
  // If the deadline passed, we still submit whatever is saved — this is also
  // the "auto-submit on expiry" path.
  await prisma.$transaction([
    prisma.examAttempt.update({
      where: { id: assignment.attempt.id },
      data: { submittedAt: now },
    }),
    prisma.assessmentAssignment.update({
      where: { id: assignment.id },
      data: { status: 'SUBMITTED', submittedAt: now },
    }),
  ])
  return { alreadySubmitted: false }
}
