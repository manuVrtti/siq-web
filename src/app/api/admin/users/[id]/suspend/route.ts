import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { audit } from '@/services/audit'
import { reactivateUser, suspendUser } from '@/services/people'

/**
 * POST { reason? } suspends (sign-in blocked, every session killed now);
 * DELETE reactivates. Super Admin only, audited.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    const body = await request.json().catch(() => null)
    const reason = typeof body?.reason === 'string' ? body.reason : null
    await suspendUser(actor, id, reason)
    await audit({ userId: actor.id, action: 'user.suspend', entityType: 'User', entityId: id, metadata: { hasReason: Boolean(reason) } })
    return successResponse({ suspended: true })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    await reactivateUser(actor, id)
    await audit({ userId: actor.id, action: 'user.reactivate', entityType: 'User', entityId: id })
    return successResponse({ suspended: false })
  } catch (error) {
    return errorResponse(error)
  }
}
