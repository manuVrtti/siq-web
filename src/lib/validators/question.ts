import { z } from 'zod'

/**
 * Plan 011 — question validation, with per-type rules.
 *
 * The rules that make a question *answerable* live here, not just field shapes:
 * an MCQ with no correct option, or a true/false with three choices, is
 * structurally invalid and must be rejected before it can be put in an exam.
 */

export const QUESTION_TYPES = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SUBJECTIVE', 'CODING'] as const
export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const

const optionSchema = z.object({
  text: z.string().trim().min(1, 'Option text is required'),
  isCorrect: z.boolean(),
  order: z.number().int().min(0),
})

const baseSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  title: z.string().trim().min(1, 'Title is required').max(300),
  body: z.string().trim().min(1, 'Question body is required'),
  difficulty: z.enum(DIFFICULTIES).default('MEDIUM'),
  marks: z.number().int().min(1, 'Marks must be at least 1').max(1000),
  negativeMarks: z.number().min(0, 'Negative marks cannot be below 0').max(1000).default(0),
  explanation: z.string().trim().max(5000).optional(),
  tagIds: z.array(z.string()).max(30).default([]),
  options: z.array(optionSchema).max(26).default([]),
  // Plan 021 — one topic + ≥1 skill under it. Optional in the shape so the
  // bulk importer can create untagged questions (they go to the backfill
  // queue); the create/edit routes require them.
  topicId: z.string().min(1).nullish(),
  skillIds: z.array(z.string().min(1)).max(15).default([]),
  // Plan 026 — open for student self-practice (answer becomes visible to students).
  practiceEnabled: z.boolean().default(false),
})

/**
 * Cross-field rules that a flat schema cannot express, applied per type.
 */
export const questionInputSchema = baseSchema.superRefine((q, ctx) => {
  const correct = q.options.filter((o) => o.isCorrect).length

  if (q.topicId && q.skillIds.length === 0)
    ctx.addIssue({ code: 'custom', message: 'Pick at least one skill for the topic', path: ['skillIds'] })
  if (!q.topicId && q.skillIds.length > 0)
    ctx.addIssue({ code: 'custom', message: 'Choose a topic for these skills', path: ['topicId'] })

  switch (q.type) {
    case 'MCQ_SINGLE':
      if (q.options.length < 2)
        ctx.addIssue({ code: 'custom', message: 'Add at least two options', path: ['options'] })
      if (correct !== 1)
        ctx.addIssue({ code: 'custom', message: 'Mark exactly one option correct', path: ['options'] })
      break

    case 'MCQ_MULTI':
      if (q.options.length < 2)
        ctx.addIssue({ code: 'custom', message: 'Add at least two options', path: ['options'] })
      if (correct < 1)
        ctx.addIssue({ code: 'custom', message: 'Mark at least one option correct', path: ['options'] })
      break

    case 'TRUE_FALSE':
      if (q.options.length !== 2)
        ctx.addIssue({ code: 'custom', message: 'True/False needs exactly two options', path: ['options'] })
      if (correct !== 1)
        ctx.addIssue({ code: 'custom', message: 'Mark exactly one option correct', path: ['options'] })
      break

    case 'SUBJECTIVE':
    case 'CODING':
      // No predefined options; graded manually (SUBJECTIVE) or by Judge0 (CODING, Plan 014).
      if (q.options.length > 0)
        ctx.addIssue({ code: 'custom', message: 'This question type does not take options', path: ['options'] })
      break
  }
})

export type QuestionInput = z.infer<typeof questionInputSchema>

/** PATCH: same rules, but every field optional at the top level. */
export const questionUpdateSchema = questionInputSchema

export const tagInputSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(60),
  category: z.string().trim().max(40).optional(),
})
