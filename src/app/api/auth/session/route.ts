import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  createSessionCookie,
  getSessionCookie,
  verifySessionCookie,
} from '@/lib/auth/session'
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
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    }

    // Verifies the token and enforces the recent-sign-in window.
    const sessionCookie = await createSessionCookie(idToken)

    // Safe to decode now that the token has been verified above.
    const decoded = await getAdminAuth().verifyIdToken(idToken)

    // Firebase is the identity source; Postgres is the app-level record.
    // Email/name/avatar are refreshed on every login so a changed Google
    // profile does not go stale here.
    const user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {
        lastLoginAt: new Date(),
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        avatarUrl: decoded.picture ?? null,
      },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        avatarUrl: decoded.picture ?? null,
        lastLoginAt: new Date(),
        // Role is never taken from the client. Elevation happens in Plan 007.
        role: 'STUDENT',
      },
    })

    const store = await cookies()
    store.set(SESSION_COOKIE_NAME, sessionCookie, {
      ...cookieOptions(),
      maxAge: SESSION_MAX_AGE_MS / 1000,
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    })
  } catch (error) {
    // Never echo the error: it can contain the token or admin credentials.
    console.error('[auth/session] POST failed:', error)

    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[auth/session] DELETE failed:', error)

    return NextResponse.json({ error: 'Sign out failed' }, { status: 500 })
  }
}
