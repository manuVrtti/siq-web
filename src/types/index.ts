import type { UserRole } from '@prisma/client'

/**
 * Application role, re-exported from the Prisma enum so the schema stays the
 * single source of truth — adding a role to `prisma/schema.prisma` widens this
 * type automatically after `npm run db:generate`.
 */
export type { UserRole }

/**
 * The authenticated caller, assembled from a verified Firebase ID token plus
 * the matching `User` row read with Prisma.
 *
 * `uid` comes from Firebase; everything else comes from Postgres.
 */
export interface AuthUser {
  /** Firebase Auth uid — the join key to `User.firebaseUid`. */
  uid: string
  /** SelectIQ `User.id` (cuid). Null before the row is provisioned. */
  id: string | null
  /** Null for phone-OTP-only accounts. */
  email: string | null
  /** E.164 format. Null for OAuth-only accounts. */
  phone: string | null
  name: string | null
  avatarUrl: string | null
  role: UserRole
}
