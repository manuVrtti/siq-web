/**
 * Plan 007 — permission constants.
 *
 * Permissions describe actions, not screens. A route or component asks "may
 * this user create an assessment?", never "is this user a CollegeAdmin?" —
 * that way adding a role later means editing one mapping table rather than
 * hunting for every role comparison in the codebase.
 */
export const PERMISSIONS = {
  // User management
  MANAGE_ALL_USERS: 'manage_all_users',
  MANAGE_ORG_USERS: 'manage_org_users',

  // Organization
  MANAGE_ALL_ORGS: 'manage_all_orgs',
  MANAGE_OWN_ORG: 'manage_own_org',
  VIEW_OWN_ORG: 'view_own_org',

  // Assessments
  CREATE_ASSESSMENT: 'create_assessment',
  EDIT_ASSESSMENT: 'edit_assessment',
  VIEW_ASSESSMENT: 'view_assessment',
  TAKE_ASSESSMENT: 'take_assessment',

  // Results
  VIEW_ALL_RESULTS: 'view_all_results',
  VIEW_ORG_RESULTS: 'view_org_results',
  VIEW_OWN_RESULTS: 'view_own_results',

  // Platform
  VIEW_PLATFORM_ANALYTICS: 'view_platform_analytics',
  MANAGE_PLATFORM_SETTINGS: 'manage_platform_settings',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
