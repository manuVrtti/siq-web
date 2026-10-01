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

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  COLLEGE_ADMIN: 'College admin',
  COLLEGE_HOD: 'College HOD',
  RECRUITER: 'Recruiter',
  STUDENT: 'Student',
}

/** The five roles, most to least privileged — for pickers and filters. */
export const ROLES = ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'STUDENT'] as const

export function labelOf(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replace(/_/g, ' ').toLowerCase()
}
