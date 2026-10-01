import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope } from '@/lib/auth/scope'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { deleteBatch } from '@/services/candidates'
import { audit } from '@/services/audit'

/**
 * Delete a batch. Only the grouping goes — candidates, their assignments and
 * results are untouched (BatchMember rows cascade). Org derived from the row.
 */

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const user = await withRole(MANAGER_ROLES)
    const batch = await prisma.batch.findUnique({ where: { id }, select: { orgId: true } })
    if (!batch) throw new NotFoundError('Batch not found')
    const scope = await getScope(user, batch.orgId)
    await deleteBatch(scope, id)
    await audit({ userId: user.id, action: 'batch.delete', entityType: 'Batch', entityId: id, metadata: { orgId: batch.orgId } })
    return successResponse({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
}
