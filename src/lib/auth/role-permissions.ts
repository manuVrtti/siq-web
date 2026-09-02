import type { UserRole } from '@prisma/client'

import { PERMISSIONS, type Permission } from '@/constants/permissions'

/**
 * Plan 007 — role to permission mapping.
 *
 * Static and hardcoded, not database-driven. The permission model will keep
 * moving for a while, and a table would mean a migration for every change plus
 * a query on every check. Revisit when the model settles.
 *
 * Roles are NOT hierarchical — each lists its permissions explicitly. A
 * COLLEGE_ADMIN is not "a STUDENT plus more"; giving admins TAKE_ASSESSMENT by
 * accident is exactly the kind of bug inheritance hides.
 *
 * `satisfies` keeps this exhaustive: adding a role to the Prisma enum without
 * adding it here is a compile error, not a silent deny.
 */
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: Object.values(PERMISSIONS),

  COLLEGE_ADMIN: [
    PERMISSIONS.MANAGE_ORG_USERS,
    PERMISSIONS.MANAGE_OWN_ORG,
    PERMISSIONS.VIEW_OWN_ORG,
    PERMISSIONS.CREATE_ASSESSMENT,
    PERMISSIONS.EDIT_ASSESSMENT,
    PERMISSIONS.VIEW_ASSESSMENT,
    PERMISSIONS.VIEW_ORG_RESULTS,
  ],

  RECRUITER: [
    PERMISSIONS.MANAGE_ORG_USERS,
    PERMISSIONS.VIEW_OWN_ORG,
    PERMISSIONS.CREATE_ASSESSMENT,
    PERMISSIONS.EDIT_ASSESSMENT,
    PERMISSIONS.VIEW_ASSESSMENT,
    PERMISSIONS.VIEW_ORG_RESULTS,
  ],

  STUDENT: [
    PERMISSIONS.VIEW_OWN_ORG,
    PERMISSIONS.VIEW_ASSESSMENT,
    PERMISSIONS.TAKE_ASSESSMENT,
    PERMISSIONS.VIEW_OWN_RESULTS,
  ],
} satisfies Record<UserRole, readonly Permission[]>
