import type { UserRole } from '@prisma/client'

/**
 * Plan 006 — the authenticated caller.
 *
 * Assembled from a verified Firebase session cookie plus the matching `User`
 * row in Postgres. `firebaseUid` comes from Firebase; everything else is the
 * app-level record.
 *
 * Role checks and organization scoping are added in Plan 007.
 */
export interface CurrentUser {
  /** SelectIQ `User.id` (cuid). */
  id: string
  /** Null for phone-OTP-only accounts. */
  email: string | null
  /** E.164 format. Null for OAuth-only accounts. */
  phone: string | null
  name: string | null
  avatarUrl: string | null
  role: UserRole
  /** Firebase Auth uid — the join key to `User.firebaseUid`. */
  firebaseUid: string
}
