import 'server-only'

import { cache } from 'react'
import { cookies, headers } from 'next/headers'

import { DEV_USER_COOKIE, devBypassEnabled, isLocalHost } from '@/lib/auth/dev-bypass'
import { getSessionCookie, verifySessionCookie } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import type { CurrentUser } from '@/types/auth'

/**
 * Plan 006 — resolve the authenticated caller.
 *
 * The proxy only checks that a session cookie exists; it deliberately does not
 * verify it or touch the database, so static assets and page transitions stay
 * cheap. This is where the real work happens: verify the cookie with Firebase,
 * then load the app-level row from Postgres.
 *
 * Wrapped in React `cache()` so a single request that calls this from a layout,
 * a page and a couple of components pays for one verification and one query,
 * not four.
 *
 * Returns null rather than throwing — callers branch on "signed out" without
 * try/catch. Use `requireAuth()` in API routes where null should be a 401.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // LOCAL DEV ONLY — see lib/auth/dev-bypass.ts. Inert in production builds.
  if (devBypassEnabled()) {
    const devId = (await cookies()).get(DEV_USER_COOKIE)?.value
    if (devId && isLocalHost((await headers()).get('host'))) {
      const u = await prisma.user.findUnique({ where: { id: devId } })
      if (u) {
        return { id: u.id, email: u.email, phone: u.phone, name: u.name, avatarUrl: u.avatarUrl, role: u.role, firebaseUid: u.firebaseUid, onboarded: u.onboardedAt !== null }
      }
    }
  }

  const cookie = await getSessionCookie()
  if (!cookie) return null

  try {
    const decoded = await verifySessionCookie(cookie)

    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    })

    // A valid cookie with no row means the user was deleted from Postgres
    // while their session was still live. Treat as signed out.
    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      firebaseUid: user.firebaseUid,
      mustChangePassword: decoded.mustChangePassword === true,
      onboarded: user.onboardedAt !== null,
    }
  } catch {
    // Expired, revoked or malformed cookie — indistinguishable from signed out.
    return null
  }
})
