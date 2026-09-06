import { cookies } from 'next/headers'
import { type NextRequest } from 'next/server'

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  createSessionCookie,
  getSessionCookie,
  verifySessionCookie,
} from '@/lib/auth/session'
import { errorResponse, successResponse } from '@/lib/api-response'
import { AppError, AuthError, ValidationError } from '@/lib/errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'

/**
 * Plan 004 — session endpoints.
 *
 *   POST   exchange a Firebase ID token for a session cookie, upsert the user
 *   DELETE clear the cookie and revoke the user's refresh tokens
 */

export const dynamic = 'force-dynamic'

/** Cookie flags shared by set and clear, so they cannot drift apart. */
function cookieOptions() {
  return {
    httpOnly: true,
    // Allowed over plain HTTP in dev only; always secure in production.
    secure: process.env.NODE_ENV === 'production',
    // `lax` still sends the cookie on top-level navigation back from the OAuth
    // provider, while blocking cross-site POSTs.
    sameSite: 'lax' as const,
    path: '/',
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const idToken = body?.idToken

    if (typeof idToken !== 'string' || !idToken) {
      throw new ValidationError('Missing idToken')
    }

    // Verifies the token and enforces the recent-sign-in window.
    const sessionCookie = await createSessionCookie(idToken)

    // Safe to decode now that the token has been verified above.
    const decoded = await getAdminAuth().verifyIdToken(idToken)

    // Firebase is the identity source; Postgres is the app-level record.
    // Email/name/avatar are refreshed on every login so a changed Google
    // profile does not go stale here.
    //
    // Three cases (Plan 013 added the middle one):
    //
    //   1. Existing user matched by firebaseUid → normal login, refresh fields.
    //   2. No firebaseUid match, but a pre-provisioned row exists with the same
    //      verified email → CLAIM it. This is how a college-imported student
    //      lands in their own row instead of getting a unique-email conflict
    //      on `create`. Only claimed when Firebase reports email_verified
    //      (Google always does; GitHub does not guarantee it), or someone could
    //      register an unverified account with a student's address and inherit
    //      their college memberships.
    //   3. Neither → create a fresh row with no org access.
    let user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } })

    if (!user && decoded.email && decoded.email_verified) {
      const pending = await prisma.user.findUnique({ where: { email: decoded.email } })
      // Only claim a row that hasn't been claimed yet (the `pending:` prefix
      // means "created by an import, never signed in"). A real user's row is
      // never overwritten by an email match.
      if (pending && pending.firebaseUid.startsWith('pending:')) {
        user = await prisma.user.update({
          where: { id: pending.id },
          data: {
            firebaseUid: decoded.uid,
            name: pending.name ?? decoded.name ?? null,
            avatarUrl: decoded.picture ?? null,
            lastLoginAt: new Date(),
          },
        })
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: decoded.uid,
          email: decoded.email ?? null,
          name: decoded.name ?? null,
          avatarUrl: decoded.picture ?? null,
          lastLoginAt: new Date(),
          // Role is never taken from the client. Elevation happens in Plan 007.
          role: 'STUDENT',
        },
      })
    } else if (!user.firebaseUid.startsWith('pending:')) {
      // Already-claimed row: refresh mutable identity fields.
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          email: decoded.email ?? user.email,
          name: decoded.name ?? user.name,
          avatarUrl: decoded.picture ?? user.avatarUrl,
        },
      })
    }

    const store = await cookies()
    store.set(SESSION_COOKIE_NAME, sessionCookie, {
      ...cookieOptions(),
      maxAge: SESSION_MAX_AGE_MS / 1000,
    })

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    })
  } catch (error) {
    // Never echo the raw error: it can contain the token or admin credentials.
    console.error('[auth/session] POST failed:', error)

    // Our own errors already carry a safe message and the right status — a
    // malformed request is a 400, not a 401. Anything else (a Firebase
    // rejection, a Prisma failure) collapses to a generic 401 so the client
    // learns nothing about why verification failed.
    return errorResponse(
      error instanceof AppError ? error : new AuthError('Authentication failed'),
    )
  }
}

export async function DELETE() {
  try {
    const cookie = await getSessionCookie()

    // Revoke refresh tokens so the session dies on every device, not just this
    // browser. Best-effort: an already-invalid cookie should still clear.
    if (cookie) {
      try {
        const decoded = await verifySessionCookie(cookie, false)
        await getAdminAuth().revokeRefreshTokens(decoded.sub)
      } catch {
        // Already expired or revoked — nothing to revoke.
      }
    }

    const store = await cookies()
    store.set(SESSION_COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 })

    return successResponse({ signedOut: true })
  } catch (error) {
    console.error('[auth/session] DELETE failed:', error)

    return errorResponse(error)
  }
}
