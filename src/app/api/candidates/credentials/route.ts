import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope } from '@/lib/auth/scope'
import { ValidationError } from '@/lib/errors'
import { audit } from '@/services/audit'
import { provisionPasswordLogins, type CredentialMode } from '@/services/credentials'

/**
 * Set up password sign-in for candidates. Body: { orgId, userIds, mode }.
 * In `temp` mode the response carries the generated passwords — the only
 * time they exist outside Firebase — so it must never be cached.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await withRole(MANAGER_ROLES)
    const body = await request.json().catch(() => null)
    const { orgId, userIds, mode } = (body ?? {}) as { orgId?: unknown; userIds?: unknown; mode?: unknown }
    if (typeof orgId !== 'string' || !orgId) throw new ValidationError('orgId is required')
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.some((x) => typeof x !== 'string')) {
      throw new ValidationError('userIds must be a non-empty array of ids')
    }
    if (mode !== 'temp' && mode !== 'email') throw new ValidationError('mode must be "temp" or "email"')
    const scope = await getScope(user, orgId)

    const result = await provisionPasswordLogins(
      scope,
      userIds as string[],
      mode as CredentialMode,
      `${request.nextUrl.origin}/login`,
    )
    await audit({
      userId: user.id,
      action: 'candidate.credentials',
      entityType: 'User',
      entityId: null,
      // Counts only — never passwords.
      metadata: { orgId, mode: mode as string, done: result.done.length, skipped: result.skipped.length },
    })

    const res = successResponse(result)
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    return errorResponse(error)
  }
}
