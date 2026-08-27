import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth'

import { config } from '@/lib/config'

/**
 * Firebase Admin SDK — SERVER-SIDE ONLY.
 *
 * ⚠️  Never import this module from a client component. It reads
 *     FIREBASE_ADMIN_PRIVATE_KEY, which must never reach the browser.
 *     `config.firebase.admin` throws if evaluated in a browser context.
 *
 * Responsibilities (authentication only):
 *   - verify Firebase ID tokens on incoming requests
 *   - mint custom tokens after MSG91 phone-OTP verification
 *
 * App-level data (roles, profiles, permissions) lives in Postgres and is read
 * with Prisma, keyed on the decoded token's `uid`.
 */

function getAdminApp(): App {
  if (getApps().length) return getApp()

  // Throws a named-variable error if the admin credentials are unset.
  const { projectId, clientEmail, privateKey } = config.firebase.admin

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

/**
 * Verifies a Firebase ID token sent by the client.
 *
 * Every authenticated API route must call this before touching data.
 * Throws if the token is missing, malformed, expired or revoked — never log
 * the token itself.
 *
 * @param idToken Raw ID token (the value after "Bearer " in the Authorization header).
 * @param checkRevoked Also verify the token has not been revoked (extra round trip).
 */
export async function verifyFirebaseToken(
  idToken: string,
  checkRevoked = false,
): Promise<DecodedIdToken> {
  if (!idToken) throw new Error('Missing Firebase ID token')

  return getAdminAuth().verifyIdToken(idToken, checkRevoked)
}

/**
 * Mints a Firebase custom token for a uid.
 *
 * Used by the phone-OTP flow: MSG91 verifies the OTP server-side, then this
 * token is handed to the client, which calls `signInWithCustomToken` to
 * establish a normal Firebase session.
 *
 * @param uid Stable user identifier (for phone sign-in, the E.164 phone number).
 * @param claims Optional additional claims embedded in the resulting ID token.
 */
export async function createCustomToken(
  uid: string,
  claims?: Record<string, unknown>,
): Promise<string> {
  if (!uid) throw new Error('Missing uid for custom token')

  return getAdminAuth().createCustomToken(uid, claims)
}
