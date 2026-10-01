import 'server-only'

import { randomBytes, randomInt } from 'node:crypto'

import { studentWhere, type Scope } from '@/lib/auth/scope'
import { ValidationError } from '@/lib/errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'

/**
 * Password sign-in for college-added students.
 *
 * Two modes, chosen by the college per run:
 *   temp  — SelectIQ creates the Firebase login with a generated password
 *           and a `mustChangePassword` custom claim. The passwords are
 *           returned ONCE to the caller (for the download sheet) and never
 *           stored or logged. The student must replace it on first sign-in.
 *   email — SelectIQ creates the login with an unguessable throwaway
 *           password, then Firebase emails the student a set-password link.
 *           Nobody but the student ever knows the password.
 *
 * Either way the SelectIQ row stays `pending:` until the student's first
 * sign-in, where /api/auth/session claims it by verified email exactly like
 * a Google sign-in. emailVerified is set because the college vouched for
 * the address (and only that inbox / the college's sheet unlocks it).
 *
 * Only never-signed-in students with an email are eligible; students who
 * already sign in (Google/GitHub/password) keep their method and can use
 * "Forgot password" to add one.
 */

export type CredentialMode = 'temp' | 'email'
export const MAX_CREDENTIALS_PER_CALL = 100

export type CredentialRow = { userId: string; name: string | null; email: string; password?: string }
export type SkipReason = 'no-email' | 'already-signed-in' | 'failed'
export type CredentialResult = {
  done: CredentialRow[]
  skipped: { userId: string; label: string; reason: SkipReason }[]
}

/* Unambiguous alphabet: no 0/O, 1/l/I. 12 chars ≈ 59 bits. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export function generateTempPassword(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`
}

/** Policy for passwords a student chooses. */
export function validateNewPassword(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters'
  if (pw.length > 128) return 'Use at most 128 characters'
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use at least one letter and one number'
  return null
}

async function sendSetPasswordEmail(email: string, continueUrl: string) {
  // Admin SDK can only *generate* links; Firebase's own mailer is reached via
  // the Identity Toolkit REST endpoint with the (public) web API key.
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!key) throw new Error('Firebase web API key is not configured')
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'PASSWORD_RESET', email, continueUrl }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? `sendOobCode ${res.status}`)
  }
}

async function provisionOne(
  u: { id: string; name: string | null; email: string },
  mode: CredentialMode,
  continueUrl: string,
): Promise<CredentialRow> {
  const auth = getAdminAuth()
  const password = mode === 'temp' ? generateTempPassword() : randomBytes(24).toString('base64url')

  let uid: string
  try {
    const existing = await auth.getUserByEmail(u.email)
    uid = existing.uid
    // Only temp mode overwrites a password; email mode leaves any existing
    // credential alone and just sends the link.
    await auth.updateUser(uid, mode === 'temp' ? { password, emailVerified: true } : { emailVerified: true })
    if (mode === 'temp') await auth.setCustomUserClaims(uid, { ...(existing.customClaims ?? {}), mustChangePassword: true })
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/user-not-found') throw e
    const created = await auth.createUser({
      email: u.email,
      password,
      emailVerified: true,
      displayName: u.name ?? undefined,
    })
    uid = created.uid
    if (mode === 'temp') await auth.setCustomUserClaims(uid, { mustChangePassword: true })
  }

  if (mode === 'email') await sendSetPasswordEmail(u.email, continueUrl)
  return { userId: u.id, name: u.name, email: u.email, ...(mode === 'temp' ? { password } : {}) }
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        try {
          out[i] = { status: 'fulfilled', value: await fn(items[i]!) }
        } catch (reason) {
          out[i] = { status: 'rejected', reason }
        }
      }
    }),
  )
  return out
}

export async function provisionPasswordLogins(
  scope: Scope,
  rawUserIds: string[],
  mode: CredentialMode,
  continueUrl: string,
): Promise<CredentialResult> {
  const userIds = [...new Set(rawUserIds)]
  if (userIds.length === 0) return { done: [], skipped: [] }
  if (userIds.length > MAX_CREDENTIALS_PER_CALL) {
    throw new ValidationError(`Set up at most ${MAX_CREDENTIALS_PER_CALL} candidates per request`)
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, ...studentWhere(scope) },
    select: { id: true, name: true, email: true, phone: true, firebaseUid: true },
  })
  if (users.length !== userIds.length) {
    throw new ValidationError(
      scope.all ? 'One or more candidates are not on this college’s roster' : 'One or more candidates are outside your department',
    )
  }

  const result: CredentialResult = { done: [], skipped: [] }
  const eligible: { id: string; name: string | null; email: string }[] = []
  for (const u of users) {
    const label = u.name ?? u.email ?? u.phone ?? u.id
    if (!u.firebaseUid.startsWith('pending:')) result.skipped.push({ userId: u.id, label, reason: 'already-signed-in' })
    else if (!u.email) result.skipped.push({ userId: u.id, label, reason: 'no-email' })
    else eligible.push({ id: u.id, name: u.name, email: u.email })
  }

  const settled = await pool(eligible, 6, (u) => provisionOne(u, mode, continueUrl))
  settled.forEach((s, i) => {
    const u = eligible[i]!
    if (s.status === 'fulfilled') result.done.push(s.value)
    else {
      // Firebase error codes only — never the password or the full error.
      console.error('[credentials] provision failed', (s.reason as { code?: string })?.code ?? 'unknown')
      result.skipped.push({ userId: u.id, label: u.name ?? u.email, reason: 'failed' })
    }
  })
  return result
}

/**
 * Replace a temporary password. Clears the claim and revokes refresh
 * tokens, so the caller must sign in again with the new password (the
 * client does that immediately) and old sessions die everywhere.
 */
export async function completePasswordChange(uid: string, newPassword: string) {
  const problem = validateNewPassword(newPassword)
  if (problem) throw new ValidationError(problem)
  const auth = getAdminAuth()
  const fbUser = await auth.getUser(uid)
  const { mustChangePassword: _drop, ...rest } = (fbUser.customClaims ?? {}) as Record<string, unknown>
  void _drop
  await auth.updateUser(uid, { password: newPassword })
  await auth.setCustomUserClaims(uid, rest)
  await auth.revokeRefreshTokens(uid)
}
