/**
 * Plan 019 Phase 3 — one source of truth for how enum values read on screen.
 */

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  MCQ_SINGLE: 'Single choice',
  MCQ_MULTI: 'Multiple choice',
  TRUE_FALSE: 'True / false',
  SUBJECTIVE: 'Subjective',
  CODING: 'Coding',
}

export const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
}

export const ASSESSMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}

export function labelOf(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replace(/_/g, ' ').toLowerCase()
}
