import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { audit } from '@/services/audit'
import { setOrganizationStatus } from '@/services/console'

/**
 * POST { reason? } pauses an organization (every member loses access at
 * once, nothing is deleted); DELETE reactivates. SUPER_ADMIN only, audited.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    const body = await request.json().catch(() => null)
    const reason = typeof body?.reason === 'string' ? body.reason : null
    await setOrganizationStatus(actor, id, 'SUSPENDED', reason)
    await audit({ userId: actor.id, action: 'org.suspend', entityType: 'Organization', entityId: id, metadata: { orgId: id, hasReason: Boolean(reason) } })
    return successResponse({ status: 'SUSPENDED' })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await withRole(['SUPER_ADMIN'])
    const { id } = await ctx.params
    await setOrganizationStatus(actor, id, 'ACTIVE', null)
    await audit({ userId: actor.id, action: 'org.reactivate', entityType: 'Organization', entityId: id, metadata: { orgId: id } })
    return successResponse({ status: 'ACTIVE' })
  } catch (error) {
    return errorResponse(error)
  }
}
