import 'server-only'

import { cookies } from 'next/headers'
import type { DecodedIdToken } from 'firebase-admin/auth'

import { getAdminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/types'

/**
 * Plan 004 — server-side session management.
 *
 * Auth state lives in an HTTP-only cookie, not in localStorage. A Firebase ID
 * token is short-lived and would have to be refreshed and stored client-side;
 * a Firebase *session cookie* can be verified server-side on every request and
 * is unreachable from JavaScript, so an XSS bug cannot exfiltrate it.
 *
 * `server-only` makes importing this from a client component a build error.
 */

/** Firebase convention. Also the only cookie name Firebase Hosting forwards. */
export const SESSION_COOKIE_NAME = '__session'

/** 5 days, per plan 004. Firebase allows 5 minutes to 2 weeks. */
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000

/**
 * How recently the user must have actually authenticated for us to mint a
 * session cookie. Without this, a stolen but still-valid ID token could be
 * exchanged for a 5-day session long after it was issued.
 */
const MAX_ID_TOKEN_AGE_MS = 5 * 60 * 1000

/**
 * Exchanges a freshly minted Firebase ID token for a session cookie.
 *
 * @throws if the token is invalid, or if the user signed in too long ago.
 */
export async function createSessionCookie(idToken: string): Promise<string> {
  if (!idToken) throw new Error('Missing ID token')

  const decoded = await getAdminAuth().verifyIdToken(idToken, true)

  // `auth_time` is when the user actually proved identity, not when the token
  // was issued — a refreshed token keeps the original auth_time.
  const authAgeMs = Date.now() - decoded.auth_time * 1000
  if (authAgeMs > MAX_ID_TOKEN_AGE_MS) {
    throw new Error('Recent sign-in required')
  }

  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  })
}

/**
 * Verifies a session cookie.
 *
 * `checkRevoked` costs a round trip to Firebase but means signing out on one
 * device invalidates the session everywhere, which is the behaviour a
 * proctored-exam product needs.
 */
export async function verifySessionCookie(
  cookie: string,
  checkRevoked = true,
): Promise<DecodedIdToken> {
  return getAdminAuth().verifySessionCookie(cookie, checkRevoked)
}

/** Reads the raw session cookie, if present. */
export async function getSessionCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(SESSION_COOKIE_NAME)?.value
}

/**
 * Resolves the current user: cookie → Firebase claims → Postgres row.
 *
 * Returns null rather than throwing, so pages can branch on "not signed in"
 * without try/catch. An invalid or expired cookie is indistinguishable from
 * no cookie here, which is what callers want.
 *
 * Plan 006 supersedes this with a fuller `getCurrentUser` plus route
 * protection; this is the minimum needed to prove the round trip works.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const cookie = await getSessionCookie()
  if (!cookie) return null

  try {
    const decoded = await verifySessionCookie(cookie)

    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    })
    if (!user) return null

    return {
      uid: decoded.uid,
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    }
  } catch {
    // Expired, revoked or malformed — treat as signed out.
    return null
  }
}
