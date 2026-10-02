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

/** Plain-language audit actions, shared by every console view. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'org.create': 'created an organization',
  'org.update': 'updated an organization',
  'user.role.change': 'changed a role',
  'user.suspend': 'suspended an account',
  'user.reactivate': 'reactivated an account',
  'superadmin.grant': 'granted Super Admin',
  'staff.add': 'added college staff',
  'staff.update': 'changed college staff',
  'staff.remove': 'removed college staff',
  'department.create': 'created a department',
  'department.update': 'renamed a department',
  'department.delete': 'deleted a department',
  'department.heads': 'changed a department’s HODs',
  'assessment.publish': 'published a test',
  'result.grade': 'graded a result',
  'import.candidates': 'imported candidates',
  'import.questions': 'imported questions',
  'batch.delete': 'deleted a batch',
  'candidate.update': 'edited a candidate',
  'candidate.remove': 'removed candidates',
  'candidate.credentials': 'set up password sign-in',
  'candidate.department': 'moved students between departments',
  'org.suspend': 'suspended an organization',
  'org.reactivate': 'reactivated an organization',
  'org.member.add': 'added an org member',
  'org.member.remove': 'removed an org member',
  'announcement.create': 'posted an announcement',
  'announcement.deactivate': 'deactivated an announcement',
  'announcement.reactivate': 'restored an announcement',
}

export function labelOf(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replace(/_/g, ' ').toLowerCase()
}
