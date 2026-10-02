import { z } from 'zod'

/**
 * Plan 012 — assessment validation.
 */

export const SCORING_POLICIES = ['STANDARD', 'NEGATIVE_MARKING'] as const

export const assessmentInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().trim().max(5000).optional(),
  durationMinutes: z.number().int().min(1, 'Duration must be at least 1 minute').max(1440),
  scoringPolicy: z.enum(SCORING_POLICIES).default('STANDARD'),
  maxAttempts: z.number().int().min(1).max(100).default(1),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  passingScore: z.number().min(0).max(100000).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  // Plan 018 — proctoring config. All optional so existing PATCH callers keep
  // working; when omitted, the server keeps the current values (partial updates).
  proctoringEnabled: z.boolean().optional(),
  snapshotIntervalSec: z.number().int().min(5).max(300).optional(),
  storeSnapshots: z.boolean().optional(),
  faceMatchThreshold: z.number().min(0).max(1).optional(),
  // Plan 021 — counts toward students' strengths & weaknesses.
  countsForAnalytics: z.boolean().optional(),
})

export type AssessmentInput = z.infer<typeof assessmentInputSchema>

export const sectionInputSchema = z.object({
  title: z.string().trim().min(1, 'Section title is required').max(200),
  description: z.string().trim().max(2000).optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
})

export const autoAssembleSchema = z.object({
  count: z.number().int().min(1).max(100),
  type: z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SUBJECTIVE', 'CODING']).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  tagId: z.string().optional(),
})
export type AutoAssembleCriteria = z.infer<typeof autoAssembleSchema>

/**
 * Whether an assessment is complete enough to publish. Returned as a list of
 * blocking reasons rather than a boolean, so the UI can show a checklist.
 */
export function publishBlockers(a: {
  durationMinutes: number
  startAt: Date | null
  endAt: Date | null
  sections: { questions: unknown[] }[]
}): string[] {
  const reasons: string[] = []

  if (a.durationMinutes <= 0) reasons.push('Duration must be greater than zero')

  const totalQuestions = a.sections.reduce((n, s) => n + s.questions.length, 0)
  if (a.sections.length === 0) reasons.push('Add at least one section')
  if (totalQuestions === 0) reasons.push('Add at least one question')

  if (a.startAt && a.endAt && a.endAt <= a.startAt) {
    reasons.push('End time must be after the start time')
  }

  return reasons
}
